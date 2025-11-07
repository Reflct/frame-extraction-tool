import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { frameStorage } from './frameStorage';
import { getVideoMetadata } from './videoUtils';

let ffmpegInstance: FFmpeg | null = null;

// Time-based chunking configuration
const CHUNK_DURATION = 2; // 2 seconds per chunk

async function initFfmpeg() {
  const ffmpeg = new FFmpeg();

  try {
    await ffmpeg.load({
      coreURL: '/ffmpeg-core.js',
      wasmURL: '/ffmpeg-core.wasm',
      workerURL: '/ffmpeg-core.worker.js'
    });
    return ffmpeg;
  } catch (error) {
    throw error;
  }
}

export async function getFfmpeg(): Promise<FFmpeg> {
  if (!ffmpegInstance) {
    ffmpegInstance = await initFfmpeg();
  }
  return ffmpegInstance;
}

export async function extractFramesFromChunk(
  ffmpeg: FFmpeg,
  startTime: number,
  duration: number,
  fps: number,
  format: 'jpeg' | 'png',
  chunkIndex: number
): Promise<number> {
  const args = [
    // Fast seeking before input
    '-ss', startTime.toString(),
    
    // Input file
    '-i', 'input.MP4',
    
    // Duration after input for accuracy
    '-t', duration.toString(),
    
    // Performance optimization flags
    '-threads', '0',
    '-preset', 'ultrafast',
    
    // Frame extraction settings
    '-vf', `fps=${fps}`,
    
    // Output format settings
    '-f', 'image2',
    '-pix_fmt', 'rgb24',
    
    // Output pattern
    `frame_%d.${format}`
  ];

  await ffmpeg.exec(args);

  // Get list of generated frames
  const files = await ffmpeg.listDir('.');
  const frameFiles = files
    .map(f => f.name)
    .filter(name => name.startsWith('frame_') && name.endsWith(`.${format}`))
    .sort((a, b) => {
      const numA = parseInt(a.match(/frame_(\d+)/)?.[1] || '0');
      const numB = parseInt(b.match(/frame_(\d+)/)?.[1] || '0');
      return numA - numB;
    });

  // Process each frame
  let frameCount = 0;
  for (const filename of frameFiles) {
    try {
      const frameData = await ffmpeg.readFile(filename);
      if (!(frameData instanceof Uint8Array)) {
        continue;
      }

      const frameNumber = frameCount + (chunkIndex * Math.ceil(fps * CHUNK_DURATION));
      const frameBlob = new Blob([frameData], { type: `image/${format}` });
      await frameStorage.storeFrame({
        id: frameNumber.toString(),
        blob: frameBlob,
        name: `frame_${frameNumber}.${format}`,
        format,
        timestamp: frameNumber / fps,
        data: new Uint8Array(frameData),
        storedAt: Date.now()
      });
      frameCount++;
    } catch {
      // Error processing frame
    }
  }

  return frameCount;
}

export async function extractFrames(
  videoFile: File,
  fps: number,
  format: 'jpeg' | 'png'
): Promise<number> {
  let ffmpeg = await getFfmpeg();
  let totalFrames = 0;

  try {
    // Write the full video file
    const fileData = await fetchFile(videoFile);
    await ffmpeg.writeFile('input.MP4', fileData);

    // Get video metadata from videoUtils
    const metadata = await getVideoMetadata(videoFile);

    // Calculate number of chunks based on video duration
    const chunks = Math.ceil(metadata.duration / CHUNK_DURATION);

    // Process each chunk
    for (let i = 0; i < chunks; i++) {
      const startTime = i * CHUNK_DURATION;
      const currentDuration = Math.min(CHUNK_DURATION, metadata.duration - startTime);

      try {
        const frameCount = await extractFramesFromChunk(
          ffmpeg,
          startTime,
          currentDuration,
          fps,
          format,
          i
        );
        totalFrames += frameCount;

        // Reinitialize FFmpeg for next chunk
        await ffmpeg.terminate();
        ffmpegInstance = null;

        if (i < chunks - 1) { // Don't reinitialize if this was the last chunk
          ffmpeg = await getFfmpeg();
          // Rewrite the video file for the next chunk using fetchFile
          const fileData = await fetchFile(videoFile);
          await ffmpeg.writeFile('input.MP4', fileData);
        }
      } catch {
        // Continue with next chunk even if this one fails
      }
    }

    return totalFrames;
  } catch (error) {
    throw error;
  } finally {
    // Ensure FFmpeg is cleaned up even if there was an error
    if (ffmpegInstance) {
      try {
        await ffmpeg.terminate();
        ffmpegInstance = null;
      } catch {
        // Error cleaning up FFmpeg
      }
    }
  }
}

export async function resizeVideo(
  videoFile: File,
  targetWidth: number
): Promise<Uint8Array> {
  let ffmpeg: FFmpeg | null = null;

  try {
    ffmpeg = await getFfmpeg();

    const fileData = await fetchFile(videoFile);
    const inputFileName = 'input' + Date.now() + '.mp4';
    const outputFileName = 'output' + Date.now() + '.mp4';

    await ffmpeg.writeFile(inputFileName, fileData);

    // Get video metadata for aspect ratio calculation
    const metadata = await getVideoMetadata(videoFile);
    const aspectRatio = metadata.width / metadata.height;
    const targetHeight = Math.round(targetWidth / aspectRatio);

    const args = [
      '-i', inputFileName,
      '-vf', `scale=${targetWidth}:${targetHeight}`,
      '-preset', 'ultrafast',
      '-c:v', 'libx264',
      '-crf', '23',
      outputFileName
    ];

    await ffmpeg.exec(args);

    const data = await ffmpeg.readFile(outputFileName);
    if (!(data instanceof Uint8Array)) {
      throw new Error('Failed to read resized video');
    }

    // Clean up files
    try {
      await ffmpeg.deleteFile(inputFileName);
      await ffmpeg.deleteFile(outputFileName);
    } catch {
      // Error cleaning up files
    }

    return data;
  } catch (error) {
    throw error;
  } finally {
    if (ffmpeg) {
      try {
        await ffmpeg.terminate();
        ffmpegInstance = null;
      } catch {
        // Error cleaning up FFmpeg
      }
    }
  }
}
