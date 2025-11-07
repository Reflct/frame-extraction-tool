import { canUseMediaBunny, getBrowserSupport } from './browserSupport';
import { extractWithMediaBunny, type ExtractedFrame } from './mediaBunnyExtraction';
import { extractFramesInBrowser } from './browserFrameExtraction';

export interface ExtractionOptions {
  videoFile: File;
  fps: number;
  format: 'jpeg' | 'png';
  timeRange: [number, number];
  onProgress: (current: number, total: number) => void;
  onMethodDetermined?: (method: 'MediaBunny' | 'Canvas', fallbackReason?: string) => void;
  signal?: AbortSignal;
  prefix?: string;
  useOriginalFrameRate?: boolean;
  originalFps?: number;
  forceCanvas?: boolean;
  videoMetadata?: { duration: number } | null;
}

export interface ExtractionResult {
  frames: ExtractedFrame[];
  method: 'MediaBunny' | 'Canvas';
  fallbackReason?: string;
  performance: {
    startTime: number;
    endTime: number;
    duration: number;
    framesPerSecond: number;
  };
  browserSupport: {
    mediaBunny: boolean;
    canvas: boolean;
    reason?: string;
  };
}

export async function extractFrames(options: ExtractionOptions): Promise<ExtractionResult> {
  const startTime = performance.now();
  const browserSupport = getBrowserSupport();
  
  let useMediaBunny = false;
  let method: 'MediaBunny' | 'Canvas' = 'Canvas';
  let fallbackReason: string | undefined;

  if (!options.forceCanvas && browserSupport.mediaBunny) {
    try {
      useMediaBunny = await canUseMediaBunny(options.videoFile);
      if (useMediaBunny) {
        method = 'MediaBunny';
      } else {
        fallbackReason = 'Video codec not supported';
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      fallbackReason = `Compatibility check failed: ${errorMessage.slice(0, 60)}`;
      useMediaBunny = false;
    }
  }
  
  // Notify that method has been determined
  if (options.onMethodDetermined) {
    options.onMethodDetermined(method, fallbackReason);
  }

  let frames: ExtractedFrame[];

  if (useMediaBunny) {
    try {
      frames = await extractWithMediaBunny(
        options.videoFile,
        options.fps,
        options.format,
        options.timeRange,
        options.onProgress,
        options.signal,
        options.videoMetadata?.duration
      );
    } catch (error) {
      // Add specific error recovery logic
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isCodecError = errorMessage.includes('codec') ||
                          errorMessage.includes('format') ||
                          errorMessage.includes('VideoDecoder') ||
                          errorMessage.includes('AV1') ||
                          errorMessage.includes('av01');

      if (isCodecError) {
        fallbackReason = 'Codec not supported';
      } else if (errorMessage.includes('time range')) {
        fallbackReason = 'Time range error';
      } else if (errorMessage.includes('yuvj420p') || errorMessage.includes('pixel format')) {
        fallbackReason = 'Pixel format not supported';
      } else {
        fallbackReason = errorMessage.slice(0, 80);
      }
      
      // Reset progress before fallback
      options.onProgress(0, 0);
      
      const canvasFrames = await extractFramesInBrowser(
        options.videoFile,
        options.fps,
        options.format,
        options.timeRange,
        options.onProgress,
        options.signal,
        options.prefix,
        options.useOriginalFrameRate,
        options.originalFps
      );
      
      frames = canvasFrames.map(frame => ({
        ...frame,
        format: options.format
      }));
      method = 'Canvas';
      useMediaBunny = false;
      
      // Notify about fallback during extraction
      if (options.onMethodDetermined) {
        options.onMethodDetermined(method, fallbackReason);
      }
    }
  } else {
    const canvasFrames = await extractFramesInBrowser(
      options.videoFile,
      options.fps,
      options.format,
      options.timeRange,
      options.onProgress,
      options.signal,
      options.prefix,
      options.useOriginalFrameRate,
      options.originalFps
    );
    
    frames = canvasFrames.map(frame => ({
      ...frame,
      format: options.format
    }));
  }

  const endTime = performance.now();
  const duration = endTime - startTime;
  const framesPerSecond = frames.length / (duration / 1000);

  return {
    frames,
    method,
    fallbackReason,
    performance: {
      startTime,
      endTime,
      duration,
      framesPerSecond
    },
    browserSupport: {
      mediaBunny: browserSupport.mediaBunny,
      canvas: browserSupport.canvas,
      reason: browserSupport.reason
    }
  };
}

export function getRecommendedExtractionMethod(): {
  recommended: 'MediaBunny' | 'Canvas';
  reason: string;
  speedupEstimate?: string;
} {
  const support = getBrowserSupport();
  
  if (support.mediaBunny) {
    return {
      recommended: 'MediaBunny',
      reason: 'Your browser supports WebCodecs for hardware-accelerated extraction',
      speedupEstimate: '10-60x faster than Canvas'
    };
  }
  
  return {
    recommended: 'Canvas',
    reason: support.reason || 'MediaBunny not supported on this browser',
  };
}