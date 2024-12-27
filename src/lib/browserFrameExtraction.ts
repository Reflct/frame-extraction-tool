import { frameStorage } from './frameStorage';

export async function extractFramesInBrowser(
  videoFile: File,
  fps: number,
  format: 'jpeg' | 'png' = 'jpeg',
  quality = 0.9,
  onProgress?: (current: number, total: number) => void
): Promise<number> {
  // Create video element
  const video = document.createElement('video');
  video.style.display = 'none';
  document.body.appendChild(video);

  // Create canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  try {
    // Create blob URL for the video
    const videoUrl = URL.createObjectURL(videoFile);
    video.src = videoUrl;

    // Wait for video metadata and enough data to play
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => {
        video.currentTime = 0;  // Ensure we start from the beginning
      };
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('Failed to load video'));
    });

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Calculate frame interval based on FPS
    const frameInterval = 1 / fps;
    const duration = video.duration;
    const totalFrames = Math.floor(duration * fps);
    let framesProcessed = 0;

    // Process frames
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      const time = frameIndex * frameInterval;
      
      // Ensure we don't exceed video duration
      if (time >= duration) {
        break;
      }

      // Set video time and wait for seeking to complete
      await new Promise<void>((resolve) => {
        const seekHandler = () => {
          video.removeEventListener('seeked', seekHandler);
          resolve();
        };
        video.addEventListener('seeked', seekHandler);
        video.currentTime = time;
      });

      // Draw frame to canvas
      ctx.drawImage(video, 0, 0);

      // Convert to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(
          (blob) => resolve(blob!),
          `image/${format}`,
          quality
        );
      });

      // Store the frame
      const paddedIndex = (frameIndex + 1).toString().padStart(4, '0');
      await frameStorage.storeFrame(
        frameIndex.toString(),
        blob,
        `frame_${paddedIndex}.${format}`,
        format
      );
      framesProcessed++;

      // Update progress
      if (onProgress) {
        onProgress(framesProcessed, totalFrames);
      }
      console.log(`Frame extraction progress: ${framesProcessed}/${totalFrames} (${Math.round((framesProcessed/totalFrames) * 100)}%)`);
    }

    return framesProcessed;
  } finally {
    // Clean up
    if (video.src) {
      URL.revokeObjectURL(video.src);
    }
    document.body.removeChild(video);
  }
}
