'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart, Bar, YAxis, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import { type FrameData, type FrameMetadata } from '@/types/frame';
import Image from 'next/image';
import { FramePreviewDialog } from './frame-preview-dialog';

interface FrameAnalysisProps {
  frames: FrameData[];
  selectedFrames: Set<string>;
  onFrameSelectAction: (frameId: string) => void;
  showImageGrid?: boolean;
}

export function FrameAnalysis({
  frames,
  selectedFrames,
  onFrameSelectAction,
  showImageGrid = true,
}: FrameAnalysisProps) {
  const [selectedFrame, setSelectedFrame] = useState<FrameData | null>(null);
  const [hoveredFrame, setHoveredFrame] = useState<FrameData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [frameData, setFrameData] = useState<Record<string, Uint8Array>>({});
  const convertingRef = useRef<Record<string, boolean>>({});
  const [frameUrls, setFrameUrls] = useState<Map<string, string>>(new Map());

  // Create blob URLs when frames change
  useEffect(() => {
    const newUrls = new Map<string, string>();
    
    frames.forEach(frame => {
      if (frame.blob) {
        const url = URL.createObjectURL(frame.blob);
        newUrls.set(frame.id, url);
      }
    });

    setFrameUrls(newUrls);

    // Cleanup old blob URLs on unmount
    return () => {
      newUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [frames]);

  // Get blob URL for a frame
  const getFrameUrl = useCallback((frameId: string) => {
    return frameUrls.get(frameId) || null;
  }, [frameUrls]);

  // Render frame thumbnail component
  const FrameThumbnail = useCallback(({ frame }: { frame: FrameData }) => {
    const url = getFrameUrl(frame.id);
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
  }, [getFrameUrl]);

  // Convert Blob to Uint8Array
  const convertBlobToUint8Array = useCallback(async (frame: FrameData): Promise<void> => {
    if (frameData[frame.name] || convertingRef.current[frame.name]) return;
    
    convertingRef.current[frame.name] = true;
    try {
      const arrayBuffer = await frame.blob.arrayBuffer();
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

      if (e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'd') {
        e.preventDefault();
        onFrameSelectAction(hoveredFrame.id);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [hoveredFrame, onFrameSelectAction]);

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
      <div className="relative h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={frames.map((frame, index) => ({
              x: index,
              y: frame.sharpnessScore || 0,
              frame
            }))}
            onMouseMove={(state) => {
              if (state?.activePayload?.[0]?.payload) {
                const data = state.activePayload[0].payload as { frame: FrameData };
                setHoveredFrame(data.frame);
              }
            }}
            onMouseLeave={() => setHoveredFrame(null)}
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
              wrapperStyle={{ zIndex: 1000 }}
              content={({ active, payload, coordinate }) => {
                if (!active || !payload || !payload.length) return null;
                
                const data = payload[0].payload as { frame: FrameData };
                const frame = data.frame;
                
                return (
                  <div 
                    className="bg-white p-3 border rounded-lg shadow-lg"
                    style={{
                      position: 'absolute',
                      transform: 'translate(-50%, -100%)',
                      left: coordinate?.x,
                      top: (coordinate?.y ?? 0) - 20,
                      pointerEvents: 'none',
                      zIndex: 1000
                    }}
                  >
                    <div className="relative w-48 aspect-video mb-2 rounded-md overflow-hidden">
                      {getFrameUrl(frame.id) && (
                        <Image
                          src={getFrameUrl(frame.id)!}
                          alt={frame.name}
                          fill
                          className="object-cover"
                          sizes="192px"
                        />
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{frame.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Sharpness: {frame.sharpnessScore?.toFixed(1)}
                      </p>
                    </div>
                  </div>
                );
              }}
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

      {/* Section Title */}
      {showImageGrid && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">All frames</h3>
          </div>
        </div>
      )}

      {/* Image Grid */}
      {showImageGrid && (
        <div className="grid grid-cols-6 gap-4">
          {frames.map((frame) => (
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
        isSelected={selectedFrame ? selectedFrames.has(selectedFrame.id) : undefined}
        onToggleSelection={selectedFrame ? () => onFrameSelectAction(selectedFrame.id) : undefined}
        onNext={handleNext}
        onPrevious={handlePrevious}
      />
    </div>
  );
}
