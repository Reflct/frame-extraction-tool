import { openDB, deleteDB, DBSchema, IDBPDatabase } from 'idb';

interface FrameDBSchema extends DBSchema {
  frames: {
    key: string;
    value: {
      id: string;
      index: number;
      blob: Blob;
      fileName: string;
      format: 'jpeg' | 'png';
    };
    indexes: {
      'by-index': number;
    };
  };
}

class FrameStorage {
  private db: IDBPDatabase<FrameDBSchema> | null = null;
  private dbName = 'frame-storage';
  private readonly storeName = 'frames' as const;

  async init() {
    if (this.db) {
      await this.close();
    }

    this.db = await openDB<FrameDBSchema>(this.dbName, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('frames')) {
          const store = db.createObjectStore('frames', { keyPath: 'id' });
          store.createIndex('by-index', 'index');
        }
      },
    });
  }

  async storeFrame(frameId: string, blob: Blob, fileName: string, format: 'jpeg' | 'png') {
    if (!this.db) await this.init();
    const index = parseInt(frameId);
    await this.db!.put(this.storeName, { 
      id: frameId,
      index,
      blob, 
      fileName,
      format
    });
  }

  async getAllFrames() {
    if (!this.db) await this.init();
    const frames = await this.db!.getAllFromIndex(
      this.storeName,
      'by-index'
    );
    return frames;
  }

  async clear() {
    try {
      // Close any existing connections
      if (this.db) {
        this.db.close();
        this.db = null;
      }

      // Delete using idb library
      await deleteDB(this.dbName);

      // Force delete using native IndexedDB
      const request = window.indexedDB.deleteDatabase(this.dbName);
      await new Promise((resolve, reject) => {
        request.onsuccess = () => {
          console.log('Database deleted successfully');
          resolve(undefined);
        };
        request.onerror = () => {
          console.error('Error deleting database');
          reject(request.error);
        };
      });

      // Double check deletion
      const databases = await window.indexedDB.databases();
      if (databases.some(db => db.name === this.dbName)) {
        throw new Error('Failed to delete database');
      }

      // Initialize fresh database
      await this.init();
    } catch (error) {
      console.error('Error clearing IndexedDB:', error);
      throw error;
    }
  }

  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const frameStorage = new FrameStorage();
