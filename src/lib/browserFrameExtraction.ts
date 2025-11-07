import { frameStorage } from './frameStorage';

export async function extractFramesInBrowser(
  videoFile: File,
  fps: number,
  format: 'jpeg' | 'png',
  timeRange: [number, number],
  onProgress: (current: number, total: number) => void,
  signal?: AbortSignal,
  prefix: string = '',
  useOriginalFrameRate: boolean = false,
  originalFps?: number
): Promise<Array<{ id: string; blob: Blob; name: string; format: string; timestamp: number }>> {
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
    const duration = Math.min(endTime - startTime, video.duration - startTime);
    const frameInterval = 1 / fps;
    const totalFrames = Math.floor(duration * fps);
    let currentFrame = 0;
    let lastSuccessfulTime = -1;

    // Clear existing frames
    await frameStorage.clear();

    // Helper function to attempt frame extraction with retries
    const attemptFrameExtraction = async (time: number, maxRetries = 3): Promise<boolean> => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        // Seek to time
        video.currentTime = time;
        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
        });

        // If we got a new frame, extract it
        if (video.currentTime !== lastSuccessfulTime) {
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
          let frameNumber: number;
          if (useOriginalFrameRate && originalFps) {
            // Calculate frame number based on original framerate
            frameNumber = Math.round(time * originalFps);
          } else {
            // Use sequential numbering
            frameNumber = currentFrame;
          }
          
          const frameId = `${prefix || 'frame'}_${frameNumber.toString().padStart(5, '0')}`;
          const fileName = `${frameId}.${format}`;
          await frameStorage.storeFrame({
            id: frameId,
            blob,
            name: fileName,
            format,
            timestamp: time,
            data: new Uint8Array(0), // Empty array - data generated on demand
            storedAt: Date.now()
          });

          lastSuccessfulTime = video.currentTime;
          return true;
        }

        // If this isn't our last attempt, wait a bit before retrying
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      return false;
    };

    // Extract frames
    for (let time = startTime; time < startTime + duration && time < video.duration; time += frameInterval) {
      if (signal?.aborted) {
        throw new DOMException('Frame extraction cancelled', 'AbortError');
      }

      const extracted = await attemptFrameExtraction(time);
      if (extracted) {
        currentFrame++;
      }
      // Update progress regardless of whether frame was extracted
      onProgress(currentFrame, totalFrames);
    }

    // Get existing frames
    let existingFrames: Array<{ id: string; blob: Blob; name: string; format: string; timestamp: number }> = [];
    try {
      const metadata = await frameStorage.getAllMetadata();
      existingFrames = await Promise.all(
        metadata.map(async (frame) => {
          const blob = await frameStorage.getFrameBlob(frame.id);
          return {
            ...frame,
            blob: blob!
          };
        })
      );
    } catch {
      // Error getting existing frames
    }

    // Return stored frames
    return existingFrames;
  } finally {
    // Clean up
    URL.revokeObjectURL(videoUrl);
  }
}
