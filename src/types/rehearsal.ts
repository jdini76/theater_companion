export interface DialogueLine {
  lineNumber: number;
  /** Primary display name (may be a combined string like "NORA & ELI"). */
  character: string;
  /**
   * Individual speaker names when `character` covers multiple people.
   * e.g. "NORA & ELI" → ["NORA", "ELI"].
   * Undefined for single-speaker lines.
   */
  characters?: string[];
  dialogue: string;
  isUserLine?: boolean;
  isStageDirection?: boolean;
  /** True when this line is a sung lyric rather than spoken dialogue. */
  isSong?: boolean;
  /** True when the line is a narrator-spoken cue such as a slugline. */
  isNarratorCue?: boolean;
  /**
   * Song title from an explicit cue marker, e.g. `(Song: "Tomorrow")`.
   * Undefined when the line was detected heuristically (no cue present).
   */
  songTitle?: string;
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
