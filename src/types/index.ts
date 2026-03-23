// Export scene types
export type { Scene, ParsedScene, SceneContextType } from "./scene";

// Export voice types
export type {
  VoiceConfig,
  CharacterRole,
  VoiceOption,
  VoiceContextType,
} from "./voice";

// Export rehearsal types
export type {
  DialogueLine,
  RehearsalSession,
  RehearsalConfig,
  RehearsalContextType,
} from "./rehearsal";

// Existing types
export interface Rehearsal {
  id: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CastMember {
  id: string;
  name: string;
  email?: string;
  role?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  role: "admin" | "director" | "cast" | "crew";
  createdAt: string;
}
