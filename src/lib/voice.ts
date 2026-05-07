import {
  VoiceConfig,
  CharacterRole,
  VoiceOption,
  TTSSettings,
} from "@/types/voice";
import { getCachedAudioFile, cacheAudioFile } from "@/lib/audio-cache";

const TTS_SETTINGS_KEY = "theater_tts_settings";

const DEFAULT_TTS_SETTINGS: TTSSettings = {
  provider: "browser",
  apiUrl: "",
  apiPath: "/v1/audio/speech",
  apiKey: "",
  defaultVoiceId: "",
  responseFormat: "mp3",
  stream: true,
  extraPayload: {},
  previewText: "Hello, this is a voice test.",
  kokoroVoice: "am_puck",
  kokoroSpeed: 1,
  kokoroDevice: "wasm",
  enableAudioCache: false,
};

/**
 * Load TTS settings from localStorage
 */
export function getTTSSettings(): TTSSettings {
  if (typeof window === "undefined") return DEFAULT_TTS_SETTINGS;
  try {
    const raw = localStorage.getItem(TTS_SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_TTS_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_TTS_SETTINGS;
}

/**
 * Get available voices from the browser's SpeechSynthesis API
 */
export function getAvailableVoices(): VoiceOption[] {
  if (typeof window === "undefined") {
    return [];
  }

  const synth = window.speechSynthesis;
  if (!synth) {
    return [];
  }

  // Load voices (might be async in some browsers)
  const voices = synth.getVoices();
  return voices.map((voice) => ({
    name: voice.name,
    lang: voice.lang,
    voiceURI: voice.voiceURI,
  }));
}

/**
 * Get voices in a specific language
 */
export function getVoicesByLanguage(lang: string): VoiceOption[] {
  return getAvailableVoices().filter((voice) => voice.lang.startsWith(lang));
}

/**
 * Get all unique languages available
 */
export function getAvailableLanguages(): string[] {
  const languages = new Set<string>();
  getAvailableVoices().forEach((voice) => {
    const lang = voice.lang.split("-")[0];
    languages.add(lang);
  });
  return Array.from(languages).sort();
}

/**
 * Generate voice config ID
 */
export function generateVoiceConfigId(): string {
  return `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a voice configuration
 */
export function createVoiceConfig(
  characterName: string,
  voiceName: string,
  options?: { rate?: number; pitch?: number; volume?: number },
): VoiceConfig {
  const now = new Date().toISOString();
  return {
    id: generateVoiceConfigId(),
    characterName,
    voiceName,
    rate: Math.max(0.1, Math.min(10, options?.rate ?? 1)),
    pitch: Math.max(0, Math.min(2, options?.pitch ?? 1)),
    volume: Math.max(0, Math.min(1, options?.volume ?? 1)),
    muted: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update a voice configuration
 */
export function updateVoiceConfig(
  config: VoiceConfig,
  updates: Partial<Omit<VoiceConfig, "id" | "characterName" | "createdAt">>,
): VoiceConfig {
  return {
    ...config,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Validate voice config values
 */
export function validateVoiceConfig(config: Partial<VoiceConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.rate !== undefined) {
    if (config.rate < 0.1 || config.rate > 10) {
      errors.push("Rate must be between 0.1 and 10");
    }
  }

  if (config.pitch !== undefined) {
    if (config.pitch < 0 || config.pitch > 2) {
      errors.push("Pitch must be between 0 and 2");
    }
  }

  if (config.volume !== undefined) {
    if (config.volume < 0 || config.volume > 1) {
      errors.push("Volume must be between 0 and 1");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Speak text with given configuration
 */
export function speakText(
  text: string,
  voiceConfig: VoiceConfig,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Speech synthesis not available"));
      return;
    }

    const synth = window.speechSynthesis;
    if (!synth) {
      reject(new Error("Speech synthesis not supported"));
      return;
    }

    if (voiceConfig.muted) {
      resolve();
      return;
    }

    // Cancel any ongoing speech
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = voiceConfig.rate;
    utterance.pitch = voiceConfig.pitch;
    utterance.volume = voiceConfig.volume;

    // Find and set the voice — try exact match first, then strip quality
    // suffixes like "(Enhanced)" or "(Premium)" which iOS doesn't expose
    // through the Web Speech API even when those variants are downloaded.
    const voices = synth.getVoices();
    const normName = (n: string) =>
      n
        .replace(/\s*\((enhanced|premium|hd)\)\s*$/i, "")
        .trim()
        .toLowerCase();
    const voice =
      voices.find((v) => v.name === voiceConfig.voiceName) ??
      voices.find(
        (v) => normName(v.name) === normName(voiceConfig.voiceName ?? ""),
      );
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(new Error(event.error));

    synth.speak(utterance);
  });
}

/**
 * Stop speaking
 */
export function stopSpeaking(): void {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (synth) {
    synth.cancel();
  }
}

/**
 * Check if currently speaking
 */
export function isSpeaking(): boolean {
  if (typeof window === "undefined") return false;
  const synth = window.speechSynthesis;
  return synth ? synth.speaking : false;
}

/**
 * Generate character ID
 */
export function generateCharacterId(): string {
  return `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a character role
 */
export function createCharacter(
  projectId: string,
  characterName: string,
  description?: string,
  actorName?: string,
): CharacterRole {
  const now = new Date().toISOString();
  return {
    id: generateCharacterId(),
    projectId,
    characterName,
    description,
    actorName,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update a character
 */
export function updateCharacter(
  character: CharacterRole,
  updates: Partial<Omit<CharacterRole, "id" | "projectId" | "createdAt">>,
): CharacterRole {
  return {
    ...character,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Validate character name
 */
export function validateCharacterName(name: string): {
  valid: boolean;
  error?: string;
} {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: "Character name cannot be empty" };
  }
  if (name.length > 100) {
    return {
      valid: false,
      error: "Character name must be less than 100 characters",
    };
  }
  return { valid: true };
}

/**
 * Format voice options for select dropdown
 */
export function formatVoiceOption(voice: VoiceOption): string {
  return `${voice.name} (${voice.lang})`;
}

/**
 * Get default voice for language
 */
export function getDefaultVoiceForLanguage(lang: string): VoiceOption | null {
  const voices = getVoicesByLanguage(lang);
  return voices.length > 0 ? voices[0] : null;
}

// ── Character name matching ─────────────────────────────────────────────────

/**
 * Check whether two character names refer to the same person.
 * Tries exact (case-insensitive), then first-name / prefix match.
 *
 * Examples that match:
 *   "PHIL" ↔ "Phil Connors"
 *   "phil connors" ↔ "PHIL CONNORS"
 */
export function characterNamesMatch(a: string, b: string): boolean {
  const au = a.trim().toUpperCase();
  const bu = b.trim().toUpperCase();
  if (!au || !bu) return false;

  // Exact match
  if (au === bu) return true;

  // Fuzzy match: all words in the shorter name must appear in the longer name
  const aWords = au.split(/\s+/).filter(Boolean);
  const bWords = bu.split(/\s+/).filter(Boolean);

  // If either is a single word, allow first-name match
  if (aWords.length === 1 && bWords.includes(aWords[0])) return true;
  if (bWords.length === 1 && aWords.includes(bWords[0])) return true;

  // Check if all words in the shorter name are present in the longer name
  const [shorter, longer] =
    aWords.length <= bWords.length ? [aWords, bWords] : [bWords, aWords];
  if (shorter.every((word) => longer.includes(word))) return true;

  return false;
}

// ── External TTS API ────────────────────────────────────────────────────────

export interface ApiVoice {
  id: string;
  name?: string;
}

/**
 * Fetch available voices from the TTS API.
 * GET {apiUrl}/v1/audio/voices
 */
// Deepgram Aura voices (hardcoded — no public list endpoint needed)
const DEEPGRAM_VOICES: ApiVoice[] = [
  { id: "aura-asteria-en", name: "Asteria (Female, US)" },
  { id: "aura-luna-en", name: "Luna (Female, US)" },
  { id: "aura-stella-en", name: "Stella (Female, US)" },
  { id: "aura-athena-en", name: "Athena (Female, British)" },
  { id: "aura-hera-en", name: "Hera (Female, US)" },
  { id: "aura-orion-en", name: "Orion (Male, US)" },
  { id: "aura-arcas-en", name: "Arcas (Male, US)" },
  { id: "aura-perseus-en", name: "Perseus (Male, US)" },
  { id: "aura-angus-en", name: "Angus (Male, Irish)" },
  { id: "aura-orpheus-en", name: "Orpheus (Male, US)" },
  { id: "aura-helios-en", name: "Helios (Male, British)" },
  { id: "aura-zeus-en", name: "Zeus (Male, US)" },
];

export async function fetchApiVoices(
  settings: TTSSettings,
): Promise<ApiVoice[]> {
  if (!settings.apiUrl) {
    throw new Error("TTS API URL is not configured.");
  }

  const apiType = settings.externalApiType ?? "custom";
  const isElevenLabs = apiType === "elevenlabs";
  const isDeepgram = apiType === "deepgram";

  // Deepgram voices are a fixed set — return locally rather than fetching
  if (isDeepgram) return DEEPGRAM_VOICES;

  const baseUrl = settings.apiUrl.replace(/\/+$/, "");
  const url = isElevenLabs
    ? `${baseUrl}/v1/voices`
    : `${baseUrl}/v1/audio/voices`;

  const headers: Record<string, string> = {};
  const effectiveKey = isElevenLabs
    ? settings.elevenLabsApiKey || settings.apiKey
    : settings.apiKey;
  if (effectiveKey) {
    if (isElevenLabs) {
      headers["xi-api-key"] = effectiveKey;
    } else {
      headers["Authorization"] = `Bearer ${effectiveKey}`;
    }
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Failed to fetch voices (${response.status}): ${errorText || response.statusText}`,
    );
  }

  const data = await response.json();

  // Handle common response shapes:
  // { voices: [...] } or [...] or { data: [...] }
  const list: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(data.voices)
      ? data.voices
      : Array.isArray(data.data)
        ? data.data
        : [];

  return list
    .map((v: unknown) => {
      if (typeof v === "string") return { id: v };
      if (typeof v === "object" && v !== null) {
        const obj = v as Record<string, unknown>;
        return {
          id: String(obj.id ?? obj.voice_id ?? obj.name ?? ""),
          name: obj.name != null ? String(obj.name) : undefined,
        };
      }
      return { id: String(v) };
    })
    .filter((v) => v.id);
}

/** Active audio element for API TTS playback */
let currentAudio: HTMLAudioElement | null = null;
/** Current object URL to revoke after playback */
let currentObjectUrl: string | null = null;

function cleanupAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.removeAttribute("src");
    currentAudio.load();
    currentAudio = null;
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

/**
 * Build the full request payload for the TTS API.
 * Merges saved extraPayload with the per-call values.
 */
export function buildTTSPayload(
  text: string,
  voice: string,
  speed: number,
  settings: TTSSettings,
): Record<string, unknown> {
  return {
    ...settings.extraPayload,
    input: text,
    voice: voice || settings.defaultVoiceId,
    response_format: settings.responseFormat || "mp3",
    speed: speed,
    stream: settings.stream,
  };
}

/**
 * Speak text via the configured external TTS API.
 * Returns a Promise that resolves when playback finishes.
 */
export async function speakTextViaApi(
  text: string,
  options: {
    voice?: string;
    speed?: number;
    volume?: number;
    characterName?: string;
    cacheAudio?: boolean;
  } = {},
): Promise<void> {
  const settings = getTTSSettings();

  if (!settings.apiUrl) {
    throw new Error(
      "TTS API URL is not configured. Go to Settings to set it up.",
    );
  }

  // Stop any currently playing audio
  cleanupAudio();

  const apiType = settings.externalApiType ?? "custom";
  const isElevenLabs = apiType === "elevenlabs";
  const isDeepgram = apiType === "deepgram";
  const voiceId = options.voice || settings.defaultVoiceId;
  const baseUrl = settings.apiUrl.replace(/\/+$/, "");

  let url: string;
  let payload: Record<string, unknown>;
  if (isElevenLabs) {
    url = `${baseUrl}/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
    payload = {
      text,
      model_id: settings.elevenLabsModelId ?? "eleven_multilingual_v2",
      voice_settings: {
        stability: settings.elevenLabsStability ?? 0.5,
        similarity_boost: settings.elevenLabsSimilarityBoost ?? 0.75,
        style: settings.elevenLabsStyle ?? 0,
        use_speaker_boost: settings.elevenLabsSpeakerBoost ?? true,
      },
    };
  } else if (isDeepgram) {
    const model = encodeURIComponent(voiceId || "aura-asteria-en");
    url = `${baseUrl}/v1/speak?model=${model}`;
    payload = { text };
  } else {
    const path = settings.apiPath || "/v1/audio/speech";
    url = `${baseUrl}${path}`;
    payload = buildTTSPayload(text, voiceId, options.speed ?? 1, settings);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const effectiveKey = isElevenLabs
    ? settings.elevenLabsApiKey || settings.apiKey
    : isDeepgram
      ? settings.deepgramApiKey || settings.apiKey
      : settings.apiKey;
  if (effectiveKey) {
    if (isElevenLabs) {
      headers["xi-api-key"] = effectiveKey;
    } else if (isDeepgram) {
      headers["Authorization"] = `Token ${effectiveKey}`;
    } else {
      headers["Authorization"] = `Bearer ${effectiveKey}`;
    }
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `TTS API error (${response.status}): ${errorText || response.statusText}`,
    );
  }

  const blob = await response.blob();

  // Cache audio if enabled
  if (options.cacheAudio && options.characterName) {
    const voiceSig = `${apiType}:${voiceId}`;
    await cacheAudioFile(options.characterName, text, blob, voiceSig);
  }

  const objectUrl = URL.createObjectURL(blob);
  currentObjectUrl = objectUrl;

  const audio = new Audio(objectUrl);
  audio.volume = options.volume ?? 1;
  currentAudio = audio;

  return new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      cleanupAudio();
      resolve();
    };
    audio.onerror = () => {
      cleanupAudio();
      reject(new Error("Audio playback failed"));
    };
    audio.play().catch((err) => {
      cleanupAudio();
      reject(err);
    });
  });
}

/**
 * Stop API TTS audio playback
 */
export function stopApiAudio(): void {
  cleanupAudio();
}

/**
 * Check if API audio is currently playing
 */
export function isApiAudioPlaying(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}

// ── Unified speak / stop (routes to the active provider) ─────────────────────

/**
 * Speak a line using whichever TTS provider is configured in settings.
 * This is the single call-site all playback should go through.
 */
export async function speakLine(
  text: string,
  voiceConfig: import("@/types/voice").VoiceConfig | null,
): Promise<void> {
  if (typeof window === "undefined") return;
  if (voiceConfig?.muted) return;

  const settings = getTTSSettings();
  const cacheEnabled = settings.enableAudioCache ?? false;
  const characterName = voiceConfig?.characterName ?? "[unknown]";

  // Check global cache first
  if (cacheEnabled) {
    const apiType = settings.externalApiType ?? "custom";
    const voiceId =
      voiceConfig?.apiVoiceId ||
      settings.defaultVoiceId ||
      settings.kokoroVoice ||
      "";
    const voiceSig =
      settings.provider === "api"
        ? `${apiType}:${voiceId}`
        : settings.provider === "kokoro"
          ? `kokoro:${voiceId}`
          : undefined;
    const cached = await getCachedAudioFile(characterName, text, voiceSig);
    if (cached) {
      console.log(`[Audio Cache] HIT: "${characterName}"`);
      cleanupAudio();
      const objectUrl = URL.createObjectURL(cached);
      currentObjectUrl = objectUrl;

      const audio = new Audio(objectUrl);
      audio.volume = voiceConfig?.volume ?? 1;
      currentAudio = audio;

      return new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          cleanupAudio();
          resolve();
        };
        audio.onerror = () => {
          cleanupAudio();
          reject(new Error("Audio playback failed"));
        };
        audio.play().catch((err) => {
          cleanupAudio();
          reject(err);
        });
      });
    }
  }

  if (settings.provider === "kokoro") {
    const { speakTextViaKokoro } = await import("./kokoro-tts");
    const kokoroVoice =
      voiceConfig?.apiVoiceId || settings.kokoroVoice || "am_puck";
    await speakTextViaKokoro(text, {
      voice: kokoroVoice,
      speed: voiceConfig?.rate ?? settings.kokoroSpeed ?? 1,
      volume: voiceConfig?.volume ?? 1,
      characterName,
      cacheAudio: cacheEnabled,
      voiceSignature: `kokoro:${kokoroVoice}`,
    });
  } else if (settings.provider === "api") {
    const apiVoice = voiceConfig?.apiVoiceId || settings.defaultVoiceId;
    await speakTextViaApi(text, {
      voice: apiVoice,
      speed: voiceConfig?.rate ?? 1,
      volume: voiceConfig?.volume ?? 1,
      characterName,
      cacheAudio: cacheEnabled,
    });
  } else {
    console.log(`[Audio] Using Browser TTS (caching not supported)`);
    if (voiceConfig) {
      await speakText(text, voiceConfig);
    } else {
      const utterance = new SpeechSynthesisUtterance(text);
      await new Promise<void>((resolve, reject) => {
        utterance.onend = () => resolve();
        utterance.onerror = (e) => reject(new Error(e.error));
        window.speechSynthesis.speak(utterance);
      });
    }
  }
}

/**
 * Stop whatever TTS provider is currently playing.
 */
export function stopLine(): void {
  if (typeof window === "undefined") return;
  const settings = getTTSSettings();

  if (settings.provider === "kokoro") {
    import("./kokoro-tts").then(({ stopKokoroAudio }) => stopKokoroAudio());
  } else if (settings.provider === "api") {
    stopApiAudio();
  } else {
    stopSpeaking();
  }
}
