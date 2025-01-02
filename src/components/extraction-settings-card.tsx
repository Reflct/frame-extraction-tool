'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ExtractionControls } from '@/components/extraction-controls';
import { ProgressIndicator } from '@/components/progress-indicator';
import { TimeRangeDialog } from '@/components/time-range-dialog';
import { type VideoMetadata } from '@/lib/videoUtils';
import { type ProgressInfo } from '@/types/frame-extraction';
import * as React from 'react';

interface ExtractionSettingsCardProps {
  videoMetadata: VideoMetadata | null;
  fps: number;
  format: 'jpeg' | 'png';
  processing: boolean;
  extractionProgress: ProgressInfo;
  sharpnessProgress: ProgressInfo;
  timeRange: [number, number];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onFpsChangeAction: (fps: number) => void;
  onFormatChangeAction: (format: 'jpeg' | 'png') => void;
  onTimeRangeChangeAction: (range: [number, number]) => void;
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
  timeRange,
  videoRef,
  onFpsChangeAction,
  onFormatChangeAction,
  onTimeRangeChangeAction,
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Time Range</label>
                <TimeRangeDialog
                  duration={videoMetadata.duration}
                  timeRange={timeRange}
                  videoRef={videoRef}
                  onTimeRangeChangeAction={onTimeRangeChangeAction}
                />
              </div>
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
