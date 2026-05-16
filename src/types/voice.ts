/**
 * Voice configuration types for text-to-speech
 */

export interface VoiceConfig {
  id: string;
  characterName: string;
  voiceName: string;
  rate: number; // 0.1 - 10, default 1
  pitch: number; // 0 - 2, default 1
  volume: number; // 0 - 1, default 1
  muted: boolean;
  apiVoiceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterRole {
  id: string;
  projectId: string;
  characterName: string;
  description?: string;
  actorName?: string;
  voiceConfigId?: string;
  aliases?: string[];
  category?: string;
  isMyRole?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceOption {
  name: string;
  lang: string;
  voiceURI?: string;
}

export interface TTSSettings {
  provider: "browser" | "api" | "kokoro" | "proxy";
  externalApiType?: "custom" | "elevenlabs" | "deepgram";
  apiUrl: string;
  apiPath: string;
  apiKey: string;
  defaultVoiceId: string;
  responseFormat: string;
  stream: boolean;
  extraPayload: Record<string, unknown>;
  previewText: string;
  kokoroVoice: string;
  kokoroSpeed: number;
  kokoroDevice: "wasm" | "webgpu";
  kokoroPreGenEnabled?: boolean;
  enableAudioCache?: boolean;
  voiceLangs?: string[];
  // ElevenLabs-specific settings
  elevenLabsApiKey?: string;
  elevenLabsModelId?: string;
  elevenLabsStability?: number;
  elevenLabsSimilarityBoost?: number;
  elevenLabsStyle?: number;
  elevenLabsSpeakerBoost?: boolean;
  // Deepgram-specific settings
  deepgramApiKey?: string;
}

export interface CharacterImportData {
  name: string;
  category?: string;
  aliases?: string[];
  description?: string;
}

export interface VoiceContextType {
  voiceConfigs: VoiceConfig[];
  characters: CharacterRole[];
  currentCharacterId: string | null;

  // Voice config operations
  createVoiceConfig: (
    characterName: string,
    voiceName: string,
    options?: { rate?: number; pitch?: number; volume?: number },
  ) => VoiceConfig;
  updateVoiceConfig: (
    id: string,
    updates: Partial<Omit<VoiceConfig, "id" | "characterName" | "createdAt">>,
  ) => void;
  deleteVoiceConfig: (id: string) => void;
  getVoiceConfig: (id: string) => VoiceConfig | null;
  getVoiceConfigByCharacter: (characterName: string) => VoiceConfig | null;

  // Character operations
  createCharacter: (
    projectId: string,
    characterName: string,
    description?: string,
    actorName?: string,
  ) => CharacterRole;
  updateCharacter: (
    id: string,
    updates: Partial<Omit<CharacterRole, "id" | "projectId" | "createdAt">>,
  ) => void;
  deleteCharacter: (id: string) => void;
  deleteCharacters: (ids: string[]) => void;
  getProjectCharacters: (projectId: string) => CharacterRole[];
  importCastCharacters: (
    projectId: string,
    data: CharacterImportData[],
  ) => CharacterRole[];
  replaceProjectCharacters: (
    projectId: string,
    data: CharacterImportData[],
  ) => CharacterRole[];
  setCurrentCharacter: (characterId: string) => void;
  getCurrentCharacter: () => CharacterRole | null;
  setMyRole: (characterId: string, projectId: string, checked: boolean) => void;
}
