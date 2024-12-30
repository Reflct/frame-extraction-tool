'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FrameSelection } from '@/components/frame-selection';
import { FrameAnalysis } from '@/components/frame-analysis';
import { type FrameData } from '@/lib/zipUtils';

interface FrameAnalysisCardProps {
  frames: FrameData[];
  selectedFrames: FrameData[];
  showFrames: boolean;
  processing: boolean;
  selectionMode: 'percentage' | 'batched';
  percentageThreshold: number;
  batchSize: number;
  batchBuffer: number;
  onSelectionModeChangeAction: (mode: 'percentage' | 'batched') => void;
  onPercentageThresholdChangeAction: (value: number) => void;
  onBatchSizeChangeAction: (size: number) => void;
  onBatchBufferChangeAction: (buffer: number) => void;
  onToggleFramesAction: () => void;
  onDownloadAction: () => void;
}

export function FrameAnalysisCard({
  frames,
  selectedFrames,
  showFrames,
  processing,
  selectionMode,
  percentageThreshold,
  batchSize,
  batchBuffer,
  onSelectionModeChangeAction,
  onPercentageThresholdChangeAction,
  onBatchSizeChangeAction,
  onBatchBufferChangeAction,
  onToggleFramesAction,
  onDownloadAction
}: FrameAnalysisCardProps) {
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
                selectionMode={selectionMode}
                percentageThreshold={percentageThreshold}
                batchSize={batchSize}
                batchBuffer={batchBuffer}
                onSelectionModeChangeAction={onSelectionModeChangeAction}
                onPercentageThresholdChangeAction={onPercentageThresholdChangeAction}
                onBatchSizeChangeAction={onBatchSizeChangeAction}
                onBatchBufferChangeAction={onBatchBufferChangeAction}
                processing={processing}
              />
            </div>

            {/* Frame Analysis */}
            <FrameAnalysis
              frames={frames}
              selectedFrames={selectedFrames}
              showFrames={showFrames}
              processing={processing}
              onDownloadAction={onDownloadAction}
              onToggleFramesAction={onToggleFramesAction}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
