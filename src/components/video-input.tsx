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
    <div 
      className={clsx(
        "relative w-full rounded-lg flex items-center justify-center text-center",
        !video && "h-[300px] border-2 border-dashed hover:bg-gray-50 transition-colors duration-200 cursor-pointer",
        video && "min-h-fit"
      )}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={(e) => {
        // Only handle clicks on the container itself, not its children
        if (e.target === e.currentTarget && !video && !loadingMetadata) {
          openFileSelector();
        }
      }}
    >
      {loadingMetadata && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading video metadata...</p>
          </div>
        </div>
      )}

      {video ? (
        <div className="w-full">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold leading-tight truncate pr-4">{video.name}</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={onVideoReplaceAction}
                className="shrink-0"
              >
                Replace Video
              </Button>
            </div>

            <div className="flex-1 flex flex-col">
              {/* Video Preview and Thumbnail */}
              {videoThumbnail && (
                <div className="mb-6">
                  <div className="relative aspect-video bg-muted rounded-xl overflow-hidden">
                    <video 
                      ref={videoRef}
                      className="absolute inset-0 w-full h-full object-cover"
                      src={videoThumbnail}
                      controls={false}
                    />
                  </div>
                </div>
              )}

              {/* Metadata */}
              {metadata && (
                <div className="flex-1 flex flex-col justify-end mt-auto">
                  <div className="grid grid-cols-3 gap-x-8 gap-y-3">
                    <div>
                      <dt className="text-sm text-muted-foreground">Duration</dt>
                      <dd className="text-base font-medium mt-0.5">{metadata.duration.toFixed(2)}s</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Resolution</dt>
                      <dd className="text-base font-medium mt-0.5">{metadata.width}×{metadata.height}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">FPS</dt>
                      <dd className="text-base font-medium mt-0.5">{metadata.fps} fps</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Total Frames</dt>
                      <dd className="text-base font-medium mt-0.5">{metadata.totalFrames}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Codec</dt>
                      <dd className="text-base font-medium mt-0.5">{metadata.codec}</dd>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <p className="text-lg font-semibold">Upload a video</p>
            <p className="text-sm text-muted-foreground max-w-[400px]">
              Drag and drop your video here, or click to select
            </p>
          </div>
          <div className="flex flex-col gap-2 items-center">
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation(); // Prevent the parent div's onClick from firing
                openFileSelector();
              }}
              disabled={loadingMetadata}
            >
              Choose Video
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                openDirectorySelector();
              }}
              disabled={loadingMetadata}
            >
              Choose Image Directory
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
