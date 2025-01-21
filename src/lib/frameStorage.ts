import { openDB, deleteDB, DBSchema, IDBPDatabase } from 'idb';

interface FrameDBSchema extends DBSchema {
  frames: {
    key: string;
    value: {
      id: string;
      blob: Blob;
      name: string;
      format: string;
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
          db.createObjectStore('frames', { keyPath: 'id' });
        }
      },
    });
  }

  async storeFrame(frame: { id: string; blob: Blob; name: string; format: string }) {
    if (!this.db) await this.init();
    await this.db!.put(this.storeName, frame);
  }

  async getFrame(id: string) {
    if (!this.db) await this.init();
    return await this.db!.get(this.storeName, id);
  }

  async getAllFrames() {
    if (!this.db) await this.init();
    return await this.db!.getAll(this.storeName);
  }

  async clear() {
    if (!this.db) await this.init();
    await this.db!.clear(this.storeName);
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
}

export const frameStorage = new FrameStorage();
