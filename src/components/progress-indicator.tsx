import { type ProgressInfo } from '@/types/frame-extraction';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface ProgressIndicatorProps {
  extractionProgress: ProgressInfo;
  sharpnessProgress: ProgressInfo;
  extractionMethod?: 'MediaBunny' | 'Canvas' | null;
  onCancelAction: () => void;
}

export function ProgressIndicator({
  extractionProgress,
  sharpnessProgress,
  extractionMethod,
  onCancelAction,
}: ProgressIndicatorProps) {
  // Format time remaining
  const formatTimeRemaining = (ms: number) => {
    if (!ms) return '';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between text-sm mb-1">
          <div className="flex items-center gap-2">
            <span>Extracting Frames</span>
            {extractionMethod && (
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                {extractionMethod}
              </span>
            )}
          </div>
          <span>
            {extractionProgress.current}/{extractionProgress.total}
            {extractionProgress.estimatedTimeMs && (
              <span className="text-gray-500 ml-2">
                ({formatTimeRemaining(extractionProgress.estimatedTimeMs)} remaining)
              </span>
            )}
          </span>
        </div>
        <Progress value={(extractionProgress.current / extractionProgress.total) * 100} />
      </div>

      <div>
        <div className="flex justify-between text-sm mb-1">
          <span>Calculating Sharpness</span>
          <span>
            {sharpnessProgress.current}/{sharpnessProgress.total}
            {sharpnessProgress.estimatedTimeMs && (
              <span className="text-gray-500 ml-2">
                ({formatTimeRemaining(sharpnessProgress.estimatedTimeMs)} remaining)
              </span>
            )}
          </span>
        </div>
        <Progress value={(sharpnessProgress.current / sharpnessProgress.total) * 100} />
      </div>

      <div className="flex justify-end">
        <Button
          variant="destructive"
          onClick={onCancelAction}
          className="w-full sm:w-auto"
        >
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
