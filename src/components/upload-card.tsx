'use client';

import { Card } from '@/components/ui/card';
import { VideoInput } from '@/components/video-input';
import { type VideoMetadata } from '@/lib/videoUtils';
import { useCallback } from 'react';

interface UploadCardProps {
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
}

export function UploadCard({
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
}: UploadCardProps) {
  const handleImageDirectoryChange = useCallback(async (files: FileList) => {
    if (!files || files.length === 0) return;
    await onImageDirectoryChangeAction?.(files);
  }, [onImageDirectoryChangeAction]);

  return (
    <Card className="rounded-[14px] bg-white h-full">
      <div className="p-6 h-full">
        <VideoInput
          video={video}
          videoThumbnail={videoThumbnail}
          metadata={metadata}
          loadingMetadata={loadingMetadata}
          videoRef={videoRef}
          onVideoChangeAction={onVideoChangeAction}
          onVideoReplaceAction={onVideoReplaceAction}
          onImageDirectoryChangeAction={handleImageDirectoryChange}
          isImageMode={isImageMode}
          imageCount={imageCount}
        />
      </div>
    </Card>
  );
}
