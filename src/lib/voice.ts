import {
  VoiceConfig,
  CharacterRole,
  VoiceOption,
  TTSSettings,
} from "@/types/voice";

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

    // Find and set the voice
    const voices = synth.getVoices();
    const voice = voices.find((v) => v.name === voiceConfig.voiceName);
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
export async function fetchApiVoices(
  settings: TTSSettings,
): Promise<ApiVoice[]> {
  if (!settings.apiUrl) {
    throw new Error("TTS API URL is not configured.");
  }

  const baseUrl = settings.apiUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/v1/audio/voices`;

  const headers: Record<string, string> = {};
  if (settings.apiKey) {
    headers["Authorization"] = `Bearer ${settings.apiKey}`;
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

  const baseUrl = settings.apiUrl.replace(/\/+$/, "");
  const path = settings.apiPath || "/v1/audio/speech";
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (settings.apiKey) {
    headers["Authorization"] = `Bearer ${settings.apiKey}`;
  }

  const payload = buildTTSPayload(
    text,
    options.voice || settings.defaultVoiceId,
    options.speed ?? 1,
    settings,
  );

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
