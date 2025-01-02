import { frameStorage } from './frameStorage';

export async function extractFramesInBrowser(
  videoFile: File,
  fps: number,
  format: 'jpeg' | 'png',
  timeRange: [number, number],
  onProgress: (current: number, total: number) => void,
  signal?: AbortSignal
): Promise<Array<{ id: string; blob: Blob; name: string; format: string }>> {
  const video = document.createElement('video');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Create URL for video
  const videoUrl = URL.createObjectURL(videoFile);

  try {
    // Load video metadata
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Failed to load video'));
      video.src = videoUrl;
    });

    // Set video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Calculate frame extraction points
    const [startTime, endTime] = timeRange;
    const duration = endTime - startTime;
    const frameInterval = 1 / fps;
    const totalFrames = Math.floor(duration * fps);
    let currentFrame = 0;

    // Clear existing frames
    await frameStorage.clear();

    // Extract frames
    for (let time = startTime; time < endTime; time += frameInterval) {
      if (signal?.aborted) {
        throw new DOMException('Frame extraction cancelled', 'AbortError');
      }

      // Seek to time
      video.currentTime = time;
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
      });

      // Draw frame to canvas
      ctx.drawImage(video, 0, 0);

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to create blob'));
          },
          format === 'jpeg' ? 'image/jpeg' : 'image/png',
          0.95
        );
      });

      // Store frame
      const frameId = `frame_${currentFrame.toString().padStart(4, '0')}`;
      const fileName = `${frameId}.${format}`;
      await frameStorage.storeFrame({
        id: frameId,
        blob,
        name: fileName,
        format,
      });

      currentFrame++;
      onProgress(currentFrame, totalFrames);
    }

    // Get all stored frames
    return await frameStorage.getAllFrames();
  } finally {
    // Clean up
    URL.revokeObjectURL(videoUrl);
  }
}
