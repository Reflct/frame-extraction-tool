'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FrameSelection } from '@/components/frame-selection';
import { FrameAnalysis } from '@/components/frame-analysis';
import { type FrameData } from '@/types/frame';

interface FrameAnalysisCardProps {
  frames: FrameData[];
  selectedFrames: FrameData[];
  showFrames: boolean;
  processing: boolean;
  selectionMode: 'percentage' | 'batched' | 'manual';
  percentageThreshold: number;
  batchSize: number;
  batchBuffer: number;
  onSelectionModeChangeAction: (mode: 'percentage' | 'batched' | 'manual') => void;
  onPercentageThresholdChangeAction: (value: number) => void;
  onBatchSizeChangeAction: (size: number) => void;
  onBatchBufferChangeAction: (buffer: number) => void;
  onToggleFramesAction: () => void;
  onSelectAllAction?: () => void;
  onDeselectAllAction?: () => void;
  onToggleFrameSelectionAction: (frameId: string) => void;
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
  onSelectAllAction,
  onDeselectAllAction,
  onToggleFrameSelectionAction
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
                onSelectAllAction={onSelectAllAction}
                onDeselectAllAction={onDeselectAllAction}
                processing={processing}
              />
            </div>

            {/* Frame Analysis */}
            <Card className="p-6">
              <FrameAnalysis
                frames={frames}
                selectedFrames={new Set(selectedFrames.map(f => f.id))}
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
