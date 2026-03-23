export interface DialogueLine {
  lineNumber: number;
  character: string;
  dialogue: string;
  isUserLine?: boolean;
  isStageDirection?: boolean;
}

export interface RehearsalSession {
  id: string;
  projectId: string;
  sceneId: string;
  userCharacterId: string;
  userCharacterName: string;
  startedAt: string;
  pausedAt?: string;
  completedAt?: string;
  currentLineIndex: number;
  isPlaying: boolean;
  isPaused: boolean;
}

export interface RehearsalConfig {
  projectId: string;
  sceneId: string;
  sceneContent: string;
  userCharacterId: string;
  userCharacterName: string;
  autoPlayNonUserLines: boolean;
  enableSubtitles: boolean;
}

export interface RehearsalContextType {
  // Session state
  currentSession: RehearsalSession | null;
  dialogueLines: DialogueLine[];
  
  // Core rehearsal operations
  startRehearsalSession: (config: RehearsalConfig) => RehearsalSession;
  pauseRehearsalSession: () => void;
  resumeRehearsalSession: () => void;
  endRehearsalSession: () => void;
  
  // Playback control
  getCurrentLine: () => DialogueLine | null;
  getNextLine: () => DialogueLine | null;
  getPreviousLines: (count: number) => DialogueLine[];
  advanceToNextLine: () => void;
  jumpToLine: (lineIndex: number) => void;
  replayCurrentLine: () => void;
  
  // Utilities
  getCurrentLinePercentage: () => number;
  isCurrentLineUserLine: () => boolean;
  getUserCharacterLines: () => DialogueLine[];
  getLinesByCharacter: (characterName: string) => DialogueLine[];
}
