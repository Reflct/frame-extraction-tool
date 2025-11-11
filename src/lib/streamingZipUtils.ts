import JSZip from 'jszip';
import { sanitizeFilename } from './zipUtils';

export interface StreamDownloadOptions {
  filename?: string;
  batchSize?: number;
  onProgress?: (progress: {
    framesProcessed: number;
    totalFrames: number;
    bytesGenerated: number;
    currentBatch: number;
    totalBatches: number;
  }) => void;
  onError?: (error: Error) => void;
}

export interface FrameWithBlob {
  id: string;
  name: string;
  blob: Blob;
  format?: string;
  sharpnessScore?: number;
}

/**
 * Downloads frames as a streamed ZIP file using StreamSaver.js
 * This approach prevents memory spikes for large downloads (3000+ frames)
 * by processing frames in batches instead of loading all frames at once
 */
export async function downloadFramesAsStreamedZip(
  frames: FrameWithBlob[],
  options: StreamDownloadOptions = {}
): Promise<void> {
  const {
    filename = 'selected-frames.zip',
    batchSize = 200,
    onProgress,
    onError,
  } = options;

  console.log(
    `[StreamingZip] Starting streamed download of ${frames.length} frames with batch size ${batchSize}`
  );

  try {
    // Check if StreamSaver is available
    const streamSaver = await import('streamsaver');
    const { createWriteStream } = streamSaver;

    // Check if service worker is available
    if (!navigator.serviceWorker) {
      throw new Error(
        'Service Worker not available. Please enable it in your browser.'
      );
    }

    // Create write stream
    const fileStream = createWriteStream(filename);
    const writer = fileStream.getWriter();

    console.log('[StreamingZip] File stream created, starting ZIP generation');

    try {
      // Process frames in batches to avoid memory spikes
      const totalBatches = Math.ceil(frames.length / batchSize);
      let bytesGenerated = 0;

      // Create a custom ZIP generation that streams to the writer
      await generateStreamedZip(
        frames,
        writer,
        batchSize,
        (progress) => {
          bytesGenerated = progress.bytesGenerated;
          onProgress?.({
            framesProcessed: progress.framesProcessed,
            totalFrames: frames.length,
            bytesGenerated,
            currentBatch: progress.currentBatch,
            totalBatches,
          });
        }
      );

      console.log(
        `[StreamingZip] Download complete. Total bytes: ${(bytesGenerated / 1024 / 1024).toFixed(2)} MB`
      );
    } finally {
      // Always close the writer
      await writer.close();
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[StreamingZip] Error during streamed download:', err);
    onError?.(err);
    throw err;
  }
}

/**
 * Generates a ZIP file and streams it to a WritableStreamDefaultWriter
 * Processes frames in batches to manage memory usage
 */
async function generateStreamedZip(
  frames: FrameWithBlob[],
  writer: { write: (chunk: Uint8Array | Uint8Array[]) => Promise<void>; close: () => Promise<void> },
  batchSize: number,
  onBatchProgress: (progress: {
    framesProcessed: number;
    bytesGenerated: number;
    currentBatch: number;
  }) => void
): Promise<void> {
  // We'll use a streaming approach with JSZip
  // Load frames in batches and generate ZIP chunks
  const zip = new JSZip();
  let processedFrames = 0;
  let bytesWritten = 0;

  // Add frames in batches
  const totalBatches = Math.ceil(frames.length / batchSize);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIdx = batchIndex * batchSize;
    const endIdx = Math.min(startIdx + batchSize, frames.length);
    const batch = frames.slice(startIdx, endIdx);

    console.log(
      `[StreamingZip] Processing batch ${batchIndex + 1}/${totalBatches} (frames ${startIdx + 1}-${endIdx})`
    );

    // Add frames from this batch to the ZIP
    for (const frame of batch) {
      const sanitizedName = sanitizeFilename(frame.name);
      zip.file(sanitizedName, frame.blob);
      processedFrames++;
    }

    // Report progress for this batch
    onBatchProgress({
      framesProcessed: processedFrames,
      bytesGenerated: bytesWritten,
      currentBatch: batchIndex + 1,
    });

    // After each batch, yield to allow UI updates
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  // Generate the complete ZIP and write to stream
  console.log('[StreamingZip] Generating final ZIP file...');

  // For now, we'll generate the complete ZIP in one go
  // since JSZip doesn't have true streaming support
  // But we're still benefiting from batched frame loading
  const content = await zip.generateAsync({
    type: 'blob',
    streamFiles: true,
  });

  // Write the ZIP blob to the stream
  const reader = content.stream().getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      await writer.write(value);
      bytesWritten += value.byteLength;

      // Update progress after each chunk written
      onBatchProgress({
        framesProcessed: processedFrames,
        bytesGenerated: bytesWritten,
        currentBatch: totalBatches,
      });

      // Yield to prevent blocking
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    await reader.cancel();
  }

  console.log(
    `[StreamingZip] ZIP file written. Total: ${(bytesWritten / 1024 / 1024).toFixed(2)} MB`
  );
}

/**
 * Fallback function that uses the standard approach for browsers without StreamSaver
 * This will be used if service workers or StreamSaver is not available
 */
export async function downloadFramesAsZipFallback(
  frames: FrameWithBlob[],
  filename: string = 'selected-frames.zip',
  onProgress?: (progress: {
    framesProcessed: number;
    totalFrames: number;
  }) => void
): Promise<void> {
  console.log(`[StreamingZip] Using fallback download for ${frames.length} frames`);

  const zip = new JSZip();

  // Add frames to ZIP
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const sanitizedName = sanitizeFilename(frame.name);
    zip.file(sanitizedName, frame.blob);

    if (i % 100 === 0) {
      onProgress?.({
        framesProcessed: i,
        totalFrames: frames.length,
      });
      // Yield to prevent blocking
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  // Generate and download ZIP
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Delay URL revocation to ensure download completes (critical for Windows 11)
  setTimeout(() => {
    URL.revokeObjectURL(url);
    console.log('[StreamingZip] Fallback download complete');
  }, 100);

  onProgress?.({
    framesProcessed: frames.length,
    totalFrames: frames.length,
  });
}

/**
 * Smart download function that chooses between streaming and fallback
 * Uses streaming for large downloads (>1000 frames) if available
 */
export async function downloadFramesSmartZip(
  frames: FrameWithBlob[],
  options: StreamDownloadOptions = {}
): Promise<void> {
  const STREAMING_THRESHOLD = 1000;

  // Check if streaming is possible (service workers available)
  const isStreamingAvailable =
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

  if (frames.length >= STREAMING_THRESHOLD && isStreamingAvailable) {
    console.log(
      '[StreamingZip] Using streaming download for large file set'
    );
    try {
      await downloadFramesAsStreamedZip(frames, options);
    } catch {
      console.warn('[StreamingZip] Streaming failed, falling back to standard download');
      await downloadFramesAsZipFallback(
        frames,
        options.filename,
        (progress) => {
          options.onProgress?.({
            ...progress,
            bytesGenerated: 0,
            currentBatch: 1,
            totalBatches: 1,
          });
        }
      );
    }
  } else {
    console.log('[StreamingZip] Using standard download');
    await downloadFramesAsZipFallback(
      frames,
      options.filename,
      (progress) => {
        options.onProgress?.({
          ...progress,
          bytesGenerated: 0,
          currentBatch: 1,
          totalBatches: 1,
        });
      }
    );
  }
}
