import { FileSystem } from '../types';

const DB_NAME = 'MominAiCache';
const STORE_NAME = 'projects';
const DB_VERSION = 1;

export interface CachedProject {
  id: string;
  npmCache: FileSystem;
  packageJsonContent: string;
  timestamp: number;
}

let db: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("IndexedDB error:", request.error);
      reject(new Error("Failed to open IndexedDB. Caching will be disabled."));
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

const getStore = async (mode: IDBTransactionMode): Promise<IDBObjectStore> => {
    const dbInstance = await openDB();
    const transaction = dbInstance.transaction(STORE_NAME, mode);
    return transaction.objectStore(STORE_NAME);
};

export const cacheService = {
  async getProjectCache(projectId: string): Promise<CachedProject | null> {
    try {
        const store = await getStore('readonly');
        const request = store.get(projectId);
        return new Promise((resolve, reject) => {
          request.onsuccess = () => {
            resolve(request.result || null);
          };
          request.onerror = () => {
            reject(request.error);
          };
        });
    } catch(e) {
        console.error("Failed to get project cache:", e);
        return null;
    }
  },

  async setProjectCache(projectId: string, npmCache: FileSystem, packageJsonContent: string): Promise<void> {
    try {
        const store = await getStore('readwrite');
        const cacheEntry: CachedProject = {
          id: projectId,
          npmCache,
          packageJsonContent,
          timestamp: Date.now(),
        };
        const request = store.put(cacheEntry);
        return new Promise((resolve, reject) => {
          request.onsuccess = () => {
            resolve();
          };
          request.onerror = () => {
            reject(request.error);
          };
        });
    } catch(e) {
        console.error("Failed to set project cache:", e);
    }
  },

  async clearProjectCache(projectId: string): Promise<void> {
    try {
        const store = await getStore('readwrite');
        const request = store.delete(projectId);
         return new Promise((resolve, reject) => {
          request.onsuccess = () => {
            resolve();
          };
          request.onerror = () => {
            reject(request.error);
          };
        });
    } catch(e) {
        console.error("Failed to clear project cache:", e);
    }
  },
};