import { VoiceConfig, CharacterRole, VoiceOption } from "@/types/voice";

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
  options?: { rate?: number; pitch?: number; volume?: number }
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
  updates: Partial<Omit<VoiceConfig, "id" | "characterName" | "createdAt">>
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
  voiceConfig: VoiceConfig
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
  actorName?: string
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
  updates: Partial<Omit<CharacterRole, "id" | "projectId" | "createdAt">>
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
    return { valid: false, error: "Character name must be less than 100 characters" };
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
