/**
 * Audio file caching using IndexedDB
 */

const DB_NAME = "theater_audio_cache";
const DB_VERSION = 1;
const STORE_NAME = "audio_files";

export interface CachedAudio {
  key: string;
  characterName: string;
  text: string;
  blob: Blob;
  createdAt: number;
}

let db: IDBDatabase | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "key",
        });
        store.createIndex("characterName", "characterName", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
  });
}

/**
 * Generate a cache key for a line of dialogue.
 * Uses a djb2-style hash that safely handles Unicode characters.
 * voiceSignature (e.g. "elevenlabs:SAz9YHcvj6GT2YYXdXww") is included so
 * switching providers or voices produces a different key.
 */
export function generateCacheKey(
  characterName: string,
  text: string,
  voiceSignature?: string,
): string {
  const input = voiceSignature ? `${voiceSignature}:${text}` : text;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
    hash = hash >>> 0; // keep as unsigned 32-bit
  }
  return `${characterName}:${hash.toString(36)}`;
}

/**
 * Save audio blob to cache
 */
export async function cacheAudioFile(
  characterName: string,
  text: string,
  blob: Blob,
  voiceSignature?: string,
): Promise<void> {
  try {
    const database = await getDB();
    const key = generateCacheKey(characterName, text, voiceSignature);

    const cached: CachedAudio = {
      key,
      characterName,
      text,
      blob,
      createdAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(cached);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log(
          `[Audio Cache] 💾 SAVED: "${characterName}" — "${text.substring(0, 40)}${text.length > 40 ? "..." : ""}" (${(blob.size / 1024).toFixed(1)} KB)`,
        );
        resolve();
      };
    });
  } catch (err) {
    console.warn("Failed to cache audio:", err);
  }
}

/**
 * Retrieve cached audio blob
 */
export async function getCachedAudioFile(
  characterName: string,
  text: string,
  voiceSignature?: string,
): Promise<Blob | null> {
  try {
    const database = await getDB();
    const key = generateCacheKey(characterName, text, voiceSignature);

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result as CachedAudio | undefined;
        if (result?.blob) {
          console.log(
            `[Audio Cache] ✅ HIT: "${characterName}" — "${text.substring(0, 40)}${text.length > 40 ? "..." : ""}"`,
          );
          resolve(result.blob);
        } else {
          console.log(
            `[Audio Cache] ❌ MISS: "${characterName}" — "${text.substring(0, 40)}${text.length > 40 ? "..." : ""}"`,
          );
          resolve(null);
        }
      };
    });
  } catch (err) {
    console.warn("Failed to retrieve cached audio:", err);
    return null;
  }
}

/**
 * Delete cached audio for a character
 */
export async function deleteCachedAudioForCharacter(
  characterName: string,
): Promise<void> {
  try {
    const database = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("characterName");
      const request = index.openCursor(IDBKeyRange.only(characterName));

      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  } catch (err) {
    console.warn("Failed to delete cached audio:", err);
  }
}

/**
 * Clear all cached audio
 */
export async function clearAllCachedAudio(): Promise<void> {
  try {
    const database = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.warn("Failed to clear audio cache:", err);
  }
}

/**
 * Encode PCM audio data as a WAV blob
 */
function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;

  // PCM data
  const pcmData = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const dataLength = pcmData.length * bytesPerSample;
  const fileLength = 36 + dataLength;

  const arrayBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, fileLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  // PCM data
  const pcmView = new Int16Array(arrayBuffer, 44);
  pcmView.set(pcmData);

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

/**
 * Cache Kokoro audio as a WAV blob
 */
export async function cacheKokoroAudio(
  characterName: string,
  text: string,
  samples: Float32Array,
  samplingRate: number,
  voiceSignature?: string,
): Promise<void> {
  try {
    const wavBlob = encodeWAV(samples, samplingRate);
    await cacheAudioFile(characterName, text, wavBlob, voiceSignature);
  } catch (err) {
    console.warn("Failed to cache Kokoro audio:", err);
  }
}

/**
 * Retrieve all cached audio entries from IndexedDB.
 */
export async function getAllCachedAudio(): Promise<CachedAudio[]> {
  try {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as CachedAudio[]);
    });
  } catch {
    return [];
  }
}

/**
 * Return the number of cached audio files and their combined size in bytes.
 */
export async function getAudioCacheStats(): Promise<{
  count: number;
  totalSizeBytes: number;
}> {
  try {
    const entries = await getAllCachedAudio();
    const totalSizeBytes = entries.reduce((sum, e) => sum + e.blob.size, 0);
    return { count: entries.length, totalSizeBytes };
  } catch {
    return { count: 0, totalSizeBytes: 0 };
  }
}
