'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FrameSelection } from '@/components/frame-selection';
import { FrameAnalysis } from '@/components/frame-analysis';
import { type FrameData } from '@/types/frame';
import { useMemo } from 'react';

interface FrameAnalysisCardProps {
  frames: FrameData[];
  selectedFrames: FrameData[];
  showFrames: boolean;
  batchSize: number;
  batchBuffer: number;
  bestNCount: number;
  bestNMinGap: number;
  percentageThreshold: number;
  onSelectionModeChangeAction: (mode: 'batched' | 'manual' | 'best-n' | 'top-percent') => void;
  onBatchSizeChangeAction: (size: number) => void;
  onBatchBufferChangeAction: (buffer: number) => void;
  onBestNCountChangeAction: (count: number) => void;
  onBestNMinGapChangeAction: (gap: number) => void;
  onPercentageThresholdChangeAction: (threshold: number) => void;
  onToggleFramesAction: () => void;
  onToggleFrameSelectionAction: (frameId: string) => void;
}

export function FrameAnalysisCard({
  frames,
  selectedFrames,
  showFrames,
  batchSize,
  batchBuffer,
  bestNCount,
  bestNMinGap,
  percentageThreshold,
  onSelectionModeChangeAction,
  onBatchSizeChangeAction,
  onBatchBufferChangeAction,
  onBestNCountChangeAction,
  onBestNMinGapChangeAction,
  onPercentageThresholdChangeAction,
  onToggleFramesAction,
  onToggleFrameSelectionAction
}: FrameAnalysisCardProps) {
  // Memoize the selected frames Set to prevent unnecessary re-renders of FrameAnalysis
  // The selectedFrames array is new on each parent render, so we create a dependency key
  // that captures when the actual frame IDs have changed
  const selectedFrameIds = useMemo(() => {
    return selectedFrames.map(f => f.id).sort().join(',');
  }, [selectedFrames]);

  const selectedFramesSet = useMemo(() => {
    const frameIds = selectedFrames.map(f => f.id);
    const set = new Set(frameIds);
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFrameIds]);

  if (frames.length === 0) return null;

  return (
    <div className="px-7">
      <Card className="text-card-foreground shadow rounded-[14px] border border-[#E0E0E0] bg-white">
        <div className="m-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Frame Selection</h2>
            <Button
              variant="outline"
              onClick={onToggleFramesAction}
            >
              {showFrames ? 'Hide Frames' : 'Show Frames'}
            </Button>
          </div>

          <div className="space-y-4">
            {/* Selection Controls */}
            <div className="space-y-4">
              <FrameSelection
                batchSize={batchSize}
                batchBuffer={batchBuffer}
                bestNCount={bestNCount}
                bestNMinGap={bestNMinGap}
                percentageThreshold={percentageThreshold}
                onSelectionModeChangeAction={onSelectionModeChangeAction}
                onBatchSizeChangeAction={onBatchSizeChangeAction}
                onBatchBufferChangeAction={onBatchBufferChangeAction}
                onBestNCountChangeAction={onBestNCountChangeAction}
                onBestNMinGapChangeAction={onBestNMinGapChangeAction}
                onPercentageThresholdChangeAction={onPercentageThresholdChangeAction}
              />
            </div>

            {/* Frame Analysis */}
            <Card className="p-6">
              <FrameAnalysis
                frames={frames}
                selectedFrames={selectedFramesSet}
                onFrameSelectAction={(frameId) => onToggleFrameSelectionAction(frameId)}
                showImageGrid={showFrames}
              />
            </Card>
          </div>
        </div>
      </Card>
    </div>
  );
}
