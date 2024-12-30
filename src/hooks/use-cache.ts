'use client';

import { useEffect } from 'react';
import { type FrameData } from '@/lib/zipUtils';
import { frameStorage } from '@/lib/storageUtils';

export function useCache() {
  const clearCache = async () => {
    // Clear frame URLs
    const frames = document.querySelectorAll('img[src^="blob:"], video[src^="blob:"]');
    frames.forEach(frame => {
      if (frame instanceof HTMLImageElement || frame instanceof HTMLVideoElement) {
        URL.revokeObjectURL(frame.src);
      }
    });

    // Clear IndexedDB storage
    await frameStorage.clear();
  };

  // Clear cache on unmount/refresh
  useEffect(() => {
    return () => {
      clearCache().catch(console.error);
    };
  }, []);

  // Function to clear cache and frames
  const clearCacheAndFrames = async (
    frames: FrameData[],
    setFrames: (frames: FrameData[]) => void,
    setVideoThumbnail?: (url: string | null) => void
  ) => {
    try {
      // Clear all blob URLs and IndexedDB
      await clearCache();

      // Clear frame blobs
      frames.forEach(frame => {
        URL.revokeObjectURL(URL.createObjectURL(frame.blob));
      });

      // Reset state
      setFrames([]);
      if (setVideoThumbnail) {
        setVideoThumbnail(null);
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  return {
    clearCache,
    clearCacheAndFrames
  };
}
