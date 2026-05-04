/**
 * Minimal IndexedDB key-value wrapper.
 * Used for storing large data (e.g. scenes with full script content) that
 * would exceed the ~5 MB localStorage quota.
 */

const DB_NAME = "theater_app";
const STORE_NAME = "kv";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null; // allow retry on next call
      reject(req.error);
    };
  });
  return dbPromise;
}

export async function idbGet<T>(key: string): Promise<T | null> {
  if (typeof window === "undefined") return null;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(STORE_NAME, "readwrite")
      .objectStore(STORE_NAME)
      .put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function idbDelete(key: string): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(STORE_NAME, "readwrite")
      .objectStore(STORE_NAME)
      .delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
