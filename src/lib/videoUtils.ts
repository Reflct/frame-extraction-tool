import { getFfmpeg } from './ffmpegWasm';
import { fetchFile } from '@ffmpeg/util';

export interface VideoMetadata {
  title: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  thumbnailUrl: string;
  codec: string;
}

// Maximum file size (1.9GB in bytes)
const MAX_FILE_SIZE = 1.9 * 1024 * 1024 * 1024;

export async function getVideoMetadata(file: File): Promise<VideoMetadata> {
  // Check file size first
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Video file is too large (${(file.size / (1024 * 1024 * 1024)).toFixed(1)}GB). Maximum supported size is 1.9GB.`);
  }

  try {
    // Get metadata using ffmpeg
    const ffmpeg = await getFfmpeg();
    const inputFileName = 'input' + file.name.substring(file.name.lastIndexOf('.'));
    
    // Use a stream-based approach for reading the file
    try {
      const fileData = await fetchFile(file);
      await ffmpeg.writeFile(inputFileName, fileData);
    } catch {
      throw new Error('Could not read video file. The file may be too large or corrupted.');
    }

    // Get stream information
    let streamInfo = '';
    ffmpeg.on('log', ({ message }) => {
      streamInfo += message + '\n';
    });

    try {
      await ffmpeg.exec(['-i', inputFileName]);
    } catch {
      // This error is expected as ffmpeg -i only shows stream info
      // We'll parse the stream info next
    }

    // Clean up FFmpeg file
    await ffmpeg.deleteFile(inputFileName);

    // Parse metadata from FFmpeg output
    const fpsMatch = streamInfo.match(/([0-9]+(?:\.[0-9]+)?|\d+\/\d+)\s*fps/);
    const resolutionMatch = streamInfo.match(/\b(\d{2,5})x(\d{2,5})\b/);
    const durationMatch = streamInfo.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
    const codecMatch = streamInfo.match(/Video:\s*(\w+)/);

    // Require essential metadata
    if (!resolutionMatch || !durationMatch) {
      throw new Error('Could not extract video metadata. The file may be corrupted or in an unsupported format.');
    }

    // Parse frame rate
    let fps = 30;
    if (fpsMatch) {
      const fpsStr = fpsMatch[1];
      if (fpsStr.includes('/')) {
        const [num, den] = fpsStr.split('/').map(Number);
        if (num && den) {
          fps = num / den;
        }
      } else {
        const parsedFps = parseFloat(fpsStr);
        if (!isNaN(parsedFps)) {
          fps = parsedFps;
        }
      }
    }

    // Parse resolution
    const width = parseInt(resolutionMatch[1]);
    const height = parseInt(resolutionMatch[2]);

    // Parse duration
    const duration = parseInt(durationMatch[1]) * 3600 + // hours
                    parseInt(durationMatch[2]) * 60 + // minutes
                    parseInt(durationMatch[3]) + // seconds
                    parseFloat(`0.${durationMatch[4]}`); // milliseconds

    // Parse codec
    const codec = codecMatch ? codecMatch[1].toLowerCase() : 'unknown';

    // Calculate total frames
    const totalFrames = Math.round(duration * fps);

    // Return metadata without thumbnail - it will be generated during frame extraction
    return {
      title: file.name,
      duration,
      width,
      height,
      fps: Math.round(fps * 1000) / 1000,
      totalFrames,
      thumbnailUrl: '',
      codec
    };
  } catch (error) {
    throw error; // Propagate the error without wrapping it
  }
}
