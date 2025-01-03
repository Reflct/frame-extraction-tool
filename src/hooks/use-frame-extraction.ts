'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { type ExtractPageState, defaultState } from '@/types/frame-extraction';
import { getSelectedFrames } from '@/utils/frame-selection';
import { extractFramesInBrowser } from '@/lib/browserFrameExtraction';
import { calculateSharpnessScore } from '@/lib/opencvUtils';
import { frameStorage } from '@/lib/frameStorage';
import { downloadAsZip, type FrameData } from '@/lib/zipUtils';
import { getVideoMetadata } from '@/lib/videoUtils';

export function useFrameExtraction() {
  const [state, setState] = useState<ExtractPageState>({
    ...defaultState,
    timeRange: [0, 0],
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleVideoChange = useCallback(async (file: File) => {
    // Clean up previous video URL if it exists
    if (state.videoThumbnailUrl) {
      URL.revokeObjectURL(state.videoThumbnailUrl);
    }

    setState(prev => ({
      ...prev,
      videoFile: file,
      loadingMetadata: true,
      error: null,
      videoThumbnailUrl: null,
      videoMetadata: null,
      frames: [],
    }));

    try {
      // Create thumbnail URL
      const thumbnailUrl = URL.createObjectURL(file);
      
      // Get metadata using FFmpeg
      const metadata = await getVideoMetadata(file);
      
      setState(prev => ({
        ...prev,
        videoMetadata: metadata,
        videoThumbnailUrl: thumbnailUrl,
        loadingMetadata: false,
        fps: 10, // Always set to 10 FPS regardless of video metadata
        timeRange: [0, metadata.duration], // Set initial time range
      }));
    } catch (error) {
      console.error('Video load error:', error);
      setState(prev => ({
        ...prev,
        error: `Failed to load video metadata: ${error}`,
        loadingMetadata: false,
      }));
    }
  }, [state.videoThumbnailUrl]); // Add videoThumbnailUrl to dependencies for cleanup

  const handleVideoReplace = useCallback(() => {
    setState(prev => ({
      ...prev,
      showClearCacheDialog: true,
    }));
  }, []);

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState(prev => ({
      ...prev,
      processing: false,
      extractionProgress: { current: 0, total: 0 },
      sharpnessProgress: { current: 0, total: 0 },
    }));
  }, []);

  const handleExtractFrames = useCallback(async () => {
    if (!state.videoFile || !state.videoMetadata) {
      setState(prev => ({
        ...prev,
        error: 'No video file or metadata available',
      }));
      return;
    }

    if (state.fps <= 0) {
      setState(prev => ({
        ...prev,
        error: 'FPS must be greater than 0',
      }));
      return;
    }

    // Create new abort controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setState(prev => ({
      ...prev,
      processing: true,
      error: null,
      frames: [],
      extractionProgress: { current: 0, total: 0, startTime: Date.now() },
      sharpnessProgress: { current: 0, total: 0, startTime: Date.now() },
    }));

    try {
      // Clear existing frames
      await frameStorage.clear();

      // Extract frames with abort signal
      const storedFrames = await extractFramesInBrowser(
        state.videoFile,
        state.fps,
        state.format,
        state.timeRange,
        (current: number, total: number) => {
          setState(prev => ({
            ...prev,
            extractionProgress: {
              current,
              total,
              startTime: prev.extractionProgress.startTime,
              estimatedTimeMs: prev.extractionProgress.startTime
                ? ((Date.now() - prev.extractionProgress.startTime) / current) * (total - current)
                : undefined,
            },
          }));
        },
        signal
      );
      
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      // Calculate sharpness scores
      let processedFrames = 0;
      const framesWithSharpness: FrameData[] = [];
      for (const frame of storedFrames) {
        if (signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        const sharpnessScore = await calculateSharpnessScore(frame.blob);
        framesWithSharpness.push({
          ...frame,
          sharpnessScore
        });
        processedFrames++;
        
        setState(prev => ({
          ...prev,
          sharpnessProgress: {
            current: processedFrames,
            total: storedFrames.length,
            startTime: prev.sharpnessProgress.startTime || Date.now(),
            estimatedTimeMs: prev.sharpnessProgress.startTime
              ? ((Date.now() - prev.sharpnessProgress.startTime) / processedFrames) * (storedFrames.length - processedFrames)
              : undefined,
          },
        }));
      }

      setState(prev => ({
        ...prev,
        frames: framesWithSharpness,
        processing: false,
      }));
    } catch (error) {
      console.error('Error in frame extraction:', error);
      
      // Only set error if not aborted
      if (error instanceof DOMException && error.name === 'AbortError') {
        await frameStorage.clear();
        return;
      }

      setState(prev => ({
        ...prev,
        error: 'Failed to extract frames',
        processing: false,
      }));
    } finally {
      abortControllerRef.current = null;
    }
  }, [state.videoFile, state.videoMetadata, state.fps, state.format, state.timeRange]);

  const handleDownload = useCallback(async () => {
    const selectedFrames = getSelectedFrames(state);
    if (selectedFrames.length === 0) {
      setState(prev => ({
        ...prev,
        error: 'No frames selected for download'
      }));
      return;
    }

    try {
      await downloadAsZip(selectedFrames);
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to download frames: ${error}`
      }));
    }
  }, [state]);

  const handleClearCache = useCallback(async () => {
    try {
      if (state.videoThumbnailUrl) {
        URL.revokeObjectURL(state.videoThumbnailUrl);
      }
      await frameStorage.clear();
      setState(prev => ({
        ...defaultState,
        selectionMode: prev.selectionMode,
        percentageThreshold: prev.percentageThreshold,
        batchSize: prev.batchSize,
        batchBuffer: prev.batchBuffer,
        timeRange: [0, 0],
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to clear cache: ${error}`,
        showClearCacheDialog: false,
      }));
    }
  }, [state.videoThumbnailUrl]);

  return {
    state,
    handlers: {
      handleVideoChange,
      handleVideoReplace,
      handleExtractFrames,
      handleDownload,
      handleCancel,
      handleClearCache,
      setState,
    },
  };
}
