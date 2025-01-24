'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { type ExtractPageState, defaultState } from '@/types/frame-extraction';
import { getSelectedFrames } from '@/utils/frame-selection';
import { extractFramesInBrowser } from '@/lib/browserFrameExtraction';
import { calculateSharpnessScore } from '@/lib/opencvUtils';
import { frameStorage } from '@/lib/frameStorage';
import { type FrameData } from '@/types/frame';
import { getVideoMetadata } from '@/lib/videoUtils';
import JSZip from 'jszip';

export function useFrameExtraction() {
  const [state, setState] = useState<ExtractPageState>(defaultState);
  const abortControllerRef = useRef<AbortController | null>(null);
  const convertingRef = useRef<Record<string, boolean>>({});

  // State update helper with proper typing
  const updateState = useCallback((updater: (prev: ExtractPageState) => ExtractPageState) => {
    setState(updater);
  }, []);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleVideoChange = useCallback(async (file: File) => {
    if (!file) return;

    // Clean up previous video URL if it exists
    if (state.videoThumbnailUrl) {
      URL.revokeObjectURL(state.videoThumbnailUrl);
    }

    updateState(prev => ({
      ...prev,
      videoFile: file,
      loadingMetadata: true,
      error: null,
      frames: [],
      videoThumbnailUrl: null,
      videoMetadata: null,
      isImageMode: false,
    }));

    try {
      updateState(prev => ({ ...prev, loadingMetadata: true }));

      // Create video URL for both thumbnail and video element
      const videoUrl = URL.createObjectURL(file);

      // Create a temporary video element to extract the first frame
      const video = document.createElement('video');
      video.src = videoUrl;
      
      // Wait for video metadata to load
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
      });

      // Seek to the first frame
      video.currentTime = 0;

      // Wait for the frame to be available
      await new Promise((resolve) => {
        video.onseeked = resolve;
      });

      // Create a canvas to capture the frame
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get metadata using FFmpeg
      const metadata = await getVideoMetadata(file);
      
      updateState(prev => ({
        ...prev,
        videoMetadata: metadata,
        videoThumbnailUrl: videoUrl, 
        loadingMetadata: false,
        fps: 10, 
        timeRange: [0, metadata.duration], 
      }));

      // Cleanup temporary elements
      video.remove();
    } catch (error) {
      console.error('Video load error:', error);
      updateState(prev => ({
        ...prev,
        error: `Failed to load video metadata: ${error}`,
        loadingMetadata: false,
      }));
    }
  }, [state.videoThumbnailUrl]); 

  const handleVideoReplace = useCallback(() => {
    if (state.videoThumbnailUrl) {
      URL.revokeObjectURL(state.videoThumbnailUrl);
    }
    updateState(prev => ({
      ...prev,
      videoFile: null,
      videoThumbnailUrl: null,
      videoMetadata: null,
      frames: [],
      selectedFrames: new Set(),
      isImageMode: false,
    }));
  }, [state.videoThumbnailUrl]); 

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    updateState(prev => ({
      ...prev,
      processing: false,
      extractionProgress: { current: 0, total: 0 },
      sharpnessProgress: { current: 0, total: 0 },
    }));
  }, []);

  const handleExtractFrames = useCallback(async () => {
    if (!state.videoFile || !state.videoMetadata) {
      updateState(prev => ({
        ...prev,
        error: 'No video file or metadata available',
      }));
      return;
    }

    if (state.fps <= 0) {
      updateState(prev => ({
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

    updateState(prev => ({
      ...prev,
      processing: true,
      error: null,
      frames: [],
      extractionProgress: { current: 0, total: 0, startTime: Date.now() },
      sharpnessProgress: { current: 0, total: 0, startTime: Date.now() },
    }));

    try {
      // Clear existing frames
      // await frameStorage.clear();

      // Extract frames with abort signal
      const extractedFrames = await extractFramesInBrowser(
        state.videoFile,
        state.fps,
        state.format,
        state.timeRange,
        (current: number, total: number) => {
          updateState(prev => ({
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
        signal,
        state.prefix,
        state.useOriginalFrameRate,
        state.videoMetadata?.fps
      );
      
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      // Create FrameData objects with initial sharpness scores
      const frames = await Promise.all(
        extractedFrames.map(async (frame, index) => {
          const arrayBuffer = await frame.blob.arrayBuffer();
          const data = new Uint8Array(arrayBuffer);
          const sharpnessScore = await calculateSharpnessScore(frame.blob);
          return {
            id: frame.id,
            name: frame.name,
            format: frame.format,
            sharpnessScore,
            blob: frame.blob,
            timestamp: (index / state.fps) * 1000, // Convert to milliseconds
            data,
            selected: false // Initialize selection state
          } as FrameData;
        })
      );

      // Update state with processed frames
      updateState(prev => ({
        ...prev,
        frames,
        processing: false,
        extractionProgress: { current: 0, total: 0 }
      }));
    } catch (error) {
      console.error('Error in frame extraction:', error);
      
      // Only set error if not aborted
      if (error instanceof DOMException && error.name === 'AbortError') {
        // await frameStorage.clear();
        return;
      }

      updateState(prev => ({
        ...prev,
        error: 'Failed to extract frames',
        processing: false,
      }));
    } finally {
      abortControllerRef.current = null;
    }
  }, [state.videoFile, state.videoMetadata, state.fps, state.format, state.timeRange, state.prefix, state.useOriginalFrameRate]);

  const handleDownload = useCallback(async () => {
    // Get automatically selected frames based on mode
    let autoSelectedFrameIds: string[] = [];
    if (state.selectionMode === 'percentage') {
      autoSelectedFrameIds = state.frames
        .sort((a, b) => (b.sharpnessScore || 0) - (a.sharpnessScore || 0))
        .slice(0, Math.ceil(state.frames.length * (state.percentageThreshold / 100)))
        .map(f => f.id);
    } else if (state.selectionMode === 'batched') {
      autoSelectedFrameIds = state.frames
        .reduce((acc, frame, index) => {
          const batchIndex = Math.floor(index / (state.batchSize + state.batchBuffer));
          const positionInBatch = index % (state.batchSize + state.batchBuffer);
          if (positionInBatch < state.batchSize) {
            acc.push(frame.id);
          }
          return acc;
        }, [] as string[]);
    }

    // Get manually selected frames
    const manuallySelectedFrameIds = state.frames
      .filter(f => f.selected)
      .map(f => f.id);

    // Combine both selections
    const selectedFrameIds = new Set([...autoSelectedFrameIds, ...manuallySelectedFrameIds]);

    if (selectedFrameIds.size === 0) {
      console.error('No frames selected for download');
      return;
    }

    try {
      const zip = new JSZip();
      
      // Add selected frames to zip
      Array.from(selectedFrameIds).forEach(frameId => {
        const frame = state.frames.find(f => f.id === frameId);
        if (frame?.blob) {
          zip.file(frame.name, frame.blob);
        }
      });

      // Generate and download zip
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'selected-frames.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading frames:', error);
      updateState(prev => ({
        ...prev,
        error: 'Failed to download frames'
      }));
    }
  }, [state.frames, state.selectionMode, state.percentageThreshold, state.batchSize, state.batchBuffer]);

  const handleClearCache = useCallback(async () => {
    try {
      if (state.videoThumbnailUrl) {
        URL.revokeObjectURL(state.videoThumbnailUrl);
      }
      // await frameStorage.clear();
      updateState(prev => ({
        ...defaultState,
        selectionMode: prev.selectionMode,
        percentageThreshold: prev.percentageThreshold,
        batchSize: prev.batchSize,
        batchBuffer: prev.batchBuffer,
        timeRange: [0, 0],
      }));
    } catch (error) {
      updateState(prev => ({
        ...prev,
        error: `Failed to clear cache: ${error}`,
        showClearCacheDialog: false,
      }));
    }
  }, [state.videoThumbnailUrl]);

  const handleImageDirectoryChange = useCallback(async (files: FileList) => {
    updateState(prev => ({
      ...prev,
      loadingMetadata: true,
      error: null,
      frames: [],
      isImageMode: true,
    }));

    try {
      // Filter for image files only
      const imageFiles = Array.from(files).filter(file => {
        const extension = file.name.split('.').pop()?.toLowerCase() || '';
        return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension);
      });

      if (imageFiles.length === 0) {
        throw new Error('No valid image files found in the selected directory');
      }

      // Convert images to FrameData format
      const frames = await Promise.all(
        imageFiles.map(async (file, index) => {
          const sharpnessScore = await calculateSharpnessScore(file);
          return {
            id: `frame-${index}`,
            name: file.name,
            format: file.name.split('.').pop() || 'jpeg',
            sharpnessScore,
            blob: file,
            timestamp: index * 1000, // Arbitrary timestamp for images
            data: new Uint8Array(await file.arrayBuffer())
          } as FrameData;
        })
      );

      updateState(prev => ({
        ...prev,
        frames,
        loadingMetadata: false,
      }));
    } catch (error) {
      console.error('Image processing error:', error);
      updateState(prev => ({
        ...prev,
        error: `Failed to process images: ${error}`,
        loadingMetadata: false,
      }));
    }
  }, []);

  const handleSelectAll = useCallback(() => {
    updateState(prev => ({
      ...prev,
      frames: prev.frames.map(frame => ({
        ...frame,
        selected: true
      }))
    }));
  }, []);

  const handleDeselectAll = useCallback(() => {
    updateState(prev => ({
      ...prev,
      frames: prev.frames.map(frame => ({
        ...frame,
        selected: false
      }))
    }));
  }, []);

  const handleToggleFrameSelection = useCallback((frameId: string) => {
    updateState(prev => ({
      ...prev,
      frames: prev.frames.map(f => {
        if (f.id === frameId) {
          return { ...f, selected: !f.selected };
        }
        return f;
      })
    }));
  }, []);

  const handleSelectionModeChange = useCallback((mode: 'percentage' | 'batched' | 'manual') => {
    updateState(prev => ({
      ...prev,
      selectionMode: mode,
      frames: prev.frames.map(f => ({ ...f, selected: false }))
    }));
  }, []);

  const handleBatchSizeChange = useCallback((size: number) => {
    updateState(prev => ({
      ...prev,
      batchSize: size,
      frames: prev.frames.map(f => ({ ...f, selected: false }))
    }));
  }, []);

  const handleBatchBufferChange = useCallback((buffer: number) => {
    updateState(prev => ({
      ...prev,
      batchBuffer: buffer,
      frames: prev.frames.map(f => ({ ...f, selected: false }))
    }));
  }, []);

  const handlePercentageThresholdChange = useCallback((value: number) => {
    updateState(prev => ({
      ...prev,
      percentageThreshold: value,
      frames: prev.frames.map(f => ({ ...f, selected: false }))
    }));
  }, []);

  return {
    state,
    setState: updateState,
    handlers: {
      handleVideoChange,
      handleVideoReplace,
      handleImageDirectoryChange,
      handleExtractFrames,
      handleCancel,
      handleDownload,
      handleClearCache,
      handleSelectAll,
      handleDeselectAll,
      handleToggleFrameSelection,
      handleSelectionModeChange,
      handleBatchSizeChange,
      handleBatchBufferChange,
      handlePercentageThresholdChange,
    },
  };
}
