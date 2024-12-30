'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ExtractionControls } from '@/components/extraction-controls';
import { ProgressIndicator } from '@/components/progress-indicator';
import { type VideoMetadata } from '@/lib/videoUtils';
import { type ProgressInfo } from '@/types/frame-extraction';

interface ExtractionSettingsCardProps {
  videoMetadata: VideoMetadata | null;
  fps: number;
  format: 'jpeg' | 'png';
  processing: boolean;
  extractionProgress: ProgressInfo;
  sharpnessProgress: ProgressInfo;
  onFpsChangeAction: (fps: number) => void;
  onFormatChangeAction: (format: 'jpeg' | 'png') => void;
  onExtractAction: () => void;
  onCancelAction: () => void;
}

export function ExtractionSettingsCard({
  videoMetadata,
  fps,
  format,
  processing,
  extractionProgress,
  sharpnessProgress,
  onFpsChangeAction,
  onFormatChangeAction,
  onExtractAction,
  onCancelAction,
}: ExtractionSettingsCardProps) {
  if (!videoMetadata) return null;

  return (
    <Card className="rounded-[14px] bg-white">
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-6">Extraction Settings</h2>
        <div className="space-y-6 max-w-sm">
          {!processing ? (
            <div className="space-y-4">
              <ExtractionControls
                fps={fps}
                format={format}
                onFpsChangeAction={onFpsChangeAction}
                onFormatChangeAction={onFormatChangeAction}
                videoMetadata={videoMetadata}
                processing={processing}
              />
              <Button onClick={onExtractAction} className="w-full">
                Extract Frames
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <ProgressIndicator
                extractionProgress={extractionProgress}
                sharpnessProgress={sharpnessProgress}
                onCancelAction={onCancelAction}
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
