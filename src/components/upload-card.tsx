'use client';

import { Card } from '@/components/ui/card';
import { VideoInput } from '@/components/video-input';
import { type VideoMetadata } from '@/lib/videoUtils';

interface UploadCardProps {
  video: File | null;
  videoThumbnail: string | null;
  metadata: VideoMetadata | null;
  loadingMetadata: boolean;
  onVideoChangeAction: (file: File) => void;
  onVideoReplaceAction: () => void;
}

export function UploadCard({
  video,
  videoThumbnail,
  metadata,
  loadingMetadata,
  onVideoChangeAction,
  onVideoReplaceAction,
}: UploadCardProps) {
  return (
    <Card className="rounded-[14px] bg-white">
      <div className="m-4">
        <VideoInput
          video={video}
          videoThumbnail={videoThumbnail}
          metadata={metadata}
          loadingMetadata={loadingMetadata}
          onVideoChangeAction={onVideoChangeAction}
          onVideoReplaceAction={onVideoReplaceAction}
        />
      </div>
    </Card>
  );
}
