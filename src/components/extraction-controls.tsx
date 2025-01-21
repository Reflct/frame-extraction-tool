'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

interface ExtractionControlsProps {
  fps: number;
  format: 'jpeg' | 'png';
  prefix: string;
  useOriginalFrameRate: boolean;
  onFpsChangeAction: (fps: number) => void;
  onFormatChangeAction: (format: 'jpeg' | 'png') => void;
  onPrefixChangeAction: (prefix: string) => void;
  onUseOriginalFrameRateChangeAction: (value: boolean) => void;
  videoMetadata: { fps: number } | null;
  processing: boolean;
}

export function ExtractionControls({
  fps,
  format,
  prefix,
  useOriginalFrameRate,
  onFpsChangeAction,
  onFormatChangeAction,
  onPrefixChangeAction,
  onUseOriginalFrameRateChangeAction,
  videoMetadata,
  processing
}: ExtractionControlsProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-3">
          <label className="text-sm font-medium">Frame Prefix</label>
          <Input
            type="text"
            value={prefix}
            onChange={(e) => onPrefixChangeAction(e.target.value)}
            placeholder="e.g., my_video"
            className="w-full"
            disabled={processing}
          />
          <p className="text-xs text-muted-foreground">
            Frames will be saved as: {prefix || 'frame'}_xxxxx.{format}
          </p>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium">Frame Rate</label>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={fps}
                onChange={(e) => onFpsChangeAction(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                min={0.1}
                step={0.1}
                className="w-24"
                disabled={processing}
              />
              <span className="text-sm text-muted-foreground">fps</span>
            </div>
            {videoMetadata && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onFpsChangeAction(videoMetadata.fps)}
                disabled={processing}
              >
                Use Original ({videoMetadata.fps} fps)
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <Checkbox
              id="useOriginalFrameRate"
              checked={useOriginalFrameRate}
              onCheckedChange={(checked) => onUseOriginalFrameRateChangeAction(checked === true)}
              disabled={processing || !videoMetadata}
              className="mt-1"
            />
            <div className="space-y-1.5">
              <label
                htmlFor="useOriginalFrameRate"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Name using original framerate
              </label>
              {videoMetadata && (
                <p className="text-xs text-muted-foreground">
                  e.g., frame_00060 at 2 seconds if video is 30fps
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-4" />

      <div className="space-y-3">
        <label className="text-sm font-medium">Format</label>
        <div className="flex gap-2">
          <Button
            variant={format === 'jpeg' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFormatChangeAction('jpeg')}
            disabled={processing}
            className="flex-1"
          >
            JPEG
          </Button>
          <Button
            variant={format === 'png' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFormatChangeAction('png')}
            disabled={processing}
            className="flex-1"
          >
            PNG
          </Button>
        </div>
      </div>
    </div>
  );
}
