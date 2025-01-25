'use client';

import { Button } from '@/components/ui/button';
import { Loader2 } from "lucide-react";
import { type VideoMetadata } from '@/lib/videoUtils';
import { clsx } from 'clsx';
import { useCallback } from 'react';

interface VideoInputProps {
  video: File | null;
  videoThumbnail: string | null;
  metadata: VideoMetadata | null;
  loadingMetadata: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  onVideoChangeAction: (file: File) => void;
  onVideoReplaceAction: () => void;
  onImageDirectoryChangeAction?: (files: FileList) => Promise<void>;
  isImageMode?: boolean;
  imageCount?: number;
  extractionProgress?: { current: number; total: number };
}

export const VideoInput: React.FC<VideoInputProps> = ({
  video,
  videoThumbnail,
  metadata,
  loadingMetadata,
  videoRef,
  onVideoChangeAction,
  onVideoReplaceAction,
  onImageDirectoryChangeAction,
  isImageMode = false,
  imageCount = 0,
  extractionProgress,
}) => {
  const openFileSelector = () => {
    if (loadingMetadata) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        onVideoChangeAction(target.files[0]);
      }
      // Clear the input value so the same file can be selected again
      target.value = '';
    };
    input.click();
  };

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (loadingMetadata) return;

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    
    onVideoChangeAction(file);
  }, [loadingMetadata, onVideoChangeAction]);

  const openDirectorySelector = useCallback(() => {
    if (loadingMetadata) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    // Set directory selection with proper types
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.setAttribute('mozdirectory', '');
    
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (!target.files || target.files.length === 0) {
        console.error('No files selected');
        return;
      }

      const imageFiles = Array.from(target.files).filter(file => 
        file.type.startsWith('image/') || 
        file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)
      );
      
      if (imageFiles.length === 0) {
        console.error('No valid image files found in the selected directory');
        return;
      }
      
      if (onImageDirectoryChangeAction) {
        onImageDirectoryChangeAction(target.files);
      }
      target.value = '';
    };
    input.click();
  }, [loadingMetadata, onImageDirectoryChangeAction]);

  return (
    <div className="space-y-4">
      {!video && !isImageMode ? (
        <div
          className={clsx(
            "relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer",
            loadingMetadata ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"
          )}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <p className="mb-2 text-sm text-gray-500">
              Drag and drop a video here
            </p>
            <p className="text-xs text-gray-500 mb-4">MP4, MOV, or WebM</p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  openFileSelector();
                }}
              >
                Choose Video
              </Button>
              <Button
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  openDirectorySelector();
                }}
              >
                Or select image directory
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {isImageMode ? (
            <div className="flex flex-col space-y-2">
              <h3 className="text-lg font-semibold">Image Directory</h3>
              <p className="text-sm text-gray-500">{imageCount} images loaded</p>
              {extractionProgress && extractionProgress.total > 0 && (
                <div className="space-y-2">
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ 
                        width: `${(extractionProgress.current / extractionProgress.total) * 100}%` 
                      }}
                    />
                  </div>
                  <p className="text-sm text-gray-500">
                    Processing {extractionProgress.current} of {extractionProgress.total} images
                  </p>
                </div>
              )}
              <Button
                variant="outline"
                onClick={onVideoReplaceAction}
                disabled={loadingMetadata}
              >
                Replace Images
              </Button>
            </div>
          ) : (
            <>
              <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-100">
                {videoThumbnail && (
                  <video
                    ref={videoRef}
                    src={videoThumbnail}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="space-y-6">
                <div className="flex items-center justify-between pt-2">
                  <h3 className="text-base font-semibold text-gray-900">{video?.name}</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onVideoReplaceAction}
                    disabled={loadingMetadata}
                    className="ml-4"
                  >
                    Replace Video
                  </Button>
                </div>
                {metadata && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-8 p-4 bg-gray-50 rounded-lg">
                    <div className="space-y-1">
                      <div className="text-sm text-gray-500">Duration</div>
                      <div className="text-sm font-semibold text-gray-900">{Math.round(metadata.duration)}s</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-gray-500">Resolution</div>
                      <div className="text-sm font-semibold text-gray-900">{metadata.width}×{metadata.height}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-gray-500">FPS</div>
                      <div className="text-sm font-semibold text-gray-900">{metadata.fps} fps</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-gray-500">Total Frames</div>
                      <div className="text-sm font-semibold text-gray-900">{Math.round(metadata.duration * metadata.fps)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-gray-500">Codec</div>
                      <div className="text-sm font-semibold text-gray-900">h264</div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
      {loadingMetadata && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading metadata...
        </div>
      )}
    </div>
  );
}
