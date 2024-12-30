'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ExtractionControlsProps {
  fps: number;
  format: 'jpeg' | 'png';
  onFpsChangeAction: (fps: number) => void;
  onFormatChangeAction: (format: 'jpeg' | 'png') => void;
  videoMetadata: { fps: number } | null;
  processing: boolean;
}

export function ExtractionControls({
  fps,
  format,
  onFpsChangeAction,
  onFormatChangeAction,
  videoMetadata,
  processing
}: ExtractionControlsProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Frame Rate</label>
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
            {videoMetadata && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onFpsChangeAction(videoMetadata.fps)}
                className="ml-2"
                disabled={processing}
              >
                Use Original ({videoMetadata.fps} fps)
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Format</label>
          <div className="flex gap-2">
            <Button
              variant={format === 'jpeg' ? 'default' : 'outline'}
              onClick={() => onFormatChangeAction('jpeg')}
              className="w-20"
              disabled={processing}
            >
              JPEG
            </Button>
            <Button
              variant={format === 'png' ? 'default' : 'outline'}
              onClick={() => onFormatChangeAction('png')}
              className="w-20"
              disabled={processing}
            >
              PNG
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
