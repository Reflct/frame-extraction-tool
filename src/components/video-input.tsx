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
  onVideoChangeAction: (file: File) => void;
  onVideoReplaceAction: () => void;
}

export const VideoInput: React.FC<VideoInputProps> = ({
  video,
  videoThumbnail,
  metadata,
  loadingMetadata,
  onVideoChangeAction,
  onVideoReplaceAction,
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

  return (
    <div 
      className={clsx(
        "relative w-full rounded-lg flex items-center justify-center text-center p-4",
        !video && "h-[300px] border-2 border-dashed hover:bg-gray-50 transition-colors duration-200 cursor-pointer",
        video && "min-h-fit"
      )}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={(e) => {
        e.preventDefault();
        if (!video && !loadingMetadata) {
          openFileSelector();
        }
      }}
    >
      {loadingMetadata && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading video metadata...</p>
          </div>
        </div>
      )}

      {video ? (
        <div className="w-full">
          <div className="flex flex-col">
            <h2 className="text-xl font-semibold mb-4 leading-tight">{video.name}</h2>
            {/* Video and Metadata */}
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
              {/* Video Thumbnail and Replace Button */}
              <div className="flex flex-col gap-4 lg:w-1/2">
                {videoThumbnail && (
                  <div className="flex items-center justify-center">
                    <video 
                      className="w-full h-auto rounded-lg object-contain max-h-[200px]"
                      src={videoThumbnail}
                      controls={false}
                    />
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onVideoReplaceAction}
                >
                  Replace Video
                </Button>
              </div>
              {/* Metadata */}
              {metadata && (
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="text-gray-500 mb-1 font-semibold">Duration:</dt>
                      <dd>{metadata.duration.toFixed(2)}s</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 mb-1 font-semibold">Resolution:</dt>
                      <dd>{metadata.width}x{metadata.height}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 mb-1 font-semibold">FPS:</dt>
                      <dd>{metadata.fps} fps</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 mb-1 font-semibold">Frames:</dt>
                      <dd>{metadata.totalFrames}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 mb-1 font-semibold">Codec:</dt>
                      <dd>{metadata.codec}</dd>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <p>Drag and drop your video here, or click to select</p>
          <div className="mt-4 flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="secondary"
              onClick={() => openFileSelector()}
              className="w-40"
            >
              Select Video
            </Button>
            <p className="mt-3 text-sm" style={{ color: '#11121452' }}>
              Maximum file size: 1.9GB. Supported formats: MP4, MOV, AVI, MKV
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
