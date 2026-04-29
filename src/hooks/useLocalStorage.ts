import { useState, useEffect } from "react";

/**
 * Hook for persisting and retrieving values from localStorage
 * @param key - The localStorage key
 * @param initialValue - The initial value if key doesn't exist
 * @returns [value, setValue] - Similar to useState
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Hydrate from localStorage after component mounts
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const item = window.localStorage.getItem(key);
        if (item) {
          setStoredValue(JSON.parse(item) as T);
        }
      }
    } catch (error) {
      console.error(`Error reading from localStorage key "${key}":`, error);
    }
  }, [key]);

  // Update localStorage when the state changes
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      if (value instanceof Function) {
        setStoredValue((prev) => {
          const next = value(prev);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(key, JSON.stringify(next));
          }
          return next;
        });
      } else {
        setStoredValue(value);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(value));
        }
      }
    } catch (error) {
      console.error(`Error writing to localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue] as const;
}
