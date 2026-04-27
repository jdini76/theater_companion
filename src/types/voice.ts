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
  createdAt: string;
  updatedAt: string;
}

export interface VoiceOption {
  name: string;
  lang: string;
  voiceURI?: string;
}

export interface TTSSettings {
  provider: "browser" | "api" | "kokoro";
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
  kokoroPreGenEnabled?: boolean; // Option to enable/disable pre-generation
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
  getProjectCharacters: (projectId: string) => CharacterRole[];
  importCastCharacters: (projectId: string, names: string[]) => CharacterRole[];
  replaceProjectCharacters: (projectId: string, names: string[]) => CharacterRole[];
  setCurrentCharacter: (characterId: string) => void;
  getCurrentCharacter: () => CharacterRole | null;
}
