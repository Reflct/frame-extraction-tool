'use client';

import { useEffect } from 'react';
import { type FrameData } from '@/types/frame';
import { frameStorage } from '@/lib/frameStorage';

export function useCache() {
  const clearCache = async () => {
    await frameStorage.clear();
  };

  useEffect(() => {
    async function clearOldCache() {
      try {
        const frames = await frameStorage.getAllMetadata();
        if (frames.length === 0) return;

        // Clear frames older than 24 hours
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const oldFrames = frames.filter((frame: FrameData) => {
          const timestamp = frame.timestamp || 0;
          return timestamp < oneDayAgo;
        });

        if (oldFrames.length > 0) {
          await Promise.all(oldFrames.map((frame: FrameData) => frameStorage.deleteFrame(frame.id)));
        }
      } catch (error) {
        console.error('Error clearing old cache:', error);
      }
    }

    clearOldCache();
  }, []);

  // Clear cache on unmount/refresh
  useEffect(() => {
    return () => {
      clearCache().catch(console.error);
    };
  }, []);

  return {
    clearCache,
  };
}
