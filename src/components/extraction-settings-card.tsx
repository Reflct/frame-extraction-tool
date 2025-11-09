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
  prefix: string;
  useOriginalFrameRate: boolean;
  processing: boolean;
  extractionProgress: ProgressInfo;
  sharpnessProgress: ProgressInfo;
  timeRange: [number, number];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  extractionMethod?: 'MediaBunny' | 'Canvas' | null;
  onFpsChangeAction: (fps: number) => void;
  onFormatChangeAction: (format: 'jpeg' | 'png') => void;
  onPrefixChangeAction: (prefix: string) => void;
  onUseOriginalFrameRateChangeAction: (value: boolean) => void;
  onTimeRangeChangeAction: (range: [number, number]) => void;
  onExtractAction: () => void;
  onCancelAction: () => void;
}

export function ExtractionSettingsCard({
  videoMetadata,
  fps,
  format,
  prefix,
  useOriginalFrameRate,
  processing,
  extractionProgress,
  sharpnessProgress,
  timeRange,
  videoRef,
  extractionMethod,
  onFpsChangeAction,
  onFormatChangeAction,
  onPrefixChangeAction,
  onUseOriginalFrameRateChangeAction,
  onTimeRangeChangeAction,
  onExtractAction,
  onCancelAction,
}: ExtractionSettingsCardProps) {
  if (!videoMetadata) return null;

  return (
    <Card className="rounded-[14px] bg-white">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Extraction Settings</h2>
        </div>
        <div className="w-full">
          {!processing ? (
            <div className="space-y-6">
              <ExtractionControls
                fps={fps}
                format={format}
                prefix={prefix}
                useOriginalFrameRate={useOriginalFrameRate}
                onFpsChangeAction={onFpsChangeAction}
                onFormatChangeAction={onFormatChangeAction}
                onPrefixChangeAction={onPrefixChangeAction}
                onUseOriginalFrameRateChangeAction={onUseOriginalFrameRateChangeAction}
                videoMetadata={videoMetadata}
                processing={processing}
              />
              <div className="space-y-3">
                <label className="text-sm font-medium">Time Range</label>
                <TimeRangeDialog
                  duration={videoMetadata.duration}
                  timeRange={timeRange}
                  videoRef={videoRef}
                  onTimeRangeChangeAction={onTimeRangeChangeAction}
                />
              </div>
              <div className="pt-2">
                <Button onClick={onExtractAction} className="w-full text-base py-6" size="lg">
                  Extract Frames
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <ProgressIndicator
                extractionProgress={extractionProgress}
                sharpnessProgress={sharpnessProgress}
                extractionMethod={extractionMethod}
                onCancelAction={onCancelAction}
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
