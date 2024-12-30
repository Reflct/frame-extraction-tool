'use client';

import { BarChart, Bar, YAxis, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import { Download } from "lucide-react";
import { type FrameData } from '@/lib/zipUtils';
import Image from 'next/image';

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
  const chartData = getChartData(frames, selectedFrames);
  const selectedCount = selectedFrames.length;

  // Calculate Y-axis domain with some padding
  const maxScore = Math.max(...chartData.map(d => d.sharpnessScore));
  const minScore = Math.min(...chartData.map(d => d.sharpnessScore));
  const padding = (maxScore - minScore) * 0.1; // 10% padding
  const yDomain = [
    Math.max(0, minScore - padding),
    Math.min(100, maxScore + padding)
  ];

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
              <BarChart data={chartData}>
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
                <Bar dataKey="sharpnessScore">
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
