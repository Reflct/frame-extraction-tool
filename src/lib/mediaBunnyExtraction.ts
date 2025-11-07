import { Input, BlobSource, ALL_FORMATS, CanvasSink } from 'mediabunny';
import { frameStorage } from './frameStorage';
import type { StoredFrameData } from '@/types/frame';

export interface ExtractedFrame {
  id: string;
  blob: Blob;
  name: string;
  format: 'jpeg' | 'png';
  timestamp: number;
}

export async function extractWithMediaBunny(
  videoFile: File,
  fps: number,
  format: 'jpeg' | 'png',
  timeRange: [number, number],
  onProgress: (current: number, total: number) => void,
  signal?: AbortSignal,
  fallbackDurationSeconds?: number
): Promise<ExtractedFrame[]> {
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(videoFile)
  });

  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) {
    throw new Error('No video track found in video file');
  }

  if (signal?.aborted) {
    throw new DOMException('Frame extraction cancelled', 'AbortError');
  }

  const sink = new CanvasSink(videoTrack);

  const duration = await videoTrack.computeDuration();

  const [startTime, endTime] = timeRange;
  const mediaBunnyDuration = duration / 1000000;
  
  // Use fallback duration if MediaBunny duration seems unreliable (too small)
  const videoDurationSeconds = (fallbackDurationSeconds && mediaBunnyDuration < 1) 
    ? fallbackDurationSeconds 
    : mediaBunnyDuration;
  
  const extractionDuration = Math.min(endTime - startTime, videoDurationSeconds - startTime);
  const frameInterval = 1 / fps;
  const frameCount = Math.floor(extractionDuration * fps);

  if (frameCount <= 0 || extractionDuration <= 0) {
    throw new Error(`Invalid time range: start=${startTime}s, end=${endTime}s, videoDuration=${videoDurationSeconds}s, frameCount=${frameCount}`);
  }

  // Generate timestamps in seconds (MediaBunny expects seconds, not microseconds)
  const timestamps: number[] = [];
  for (let i = 0; i < frameCount; i++) {
    const time = startTime + (i * frameInterval);
    timestamps.push(time); // Use time directly in seconds
  }

  const frames: ExtractedFrame[] = [];
  let frameIndex = 0;
  let processedFrames = 0;

  // Batch processing configuration
  const BATCH_SIZE = 20; // Process 20 frames at a time for optimal performance
  const canvasBatch: Array<{ canvas: HTMLCanvasElement | OffscreenCanvas; timestamp: number; index: number }> = [];
  const frameBatch: StoredFrameData[] = [];

  try {
    for await (const result of sink.canvasesAtTimestamps(timestamps)) {
      if (signal?.aborted) {
        throw new DOMException('Frame extraction cancelled', 'AbortError');
      }
      
      if (result && result.canvas) {
        // Add to batch for parallel processing
        canvasBatch.push({
          canvas: result.canvas,
          timestamp: result.timestamp,
          index: frameIndex
        });
        
        frameIndex++;
        
        // Process batch when it reaches BATCH_SIZE or is the last batch
        if (canvasBatch.length >= BATCH_SIZE || frameIndex === frameCount) {
          // Convert canvases to blobs in parallel
          const blobPromises = canvasBatch.map(async ({ canvas, timestamp, index }) => {
            let blob: Blob;
            
            if (canvas instanceof HTMLCanvasElement) {
              blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(
                  (b) => b ? resolve(b) : reject(new Error('Failed to create blob')),
                  format === 'jpeg' ? 'image/jpeg' : 'image/png',
                  0.95
                );
              });
            } else {
              blob = await canvas.convertToBlob({
                type: format === 'jpeg' ? 'image/jpeg' : 'image/png',
                quality: 0.95
              });
            }
            
            const frameId = `frame_${index.toString().padStart(5, '0')}`;
            const fileName = `${frameId}.${format}`;
            
            return {
              id: frameId,
              blob,
              name: fileName,
              format,
              timestamp,
              index
            };
          });
          
          // Wait for all blobs in batch to be created
          const blobResults = await Promise.all(blobPromises);
          
          // Prepare frames for batch storage (defer ArrayBuffer conversion)
          for (const blobResult of blobResults) {
            const storedFrame: StoredFrameData = {
              id: blobResult.id,
              blob: blobResult.blob,
              name: blobResult.name,
              format: blobResult.format,
              timestamp: blobResult.timestamp,
              data: new Uint8Array(0), // Skip ArrayBuffer - will generate on demand
              storedAt: Date.now()
            };
            
            frameBatch.push(storedFrame);
            
            frames.push({
              id: blobResult.id,
              blob: blobResult.blob,
              name: blobResult.name,
              format: blobResult.format as 'jpeg' | 'png',
              timestamp: blobResult.timestamp
            });
          }
          
          // Store batch of frames in single transaction (with optimized thumbnails)
          if (frameBatch.length > 0) {
            await frameStorage.storeFrameBatch(frameBatch);

            processedFrames += frameBatch.length;

            // Update progress after each batch
            onProgress(processedFrames, frameCount);
            
            // Clear batches immediately to free memory
            frameBatch.length = 0;
          }
          
          // Clear canvas batch immediately to free memory
          canvasBatch.length = 0;
          
          // Hint garbage collection after batch processing
          if (typeof globalThis !== 'undefined' && globalThis.gc) {
            globalThis.gc();
          }
        }
      } else {
        // Handle null results (no frame at timestamp)
        processedFrames++;

        // Update progress for null results too
        onProgress(processedFrames, frameCount);
      }
    }
    
    // Process any remaining frames in the batch
    if (canvasBatch.length > 0) {
      // Same batch processing logic as above
      const blobPromises = canvasBatch.map(async ({ canvas, timestamp, index }) => {
        let blob: Blob;
        
        if (canvas instanceof HTMLCanvasElement) {
          blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (b) => b ? resolve(b) : reject(new Error('Failed to create blob')),
              format === 'jpeg' ? 'image/jpeg' : 'image/png',
              0.95
            );
          });
        } else {
          blob = await canvas.convertToBlob({
            type: format === 'jpeg' ? 'image/jpeg' : 'image/png',
            quality: 0.95
          });
        }
        
        const frameId = `frame_${index.toString().padStart(5, '0')}`;
        const fileName = `${frameId}.${format}`;
        
        return {
          id: frameId,
          blob,
          name: fileName,
          format,
          timestamp,
          index
        };
      });
      
      const blobResults = await Promise.all(blobPromises);
      
      for (const blobResult of blobResults) {
        const storedFrame: StoredFrameData = {
          id: blobResult.id,
          blob: blobResult.blob,
          name: blobResult.name,
          format: blobResult.format,
          timestamp: blobResult.timestamp,
          data: new Uint8Array(0), // Skip ArrayBuffer - will generate on demand
          storedAt: Date.now()
        };
        
        frameBatch.push(storedFrame);
        
        frames.push({
          id: blobResult.id,
          blob: blobResult.blob,
          name: blobResult.name,
          format: blobResult.format as 'jpeg' | 'png',
          timestamp: blobResult.timestamp
        });
      }
      
      if (frameBatch.length > 0) {
        await frameStorage.storeFrameBatch(frameBatch);
        processedFrames += frameBatch.length;
        
        // Final progress update
        onProgress(processedFrames, frameCount);
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    
    // Provide more specific error information
    let errorMessage = 'MediaBunny extraction failed';
    
    if (error instanceof Error) {
      if (error.message.includes('VideoDecoder')) {
        errorMessage = 'Video decoder initialization failed - codec may not be supported';
      } else if (error.message.includes('format')) {
        errorMessage = 'Video format not supported by MediaBunny';
      } else if (error.message.includes('track')) {
        errorMessage = 'Failed to access video track';
      } else {
        errorMessage = `MediaBunny extraction failed: ${error.message}`;
      }
    }
    
    throw new Error(errorMessage);
  }

  if (frames.length === 0) {
    throw new Error('No frames were successfully extracted');
  }

  // Final garbage collection hint after extraction complete
  if (typeof globalThis !== 'undefined' && globalThis.gc) {
    globalThis.gc();
  }

  return frames;
}

export async function testMediaBunnyCompatibility(videoFile: File): Promise<{
  compatible: boolean;
  error?: string;
  codecInfo?: string;
}> {
  try {
    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(videoFile.slice(0, 4096))
    });
    
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) {
      return {
        compatible: false,
        error: 'No video track found'
      };
    }

    const duration = await videoTrack.computeDuration();
    if (duration <= 0) {
      return {
        compatible: false,
        error: 'Invalid video duration'
      };
    }

    return {
      compatible: true,
      codecInfo: `Duration: ${(duration / 1000000).toFixed(2)}s`
    };
  } catch (error) {
    return {
      compatible: false,
      error: error instanceof Error ? error.message : 'Unknown compatibility error'
    };
  }
}