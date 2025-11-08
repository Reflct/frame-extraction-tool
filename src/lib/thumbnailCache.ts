import { frameStorage } from './frameStorage';
import { createThumbnail } from './imageUtils';

interface CacheEntry {
  url: string;
  lastAccessed: number;
  frameId: string;
}

/**
 * LRU cache for thumbnail URLs with smart preloading
 * Prevents excessive memory usage and IndexedDB reads for large frame counts
 */
export class ThumbnailCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private loadingQueue: Set<string> = new Set();
  
  constructor(maxSize: number = 200) {
    this.maxSize = maxSize;
  }
  
  /**
   * Get thumbnail URL from cache or load it
   * If thumbnail doesn't exist in IndexedDB, generates it on-demand
   * Updates LRU timestamp on access
   */
  async get(frameId: string, generateIfMissing: boolean = true): Promise<string | null> {
    console.log(`[ThumbnailCache.get] Starting for frameId: ${frameId}`);

    // Check cache first
    const cached = this.cache.get(frameId);
    if (cached) {
      cached.lastAccessed = Date.now();
      console.log(`[ThumbnailCache.get] Cache HIT for ${frameId}`);
      return cached.url;
    }

    console.log(`[ThumbnailCache.get] Cache MISS for ${frameId}`);

    // Don't load if already in queue - return null immediately
    if (this.loadingQueue.has(frameId)) {
      console.log(`[ThumbnailCache.get] Already loading ${frameId}, returning null`);
      return null;
    }

    // Limit concurrent loads - if too many are loading, don't start a new one
    // This prevents memory from exploding during rapid interactions
    if (this.loadingQueue.size > 3) {
      console.log(`[ThumbnailCache.get] Too many concurrent loads (${this.loadingQueue.size}), deferring ${frameId}`);
      return null;
    }

    // Load thumbnail from IndexedDB with timeout protection
    this.loadingQueue.add(frameId);
    console.log(`[ThumbnailCache.get] Added ${frameId} to loading queue`);

    try {
      let blob: Blob | undefined;

      try {
        // Add timeout for thumbnail retrieval (5 seconds max)
        console.log(`[ThumbnailCache.get] Fetching thumbnail for ${frameId} from storage`);
        blob = await Promise.race([
          frameStorage.getFrameThumbnail(frameId),
          new Promise<undefined>((_, reject) =>
            setTimeout(() => reject(new Error('Thumbnail load timeout')), 5000)
          )
        ]);
        console.log(`[ThumbnailCache.get] Got blob for ${frameId}:`, blob ? 'YES' : 'NO');
      } catch (error) {
        if (error instanceof Error && error.message === 'Thumbnail load timeout') {
          console.warn(`[ThumbnailCache] Timeout loading thumbnail ${frameId}`);
        } else {
          console.warn(`[ThumbnailCache] Failed to retrieve thumbnail ${frameId}:`, error);
        }
        blob = undefined;
      }

      // If thumbnail doesn't exist and we should generate it, create on-demand
      if (!blob && generateIfMissing) {
        console.log(`[ThumbnailCache.get] Generating thumbnail for ${frameId}`);
        try {
          const generated = await this.generateThumbnail(frameId);
          if (generated) {
            blob = generated;
            console.log(`[ThumbnailCache.get] Generated thumbnail for ${frameId}`);
          }
        } catch (error) {
          console.warn(`[ThumbnailCache] Failed to generate thumbnail ${frameId}:`, error);
          blob = undefined;
        }
      }

      if (!blob) {
        console.warn(`[ThumbnailCache.get] No blob available for ${frameId}`);
        return null;
      }

      // Validate blob before using it
      if (!(blob instanceof Blob) || blob.size === 0) {
        console.warn(`[ThumbnailCache] Invalid blob for ${frameId}: not a Blob or empty`);
        return null;
      }

      try {
        const url = URL.createObjectURL(blob);
        console.log(`[ThumbnailCache.get] Created object URL for ${frameId}`);

        // Add to cache
        this.cache.set(frameId, {
          url,
          lastAccessed: Date.now(),
          frameId
        });

        // Enforce cache size limit with LRU eviction
        this.evictIfNeeded();

        console.log(`[ThumbnailCache.get] Success: returning URL for ${frameId}`);
        return url;
      } catch (error) {
        console.error(`[ThumbnailCache] Failed to create object URL for ${frameId}:`, error);
        return null;
      }
    } catch (error) {
      console.error(`[ThumbnailCache] Unexpected error loading thumbnail ${frameId}:`, error);
      console.error(`[ThumbnailCache] Error stack:`, error instanceof Error ? error.stack : 'unknown');
      return null;
    } finally {
      this.loadingQueue.delete(frameId);
      console.log(`[ThumbnailCache.get] Removed ${frameId} from loading queue`);
    }
  }
  
  /**
   * Generate thumbnail on-demand from full frame
   * Stores the result in IndexedDB for future use
   */
  private async generateThumbnail(frameId: string): Promise<Blob | null> {
    try {
      // Add timeout for blob retrieval
      let fullBlob: Blob | undefined;
      try {
        fullBlob = await Promise.race([
          frameStorage.getFrameBlob(frameId),
          new Promise<undefined>((_, reject) =>
            setTimeout(() => reject(new Error('Frame blob load timeout')), 5000)
          )
        ]);
      } catch (error) {
        if (error instanceof Error && error.message.includes('timeout')) {
          console.warn(`[ThumbnailCache] Timeout retrieving frame blob for ${frameId}`);
        } else {
          console.warn(`[ThumbnailCache] Failed to retrieve frame blob for ${frameId}:`, error);
        }
        return null;
      }

      if (!fullBlob || !(fullBlob instanceof Blob) || fullBlob.size === 0) {
        console.warn(`[ThumbnailCache] Invalid frame blob for ${frameId}`);
        return null;
      }

      // Generate thumbnail with error handling
      let thumbnailBlob: Blob;
      try {
        thumbnailBlob = await createThumbnail(fullBlob);
      } catch (error) {
        console.warn(`[ThumbnailCache] Failed to create thumbnail for ${frameId}:`, error);
        return null;
      }

      // Validate generated thumbnail
      if (!thumbnailBlob || !(thumbnailBlob instanceof Blob) || thumbnailBlob.size === 0) {
        console.warn(`[ThumbnailCache] Generated invalid thumbnail for ${frameId}`);
        return null;
      }

      // Store in IndexedDB for future use (best effort - don't fail if this errors)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const storage: any = frameStorage;
        if (storage.db) {
          await storage.db.put('thumbnails', {
            id: frameId,
            blob: thumbnailBlob,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.warn(`[ThumbnailCache] Failed to cache thumbnail for ${frameId}:`, error);
        // Continue - we still have the blob to return
      }

      return thumbnailBlob;
    } catch (error) {
      console.error(`[ThumbnailCache] Unexpected error generating thumbnail for ${frameId}:`, error);
      return null;
    }
  }
  
  /**
   * Preload thumbnails for frame IDs (non-blocking)
   * Loads in small batches to avoid UI blocking
   * Heavily rate-limited to prevent memory leaks from rapid image loading
   */
  async preload(frameIds: string[]): Promise<void> {
    const BATCH_SIZE = 2; // Reduced from 5 to 2 to reduce concurrent loads
    const BATCH_DELAY = 100; // Increased from 5ms to 100ms between batches

    for (let i = 0; i < frameIds.length; i += BATCH_SIZE) {
      const batch = frameIds.slice(i, i + BATCH_SIZE);

      // Load batch in parallel
      await Promise.all(
        batch.map(id => {
          // Skip if already cached or loading
          if (this.cache.has(id) || this.loadingQueue.has(id)) {
            return Promise.resolve();
          }
          return this.get(id).catch(() => {
            // Ignore preload failures silently
          });
        })
      );

      // Increased delay between batches to let GC catch up
      // This prevents memory from climbing during rapid scrolling
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }
  
  /**
   * LRU eviction when cache exceeds max size
   * Removes oldest 20% of entries based on last access time
   */
  private evictIfNeeded(): void {
    if (this.cache.size <= this.maxSize) return;
    
    // Sort by last accessed time (oldest first)
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    // Evict oldest 20% of cache
    const evictCount = Math.ceil(this.maxSize * 0.2);
    
    for (let i = 0; i < evictCount && i < entries.length; i++) {
      const [frameId, entry] = entries[i];
      URL.revokeObjectURL(entry.url);
      this.cache.delete(frameId);
    }
    
    console.log(`[ThumbnailCache] Evicted ${evictCount} thumbnails (cache size: ${this.cache.size}/${this.maxSize})`);
  }
  
  /**
   * Check if frame is cached (does not update LRU timestamp)
   */
  has(frameId: string): boolean {
    return this.cache.has(frameId);
  }
  
  /**
   * Clear entire cache and revoke all URLs
   */
  clear(): void {
    for (const entry of this.cache.values()) {
      URL.revokeObjectURL(entry.url);
    }
    this.cache.clear();
    this.loadingQueue.clear();
    console.log('[ThumbnailCache] Cache cleared');
  }
  
  /**
   * Get cache statistics for debugging
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      loading: this.loadingQueue.size,
      utilizationPercent: Math.round((this.cache.size / this.maxSize) * 100)
    };
  }
}

