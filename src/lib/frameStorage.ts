import { openDB, deleteDB, DBSchema, IDBPDatabase } from 'idb';
import { type FrameMetadata, type StoredFrameData } from '@/types/frame';
import { createThumbnail } from './imageUtils';

interface FrameDBSchema extends DBSchema {
  frames: {
    key: string;
    value: StoredFrameData;
    indexes: {
      'by-timestamp': number;
    };
  };
  metadata: {
    key: string;
    value: FrameMetadata;
    indexes: {
      'by-timestamp': number;
    };
  };
  thumbnails: {
    key: string;
    value: { id: string; blob: Blob; timestamp: number };
  };
}

class FrameStorage {
  private db: IDBPDatabase<FrameDBSchema> | null = null;
  private dbName = 'frame-storage';
  private readonly frameStore = 'frames' as const;
  private readonly metadataStore = 'metadata' as const;
  private readonly thumbnailStore = 'thumbnails' as const;
  private version = 3; // Increment version to add thumbnail store

  async init() {
    if (this.db) {
      await this.close();
    }

    try {
      this.db = await openDB<FrameDBSchema>(this.dbName, this.version, {
        upgrade(db, oldVersion) {
          // Delete old stores if they exist
          if (oldVersion < 2) {
            if (db.objectStoreNames.contains('frames')) {
              db.deleteObjectStore('frames');
            }
            if (db.objectStoreNames.contains('metadata')) {
              db.deleteObjectStore('metadata');
            }
          }

          // Create new stores with indexes
          if (!db.objectStoreNames.contains('frames')) {
            const frameStore = db.createObjectStore('frames', { keyPath: 'id' });
            frameStore.createIndex('by-timestamp', 'timestamp');
          }

          if (!db.objectStoreNames.contains('metadata')) {
            const metadataStore = db.createObjectStore('metadata', { keyPath: 'id' });
            metadataStore.createIndex('by-timestamp', 'timestamp');
          }

          // Add thumbnail store in version 3
          if (oldVersion < 3 && !db.objectStoreNames.contains('thumbnails')) {
            db.createObjectStore('thumbnails', { keyPath: 'id' });
          }
        },
        blocked() {
          // Database upgrade blocked - another tab is using this app
        },
        terminated() {
          // Database connection terminated unexpectedly
        }
      });
    } catch {
      // Try to recover by deleting and recreating the database
      await this.delete();
      this.db = await openDB<FrameDBSchema>(this.dbName, this.version, {
        upgrade(db) {
          const frameStore = db.createObjectStore('frames', { keyPath: 'id' });
          frameStore.createIndex('by-timestamp', 'timestamp');
          
          const metadataStore = db.createObjectStore('metadata', { keyPath: 'id' });
          metadataStore.createIndex('by-timestamp', 'timestamp');

          db.createObjectStore('thumbnails', { keyPath: 'id' });
        }
      });
    }
  }

  async storeFrame(frame: StoredFrameData) {
    if (!this.db) await this.init();
    
    // Store full frame data
    await this.db!.put(this.frameStore, frame);
    
    // Generate and store thumbnail
    try {
      const thumbnail = await createThumbnail(frame.blob);
      await this.db!.put(this.thumbnailStore, {
        id: frame.id,
        blob: thumbnail,
        timestamp: frame.timestamp
      });
    } catch {
      // Failed to create thumbnail - continue without it
    }

    // Store metadata separately
    const metadata: FrameMetadata = {
      id: frame.id,
      name: frame.name,
      timestamp: frame.timestamp,
      format: frame.format,
      sharpnessScore: frame.sharpnessScore,
      selected: frame.selected,
    };
    await this.db!.put(this.metadataStore, metadata);
  }

  async storeFrameBatch(frames: StoredFrameData[], options: { skipThumbnails?: boolean } = {}) {
    if (!this.db) await this.init();
    
    const stores = options.skipThumbnails 
      ? [this.frameStore, this.metadataStore]
      : [this.frameStore, this.metadataStore, this.thumbnailStore];
    
    const transaction = this.db!.transaction(stores, 'readwrite');
    
    try {
      // Batch all frame and metadata operations (no awaiting inside map)
      const operations = frames.map(async (frame) => {
        // Store full frame data
        const framePromise = transaction.objectStore(this.frameStore).put(frame);
        
        // Store metadata
        const metadata: FrameMetadata = {
          id: frame.id,
          name: frame.name,
          timestamp: frame.timestamp,
          format: frame.format,
          sharpnessScore: frame.sharpnessScore,
          selected: frame.selected,
        };
        const metadataPromise = transaction.objectStore(this.metadataStore).put(metadata);
        
        return Promise.all([framePromise, metadataPromise]);
      });
      
      // Execute all operations in parallel
      await Promise.all(operations);
      await transaction.done;
      
      // Generate thumbnails lazily in background (don't block extraction)
      if (!options.skipThumbnails) {
        this.generateThumbnailsAsync(frames).catch(() => {
          // Background thumbnail generation failed
        });
      }
    } catch (error) {
      transaction.abort();
      throw error;
    }
  }
  
  // Background thumbnail generation (non-blocking)
  private async generateThumbnailsAsync(frames: StoredFrameData[]) {
    if (!this.db) return;
    
    // Process thumbnails in smaller batches to avoid blocking UI
    const THUMBNAIL_BATCH_SIZE = 8;
    
    for (let i = 0; i < frames.length; i += THUMBNAIL_BATCH_SIZE) {
      const batch = frames.slice(i, i + THUMBNAIL_BATCH_SIZE);
      
      try {
        const thumbnailPromises = batch.map(async (frame) => {
          try {
            const thumbnail = await createThumbnail(frame.blob);
            return {
              id: frame.id,
              blob: thumbnail,
              timestamp: frame.timestamp
            };
          } catch {
            return null;
          }
        });
        
        const thumbnails = (await Promise.all(thumbnailPromises)).filter(t => t !== null);
        
        if (thumbnails.length > 0) {
          const transaction = this.db.transaction([this.thumbnailStore], 'readwrite');
          await Promise.all(
            thumbnails.map(thumbnail => 
              transaction.objectStore(this.thumbnailStore).put(thumbnail)
            )
          );
          await transaction.done;
        }
        
        // Small delay between batches to keep UI responsive
        await new Promise(resolve => setTimeout(resolve, 5));
      } catch {
        // Continue with next batch even if this one fails
      }
    }
  }

  async getFrameThumbnail(id: string): Promise<Blob | undefined> {
    if (!this.db) await this.init();
    const thumbnail = await this.db!.get(this.thumbnailStore, id);
    return thumbnail?.blob;
  }

  async getFrameMetadata(id: string): Promise<FrameMetadata | undefined> {
    if (!this.db) await this.init();
    return await this.db!.get(this.metadataStore, id);
  }

  async getAllMetadata(): Promise<FrameMetadata[]> {
    if (!this.db) await this.init();
    return await this.db!.getAll(this.metadataStore);
  }

  async getFrameBlob(id: string): Promise<Blob | undefined> {
    if (!this.db) await this.init();
    try {
      const frame = await this.db!.get(this.frameStore, id);

      // Validate blob exists and is valid
      if (!frame) {
        return undefined;
      }

      if (!frame.blob || !(frame.blob instanceof Blob)) {
        return undefined;
      }

      return frame.blob;
    } catch (error) {
      return undefined;
    }
  }

  async getFrameData(id: string): Promise<Uint8Array | undefined> {
    if (!this.db) await this.init();
    const frame = await this.db!.get(this.frameStore, id);
    return frame?.data;
  }

  async deleteFrame(id: string) {
    if (!this.db) await this.init();
    await Promise.all([
      this.db!.delete(this.frameStore, id),
      this.db!.delete(this.metadataStore, id)
    ]);
  }

  async clear() {
    if (!this.db) await this.init();
    await Promise.all([
      this.db!.clear(this.frameStore),
      this.db!.clear(this.metadataStore),
      this.db!.clear(this.thumbnailStore)
    ]);
  }

  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async delete() {
    await this.close();
    await deleteDB(this.dbName);
  }

  // Helper method to update metadata without touching blob data
  async updateMetadata(id: string, updates: Partial<FrameMetadata>) {
    if (!this.db) await this.init();
    const metadata = await this.getFrameMetadata(id);
    if (metadata) {
      const updated = { ...metadata, ...updates };
      await this.db!.put(this.metadataStore, updated);
    }
  }
}

export const frameStorage = new FrameStorage();
