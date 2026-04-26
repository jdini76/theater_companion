/**
 * Kokoro TTS — local AI voice synthesis running entirely in the browser.
 * The model is downloaded from HuggingFace on first use and cached thereafter.
 *
 * Devices:
 *   wasm   — CPU, dtype q8  (~80 MB).  Works everywhere.
 *   webgpu — GPU, dtype fp16 (~164 MB). ~5-10x faster; requires Chrome 113+.
 */

export const KOKORO_VOICES = [
  { id: "af_heart",    name: "Heart (American Female)" },
  { id: "af_bella",    name: "Bella (American Female)" },
  { id: "af_jessica",  name: "Jessica (American Female)" },
  { id: "af_sarah",    name: "Sarah (American Female)" },
  { id: "af_nicole",   name: "Nicole (American Female)" },
  { id: "af_sky",      name: "Sky (American Female)" },
  { id: "am_adam",     name: "Adam (American Male)" },
  { id: "am_michael",  name: "Michael (American Male)" },
  { id: "am_puck",     name: "Puck (American Male)" },
  { id: "am_echo",     name: "Echo (American Male)" },
  { id: "bf_emma",     name: "Emma (British Female)" },
  { id: "bf_isabella", name: "Isabella (British Female)" },
  { id: "bm_george",   name: "George (British Male)" },
  { id: "bm_lewis",    name: "Lewis (British Male)" },
] as const;

export type KokoroVoiceId = (typeof KOKORO_VOICES)[number]["id"];
export type KokoroLoadState = "idle" | "loading" | "ready" | "error";
export type KokoroDevice = "wasm" | "webgpu";

interface KokoroTTSInstance {
  generate(
    text: string,
    options: { voice: string; speed?: number },
  ): Promise<{ audio: Float32Array; sampling_rate: number }>;
}

type RawAudio = { audio: Float32Array; sampling_rate: number };

// ── Model state ───────────────────────────────────────────────────────────────

let _instance: KokoroTTSInstance | null = null;
let _loadState: KokoroLoadState = "idle";
let _loadError: string | null = null;
let _loadPromise: Promise<void> | null = null;
let _loadedDevice: KokoroDevice | null = null;
let _listeners: Array<(state: KokoroLoadState) => void> = [];

function notify() {
  _listeners.forEach((cb) => cb(_loadState));
}

export function isWebGPUSupported(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export function getKokoroLoadState(): KokoroLoadState {
  return _loadState;
}

export function getKokoroLoadError(): string | null {
  return _loadError;
}

export function getKokoroLoadedDevice(): KokoroDevice | null {
  return _loadedDevice;
}

export function onKokoroStateChange(
  cb: (state: KokoroLoadState) => void,
): () => void {
  _listeners.push(cb);
  return () => {
    _listeners = _listeners.filter((l) => l !== cb);
  };
}

/** Tear down the loaded model so it can be reloaded with a different device. */
export function resetKokoro(): void {
  _instance = null;
  _loadState = "idle";
  _loadError = null;
  _loadPromise = null;
  _loadedDevice = null;
  _pregenCache.clear();
  notify();
}

export interface LoadKokoroOptions {
  device?: KokoroDevice;
  onProgress?: (msg: string) => void;
}

export async function loadKokoro(options: LoadKokoroOptions = {}): Promise<void> {
  const device: KokoroDevice = options.device ?? "wasm";

  if (_loadState === "ready") {
    // Already loaded — if the device changed, reset first
    if (_loadedDevice !== device) {
      resetKokoro();
    } else {
      return;
    }
  }

  if (_loadState === "loading" && _loadPromise) {
    return _loadPromise;
  }

  _loadState = "loading";
  _loadError = null;
  notify();

  _loadPromise = (async () => {
    try {
      options.onProgress?.("Importing kokoro-js…");
      const { KokoroTTS } = await import("kokoro-js");

      const dtype = device === "webgpu" ? "fp32" : "q8";
      const sizeHint = device === "webgpu" ? "~300 MB" : "~80 MB";
      options.onProgress?.(
        `Downloading model (first run only, ${sizeHint})…`,
      );

      _instance = (await KokoroTTS.from_pretrained(
        "onnx-community/Kokoro-82M-v1.0-ONNX",
        { dtype, device },
      )) as KokoroTTSInstance;

      _loadedDevice = device;
      _loadState = "ready";
      notify();
    } catch (err) {
      _loadState = "error";
      _loadError =
        err instanceof Error ? err.message : "Failed to load Kokoro model";
      notify();
      throw err;
    }
  })();

  return _loadPromise;
}

// ── Pre-generation cache ──────────────────────────────────────────────────────
// Generates audio in the background while the previous line is still playing,
// so playback of the next line can start immediately.

const _pregenCache = new Map<string, Promise<RawAudio>>();
const PREGEN_CACHE_MAX = 4;

function pregenKey(text: string, voice: string, speed: number): string {
  return `${voice}|${speed}|${text}`;
}

/**
 * Kick off background audio generation for an upcoming line.
 * Safe to call when the model isn't loaded — it becomes a no-op.
 */
export function pregenerateText(
  text: string,
  options: { voice?: string; speed?: number } = {},
): void {
  if (_loadState !== "ready" || !_instance || !text.trim()) return;

  const voice = options.voice ?? "am_puck";
  const speed = options.speed ?? 1;
  const key = pregenKey(text, voice, speed);

  if (_pregenCache.has(key)) return;

  // Evict oldest entry if over limit
  if (_pregenCache.size >= PREGEN_CACHE_MAX) {
    const firstKey = _pregenCache.keys().next().value;
    if (firstKey !== undefined) _pregenCache.delete(firstKey);
  }

  _pregenCache.set(key, _instance.generate(text, { voice, speed }));
}

// ── Audio playback ────────────────────────────────────────────────────────────

let _audioCtx: AudioContext | null = null;
let _currentSource: AudioBufferSourceNode | null = null;

function getAudioContext(): AudioContext {
  if (!_audioCtx) {
    _audioCtx = new (
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext!
    )();
  }
  return _audioCtx;
}

export function stopKokoroAudio(): void {
  if (_currentSource) {
    try {
      _currentSource.stop();
    } catch {
      // already stopped
    }
    _currentSource = null;
  }
}

export function isKokoroPlaying(): boolean {
  return _currentSource !== null;
}

export async function speakTextViaKokoro(
  text: string,
  options: { voice?: string; speed?: number; volume?: number } = {},
): Promise<void> {
  if (typeof window === "undefined") return;

  if (_loadState !== "ready" || !_instance) {
    throw new Error(
      "Kokoro model is not loaded. Open Settings → Voice Settings and click Load Model.",
    );
  }

  stopKokoroAudio();

  const voice = options.voice ?? "am_puck";
  const speed = options.speed ?? 1;
  const key = pregenKey(text, voice, speed);

  // Use pre-generated audio if available, otherwise generate now
  let rawPromise = _pregenCache.get(key);
  if (rawPromise) {
    _pregenCache.delete(key);
  } else {
    rawPromise = _instance.generate(text, { voice, speed });
  }

  const raw = await rawPromise;

  const ctx = getAudioContext();
  if (ctx.state === "suspended") await ctx.resume();

  const buffer = ctx.createBuffer(1, raw.audio.length, raw.sampling_rate);
  buffer.getChannelData(0).set(raw.audio);

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.value = Math.max(0, Math.min(1, options.volume ?? 1));

  source.connect(gain);
  gain.connect(ctx.destination);

  _currentSource = source;

  return new Promise<void>((resolve) => {
    source.onended = () => {
      _currentSource = null;
      resolve();
    };
    source.start();
  });
}
