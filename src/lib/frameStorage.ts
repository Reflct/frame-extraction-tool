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
          console.warn('Database upgrade blocked. Please close other tabs using this app.');
        },
        terminated() {
          console.error('Database connection terminated unexpectedly.');
        }
      });
    } catch (error) {
      console.error('Failed to initialize database:', error);
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
    } catch (error) {
      console.error('Failed to create thumbnail:', error);
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
    const frame = await this.db!.get(this.frameStore, id);
    return frame?.blob;
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
