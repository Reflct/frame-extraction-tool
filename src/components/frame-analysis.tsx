'use client';

import { useCallback, useEffect, useRef, useState, useLayoutEffect } from 'react';
import { BarChart, Bar, YAxis, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import { type FrameData, type FrameMetadata } from '@/types/frame';
import Image from 'next/image';
import { FramePreviewDialog } from './frame-preview-dialog';
import { frameStorage } from '@/lib/frameStorage';
import { ChartTooltip } from './chart-tooltip';

interface FrameAnalysisProps {
  frames: FrameData[];
  selectedFrames: Set<string>;
  onFrameSelectAction: (frameId: string) => void;
  showImageGrid?: boolean;
}

interface ChartMouseMoveState {
  activePayload?: Array<{ 
    payload: { 
      x: number;
      y: number;
      frame: FrameData;
    }
  }>;
  chartX?: number;
  chartY?: number;
}

export function FrameAnalysis({
  frames,
  selectedFrames,
  onFrameSelectAction,
  showImageGrid = true,
}: FrameAnalysisProps) {
  const [selectedFrame, setSelectedFrame] = useState<FrameData | null>(null);
  const [hoveredFrame, setHoveredFrame] = useState<FrameData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [frameData, setFrameData] = useState<Record<string, Uint8Array>>({});
  const convertingRef = useRef<Record<string, boolean>>({});
  const [thumbnailUrls, setThumbnailUrls] = useState<Map<string, string>>(new Map());
  const loadingThumbnails = useRef<Set<string>>(new Set());
  const chartRef = useRef<HTMLDivElement>(null);
  const chartRectRef = useRef<DOMRect | null>(null);

  // Load thumbnails when frames change
  useEffect(() => {
    const newUrls = new Map<string, string>(thumbnailUrls);
    
    // Cleanup URLs for frames that no longer exist
    for (const [id, url] of thumbnailUrls.entries()) {
      if (!frames.some(frame => frame.id === id)) {
        URL.revokeObjectURL(url);
        newUrls.delete(id);
      }
    }

    // Load missing thumbnails
    async function loadMissingThumbnails() {
      const missingFrames = frames.filter(frame => !newUrls.has(frame.id));
      
      for (const frame of missingFrames) {
        if (loadingThumbnails.current.has(frame.id)) continue;
        
        try {
          loadingThumbnails.current.add(frame.id);
          const thumbnail = await frameStorage.getFrameThumbnail(frame.id);
          if (thumbnail) {
            const url = URL.createObjectURL(thumbnail);
            newUrls.set(frame.id, url);
            setThumbnailUrls(new Map(newUrls));
          }
        } catch (error) {
          console.error(`Failed to load thumbnail for frame ${frame.id}:`, error);
        } finally {
          loadingThumbnails.current.delete(frame.id);
        }
      }
    }

    loadMissingThumbnails();

    return () => {
      // Only cleanup URLs for frames that no longer exist
      for (const [id, url] of thumbnailUrls.entries()) {
        if (!frames.some(frame => frame.id === id)) {
          URL.revokeObjectURL(url);
        }
      }
    };
  }, [frames, thumbnailUrls]);

  // Load thumbnail for hovered frame immediately
  useEffect(() => {
    if (!hoveredFrame?.id || thumbnailUrls.has(hoveredFrame.id)) return;

    const frameId = hoveredFrame.id; // Store id to avoid null checks

    async function loadHoveredThumbnail() {
      if (loadingThumbnails.current.has(frameId)) return;
      
      try {
        loadingThumbnails.current.add(frameId);
        const thumbnail = await frameStorage.getFrameThumbnail(frameId);
        if (thumbnail) {
          const url = URL.createObjectURL(thumbnail);
          setThumbnailUrls(prev => new Map(prev.set(frameId, url)));
        }
      } catch (error) {
        console.error(`Failed to load thumbnail for hovered frame ${frameId}:`, error);
      } finally {
        loadingThumbnails.current.delete(frameId);
      }
    }

    loadHoveredThumbnail();
  }, [hoveredFrame, thumbnailUrls]);

  // Get thumbnail URL for a frame
  const getThumbnailUrl = useCallback((frameId: string) => {
    return thumbnailUrls.get(frameId);
  }, [thumbnailUrls]);

  // Render frame thumbnail component
  const FrameThumbnail = useCallback(({ frame }: { frame: FrameData }) => {
    const url = getThumbnailUrl(frame.id);
    if (!url) return null;

    return (
      <div className="relative w-full h-full">
        <Image
          src={url}
          alt={`Frame ${frame.id}`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 16vw"
          priority={true}
        />
      </div>
    );
  }, [getThumbnailUrl]);

  // Convert Blob to Uint8Array
  const convertBlobToUint8Array = useCallback(async (frame: FrameMetadata): Promise<void> => {
    if (frameData[frame.name] || convertingRef.current[frame.name]) return;
    
    convertingRef.current[frame.name] = true;
    try {
      const blob = await frameStorage.getFrameBlob(frame.id);
      if (!blob) return;
      
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      setFrameData(prev => ({ ...prev, [frame.name]: uint8Array }));
    } finally {
      convertingRef.current[frame.name] = false;
    }
  }, [frameData]);

  // Navigation handlers
  const handleNext = useCallback((frame: FrameMetadata) => {
    const currentIndex = frames.findIndex(f => f.id === frame.id);
    if (currentIndex < frames.length - 1) {
      const nextFrame = frames[currentIndex + 1];
      setSelectedFrame(nextFrame);
    }
  }, [frames]);

  const handlePrevious = useCallback((frame: FrameMetadata) => {
    const currentIndex = frames.findIndex(f => f.id === frame.id);
    if (currentIndex > 0) {
      const prevFrame = frames[currentIndex - 1];
      setSelectedFrame(prevFrame);
    }
  }, [frames]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!hoveredFrame || !onFrameSelectAction) return;

      if (e.key.toLowerCase() === 'a') {
        e.preventDefault();
        onFrameSelectAction(hoveredFrame.id);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [hoveredFrame, onFrameSelectAction]);

  // Cache chart position
  useLayoutEffect(() => {
    const updateChartRect = () => {
      if (chartRef.current) {
        chartRectRef.current = chartRef.current.getBoundingClientRect();
      }
    };

    updateChartRect();
    window.addEventListener('resize', updateChartRect);
    window.addEventListener('scroll', updateChartRect);

    return () => {
      window.removeEventListener('resize', updateChartRect);
      window.removeEventListener('scroll', updateChartRect);
    };
  }, []);

  // Optimized mouse move handler
  const handleChartMouseMove = useCallback((state: ChartMouseMoveState) => {
    if (state?.activePayload?.[0]?.payload) {
      const { frame } = state.activePayload[0].payload;
      setHoveredFrame(frame);
      if (state.chartX && state.chartY && chartRectRef.current) {
        setTooltipPosition({
          x: chartRectRef.current.left + state.chartX,
          y: chartRectRef.current.top + state.chartY
        });
      }
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Frame Analysis</h3>
          <p className="text-sm text-[#111214]/35">
            {frames.length} frames analyzed
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              frames.forEach(frame => onFrameSelectAction(frame.id));
            }}
          >
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              Array.from(selectedFrames).forEach(frameId => onFrameSelectAction(frameId));
            }}
          >
            Deselect All
          </Button>
        </div>
      </div>

      {/* Histogram */}
      <div className="relative h-[300px] w-full overflow-hidden">
        <div 
          ref={chartRef}
          className="h-full overflow-x-auto"
          style={{ width: '100%' }}
        >
          <div style={{ 
            width: `${Math.max(frames.length * 8, 100)}px`,
            height: '100%'
          }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={frames.map((frame, index) => ({
                  x: index,
                  y: frame.sharpnessScore || 0,
                  frame
                }))}
                onMouseMove={handleChartMouseMove}
                onMouseLeave={() => {
                  setHoveredFrame(null);
                  setTooltipPosition(null);
                }}
                margin={{ left: 40 }}
              >
                <YAxis 
                  tickFormatter={(value) => value.toFixed(1)} 
                  width={40}
                  stroke="#9CA3AF"
                />
                <XAxis 
                  hide={true}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(0, 102, 255, 0.1)' }}
                  content={() => null}
                />
                <Bar 
                  dataKey="y" 
                  onClick={(data) => {
                    const frame = (data as unknown as { frame: FrameData }).frame;
                    if (frame) {
                      setSelectedFrame(frame);
                      setIsPreviewOpen(true);
                      convertBlobToUint8Array(frame);
                    }
                  }}
                  cursor="pointer"
                >
                  {frames.map((frame, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={selectedFrames.has(frame.id) ? '#0066FF' : '#E5E7EB'}
                      className="cursor-pointer hover:opacity-80"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <ChartTooltip
        frame={hoveredFrame}
        position={tooltipPosition}
        getThumbnailUrl={getThumbnailUrl}
      />

      {/* Section Title */}
      {showImageGrid && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Selected frames</h3>
          </div>
        </div>
      )}

      {/* Image Grid */}
      {showImageGrid && (
        <div className="grid grid-cols-6 gap-4">
          {frames.filter(frame => selectedFrames.has(frame.id)).map((frame) => (
            <div 
              key={frame.id} 
              className="relative aspect-video rounded-md overflow-hidden border border-gray-200"
            >
              <FrameThumbnail frame={frame} />
            </div>
          ))}
        </div>
      )}

      <FramePreviewDialog
        open={isPreviewOpen}
        onOpenChangeAction={setIsPreviewOpen}
        frame={selectedFrame}
        frames={frames}
        isSelected={selectedFrame ? selectedFrames.has(selectedFrame.id) : undefined}
        onToggleSelection={selectedFrame ? () => onFrameSelectAction(selectedFrame.id) : undefined}
        onNext={handleNext}
        onPrevious={handlePrevious}
      />
    </div>
  );
}
