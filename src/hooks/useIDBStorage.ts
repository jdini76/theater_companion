import { useState, useEffect } from "react";
import { idbGet, idbSet, idbDelete } from "@/lib/idb";

/**
 * Drop-in replacement for useLocalStorage that persists to IndexedDB.
 * IndexedDB has no practical size limit, making it suitable for large data
 * like full script content that would exceed localStorage's ~5 MB quota.
 *
 * On first use it performs a one-time migration: if the key exists in
 * localStorage it is moved to IndexedDB and removed from localStorage.
 */
export function useIDBStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Hydrate from IDB after mount (with one-time localStorage migration)
  useEffect(() => {
    async function hydrate() {
      try {
        // Migration: move existing localStorage data into IDB once
        if (typeof window !== "undefined") {
          const lsRaw = window.localStorage.getItem(key);
          if (lsRaw !== null) {
            try {
              const parsed = JSON.parse(lsRaw) as T;
              await idbSet(key, parsed);
              window.localStorage.removeItem(key);
              setStoredValue(parsed);
              return;
            } catch {
              // Malformed localStorage entry — ignore and fall through to IDB read
              window.localStorage.removeItem(key);
            }
          }
        }

        const value = await idbGet<T>(key);
        if (value !== null) {
          setStoredValue(value);
        }
      } catch (err) {
        console.error(`useIDBStorage: error hydrating key "${key}":`, err);
      }
    }
    hydrate();
  }, [key]);

  const setValue = (value: T | ((val: T) => T)) => {
    setStoredValue((prev) => {
      const next = value instanceof Function ? value(prev) : value;
      idbSet(key, next).catch((err) =>
        console.error(`useIDBStorage: error writing key "${key}":`, err),
      );
      return next;
    });
  };

  const removeValue = () => {
    setStoredValue(initialValue);
    idbDelete(key).catch((err) =>
      console.error(`useIDBStorage: error deleting key "${key}":`, err),
    );
  };

  return [storedValue, setValue, removeValue] as const;
}
