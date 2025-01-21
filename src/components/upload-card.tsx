'use client';

import { Card } from '@/components/ui/card';
import { VideoInput } from '@/components/video-input';
import { type VideoMetadata } from '@/lib/videoUtils';

interface UploadCardProps {
  video: File | null;
  videoThumbnail: string | null;
  metadata: VideoMetadata | null;
  loadingMetadata: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  onVideoChangeAction: (file: File) => void;
  onVideoReplaceAction: () => void;
}

export function UploadCard({
  video,
  videoThumbnail,
  metadata,
  loadingMetadata,
  videoRef,
  onVideoChangeAction,
  onVideoReplaceAction,
}: UploadCardProps) {
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
        />
      </div>
    </Card>
  );
}
