'use client';

const DB_NAME = 'frame-extraction';
const STORE_NAME = 'frames';
let db: IDBDatabase | null = null;

export async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB database'));
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
  });
}

export async function clearObjectStore(): Promise<void> {
  const database = await openDatabase();
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => {
        reject(new Error('Failed to clear object store'));
      };

      transaction.oncomplete = () => {
        resolve();
      };
    } catch (error) {
      reject(error);
    }
  });
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    db.close();
    db = null;
  }
}

// Initialize the database when the module loads
openDatabase().catch(console.error);

export const frameStorage = {
  async clear(): Promise<void> {
    try {
      await clearObjectStore();
    } catch (error) {
      console.error('Error clearing frame storage:', error);
      // If clearing fails, try closing and reopening the database
      await closeDatabase();
      await openDatabase();
      await clearObjectStore();
    }
  }
};
