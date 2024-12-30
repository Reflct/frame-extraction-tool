import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { frameStorage } from './frameStorage';
import { getVideoMetadata } from './videoUtils';

let ffmpegInstance: FFmpeg | null = null;

// Time-based chunking configuration
const CHUNK_DURATION = 2; // 2 seconds per chunk

async function initFfmpeg() {
  const ffmpeg = new FFmpeg();
  
  ffmpeg.on('progress', ({ progress }) => {
    console.log(`FFmpeg Progress: ${Math.round(progress * 100)}%`);
  });

  ffmpeg.on('log', ({ message }) => {
    console.log('FFmpeg log: ', message);
  });

  try {
    await ffmpeg.load({
      coreURL: '/ffmpeg-core.js',
      wasmURL: '/ffmpeg-core.wasm',
      workerURL: '/ffmpeg-core.worker.js'
    });
    console.log('FFmpeg loaded successfully');
    return ffmpeg;
  } catch (error) {
    console.error('Failed to load FFmpeg:', error);
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

  console.log('Running FFmpeg with args:', args);
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
        console.warn(`Skipping frame ${filename}: invalid data type`);
        continue;
      }

      const frameNumber = frameCount + (chunkIndex * Math.ceil(fps * CHUNK_DURATION));
      const frameBlob = new Blob([frameData], { type: `image/${format}` });
      await frameStorage.storeFrame({
        id: frameNumber.toString(),
        blob: frameBlob,
        name: `frame_${frameNumber}.${format}`,
        format
      });
      frameCount++;
    } catch (error) {
      console.error(`Error processing frame ${filename}:`, error);
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
    console.log('Loading video file...');
    const fileData = await fetchFile(videoFile);
    await ffmpeg.writeFile('input.MP4', fileData);
    
    // Get video metadata from videoUtils
    console.log('Analyzing video...');
    const metadata = await getVideoMetadata(videoFile);
    console.log('Video metadata:', metadata);
    
    // Calculate number of chunks based on video duration
    const chunks = Math.ceil(metadata.duration / CHUNK_DURATION);
    console.log(`Processing video in ${chunks} chunks of ${CHUNK_DURATION} seconds each`);

    // Process each chunk
    for (let i = 0; i < chunks; i++) {
      const startTime = i * CHUNK_DURATION;
      const currentDuration = Math.min(CHUNK_DURATION, metadata.duration - startTime);

      console.log(`Processing chunk ${i + 1}/${chunks} (${startTime}s - ${startTime + currentDuration}s)`);
      
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
        console.log('Reinitializing FFmpeg...');
        await ffmpeg.terminate();
        ffmpegInstance = null;
        
        if (i < chunks - 1) { // Don't reinitialize if this was the last chunk
          ffmpeg = await getFfmpeg();
          // Rewrite the video file for the next chunk using fetchFile
          const fileData = await fetchFile(videoFile);
          await ffmpeg.writeFile('input.MP4', fileData);
        }
      } catch (error) {
        console.error(`Error processing chunk ${i}:`, error);
        // Continue with next chunk even if this one fails
      }
    }

    return totalFrames;
  } catch (error) {
    console.error('Error extracting frames:', error);
    throw error;
  } finally {
    // Ensure FFmpeg is cleaned up even if there was an error
    if (ffmpegInstance) {
      try {
        await ffmpeg.terminate();
        ffmpegInstance = null;
      } catch (error) {
        console.error('Error cleaning up FFmpeg:', error);
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
    console.log('Initializing FFmpeg...');
    ffmpeg = await getFfmpeg();
    
    console.log('Loading video for resize...');
    const fileData = await fetchFile(videoFile);
    const inputFileName = 'input' + Date.now() + '.mp4';
    const outputFileName = 'output' + Date.now() + '.mp4';
    
    console.log('Writing input file...');
    await ffmpeg.writeFile(inputFileName, fileData);
    
    // Get video metadata for aspect ratio calculation
    const metadata = await getVideoMetadata(videoFile);
    const aspectRatio = metadata.width / metadata.height;
    const targetHeight = Math.round(targetWidth / aspectRatio);
    
    console.log(`Resizing video to ${targetWidth}x${targetHeight}...`);
    
    const args = [
      '-i', inputFileName,
      '-vf', `scale=${targetWidth}:${targetHeight}`,
      '-preset', 'ultrafast',
      '-c:v', 'libx264',
      '-crf', '23',
      outputFileName
    ];
    
    console.log('Running FFmpeg with args:', args);
    await ffmpeg.exec(args);
    
    console.log('Reading output file...');
    const data = await ffmpeg.readFile(outputFileName);
    if (!(data instanceof Uint8Array)) {
      throw new Error('Failed to read resized video');
    }
    
    // Clean up files
    console.log('Cleaning up...');
    try {
      await ffmpeg.deleteFile(inputFileName);
      await ffmpeg.deleteFile(outputFileName);
    } catch (error) {
      console.warn('Error cleaning up files:', error);
    }
    
    return data;
  } catch (error) {
    console.error('Error during video resize:', error);
    throw error;
  } finally {
    if (ffmpeg) {
      try {
        await ffmpeg.terminate();
        ffmpegInstance = null;
      } catch (error) {
        console.error('Error cleaning up FFmpeg:', error);
      }
    }
  }
}
