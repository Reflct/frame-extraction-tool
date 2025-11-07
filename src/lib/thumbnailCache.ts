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
    // Check cache first
    const cached = this.cache.get(frameId);
    if (cached) {
      cached.lastAccessed = Date.now();
      return cached.url;
    }
    
    // Don't load if already in queue
    if (this.loadingQueue.has(frameId)) {
      return null;
    }
    
    // Load thumbnail from IndexedDB
    this.loadingQueue.add(frameId);
    try {
      let blob = await frameStorage.getFrameThumbnail(frameId);
      
      // If thumbnail doesn't exist and we should generate it, create on-demand
      if (!blob && generateIfMissing) {
        const generated = await this.generateThumbnail(frameId);
        if (generated) {
          blob = generated;
        }
      }
      
      if (!blob) {
        return null;
      }
      
      const url = URL.createObjectURL(blob);
      
      // Add to cache
      this.cache.set(frameId, {
        url,
        lastAccessed: Date.now(),
        frameId
      });
      
      // Enforce cache size limit with LRU eviction
      this.evictIfNeeded();
      
      return url;
    } catch (error) {
      console.error(`[ThumbnailCache] Error loading thumbnail ${frameId}:`, error);
      return null;
    } finally {
      this.loadingQueue.delete(frameId);
    }
  }
  
  /**
   * Generate thumbnail on-demand from full frame
   * Stores the result in IndexedDB for future use
   */
  private async generateThumbnail(frameId: string): Promise<Blob | null> {
    try {
      // Get full frame from IndexedDB
      const fullBlob = await frameStorage.getFrameBlob(frameId);
      if (!fullBlob) {
        return null;
      }
      
      // Generate thumbnail
      const thumbnailBlob = await createThumbnail(fullBlob);
      
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
      } catch {
        // Failed to store, but we still have the blob to return
      }
      
      return thumbnailBlob;
    } catch (error) {
      console.error(`[ThumbnailCache] Failed to generate thumbnail for ${frameId}:`, error);
      return null;
    }
  }
  
  /**
   * Preload thumbnails for frame IDs (non-blocking)
   * Loads in small batches to avoid UI blocking
   */
  async preload(frameIds: string[]): Promise<void> {
    const BATCH_SIZE = 5;
    
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
      
      // Small delay between batches to keep UI responsive
      await new Promise(resolve => setTimeout(resolve, 5));
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

