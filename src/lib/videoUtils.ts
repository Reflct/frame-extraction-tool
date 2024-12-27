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

export async function getVideoMetadata(file: File): Promise<VideoMetadata> {
  try {
    // First get the video fps using ffmpeg
    const ffmpeg = await getFfmpeg();
    const inputFileName = 'input' + file.name.substring(file.name.lastIndexOf('.'));
    await ffmpeg.writeFile(inputFileName, await fetchFile(file));

    // Get frame rate using FFmpeg stream info
    let streamInfo = '';
    ffmpeg.on('log', ({ message }) => {
      streamInfo += message + '\n';
    });

    // Get stream information
    await ffmpeg.exec(['-i', inputFileName]);

    // Clean up FFmpeg file
    await ffmpeg.deleteFile(inputFileName);

    // Look for frame rate in stream info
    const fpsMatch = streamInfo.match(/([0-9]+(?:\.[0-9]+)?|\d+\/\d+)\s*fps/);
    let fps = 30; // Default to 30fps if we can't detect it

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

    // Now get the rest of the metadata
    const metadata = await calculateMetadata(file, fps);
    return metadata;
  } catch (error) {
    throw new Error(`Failed to get video metadata: ${error}`);
  }
}

async function calculateMetadata(file: File, fps: number): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    // Create object URL for the thumbnail
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    
    video.onloadedmetadata = () => {
      // Get basic metadata
      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;
      
      // Create a canvas to capture the first frame
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      // Set video to first frame
      video.currentTime = 0;
      
      video.onseeked = () => {
        // Get thumbnail
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0, width, height);
        const thumbnailUrl = canvas.toDataURL('image/jpeg');
        
        // Calculate total frames
        const totalFrames = Math.round(duration * fps);
        
        // Clean up
        video.removeAttribute('src');
        video.load();
        URL.revokeObjectURL(objectUrl);
        
        resolve({
          title: file.name,
          duration,
          width,
          height,
          fps: Math.round(fps * 1000) / 1000, // Round to 3 decimal places
          totalFrames,
          thumbnailUrl,
          codec: 'h264' // Default to h264 since we don't need exact codec
        });
      };
      
      video.onerror = () => {
        video.removeAttribute('src');
        video.load();
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load video metadata'));
      };
    };
    
    video.onerror = () => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load video metadata'));
    };
  });
}
