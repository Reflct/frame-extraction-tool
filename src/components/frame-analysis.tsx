'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { BarChart, Bar, YAxis, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import { Download } from "lucide-react";
import { type FrameData } from '@/lib/zipUtils';
import { type FrameMetadata } from '@/types/frame';
import Image from 'next/image';
import { FramePreviewDialog } from './frame-preview-dialog';

interface ChartData {
  name: string;
  sharpnessScore: number;
  selected: boolean;
  frame: FrameData;
}

interface FrameAnalysisProps {
  frames: FrameData[];
  selectedFrames: FrameData[];
  showFrames: boolean;
  processing: boolean;
  onDownloadAction: () => void;
  onToggleFramesAction: () => void;
}

function getChartData(frames: FrameData[], selectedFrames: FrameData[]): ChartData[] {
  return frames.map((frame) => {
    const frameNumber = frame.name?.match(/frame_(\d+)/)?.[1] || frame.name || 'unknown';
    return {
      name: frameNumber,
      sharpnessScore: frame.sharpnessScore ?? 0,
      selected: selectedFrames.includes(frame),
      frame,
    };
  });
}

export function FrameAnalysis({
  frames,
  selectedFrames,
  showFrames,
  processing,
  onDownloadAction,
  onToggleFramesAction
}: FrameAnalysisProps) {
  const [selectedFrame, setSelectedFrame] = useState<FrameData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [frameData, setFrameData] = useState<Record<string, Uint8Array>>({});
  const convertingRef = useRef<Record<string, boolean>>({});

  // Sort frames by frame number
  const sortedFrames = useMemo(() => {
    return [...frames].sort((a, b) => {
      const aNum = parseInt(a.name.match(/frame_(\d+)/)?.[1] || '0');
      const bNum = parseInt(b.name.match(/frame_(\d+)/)?.[1] || '0');
      return aNum - bNum;
    });
  }, [frames]);

  const chartData = getChartData(sortedFrames, selectedFrames);
  const selectedCount = selectedFrames.length;

  // Calculate Y-axis domain with some padding
  const maxScore = Math.max(...chartData.map(d => d.sharpnessScore));
  const minScore = Math.min(...chartData.map(d => d.sharpnessScore));
  const padding = (maxScore - minScore) * 0.1; // 10% padding
  const yDomain = [
    Math.max(0, minScore - padding),
    Math.min(100, maxScore + padding)
  ];

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

  // Handle frame change
  const handleFrameChange = useCallback(async (frame: FrameMetadata) => {
    const newFrame = sortedFrames.find(f => f.name === frame.id);
    if (newFrame) {
      await convertBlobToUint8Array(newFrame);
      setSelectedFrame(newFrame);
    }
  }, [sortedFrames, convertBlobToUint8Array]);

  // Handle bar click to open preview
  const handleBarClick = useCallback(async (data: ChartData) => {
    setSelectedFrame(data.frame);
    setIsPreviewOpen(true);
    await convertBlobToUint8Array(data.frame);
  }, [convertBlobToUint8Array]);

  // Create frame metadata
  const createFrameMetadata = useCallback((frame: FrameData): FrameMetadata | null => {
    if (!frameData[frame.name]) {
      // Start conversion if not already done
      convertBlobToUint8Array(frame);
      return null;
    }
    return {
      id: frame.name,
      name: frame.name,
      timestamp: parseInt(frame.name.match(/frame_(\d+)/)?.[1] || '0'),
      format: 'jpeg',
      sharpnessScore: frame.sharpnessScore,
      data: frameData[frame.name]
    };
  }, [frameData, convertBlobToUint8Array]);

  // Convert sorted frames to metadata
  const frameMetadata = useMemo(() => 
    sortedFrames
      .map(createFrameMetadata)
      .filter((f): f is FrameMetadata => f !== null),
    [sortedFrames, createFrameMetadata]
  );

  return (
    <div className="space-y-4">
      {/* Chart Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Frame Analysis</h3>
          <p className="text-sm text-[#111214]/35">
            {frames.length} frames analyzed, {selectedCount} selected
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleFramesAction}
            disabled={processing || frames.length === 0}
          >
            {showFrames ? 'Hide' : 'Show'} Frames
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDownloadAction}
            disabled={processing || selectedCount === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Download {selectedCount} {selectedCount === 1 ? 'Frame' : 'Frames'}
          </Button>
        </div>
      </div>

      {/* Blur Score Chart */}
      {frames.length > 0 && (
        <div className="w-full overflow-x-auto">
          <div style={{ width: Math.max(frames.length * 8, 300), height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} onClick={(data) => data && handleBarClick(data.activePayload?.[0]?.payload)}>
                <XAxis 
                  dataKey="name" 
                  tick={false}
                  label={{ 
                    value: 'Frames', 
                    position: 'bottom',
                    style: { fontSize: 12, fill: '#111214' }
                  }}
                />
                <YAxis 
                  domain={[Math.floor(yDomain[0]), Math.ceil(yDomain[1])]}
                  tickFormatter={(value) => Math.round(value).toString()}
                  tick={{ fontSize: 12, fill: '#111214' }}
                  label={{ 
                    value: 'Sharpness', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { fontSize: 12, fill: '#111214' }
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as ChartData;
                      return (
                        <div className="bg-white p-2 border rounded shadow-lg">
                          <div className="mb-2 relative w-[160px] h-[90px]">
                            <Image
                              src={URL.createObjectURL(data.frame.blob)}
                              alt={`Frame ${data.name}`}
                              fill
                              className="object-cover rounded"
                            />
                          </div>
                          <p className="text-sm font-medium text-[#111214]">Frame {data.name}</p>
                          <p className="text-sm text-[#111214]/35">Sharpness: {data.sharpnessScore.toFixed(2)}</p>
                          <p className="text-sm text-[#111214]/35">
                            {data.selected ? 'Selected' : 'Not Selected'}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="sharpnessScore" style={{ cursor: 'pointer' }}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.selected ? '#2563eb' : '#111214'}
                      fillOpacity={entry.selected ? 1 : 0.35}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Frame Preview Dialog */}
      <FramePreviewDialog
        open={isPreviewOpen}
        onOpenChangeAction={setIsPreviewOpen}
        frame={selectedFrame ? createFrameMetadata(selectedFrame) : null}
        frames={frameMetadata}
        isSelected={selectedFrame ? selectedFrames.includes(selectedFrame) : false}
        onFrameChangeAction={handleFrameChange}
      />

      {/* Frame Grid */}
      {showFrames && selectedFrames.length > 0 && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {selectedFrames.map((frame, index) => {
            return (
              <div
                key={frame.name || index}
                className="relative aspect-video rounded-lg overflow-hidden border-2 border-blue-500"
              >
                <Image
                  src={URL.createObjectURL(frame.blob)}
                  alt={`Frame ${frame.name || index}`}
                  width={320}
                  height={180}
                  className="object-cover w-full h-full"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                  priority={false}
                  loading="lazy"
                  unoptimized={false}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-[#111214]/50 text-white text-xs p-1">
                  <div>Frame: {frame.name?.match(/frame_(\d+)/)?.[1] || frame.name || index}</div>
                  <div>Sharpness: {frame.sharpnessScore?.toFixed(2) ?? 'N/A'}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
