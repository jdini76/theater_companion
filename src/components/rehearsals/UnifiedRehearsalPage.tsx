"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { parseScenes, extractSceneCharacters } from "@/lib/scenes";
import {
  parseDialogueLines,
  normalizeStageDirectionLines,
  resolveSongBlockFlags,
} from "@/lib/rehearsal";
import { useScenes } from "@/contexts/SceneContext";
import { useProjects } from "@/contexts/ProjectContext";
import { useDeviceCapabilities } from "@/hooks/useDeviceCapabilities";
import { Scene as StoredScene } from "@/types/scene";
import { DialogueLine } from "@/types/rehearsal";
import { type LineOverride } from "@/types/line-override";
import {
  getTTSSettings,
  fetchApiVoices,
  speakTextViaApi,
  stopApiAudio,
  ApiVoice,
  characterNamesMatch,
  isNarratorPlaybackLine,
} from "@/lib/voice";
import { getCachedAudioFile } from "@/lib/audio-cache";
import { decodeHtmlEntities } from "@/lib/utils";
import {
  KOKORO_VOICES,
  speakTextViaKokoro,
  stopKokoroAudio,
  getKokoroLoadState,
  loadKokoro,
  pregenerateText,
} from "@/lib/kokoro-tts";
import { useVoice } from "@/contexts/VoiceContext";
import { capture } from "@/lib/analytics";

const CURRENT_PROJECT_KEY = "theater_current_project_id";

const BUILT_IN_PROXY_VOICES: ApiVoice[] = [
  { id: "af_heart", name: "af_heart — US female (warm)" },
  { id: "af_bella", name: "af_bella — US female" },
  { id: "af_nicole", name: "af_nicole — US female" },
  { id: "af_aoede", name: "af_aoede — US female" },
  { id: "af_kore", name: "af_kore — US female" },
  { id: "am_adam", name: "am_adam — US male" },
  { id: "am_echo", name: "am_echo — US male" },
  { id: "am_eric", name: "am_eric — US male" },
  { id: "am_fenrir", name: "am_fenrir — US male" },
  { id: "am_liam", name: "am_liam — US male" },
  { id: "am_michael", name: "am_michael — US male" },
  { id: "am_onyx", name: "am_onyx — US male (deep)" },
  { id: "bf_emma", name: "bf_emma — UK female" },
  { id: "bf_isabella", name: "bf_isabella — UK female" },
  { id: "bm_george", name: "bm_george — UK male" },
  { id: "bm_lewis", name: "bm_lewis — UK male" },
];

function parseStoredProjectId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CURRENT_PROJECT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveKeyForProject(projectId: string | null) {
  return projectId
    ? `theater_rehearsal_settings_${projectId}`
    : "theater_rehearsal_settings_default";
}

function loadSavedForProject(projectId: string | null) {
  try {
    const raw = localStorage.getItem(saveKeyForProject(projectId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function sceneProfileKey(projectId: string | null, sceneId: string) {
  return projectId
    ? `theater_rehearsal_scene_settings_${projectId}_${sceneId}`
    : `theater_rehearsal_scene_settings_default_${sceneId}`;
}

function loadSceneProfile(
  projectId: string | null,
  sceneId: string,
): SceneRunLinesProfile | null {
  try {
    const raw = localStorage.getItem(sceneProfileKey(projectId, sceneId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSceneProfile(
  projectId: string | null,
  sceneId: string,
  profile: SceneRunLinesProfile,
) {
  try {
    localStorage.setItem(
      sceneProfileKey(projectId, sceneId),
      JSON.stringify(profile),
    );
  } catch {
    // Ignore storage errors
  }
}

function collectImportedCharacterNames(
  scene: StoredScene,
  overrides?: Record<number, LineOverride>,
): string[] {
  const names = new Set<string>(
    (scene.characters ?? []).map((name) => name.toUpperCase()),
  );
  for (const override of Object.values(overrides ?? {})) {
    if (override.kind === "dialogue" || override.kind === "header") {
      const char = override.char.trim().toUpperCase();
      if (char) names.add(char);
    } else if (override.kind === "multi-header") {
      for (const char of override.chars) {
        const upper = char.trim().toUpperCase();
        if (upper) names.add(upper);
      }
    }
  }
  return Array.from(names);
}

function canonicalizeSceneCharacterNames(
  names: string[],
  knownCast: string[],
): string[] {
  const castUpper = new Set(knownCast.map((name) => name.toUpperCase()));
  const firstNameMap = new Map<string, string>();
  const lastNameMap = new Map<string, string>();

  for (const name of knownCast) {
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
      const first = parts[0].toUpperCase();
      if (firstNameMap.has(first)) {
        firstNameMap.set(first, "");
      } else {
        firstNameMap.set(first, name.toUpperCase());
      }

      const last = parts[parts.length - 1].toUpperCase();
      if (lastNameMap.has(last)) {
        lastNameMap.set(last, "");
      } else {
        lastNameMap.set(last, name.toUpperCase());
      }
    }
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const name of names) {
    const upper = name.trim().toUpperCase();
    if (!upper) continue;

    let canonical = upper;
    if (castUpper.size > 0) {
      if (castUpper.has(upper)) {
        canonical = upper;
      } else {
        const byFirst = firstNameMap.get(upper);
        const byLast = lastNameMap.get(upper);
        if (byFirst) canonical = byFirst;
        else if (byLast) canonical = byLast;
      }
    }

    if (!seen.has(canonical)) {
      seen.add(canonical);
      result.push(canonical);
    }
  }

  return result;
}

interface Scene {
  id: string;
  title: string;
  lines: DialogueLine[];
  characters?: string[];
  setPiece?: string;
}

interface SceneRunLinesProfile {
  selectedCharacter: string;
  voiceAssignments: Record<string, VoiceAssignment>;
  apiVoiceAssignments: Record<string, string>;
  speakNames: boolean;
  readOwnLines: boolean;
  coverMyLines: boolean;
  skipNarration: boolean;
  skipStageDirections: boolean;
  rehearsalMode: "full" | "cue-only";
  pauseMode: "manual" | "countdown" | "wpm";
  countdownSeconds: number;
  wordsPerMinute: number;
  narratorVoiceIndex: number;
  ttsProvider: "browser" | "api" | "kokoro" | "proxy";
}

function buildParsedSceneId(title: string, index: number): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `paste:${index}:${slug || "scene"}`;
}

interface LibrarySetPieceGroup {
  label: string;
  scenes: StoredScene[];
}

interface VoiceAssignment {
  voiceIndex: number;
  rate: number;
  pitch: number;
}

interface RehearsalState {
  lines: DialogueLine[];
  index: number;
  isPlaying: boolean;
  isPaused: boolean;
}

// Utility to extract unique character names from a scene
function getCharacters(
  scene: {
    lines: DialogueLine[];
    characters?: string[];
  },
  _knownCast: string[] = [],
): string[] {
  // Always derive from scene.lines so names exactly match line.character at
  // playback time. scene.characters may hold old canonicalized names
  // (e.g. "JASPER REED") while lines now store source-text names ("JASPER"),
  // causing voice assignment key mismatches.
  const chars = new Set<string>();
  for (const line of scene.lines ?? []) {
    if (!line.character || line.character.startsWith("[") || line.isNarratorCue)
      continue;
    for (const part of line.character.split(/\s*[,&+]\s*/)) {
      const upper = part.trim().toUpperCase();
      if (upper) chars.add(upper);
    }
  }
  // Fall back to scene.characters only when lines are absent.
  if (chars.size === 0 && scene.characters) {
    for (const name of scene.characters) {
      const upper = name.trim().toUpperCase();
      if (upper) chars.add(upper);
    }
  }
  return Array.from(chars);
}

interface UnifiedRehearsalPageProps {
  pendingSceneId?: string | null;
  onSceneNavigated?: () => void;
}

export default function UnifiedRehearsalPage({
  pendingSceneId,
  onSceneNavigated,
}: UnifiedRehearsalPageProps = {}) {
  // Access saved scenes from the Scene Library (scenes page)
  const { getProjectScenes } = useScenes();
  const { getCurrentProject } = useProjects();
  const { canUseKokoro } = useDeviceCapabilities();

  // Access cast voice configs
  const {
    getVoiceConfigByCharacter,
    updateVoiceConfig: updateCastVoiceConfig,
    getProjectCharacters,
    createVoiceConfig: createCastVoiceConfig,
    updateCharacter: updateCastCharacter,
    getVoiceConfig: getCastVoiceConfig,
  } = useVoice();

  // Active project ID (mirrors theater_current_project_id in localStorage)
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() =>
    parseStoredProjectId(),
  );

  // Track whether initial load from storage has happened
  const loadedRef = useRef(false);
  // Track whether current scenes came from the library (vs paste/sample)
  const loadedFromLibraryRef = useRef(false);
  // Track previous scene count to only auto-close panel on first load (0 → >0)
  const prevSceneCountRef = useRef(0);

  // Script loading
  const [loadSource, setLoadSource] = useState<"paste" | "library">("library");
  const [libraryLoadMode, setLibraryLoadMode] = useState<
    "scenes" | "set-pieces"
  >("scenes");
  const [scriptInput, setScriptInput] = useState<string>("");
  const [sceneMode, setSceneMode] = useState<"single" | "multiple">("single");
  const [selectedLibrarySceneIds, setSelectedLibrarySceneIds] = useState<
    Set<string>
  >(new Set());
  const [selectedLibrarySetPieces, setSelectedLibrarySetPieces] = useState<
    Set<string>
  >(new Set());
  const [libraryFilter, setLibraryFilter] = useState<string>("");
  const [hideScenesWithoutCharacters, setHideScenesWithoutCharacters] =
    useState<boolean>(false);

  // Scenes
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number>(0);

  // Role and voice setup
  const [selectedCharacter, setSelectedCharacter] = useState<string>("");
  const [voiceAssignments, setVoiceAssignments] = useState<
    Record<string, VoiceAssignment>
  >({});
  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([]);

  // Rehearsal mode
  const [rehearsalMode, setRehearsalMode] = useState<"full" | "cue-only">(
    "full",
  );

  // TTS provider
  const [ttsProvider, setTtsProvider] = useState<
    "browser" | "api" | "kokoro" | "proxy"
  >("browser");
  const [kokoroStatus, setKokoroStatus] = useState<string | null>(null);
  const [apiVoices, setApiVoices] = useState<ApiVoice[]>([]);
  const [apiVoicesLoading, setApiVoicesLoading] = useState(false);
  const [apiVoicesError, setApiVoicesError] = useState<string | null>(null);
  const [apiVoiceAssignments, setApiVoiceAssignments] = useState<
    Record<string, string>
  >({});
  const [previewingChar, setPreviewingChar] = useState<string | null>(null);

  // UI panel state
  const [scenesOpen, setScenesOpen] = useState<boolean>(true);
  const [runLinesOpen, setRunLinesOpen] = useState<boolean>(false);

  // Rehearsal options
  const [speakNames, setSpeakNames] = useState<boolean>(false);
  const [readOwnLines, setReadOwnLines] = useState<boolean>(false);
  const [coverMyLines, setCoverMyLines] = useState<boolean>(false);
  const [pauseMode, setPauseMode] = useState<"manual" | "countdown" | "wpm">(
    "manual",
  );
  const [countdownSeconds, setCountdownSeconds] = useState<number>(4);
  const [wordsPerMinute, setWordsPerMinute] = useState<number>(160);
  const [narratorVoiceIndex, setNarratorVoiceIndex] = useState<number>(0);
  const [skipNarration, setSkipNarration] = useState<boolean>(false);
  const [skipStageDirections, setSkipStageDirections] =
    useState<boolean>(false);

  // Rehearsal playback
  const [rehearsal, setRehearsal] = useState<RehearsalState>({
    lines: [],
    index: 0,
    isPlaying: false,
    isPaused: false,
  });
  const [revealedLineIndex, setRevealedLineIndex] = useState<number | null>(
    null,
  );
  const [currentSpeaker, setCurrentSpeaker] = useState<string>("");
  const [currentDialogue, setCurrentDialogue] = useState<string>(
    "Load a scene, pick your role, and press Start.",
  );
  const [currentPrompt, setCurrentPrompt] = useState<string>("");
  const [playedFromCache, setPlayedFromCache] = useState<boolean>(false);

  // Timers
  const [countdownInterval, setCountdownInterval] =
    useState<NodeJS.Timeout | null>(null);
  const [nextLineTimeout, setNextLineTimeout] = useState<NodeJS.Timeout | null>(
    null,
  );

  const currentProject = getCurrentProject();
  const productionType = currentProject?.productionType;
  const activeProjectId = currentProjectId ?? currentProject?.id ?? null;
  const projectCast = useMemo(() => {
    if (!activeProjectId) return [];
    return getProjectCharacters(activeProjectId).flatMap((character) => [
      character.characterName,
      ...(character.aliases ?? []),
    ]);
  }, [activeProjectId, getProjectCharacters]);

  const buildKnownCharacters = useCallback(
    (sceneCharacters: string[] = []) => {
      const names = new Set<string>();

      if (activeProjectId) {
        for (const character of getProjectCharacters(activeProjectId)) {
          names.add(character.characterName.toUpperCase());
          for (const alias of character.aliases ?? []) {
            names.add(alias.toUpperCase());
          }
        }
      }

      for (const character of sceneCharacters) {
        names.add(character.toUpperCase());
      }

      return Array.from(names);
    },
    [activeProjectId, getProjectCharacters],
  );

  const buildSetPieceGroups = useCallback(
    (sourceScenes: StoredScene[]): LibrarySetPieceGroup[] => {
      const groups = new Map<
        string,
        { label: string; scenes: StoredScene[]; order: number }
      >();

      for (const scene of sourceScenes) {
        const label = scene.setPiece?.trim();
        if (!label) continue;

        const key = label.toLowerCase();
        const existing = groups.get(key);
        if (existing) {
          existing.scenes.push(scene);
          existing.order = Math.min(existing.order, scene.order);
          continue;
        }

        groups.set(key, { label, scenes: [scene], order: scene.order });
      }

      return Array.from(groups.values())
        .sort((a, b) => a.order - b.order)
        .map((group) => ({
          label: group.label,
          scenes: group.scenes.sort((a, b) => a.order - b.order),
        }));
    },
    [],
  );

  const libraryScenes = useMemo(
    () => (currentProjectId ? getProjectScenes(currentProjectId) : []),
    [currentProjectId, getProjectScenes],
  );
  const librarySetPieceGroups = useMemo(
    () => buildSetPieceGroups(libraryScenes),
    [buildSetPieceGroups, libraryScenes],
  );

  const parseSceneHeading = useCallback((scene: StoredScene) => {
    const headingLine = scene.lines?.find(
      (line) => line.character === "[Scene Heading]" && line.dialogue.trim(),
    );
    return headingLine?.dialogue.trim() || scene.title.trim();
  }, []);

  const getImportedSceneLines = useCallback(
    (scene: StoredScene): DialogueLine[] => {
      const raw =
        scene.lines && scene.lines.length > 0
          ? normalizeStageDirectionLines(scene.lines).lines
          : parseDialogueLines(
              scene.content,
              productionType === "Film" ? "screenplay" : "mixed",
              buildKnownCharacters(
                collectImportedCharacterNames(scene, scene.lineOverrides),
              ),
              scene.lineOverrides,
            );
      // Re-evaluate isSong from cue context so all views agree on which lines
      // are song lyrics (stored flag can be stale after user reclassifies a cue).
      return resolveSongBlockFlags(raw);
    },
    [buildKnownCharacters, productionType],
  );

  const buildLibraryScenePage = useCallback(
    (scene: StoredScene): Scene | null => {
      const dialogueLines = getImportedSceneLines(scene);

      const lineChars = Array.from(
        new Set(
          dialogueLines
            .filter((l) => !l.isStageDirection && !l.character.startsWith("["))
            .flatMap((l) =>
              l.character
                .split(/\s*[,&+]\s*/)
                .map((n) => n.trim().toUpperCase())
                .filter(Boolean),
            ),
        ),
      );

      const mergedChars = canonicalizeSceneCharacterNames(
        [...(scene.characters ?? []), ...lineChars],
        projectCast,
      );

      return {
        id: scene.id,
        title: scene.title,
        lines: dialogueLines,
        characters: mergedChars.length > 0 ? mergedChars : scene.characters,
        setPiece: scene.setPiece?.trim() || undefined,
      };
    },
    [getImportedSceneLines, projectCast],
  );

  const buildSetPieceScenePage = useCallback(
    (label: string, scenesInSetPiece: StoredScene[]): Scene | null => {
      const flattenedLines: DialogueLine[] = [];
      const mergedChars = new Set<string>();

      for (const scene of scenesInSetPiece) {
        const dialogueLines = getImportedSceneLines(scene);

        const slugline = parseSceneHeading(scene);
        if (slugline) {
          flattenedLines.push({
            lineNumber: -1,
            character: "[Narrative]",
            dialogue: slugline,
            isNarratorCue: true,
          });
        }

        for (const line of dialogueLines) {
          if (line.character === "[Scene Heading]") continue;
          flattenedLines.push(line);
        }

        const lineChars = Array.from(
          new Set(
            dialogueLines
              .filter(
                (l) => !l.isStageDirection && !l.character.startsWith("["),
              )
              .flatMap((l) =>
                l.character
                  .split(/\s*[,&+]\s*/)
                  .map((n) => n.trim().toUpperCase())
                  .filter(Boolean),
              ),
          ),
        );

        for (const characterName of canonicalizeSceneCharacterNames(
          [...(scene.characters ?? []), ...lineChars],
          projectCast,
        )) {
          const upper = characterName.trim().toUpperCase();
          if (upper) mergedChars.add(upper);
        }
      }

      if (flattenedLines.length === 0) return null;

      return {
        id: buildParsedSceneId(label, 0),
        title: label,
        lines: flattenedLines,
        characters: Array.from(mergedChars),
        setPiece: label,
      };
    },
    [getImportedSceneLines, parseSceneHeading, projectCast],
  );

  // Keep run-lines scenes in sync when SceneViewer edits scene.lines in the library
  useEffect(() => {
    if (!loadedFromLibraryRef.current) return;

    let rebuilt: Scene[] = [];

    if (libraryLoadMode === "set-pieces") {
      const selectedLabels =
        selectedLibrarySetPieces.size > 0
          ? librarySetPieceGroups
              .map((g) => g.label)
              .filter((label) => selectedLibrarySetPieces.has(label))
          : librarySetPieceGroups.map((g) => g.label);

      rebuilt = selectedLabels
        .map((label) => {
          const group = librarySetPieceGroups.find(
            (g) => g.label.toLowerCase() === label.toLowerCase(),
          );
          if (!group) return null;
          return buildSetPieceScenePage(group.label, group.scenes);
        })
        .filter((s): s is Scene => s !== null);
    } else {
      const toLoad: StoredScene[] =
        selectedLibrarySceneIds.size > 0
          ? libraryScenes.filter((s) => selectedLibrarySceneIds.has(s.id))
          : libraryScenes;

      rebuilt = toLoad
        .map((s) => buildLibraryScenePage(s))
        .filter((s): s is Scene => s !== null);
    }

    if (rebuilt.length > 0) {
      setScenes(rebuilt);
    }
  }, [
    libraryScenes,
    libraryLoadMode,
    selectedLibrarySetPieces,
    librarySetPieceGroups,
    selectedLibrarySceneIds,
    buildLibraryScenePage,
    buildSetPieceScenePage,
  ]);

  const normalizeScriptInput = useCallback(
    (text: string) => decodeHtmlEntities(text),
    [],
  );

  // Helper: apply a saved settings blob to component state
  const applySettings = useCallback((saved: Record<string, unknown> | null) => {
    // Reset to defaults first so stale state from another project is cleared
    window.speechSynthesis.cancel();
    loadedFromLibraryRef.current = false;
    setScriptInput("");
    setSceneMode("single");
    setScenes([]);
    setSelectedSceneIndex(0);
    setSelectedCharacter("");
    setVoiceAssignments({});
    setSpeakNames(false);
    setReadOwnLines(false);
    setCoverMyLines(false);
    setRehearsalMode("full");
    setPauseMode("manual");
    setCountdownSeconds(4);
    setWordsPerMinute(160);
    setNarratorVoiceIndex(0);
    setTtsProvider("browser");
    setApiVoiceAssignments({});
    setCurrentSpeaker("");
    setCurrentDialogue("Load a scene, pick your role, and press Start.");
    setCurrentPrompt("");
    setRehearsal({ lines: [], index: 0, isPlaying: false, isPaused: false });
    setRevealedLineIndex(null);

    if (!saved) return;

    if (saved.scriptInput)
      setScriptInput(normalizeScriptInput(saved.scriptInput as string));
    if (saved.sceneMode) setSceneMode(saved.sceneMode as "single" | "multiple");
    if (saved.loadSource)
      setLoadSource(saved.loadSource as "paste" | "library");
    if (saved.libraryLoadMode)
      setLibraryLoadMode(saved.libraryLoadMode as "scenes" | "set-pieces");
    // Restore the previously loaded library selection so scenes reload
    // automatically once `libraryScenes` is available, instead of requiring
    // the user to re-pick and reload them after navigating away.
    const savedSceneIds = saved.selectedLibrarySceneIds;
    if (Array.isArray(savedSceneIds) && savedSceneIds.length > 0) {
      setSelectedLibrarySceneIds(new Set(savedSceneIds as string[]));
      loadedFromLibraryRef.current = true;
      setScenesOpen(false);
    }
    const savedSetPieces = saved.selectedLibrarySetPieces;
    if (Array.isArray(savedSetPieces) && savedSetPieces.length > 0) {
      setSelectedLibrarySetPieces(new Set(savedSetPieces as string[]));
      loadedFromLibraryRef.current = true;
      setScenesOpen(false);
    }
    if (saved.selectedCharacter)
      setSelectedCharacter(saved.selectedCharacter as string);
    if (saved.voiceAssignments)
      setVoiceAssignments(
        saved.voiceAssignments as Record<string, VoiceAssignment>,
      );
    if (typeof saved.speakNames === "boolean") setSpeakNames(saved.speakNames);
    if (typeof saved.readOwnLines === "boolean")
      setReadOwnLines(saved.readOwnLines);
    if (typeof saved.coverMyLines === "boolean")
      setCoverMyLines(saved.coverMyLines);
    if (typeof saved.skipNarration === "boolean")
      setSkipNarration(saved.skipNarration);
    if (typeof saved.skipStageDirections === "boolean")
      setSkipStageDirections(saved.skipStageDirections);
    if (saved.rehearsalMode)
      setRehearsalMode(saved.rehearsalMode as "full" | "cue-only");
    if (saved.pauseMode)
      setPauseMode(saved.pauseMode as "manual" | "countdown" | "wpm");
    if (saved.countdownSeconds)
      setCountdownSeconds(saved.countdownSeconds as number);
    if (typeof saved.wordsPerMinute === "number")
      setWordsPerMinute(saved.wordsPerMinute);
    if (typeof saved.narratorVoiceIndex === "number")
      setNarratorVoiceIndex(saved.narratorVoiceIndex);
    if (saved.ttsProvider)
      setTtsProvider(
        saved.ttsProvider as "browser" | "api" | "kokoro" | "proxy",
      );
    if (saved.apiVoiceAssignments)
      setApiVoiceAssignments(
        saved.apiVoiceAssignments as Record<string, string>,
      );
    if (typeof saved.selectedSceneIndex === "number")
      setSelectedSceneIndex(saved.selectedSceneIndex as number);

    if (saved.scriptInput) {
      const mode = ((saved.sceneMode as string) || "auto") as
        | "single"
        | "multiple"
        | "auto";
      const normalizedScript = normalizeScriptInput(
        saved.scriptInput as string,
      );
      const parsedScenes = parseScenes(normalizedScript, {
        mode,
        productionType,
      });
      const processedScenes: Scene[] = parsedScenes
        .map((ps, i) => ({
          id: buildParsedSceneId(ps.title, i),
          title: ps.title,
          lines: parseDialogueLines(
            ps.content,
            productionType === "Film" ? "screenplay" : "mixed",
            buildKnownCharacters(),
          ),
        }))
        .filter((s) => s.lines.length > 0);
      if (processedScenes.length > 0) {
        setScenes(processedScenes);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-load a scene when navigated from SceneViewer via "Run Lines" button
  useEffect(() => {
    if (!pendingSceneId) return;

    const saved = loadSavedForProject(currentProjectId) as Record<
      string,
      unknown
    > | null;
    const savedSceneIds = Array.isArray(saved?.selectedLibrarySceneIds)
      ? (saved?.selectedLibrarySceneIds as string[])
      : [];
    const savedLoadSource = saved?.loadSource as string | undefined;
    const savedLibraryLoadMode = saved?.libraryLoadMode as string | undefined;

    const shouldRestoreSavedConfigForPendingScene =
      savedLoadSource === "library" &&
      savedLibraryLoadMode === "scenes" &&
      savedSceneIds.length === 1 &&
      savedSceneIds[0] === pendingSceneId;

    if (shouldRestoreSavedConfigForPendingScene) {
      applySettings(saved);
      setCurrentSpeaker("READY");
      setCurrentDialogue("Scene loaded from your saved Run Lines setup.");
      setCurrentPrompt("");
      setScenesOpen(false);
      onSceneNavigated?.();
      return;
    }

    console.log(
      "[UnifiedRehearsalPage] Loading scene from SceneViewer with sceneId:",
      pendingSceneId,
    );
    const stored = libraryScenes.find((s) => s.id === pendingSceneId);
    if (!stored) return;
    const scene = buildLibraryScenePage(stored);
    if (!scene) return;
    loadedFromLibraryRef.current = true;
    setLoadSource("library");
    setLibraryLoadMode("scenes");
    setSelectedLibrarySceneIds(new Set([pendingSceneId]));
    setScenes([scene]);
    setSelectedSceneIndex(0);
    setCurrentSpeaker("READY");
    setCurrentDialogue("Scene loaded from library.");
    setCurrentPrompt("");
    setScenesOpen(false);
    onSceneNavigated?.();
  }, [
    pendingSceneId,
    libraryScenes,
    buildLibraryScenePage,
    onSceneNavigated,
    currentProjectId,
    applySettings,
  ]);

  // Load browser voices (with iOS primer)
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;

    const loadVoices = () => {
      const raw = synth.getVoices();
      if (raw.length > 0) setAvailableVoices(raw);
    };

    synth.onvoiceschanged = loadVoices;
    synth.addEventListener?.("voiceschanged", loadVoices);
    loadVoices();
    const timers = [setTimeout(loadVoices, 100), setTimeout(loadVoices, 600)];

    // iOS Safari: getVoices() returns [] until speak() is called from a user gesture.
    let primed = false;
    const prime = () => {
      if (primed) return;
      primed = true;
      try {
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        u.rate = 10;
        synth.speak(u);
        setTimeout(() => {
          synth.cancel();
          loadVoices();
        }, 50);
      } catch {
        /* non-iOS */
      }
    };
    document.addEventListener("click", prime, { once: true, passive: true });
    document.addEventListener("touchstart", prime, {
      once: true,
      passive: true,
    });

    return () => {
      timers.forEach(clearTimeout);
      synth.removeEventListener?.("voiceschanged", loadVoices);
      document.removeEventListener("click", prime);
      document.removeEventListener("touchstart", prime);
    };
  }, []);

  // Some browsers populate voices after a longer delay (or only after route
  // transitions). Retry automatically so returning to Run Lines does not
  // require pressing "Load Voices" manually.
  useEffect(() => {
    if (ttsProvider !== "browser" || availableVoices.length > 0) return;

    const synth = window.speechSynthesis;
    if (!synth) return;

    const tryLoad = () => {
      const voices = synth.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
        return true;
      }
      return false;
    };

    if (tryLoad()) return;

    let attempts = 0;
    const maxAttempts = 20;
    const retryTimer = setInterval(() => {
      attempts += 1;
      if (tryLoad() || attempts >= maxAttempts) {
        clearInterval(retryTimer);
      }
    }, 250);

    return () => clearInterval(retryTimer);
  }, [ttsProvider, availableVoices.length]);

  // Re-query browser voices with delayed calls and wake-up triggers when Run
  // Lines is open. Some engines only populate voices after tab focus changes
  // or a fresh user interaction.
  useEffect(() => {
    if (
      ttsProvider !== "browser" ||
      !runLinesOpen ||
      availableVoices.length > 0
    )
      return;

    const synth = window.speechSynthesis;
    if (!synth) return;

    let isDisposed = false;

    const refreshVoices = () => {
      if (isDisposed) return false;
      const voices = synth.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
        return true;
      }
      return false;
    };

    const primeVoices = () => {
      if (isDisposed) return;
      try {
        const utterance = new SpeechSynthesisUtterance(" ");
        utterance.volume = 0;
        utterance.rate = 10;
        synth.speak(utterance);
        setTimeout(() => {
          synth.cancel();
          refreshVoices();
        }, 60);
      } catch {
        /* ignore */
      }
    };

    const wakeAndRefresh = () => {
      if (!refreshVoices()) {
        primeVoices();
      }
    };

    wakeAndRefresh();
    const timers = [
      setTimeout(wakeAndRefresh, 250),
      setTimeout(wakeAndRefresh, 900),
      setTimeout(wakeAndRefresh, 1800),
      setTimeout(wakeAndRefresh, 3200),
    ];

    const onFocus = () => wakeAndRefresh();
    const onKeyDown = () => wakeAndRefresh();
    const onClick = () => wakeAndRefresh();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        wakeAndRefresh();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onClick, { passive: true });

    return () => {
      isDisposed = true;
      timers.forEach(clearTimeout);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onClick);
    };
  }, [
    ttsProvider,
    runLinesOpen,
    availableVoices.length,
    scenes.length,
    selectedSceneIndex,
  ]);

  // Hydrate non-browser voice lists automatically when restoring saved
  // provider settings, so voice dropdowns don't require manual refresh.
  useEffect(() => {
    if (ttsProvider === "proxy") {
      if (apiVoices.length === 0) {
        setApiVoices(BUILT_IN_PROXY_VOICES);
      }
      return;
    }

    if (
      ttsProvider === "api" &&
      apiVoices.length === 0 &&
      !apiVoicesLoading &&
      !apiVoicesError
    ) {
      const settings = getTTSSettings();
      if (!settings.apiUrl) return;

      setApiVoicesLoading(true);
      fetchApiVoices(settings)
        .then((voices) => {
          setApiVoices(voices);
          if (voices.length === 0) {
            setApiVoicesError("No voices returned.");
          }
        })
        .catch((err) =>
          setApiVoicesError(err instanceof Error ? err.message : "Failed"),
        )
        .finally(() => setApiVoicesLoading(false));
    }
  }, [
    ttsProvider,
    apiVoices.length,
    apiVoicesLoading,
    apiVoicesError,
    runLinesOpen,
  ]);

  // Load saved settings exactly once on mount.
  // Skip when pendingSceneId is set — the pendingSceneId effect (above) will load
  // the scene, and calling applySettings here would overwrite it because React
  // batches both effects' setState calls and runs this one last.
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    if (!pendingSceneId) {
      applySettings(loadSavedForProject(currentProjectId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-expand Run Lines when scenes load; only collapse the sidebar on first load
  useEffect(() => {
    const prev = prevSceneCountRef.current;
    prevSceneCountRef.current = scenes.length;
    if (scenes.length > 0) {
      setRunLinesOpen(true);
      setOptionsOpen(true);
      setVoicesOpen(true);
      if (prev === 0) setScenesOpen(false);
    }
  }, [scenes.length]);

  // Watch for project changes (from ProjectSelector dropdown or projects page)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== CURRENT_PROJECT_KEY) return;
      let newProjectId: string | null = null;
      try {
        newProjectId = e.newValue ? JSON.parse(e.newValue) : null;
      } catch {
        newProjectId = null;
      }
      setCurrentProjectId(newProjectId);
      applySettings(loadSavedForProject(newProjectId));
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [applySettings]);

  // Also poll for same-tab project changes (storage events don't fire in the same tab)
  useEffect(() => {
    const interval = setInterval(() => {
      const pid = parseStoredProjectId();
      setCurrentProjectId((prev) => {
        if (pid !== prev) {
          applySettings(loadSavedForProject(pid));
          return pid;
        }
        return prev;
      });
    }, 500);
    return () => clearInterval(interval);
  }, [applySettings]);

  // Split a combined speaker label ("MOM + JOEY") into individual names
  const splitSpeaker = (speaker: string): string[] => {
    return speaker
      .split(/\s*[,&+]\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  // Ensure voice assignments exist, loading saved configs from cast page
  const ensureVoiceAssignments = useCallback(() => {
    if (!scenes[selectedSceneIndex]) return;
    const scene = scenes[selectedSceneIndex];
    const chars = getCharacters(scene, projectCast);
    const updatedVoice = { ...voiceAssignments };
    const updatedApi = { ...apiVoiceAssignments };

    chars.forEach((char, idx) => {
      if (!updatedVoice[char]) {
        // Try loading from saved cast voice config
        const saved = getVoiceConfigByCharacter(char);
        if (saved) {
          const voiceIdx = availableVoices.findIndex(
            (v) => v.name === saved.voiceName,
          );
          updatedVoice[char] = {
            voiceIndex:
              voiceIdx >= 0
                ? voiceIdx
                : idx % Math.max(availableVoices.length, 1),
            rate: saved.rate,
            pitch: saved.pitch,
          };
          if (saved.apiVoiceId && !updatedApi[char]) {
            updatedApi[char] = saved.apiVoiceId;
          }
        } else {
          updatedVoice[char] = {
            voiceIndex: idx % Math.max(availableVoices.length, 1),
            rate: 1,
            pitch: 1,
          };
        }
      }
    });

    // Narrator and stage-direction lines aren't real cast characters, so
    // getCharacters() excludes them above and they'd otherwise never get a
    // pinned voice — they'd keep floating on whatever the global default
    // voice happens to be, which silently invalidates their audio cache
    // signature (kokoro:<voice> / <apiType>:<voiceId>) any time that default
    // changes elsewhere in Settings.
    const ttsSettings = getTTSSettings();
    (["NARRATOR", "[Stage Direction]"] as const).forEach((bucket) => {
      if (!updatedVoice[bucket]) {
        updatedVoice[bucket] = {
          voiceIndex: narratorVoiceIndex,
          rate: 1,
          pitch: 1,
        };
      }
      if (!updatedApi[bucket]) {
        updatedApi[bucket] =
          ttsProvider === "kokoro"
            ? ttsSettings.kokoroVoice || "am_puck"
            : ttsSettings.defaultVoiceId || "af_heart";
      }
    });

    setVoiceAssignments(updatedVoice);
    setApiVoiceAssignments(updatedApi);
  }, [
    scenes,
    selectedSceneIndex,
    voiceAssignments,
    apiVoiceAssignments,
    availableVoices,
    getVoiceConfigByCharacter,
    projectCast,
    narratorVoiceIndex,
    ttsProvider,
  ]);

  // Parse script
  const handleParseScript = () => {
    if (!scriptInput.trim()) {
      return;
    }

    // First, parse scenes (splits by scene headers)
    const normalizedScriptInput = normalizeScriptInput(scriptInput);
    if (normalizedScriptInput !== scriptInput) {
      setScriptInput(normalizedScriptInput);
    }

    const parsedScenes = parseScenes(normalizedScriptInput, {
      mode: sceneMode,
      productionType,
    });
    if (parsedScenes.length === 0) {
      return;
    }

    // Then, convert each ParsedScene to a Scene with dialogue lines
    const processedScenes: Scene[] = parsedScenes.map((ps, i) => {
      const dialogueLines = parseDialogueLines(
        ps.content,
        productionType === "Film" ? "screenplay" : "mixed",
        buildKnownCharacters(),
      );
      return {
        id: buildParsedSceneId(ps.title, i),
        title: ps.title,
        lines: dialogueLines,
      };
    });

    // Filter out scenes with no dialogue
    const scenesWithDialogue = processedScenes.filter(
      (s) => s.lines.length > 0,
    );

    if (scenesWithDialogue.length === 0) {
      return;
    }

    loadedFromLibraryRef.current = false;
    setScenes(scenesWithDialogue);
    setSelectedSceneIndex(0);
    setCurrentSpeaker("READY");
    setCurrentDialogue("Script loaded.");
    setCurrentPrompt("");
    setScenesOpen(false);
  };

  // Load sample
  const handleLoadSample = () => {
    setSceneMode("multiple");
    setScriptInput(
      `SCENE 1: AUDITION ROOM
MOM: You know the lines. Just breathe.
JOEY: I always know them until someone asks me to say them.
DIRECTOR: Whenever you're ready, Joey.
JOEY: Thank you. I'll begin from the top.

SCENE 2: BACKSTAGE
FRIEND: You did great out there.
JOEY: I skipped one word.
FRIEND: That is called acting confidence. Keep it moving.
MOM: See? You were ready.`,
    );
  };

  const loadFromSceneIds = useCallback(
    (ids: Set<string>) => {
      setSelectedLibrarySceneIds(ids);
      if (ids.size === 0) {
        loadedFromLibraryRef.current = false;
        setScenes([]);
        setCurrentSpeaker("");
        setCurrentDialogue("Load a scene, pick your role, and press Start.");
        setCurrentPrompt("");
        return;
      }
      const toLoad = libraryScenes.filter((s) => ids.has(s.id));
      const processedScenes = toLoad
        .map((scene) => buildLibraryScenePage(scene))
        .filter((scene): scene is Scene => scene !== null);
      if (processedScenes.length === 0) return;
      loadedFromLibraryRef.current = true;
      setScenes(processedScenes);
      setSelectedSceneIndex(0);
      setCurrentSpeaker("READY");
      setCurrentDialogue("Scenes loaded from library.");
      setCurrentPrompt("");
    },
    [libraryScenes, buildLibraryScenePage],
  );

  const loadFromSetPieceLabels = useCallback(
    (labels: Set<string>) => {
      setSelectedLibrarySetPieces(labels);
      if (labels.size === 0) {
        loadedFromLibraryRef.current = false;
        setScenes([]);
        setCurrentSpeaker("");
        setCurrentDialogue("Load a scene, pick your role, and press Start.");
        setCurrentPrompt("");
        return;
      }
      const processedScenes = Array.from(labels)
        .map((label) => {
          const group = librarySetPieceGroups.find(
            (g) => g.label.toLowerCase() === label.toLowerCase(),
          );
          if (!group) return null;
          return buildSetPieceScenePage(group.label, group.scenes);
        })
        .filter((scene): scene is Scene => scene !== null);
      if (processedScenes.length === 0) return;
      loadedFromLibraryRef.current = true;
      setScenes(processedScenes);
      setSelectedSceneIndex(0);
      setCurrentSpeaker("READY");
      setCurrentDialogue("Set pieces loaded from library.");
      setCurrentPrompt("");
    },
    [librarySetPieceGroups, buildSetPieceScenePage],
  );

  const toggleLibraryScene = (sceneId: string) => {
    const next = new Set(selectedLibrarySceneIds);
    if (next.has(sceneId)) next.delete(sceneId);
    else next.add(sceneId);
    loadFromSceneIds(next);
  };

  const toggleLibrarySetPiece = (label: string) => {
    const next = new Set(selectedLibrarySetPieces);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    loadFromSetPieceLabels(next);
  };

  // Preview a character's voice using the preview text from Settings
  const handlePreviewVoice = useCallback(
    async (char: string) => {
      if (previewingChar === char) {
        if (ttsProvider === "api") stopApiAudio();
        else if (ttsProvider === "kokoro") stopKokoroAudio();
        else window.speechSynthesis.cancel();
        setPreviewingChar(null);
        return;
      }

      const ttsSettings = getTTSSettings();
      const text = ttsSettings.previewText || "Hello, this is a voice test.";
      const cfg = voiceAssignments[char] || {
        voiceIndex: 0,
        rate: 1,
        pitch: 1,
      };

      setPreviewingChar(char);
      try {
        if (ttsProvider === "kokoro") {
          const voice =
            apiVoiceAssignments[char] || ttsSettings.kokoroVoice || "am_puck";
          await speakTextViaKokoro(text, { voice, speed: cfg.rate });
        } else if (ttsProvider === "api" || ttsProvider === "proxy") {
          const apiVoiceId =
            apiVoiceAssignments[char] ||
            (ttsProvider === "proxy"
              ? getTTSSettings().defaultVoiceId || "af_heart"
              : ttsSettings.defaultVoiceId);
          await speakTextViaApi(text, {
            voice: apiVoiceId,
            speed: cfg.rate,
            forceProxy: ttsProvider === "proxy",
          });
        } else {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = cfg.rate;
          utterance.pitch = cfg.pitch;
          if (availableVoices[cfg.voiceIndex]) {
            utterance.voice = availableVoices[cfg.voiceIndex];
          }
          await new Promise<void>((resolve, reject) => {
            utterance.onend = () => resolve();
            utterance.onerror = (e) => reject(new Error(e.error));
            window.speechSynthesis.speak(utterance);
          });
        }
      } catch {
        // ignore preview errors
      } finally {
        setPreviewingChar(null);
      }
    },
    [
      previewingChar,
      ttsProvider,
      apiVoiceAssignments,
      voiceAssignments,
      availableVoices,
    ],
  );

  // Save a character's voice settings to the cast page
  const handleSaveVoiceToCast = useCallback(
    (char: string) => {
      if (!currentProjectId) return;
      const cfg = voiceAssignments[char] || {
        voiceIndex: 0,
        rate: 1,
        pitch: 1,
      };
      const voiceName = availableVoices[cfg.voiceIndex]?.name || "Default";
      const apiVoiceId = apiVoiceAssignments[char] || undefined;

      // Find the cast character (fuzzy: first-name match)
      const castChars = getProjectCharacters(currentProjectId);
      const castChar = castChars.find((c) =>
        characterNamesMatch(c.characterName, char),
      );

      // If the cast character has a linked voice config, update that one directly
      if (castChar?.voiceConfigId) {
        const linked = getCastVoiceConfig(castChar.voiceConfigId);
        if (linked) {
          updateCastVoiceConfig(linked.id, {
            voiceName,
            rate: cfg.rate,
            pitch: cfg.pitch,
            apiVoiceId,
          });
          return;
        }
      }

      // Fallback: find any voice config by character name
      const existing = getVoiceConfigByCharacter(char);
      if (existing) {
        updateCastVoiceConfig(existing.id, {
          voiceName,
          rate: cfg.rate,
          pitch: cfg.pitch,
          apiVoiceId,
        });
        // Link it to the cast character if not already linked
        if (castChar && castChar.voiceConfigId !== existing.id) {
          updateCastCharacter(castChar.id, { voiceConfigId: existing.id });
        }
        return;
      }

      // No existing config found â€” create a new one and link it
      const newConfig = createCastVoiceConfig(char, voiceName, {
        rate: cfg.rate,
        pitch: cfg.pitch,
      });
      if (apiVoiceId) {
        updateCastVoiceConfig(newConfig.id, { apiVoiceId });
      }
      if (castChar) {
        updateCastCharacter(castChar.id, { voiceConfigId: newConfig.id });
      }
    },
    [
      currentProjectId,
      voiceAssignments,
      apiVoiceAssignments,
      availableVoices,
      getVoiceConfigByCharacter,
      updateCastVoiceConfig,
      getProjectCharacters,
      createCastVoiceConfig,
      updateCastCharacter,
      getCastVoiceConfig,
    ],
  );

  // Clear everything for current project
  const handleClear = () => {
    window.speechSynthesis.cancel();
    localStorage.removeItem(saveKeyForProject(currentProjectId));
    setSelectedLibrarySceneIds(new Set());
    setSelectedLibrarySetPieces(new Set());
    setScenesOpen(true);
    applySettings(null);
  };

  // Auto-save all settings to localStorage whenever they change
  useEffect(() => {
    if (!loadedRef.current) return;
    const pid = currentProjectId;
    const toSave = {
      scriptInput,
      sceneMode,
      loadSource,
      libraryLoadMode,
      selectedLibrarySceneIds: Array.from(selectedLibrarySceneIds),
      selectedLibrarySetPieces: Array.from(selectedLibrarySetPieces),
      selectedSceneIndex,
      selectedCharacter,
      voiceAssignments,
      speakNames,
      readOwnLines,
      coverMyLines,
      skipNarration,
      skipStageDirections,
      rehearsalMode,
      pauseMode,
      countdownSeconds,
      wordsPerMinute,
      narratorVoiceIndex,
      ttsProvider,
      apiVoiceAssignments,
    };

    const persist = () => {
      try {
        localStorage.setItem(saveKeyForProject(pid), JSON.stringify(toSave));
      } catch {
        // Ignore storage errors
      }
    };

    const timer = setTimeout(() => {
      persist();
    }, 500);

    // Flush latest settings immediately when effect is torn down (including
    // tab switches/unmount) so rapid navigation does not drop voice changes.
    return () => {
      clearTimeout(timer);
      persist();
    };
  }, [
    currentProjectId,
    scriptInput,
    sceneMode,
    loadSource,
    libraryLoadMode,
    selectedLibrarySceneIds,
    selectedLibrarySetPieces,
    selectedSceneIndex,
    selectedCharacter,
    voiceAssignments,
    speakNames,
    readOwnLines,
    coverMyLines,
    skipNarration,
    skipStageDirections,
    rehearsalMode,
    pauseMode,
    countdownSeconds,
    wordsPerMinute,
    narratorVoiceIndex,
    ttsProvider,
    apiVoiceAssignments,
  ]);

  // When exactly one scene is loaded, its Run Lines settings (role, voice
  // assignments, pause mode, etc.) are remembered per-scene so switching
  // between scenes in the same project no longer clobbers each other's setup.
  const activeSceneId = scenes.length === 1 ? scenes[0].id : null;
  const appliedSceneProfileIdRef = useRef<string | null>(null);
  const skipSceneProfileSaveRef = useRef(false);

  useEffect(() => {
    if (!activeSceneId) {
      appliedSceneProfileIdRef.current = null;
      return;
    }
    if (appliedSceneProfileIdRef.current === activeSceneId) return;
    appliedSceneProfileIdRef.current = activeSceneId;
    skipSceneProfileSaveRef.current = true;

    const profile = loadSceneProfile(currentProjectId, activeSceneId);
    if (!profile) return;

    if (profile.selectedCharacter)
      setSelectedCharacter(profile.selectedCharacter);
    if (profile.voiceAssignments) setVoiceAssignments(profile.voiceAssignments);
    if (profile.apiVoiceAssignments)
      setApiVoiceAssignments(profile.apiVoiceAssignments);
    if (typeof profile.speakNames === "boolean")
      setSpeakNames(profile.speakNames);
    if (typeof profile.readOwnLines === "boolean")
      setReadOwnLines(profile.readOwnLines);
    if (typeof profile.coverMyLines === "boolean")
      setCoverMyLines(profile.coverMyLines);
    if (typeof profile.skipNarration === "boolean")
      setSkipNarration(profile.skipNarration);
    if (typeof profile.skipStageDirections === "boolean")
      setSkipStageDirections(profile.skipStageDirections);
    if (profile.rehearsalMode) setRehearsalMode(profile.rehearsalMode);
    if (profile.pauseMode) setPauseMode(profile.pauseMode);
    if (typeof profile.countdownSeconds === "number")
      setCountdownSeconds(profile.countdownSeconds);
    if (typeof profile.wordsPerMinute === "number")
      setWordsPerMinute(profile.wordsPerMinute);
    if (typeof profile.narratorVoiceIndex === "number")
      setNarratorVoiceIndex(profile.narratorVoiceIndex);
    if (profile.ttsProvider) setTtsProvider(profile.ttsProvider);
  }, [activeSceneId, currentProjectId]);

  useEffect(() => {
    if (!activeSceneId) return;
    if (skipSceneProfileSaveRef.current) {
      skipSceneProfileSaveRef.current = false;
      return;
    }

    const profile: SceneRunLinesProfile = {
      selectedCharacter,
      voiceAssignments,
      apiVoiceAssignments,
      speakNames,
      readOwnLines,
      coverMyLines,
      skipNarration,
      skipStageDirections,
      rehearsalMode,
      pauseMode,
      countdownSeconds,
      wordsPerMinute,
      narratorVoiceIndex,
      ttsProvider,
    };

    const timer = setTimeout(() => {
      saveSceneProfile(currentProjectId, activeSceneId, profile);
    }, 500);

    return () => {
      clearTimeout(timer);
      saveSceneProfile(currentProjectId, activeSceneId, profile);
    };
  }, [
    activeSceneId,
    currentProjectId,
    selectedCharacter,
    voiceAssignments,
    apiVoiceAssignments,
    speakNames,
    readOwnLines,
    coverMyLines,
    skipNarration,
    skipStageDirections,
    rehearsalMode,
    pauseMode,
    countdownSeconds,
    wordsPerMinute,
    narratorVoiceIndex,
    ttsProvider,
  ]);

  // Rehearsal playback logic
  const speakLine = useCallback(
    (line: DialogueLine, onDone: () => void) => {
      // Treat explicit narrator cues and plain narrative lines as the same
      // cache/voice bucket so they are saved and replayed consistently.
      const isNarratorLine = isNarratorPlaybackLine(line);

      // For combined speakers like "MOM + JOEY", use the first individual's voice.
      const primarySpeaker = isNarratorLine
        ? "NARRATOR"
        : splitSpeaker(line.character)[0] || line.character;
      const cacheEnabled = getTTSSettings().enableAudioCache ?? false;
      if (isNarratorLine) {
        const playBlob = (blob: Blob): Promise<void> =>
          new Promise<void>((resolve) => {
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.onended = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            audio.onerror = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            audio.play().catch(() => {
              URL.revokeObjectURL(url);
              resolve();
            });
          });

        if (ttsProvider === "kokoro") {
          (async () => {
            const ttsSettings = getTTSSettings();
            const narratorVoice =
              apiVoiceAssignments["NARRATOR"] ||
              ttsSettings.kokoroVoice ||
              "am_puck";
            const voiceSig = `kokoro:${narratorVoice}`;
            if (cacheEnabled) {
              const cached = await getCachedAudioFile(
                primarySpeaker,
                line.dialogue,
                voiceSig,
              );
              if (cached) {
                setPlayedFromCache(true);
                await playBlob(cached);
                onDone();
                return;
              }
            }
            setPlayedFromCache(false);
            await speakTextViaKokoro(line.dialogue, {
              voice: narratorVoice,
              speed: 1,
              characterName: primarySpeaker,
              cacheAudio: cacheEnabled,
              voiceSignature: voiceSig,
            });
            onDone();
          })().catch(() => onDone());
          return;
        }

        if (ttsProvider === "api" || ttsProvider === "proxy") {
          (async () => {
            const ttsSettings = getTTSSettings();
            const narratorVoice =
              apiVoiceAssignments["NARRATOR"] ||
              ttsSettings.defaultVoiceId ||
              "af_heart";
            const apiType = ttsSettings.externalApiType ?? "custom";
            const voiceSig = `${apiType}:${narratorVoice}`;
            if (cacheEnabled) {
              const cached = await getCachedAudioFile(
                primarySpeaker,
                line.dialogue,
                voiceSig,
              );
              if (cached) {
                setPlayedFromCache(true);
                await playBlob(cached);
                onDone();
                return;
              }
            }
            setPlayedFromCache(false);
            await speakTextViaApi(line.dialogue, {
              voice: narratorVoice,
              speed: 1,
              characterName: primarySpeaker,
              cacheAudio: cacheEnabled,
              forceProxy: ttsProvider === "proxy",
            });
            onDone();
          })().catch(() => {
            setCurrentPrompt("Voice playback failed. Tap Continue to retry.");
            setRehearsal((prev) => ({ ...prev, isPaused: true }));
          });
          return;
        }

        const utterance = new SpeechSynthesisUtterance(line.dialogue);
        utterance.rate = 1;
        utterance.pitch = 1;
        if (availableVoices.length && availableVoices[narratorVoiceIndex]) {
          utterance.voice = availableVoices[narratorVoiceIndex];
        }
        utterance.onend = onDone;
        utterance.onerror = onDone;
        window.speechSynthesis.speak(utterance);
        return;
      }

      // â”€â”€ Kokoro TTS path â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (ttsProvider === "kokoro") {
        const ttsSettings = getTTSSettings();
        const voice =
          apiVoiceAssignments[primarySpeaker] ||
          ttsSettings.kokoroVoice ||
          "am_puck";
        const cfg = voiceAssignments[primarySpeaker] || {
          rate: 1,
          pitch: 1,
          voiceIndex: 0,
        };

        const doKokoroSpeak = () =>
          speakTextViaKokoro(line.dialogue, {
            voice,
            speed: cfg.rate,
            characterName: primarySpeaker,
            cacheAudio: cacheEnabled,
            voiceSignature: `kokoro:${voice}`,
          });

        const playCachedBlob = (blob: Blob): Promise<void> =>
          new Promise<void>((resolve) => {
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.onended = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            audio.onerror = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            audio.play().catch(() => {
              URL.revokeObjectURL(url);
              resolve();
            });
          });

        (async () => {
          if (cacheEnabled) {
            const cached = await getCachedAudioFile(
              primarySpeaker,
              line.dialogue,
              `kokoro:${voice}`,
            );
            if (cached) {
              setPlayedFromCache(true);
              if (speakNames) {
                const nameUtter = new SpeechSynthesisUtterance(
                  `${line.character}.`,
                );
                nameUtter.rate = 1;
                if (availableVoices[narratorVoiceIndex])
                  nameUtter.voice = availableVoices[narratorVoiceIndex];
                nameUtter.onend = () =>
                  playCachedBlob(cached).then(onDone).catch(onDone);
                nameUtter.onerror = () =>
                  playCachedBlob(cached).then(onDone).catch(onDone);
                window.speechSynthesis.speak(nameUtter);
              } else {
                playCachedBlob(cached).then(onDone).catch(onDone);
              }
              return;
            }
          }
          setPlayedFromCache(false);

          if (speakNames) {
            const nameUtter = new SpeechSynthesisUtterance(
              `${line.character}.`,
            );
            nameUtter.rate = 1;
            if (availableVoices[narratorVoiceIndex])
              nameUtter.voice = availableVoices[narratorVoiceIndex];
            nameUtter.onend = () => doKokoroSpeak().then(onDone).catch(onDone);
            nameUtter.onerror = () =>
              doKokoroSpeak().then(onDone).catch(onDone);
            window.speechSynthesis.speak(nameUtter);
          } else {
            doKokoroSpeak().then(onDone).catch(onDone);
          }
        })();
        return;
      }

      // â”€â”€ API TTS path â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (ttsProvider === "api" || ttsProvider === "proxy") {
        const voiceId =
          apiVoiceAssignments[primarySpeaker] ||
          (ttsProvider === "proxy"
            ? getTTSSettings().defaultVoiceId || "af_heart"
            : "");
        const ttsSettings = getTTSSettings();
        const apiType = ttsSettings.externalApiType ?? "custom";
        const voiceSig = `${apiType}:${voiceId}`;
        const cfg = voiceAssignments[primarySpeaker] || {
          rate: 1,
          pitch: 1,
          voiceIndex: 0,
        };

        const cacheEnabledApi = cacheEnabled;

        console.log("[TTS API]", {
          character: line.character,
          primarySpeaker,
          voiceId,
          allAssignments: { ...apiVoiceAssignments },
        });

        const doApiSpeak = (text: string, voice: string, speed: number) =>
          speakTextViaApi(text, {
            voice,
            speed,
            characterName: primarySpeaker,
            cacheAudio: cacheEnabledApi,
            forceProxy: ttsProvider === "proxy",
          });

        const playCachedBlobApi = (blob: Blob): Promise<void> =>
          new Promise<void>((resolve) => {
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.onended = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            audio.onerror = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            audio.play().catch(() => {
              URL.revokeObjectURL(url);
              resolve();
            });
          });

        (async () => {
          if (cacheEnabledApi) {
            const cached = await getCachedAudioFile(
              primarySpeaker,
              line.dialogue,
              voiceSig,
            );
            if (cached) {
              setPlayedFromCache(true);
              if (speakNames) {
                const nameUtter = new SpeechSynthesisUtterance();
                nameUtter.text = `${line.character}.`;
                nameUtter.rate = 1;
                nameUtter.pitch = 1;
                if (
                  availableVoices.length &&
                  availableVoices[narratorVoiceIndex]
                )
                  nameUtter.voice = availableVoices[narratorVoiceIndex];
                nameUtter.onend = () =>
                  playCachedBlobApi(cached).then(onDone).catch(onDone);
                nameUtter.onerror = () =>
                  playCachedBlobApi(cached).then(onDone).catch(onDone);
                window.speechSynthesis.speak(nameUtter);
              } else {
                playCachedBlobApi(cached).then(onDone).catch(onDone);
              }
              return;
            }
          }
          setPlayedFromCache(false);

          const speakViaApi = (text: string, voice: string, speed: number) => {
            doApiSpeak(text, voice, speed)
              .then(onDone)
              .catch(() => {
                setCurrentPrompt(
                  "Voice playback failed. Tap Continue to retry.",
                );
                setRehearsal((prev) => ({ ...prev, isPaused: true }));
              });
          };

          if (speakNames) {
            const nameUtter = new SpeechSynthesisUtterance();
            nameUtter.text = `${line.character}.`;
            nameUtter.rate = 1;
            nameUtter.pitch = 1;
            if (availableVoices.length && availableVoices[narratorVoiceIndex]) {
              nameUtter.voice = availableVoices[narratorVoiceIndex];
            }
            nameUtter.onend = () =>
              speakViaApi(line.dialogue, voiceId, cfg.rate || 1);
            nameUtter.onerror = () =>
              speakViaApi(line.dialogue, voiceId, cfg.rate || 1);
            window.speechSynthesis.speak(nameUtter);
          } else {
            speakViaApi(line.dialogue, voiceId, cfg.rate || 1);
          }
        })();
        return;
      }

      // â”€â”€ Browser TTS path â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const cfg = voiceAssignments[primarySpeaker] || {
        rate: 1,
        pitch: 1,
        voiceIndex: 0,
      };

      // If speakNames is enabled, speak character name with narrator voice first
      if (speakNames) {
        const nameUtter = new SpeechSynthesisUtterance();
        nameUtter.text = `${line.character}.`;
        nameUtter.rate = 1;
        nameUtter.pitch = 1;

        if (availableVoices.length && availableVoices[narratorVoiceIndex]) {
          nameUtter.voice = availableVoices[narratorVoiceIndex];
        }

        nameUtter.onend = () => {
          // After narrator says character name, speak the dialogue
          const dialogueUtter = new SpeechSynthesisUtterance();
          dialogueUtter.text = line.dialogue;
          dialogueUtter.rate = cfg.rate || 1;
          dialogueUtter.pitch = cfg.pitch || 1;

          if (availableVoices.length && availableVoices[cfg.voiceIndex]) {
            dialogueUtter.voice = availableVoices[cfg.voiceIndex];
          }

          dialogueUtter.onend = onDone;
          dialogueUtter.onerror = onDone;

          window.speechSynthesis.speak(dialogueUtter);
        };

        nameUtter.onerror = onDone;
        window.speechSynthesis.speak(nameUtter);
      } else {
        // No narrator, just speak the dialogue
        const utter = new SpeechSynthesisUtterance();
        utter.text = line.dialogue;
        utter.rate = cfg.rate || 1;
        utter.pitch = cfg.pitch || 1;

        if (availableVoices.length && availableVoices[cfg.voiceIndex]) {
          utter.voice = availableVoices[cfg.voiceIndex];
        }

        utter.onend = onDone;
        utter.onerror = onDone;

        window.speechSynthesis.speak(utter);
      }
    },
    [
      voiceAssignments,
      apiVoiceAssignments,
      ttsProvider,
      speakNames,
      availableVoices,
      narratorVoiceIndex,
    ],
  );

  const runRehearsalLine = useCallback(() => {
    if (rehearsal.isPlaying === false || rehearsal.isPaused) return;

    if (rehearsal.index >= rehearsal.lines.length) {
      setCurrentSpeaker("DONE");
      setCurrentDialogue("End of scene. Nice work.");
      setCurrentPrompt("");
      setRehearsal((prev) => ({ ...prev, isPlaying: false }));
      return;
    }

    // Skip narration and stage directions if enabled
    let idx = rehearsal.index;
    let line = rehearsal.lines[idx];
    while (
      line &&
      ((skipNarration && line.character === "[Narrative]") ||
        (skipStageDirections &&
          (line.character === "[Stage Direction]" ||
            line.character === "[Scene Heading]" ||
            line.isStageDirection)))
    ) {
      if (line.isNarratorCue) {
        break;
      }
      idx++;
      line = rehearsal.lines[idx];
    }
    if (!line) {
      setCurrentSpeaker("DONE");
      setCurrentDialogue("End of scene. Nice work.");
      setCurrentPrompt("");
      setRehearsal((prev) => ({ ...prev, isPlaying: false }));
      return;
    }
    if (idx !== rehearsal.index) {
      setRehearsal((prev) => ({ ...prev, index: idx }));
      return;
    }

    // Combined line is "mine" if any speaker matches selectedCharacter.
    // Stage directions never count as a character's line — guard on the
    // canonical `isStageDirection` flag rather than `character`, since some
    // persisted lines retain the original speaker name after reclassification.
    const isMine =
      !line.isStageDirection &&
      splitSpeaker(line.character).some((name) =>
        characterNamesMatch(name, selectedCharacter),
      );

    const dialogueForDisplay =
      coverMyLines && isMine && revealedLineIndex !== idx
        ? line.dialogue.replace(/[^\s]/g, "•")
        : line.dialogue;

    if (isMine && !readOwnLines) {
      setCurrentSpeaker(line.character);
      setCurrentDialogue(dialogueForDisplay);
      setCurrentPrompt("Your turn.");

      if (pauseMode === "countdown") {
        let sec = Math.max(1, countdownSeconds);
        setCurrentPrompt(`Your turn. Continuing in ${sec}...`);

        const interval = setInterval(() => {
          sec -= 1;
          if (sec <= 0) {
            clearInterval(interval);
            setCurrentPrompt("");
            setRehearsal((prev) => ({ ...prev, index: prev.index + 1 }));
          } else {
            setCurrentPrompt(`Your turn. Continuing in ${sec}...`);
          }
        }, 1000);

        setCountdownInterval(interval);
      } else if (pauseMode === "wpm") {
        // Calculate words in the line
        const wordCount = line.dialogue.trim().split(/\s+/).length;
        // Calculate seconds based on WPM: (words / wpm) * 60
        const seconds = Math.max(
          1,
          Math.round((wordCount / wordsPerMinute) * 60),
        );
        setCurrentPrompt(`Your turn. Continuing in ${seconds}s...`);

        let remaining = seconds;
        const interval = setInterval(() => {
          remaining -= 1;
          if (remaining <= 0) {
            clearInterval(interval);
            setCurrentPrompt("");
            setRehearsal((prev) => ({ ...prev, index: prev.index + 1 }));
          } else {
            setCurrentPrompt(`Your turn. Continuing in ${remaining}s...`);
          }
        }, 1000);

        setCountdownInterval(interval);
      } else {
        setRehearsal((prev) => ({ ...prev, isPaused: true }));
      }

      return;
    }

    // Cue Only mode: silently advance past lines that are not the immediate
    // cue (the line directly before the next user line).
    if (rehearsalMode === "cue-only") {
      const nextUserIdx = rehearsal.lines.findIndex(
        (l, i) =>
          i > rehearsal.index &&
          !l.isStageDirection &&
          l.character === selectedCharacter,
      );
      if (nextUserIdx !== -1 && rehearsal.index < nextUserIdx - 1) {
        setRehearsal((prev) => ({ ...prev, index: prev.index + 1 }));
        return;
      }
    }

    setCurrentSpeaker(line.character);
    setCurrentDialogue(dialogueForDisplay);
    setCurrentPrompt(isMine ? "Read-through mode" : "Listening...");

    // Pre-generate the next non-user Kokoro line in the background (if enabled)
    if (ttsProvider === "kokoro") {
      const ttsSettings = getTTSSettings();
      if (ttsSettings.kokoroPreGenEnabled !== false) {
        for (let i = rehearsal.index + 1; i < rehearsal.lines.length; i++) {
          const upcoming = rehearsal.lines[i];
          const upcomingIsMine =
            !upcoming.isStageDirection &&
            splitSpeaker(upcoming.character).some((n) =>
              characterNamesMatch(n, selectedCharacter),
            );
          if (!upcomingIsMine && upcoming.dialogue.trim()) {
            const primary =
              splitSpeaker(upcoming.character)[0] || upcoming.character;
            pregenerateText(upcoming.dialogue, {
              voice:
                apiVoiceAssignments[primary] ||
                ttsSettings.kokoroVoice ||
                "am_puck",
              speed: (voiceAssignments[primary] || { rate: 1 }).rate,
            });
            break;
          }
        }
      }
    }

    speakLine(line, () => {
      if (rehearsal.isPlaying && !rehearsal.isPaused) {
        const timeout = setTimeout(() => {
          setRehearsal((prev) => ({ ...prev, index: prev.index + 1 }));
        }, 250);
        setNextLineTimeout(timeout);
      }
    });
  }, [
    rehearsal,
    selectedCharacter,
    readOwnLines,
    coverMyLines,
    rehearsalMode,
    pauseMode,
    countdownSeconds,
    wordsPerMinute,
    speakLine,
    ttsProvider,
    apiVoiceAssignments,
    voiceAssignments,
    skipNarration,
    skipStageDirections,
    revealedLineIndex,
  ]);

  // Trigger rehearsal advancement
  useEffect(() => {
    if (rehearsal.isPlaying && !rehearsal.isPaused) {
      runRehearsalLine();
    }
  }, [
    rehearsal.index,
    rehearsal.isPlaying,
    rehearsal.isPaused,
    runRehearsalLine,
  ]);

  // Reveal is line-specific; clear it whenever playback advances.
  useEffect(() => {
    setRevealedLineIndex(null);
  }, [rehearsal.index]);

  // Start rehearsal
  const handleStart = () => {
    if (!scenes.length) {
      return;
    }

    if (!selectedCharacter) {
      return;
    }

    window.speechSynthesis.cancel();
    stopApiAudio();

    ensureVoiceAssignments();

    const scene = scenes[selectedSceneIndex];
    capture("rehearsal_started", {
      tts_provider: ttsProvider,
      scene_count: scenes.length,
      load_source: loadSource,
      rehearsal_mode: rehearsalMode,
    });
    setRehearsal({
      lines: scene.lines,
      index: 0,
      isPlaying: true,
      isPaused: false,
    });
    setRevealedLineIndex(null);
  };

  // Pause rehearsal
  const handlePause = () => {
    if (!rehearsal.isPlaying) return;
    window.speechSynthesis.pause();
    stopApiAudio();
    stopKokoroAudio();
    setRehearsal((prev) => ({ ...prev, isPaused: true }));

    if (countdownInterval) clearInterval(countdownInterval);
    if (nextLineTimeout) clearTimeout(nextLineTimeout);
  };

  // Resume rehearsal
  const handleResume = () => {
    if (!rehearsal.isPlaying) {
      handleStart();
      return;
    }

    if (nextLineTimeout) clearTimeout(nextLineTimeout);
    if (countdownInterval) clearInterval(countdownInterval);

    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    // When paused waiting for the user's own line (manual pause mode),
    // advance past that line so the next line plays instead of immediately
    // re-pausing on the same user line.
    if (isMyTurn) {
      setRehearsal((prev) => ({
        ...prev,
        isPaused: false,
        index: prev.index + 1,
      }));
    } else {
      setRehearsal((prev) => ({ ...prev, isPaused: false }));
    }
  };

  // Reset rehearsal back to beginning
  const handleReset = () => {
    window.speechSynthesis.cancel();
    stopApiAudio();
    stopKokoroAudio();
    if (countdownInterval) clearInterval(countdownInterval);
    if (nextLineTimeout) clearTimeout(nextLineTimeout);
    setRehearsal({ lines: [], index: 0, isPlaying: false, isPaused: false });
    setRevealedLineIndex(null);
    setCurrentSpeaker("");
    setCurrentDialogue("Load a scene, pick your role, and press Start.");
    setCurrentPrompt("");
  };

  const handleRevealCurrentLine = () => {
    const line = rehearsal.lines[rehearsal.index];
    if (!line || !coverMyLines) return;

    const isMine =
      !line.isStageDirection &&
      splitSpeaker(line.character).some((name) =>
        characterNamesMatch(name, selectedCharacter),
      );

    if (!isMine) return;

    setRevealedLineIndex(rehearsal.index);
    setCurrentDialogue(line.dialogue);
  };

  const [optionsOpen, setOptionsOpen] = useState(false);
  const [voicesOpen, setVoicesOpen] = useState(false);

  const currentScene = scenes[selectedSceneIndex];
  const characters = currentScene
    ? getCharacters(currentScene, projectCast)
    : [];
  const isActive = rehearsal.isPlaying || rehearsal.isPaused;
  const isMyTurn = rehearsal.isPaused && currentPrompt.startsWith("Your turn");
  const activeLine = rehearsal.lines[rehearsal.index];
  const activeLineIsMine =
    !!activeLine &&
    !activeLine.isStageDirection &&
    splitSpeaker(activeLine.character).some((name) =>
      characterNamesMatch(name, selectedCharacter),
    );
  const canRevealCurrentLine =
    !!activeLine &&
    coverMyLines &&
    activeLineIsMine &&
    revealedLineIndex !== rehearsal.index;

  // â”€â”€ helpers for button styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const btnPrimary =
    "px-4 py-2 rounded-lg font-semibold text-sm bg-accent-cyan text-dark-base hover:bg-accent-cyan/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
  const btnSecondary =
    "px-4 py-2 rounded-lg font-semibold text-sm bg-dark-input border border-border text-light hover:border-accent-cyan transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const btnDanger =
    "px-4 py-2 rounded-lg font-semibold text-sm bg-dark-input border border-border text-red-400 hover:border-red-400 transition-colors";
  const inputCls =
    "w-full bg-background border border-border rounded-lg px-3 py-2 text-light text-sm focus:outline-none focus:border-accent-cyan";
  const labelCls =
    "block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5";

  return (
    <div className="space-y-4">
      {/* ── Run Lines (stays fixed) ──────────────────────────────── */}
      <section className="card space-y-5">
        <button
          onClick={() => setRunLinesOpen((o) => !o)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-bold text-light">Run Lines</h2>
            {scenes[selectedSceneIndex] && (
              <span className="text-sm text-muted truncate max-w-[24rem]">
                {scenes[selectedSceneIndex].title}
              </span>
            )}
          </div>
          <span className="text-muted text-xs flex-shrink-0">
            {runLinesOpen ? "▲ Hide" : "▼ Show"}
          </span>
        </button>

        {runLinesOpen && (
          <div className="space-y-5">
            {scenes.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {scenes.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedSceneIndex(i)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
                      i === selectedSceneIndex
                        ? "border-accent-cyan bg-accent-cyan/20 text-accent-cyan"
                        : "border-border text-muted hover:border-accent-cyan hover:text-light"
                    }`}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            )}

            <div
              className={`rounded-xl border p-6 min-h-[180px] flex flex-col justify-center transition-colors ${
                isMyTurn
                  ? "border-yellow-400/50 bg-yellow-400/5"
                  : "border-border bg-background"
              }`}
            >
              {currentSpeaker ? (
                <>
                  <div className="text-xs font-bold tracking-widest uppercase text-accent-cyan mb-3 flex items-center gap-1.5">
                    {currentSpeaker}
                    {playedFromCache && (
                      <span
                        title="from cache"
                        className="text-emerald-400 text-xs leading-none cursor-default"
                      >
                        ⚡
                      </span>
                    )}
                  </div>
                  <div className="text-xl sm:text-2xl text-light leading-relaxed">
                    {currentDialogue}
                  </div>
                  {currentPrompt && (
                    <div className="text-yellow-400 font-semibold text-sm mt-4">
                      {currentPrompt}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted text-sm text-center">
                  Load a scene, pick your character, and press Start.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {!isActive ? (
                <button
                  onClick={handleStart}
                  disabled={!scenes.length || !selectedCharacter}
                  className={btnPrimary}
                >
                  ▶ Start
                </button>
              ) : rehearsal.isPaused ? (
                <button onClick={handleResume} className={btnPrimary}>
                  ▶ Continue
                </button>
              ) : (
                <button onClick={handlePause} className={btnSecondary}>
                  ⏸ Pause
                </button>
              )}
              {coverMyLines && (
                <button
                  onClick={handleRevealCurrentLine}
                  disabled={!canRevealCurrentLine}
                  className={btnSecondary}
                >
                  👁 Reveal
                </button>
              )}
              {isActive && (
                <button onClick={handleReset} className={btnDanger}>
                  ⏹ Stop
                </button>
              )}
              {!isActive && scenes.length > 0 && (
                <button onClick={handleReset} className={btnSecondary}>
                  Reset
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Sidebar and other cards ─────────────────────────────── */}
      <div className="flex gap-4 items-start">
        {/* ── Load Scenes sidebar ──────────────────────────────────── */}
        <div
          className={`flex-shrink-0 transition-all duration-200 ${scenesOpen ? "w-[34rem]" : "w-8"}`}
        >
          <div className="card relative overflow-hidden">
            {/* Toggle chevron */}
            <button
              onClick={() => setScenesOpen((v) => !v)}
              className="absolute top-3 right-2 z-10 p-0.5 rounded hover:bg-white/10 text-muted hover:text-light transition-colors"
              aria-label={
                scenesOpen ? "Collapse scene loader" : "Expand scene loader"
              }
            >
              {scenesOpen ? (
                <ChevronLeft size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </button>

            {/* Collapsed strip */}
            {!scenesOpen && (
              <div className="flex flex-col items-center py-6 px-1 gap-2">
                <span
                  className="text-xs font-semibold text-muted"
                  style={{
                    writingMode: "vertical-rl",
                    textOrientation: "mixed",
                  }}
                >
                  {scenes.length > 0
                    ? `${scenes.length} scene${scenes.length !== 1 ? "s" : ""}`
                    : "Load Scenes"}
                </span>
              </div>
            )}

            {/* Expanded content */}
            {scenesOpen && (
              <div className="p-4 pr-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-light">
                    Load Scenes
                  </h2>
                  {scenes.length > 0 && (
                    <button
                      onClick={handleClear}
                      className="text-xs text-muted hover:text-red-400 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {/* Source tabs */}
                  <div className="flex gap-1 border-b border-border">
                    {(["library", "paste"] as const).map((src) => (
                      <button
                        key={src}
                        onClick={() => setLoadSource(src)}
                        className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors -mb-px ${
                          loadSource === src
                            ? "border-accent-cyan text-accent-cyan"
                            : "border-transparent text-muted hover:text-light"
                        }`}
                      >
                        {src === "library" ? "From Library" : "Paste Script"}
                      </button>
                    ))}
                  </div>

                  {loadSource === "library" && (
                    <div className="grid grid-cols-2 gap-1 rounded-lg border border-border p-1">
                      {(["scenes", "set-pieces"] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => {
                            setLibraryLoadMode(mode);
                            if (mode === "scenes") {
                              setSelectedLibrarySetPieces(new Set());
                            } else {
                              setSelectedLibrarySceneIds(new Set());
                            }
                          }}
                          className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                            libraryLoadMode === mode
                              ? "bg-accent-cyan/20 text-accent-cyan"
                              : "text-muted hover:text-light hover:bg-white/5"
                          }`}
                        >
                          {mode === "scenes"
                            ? "Individual Scenes"
                            : "Set Pieces"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Library */}
                {loadSource === "library" && (
                  <div className="space-y-3">
                    {libraryScenes.length === 0 ? (
                      <p className="text-muted text-sm">
                        No scenes found. Import scenes in the{" "}
                        <span className="text-accent-cyan">Scenes</span> tab
                        first.
                      </p>
                    ) : libraryLoadMode === "scenes" ? (
                      <>
                        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer hover:text-light select-none">
                          <input
                            type="checkbox"
                            checked={hideScenesWithoutCharacters}
                            onChange={(e) =>
                              setHideScenesWithoutCharacters(e.target.checked)
                            }
                            className="accent-accent-cyan w-3.5 h-3.5"
                          />
                          Hide scenes without characters
                        </label>
                        <input
                          type="text"
                          value={libraryFilter}
                          onChange={(e) => setLibraryFilter(e.target.value)}
                          placeholder="Filter scenes…"
                          className={inputCls}
                        />
                        {(() => {
                          const query = libraryFilter.trim().toLowerCase();
                          const scenesWithCharacters =
                            hideScenesWithoutCharacters
                              ? libraryScenes.filter((ls) => {
                                  const chars =
                                    ls.characters ??
                                    extractSceneCharacters(
                                      ls.content,
                                      undefined,
                                      productionType,
                                    );
                                  return chars.length > 0;
                                })
                              : libraryScenes;
                          const filtered = query
                            ? scenesWithCharacters.filter((ls) => {
                                const chars =
                                  ls.characters ??
                                  extractSceneCharacters(
                                    ls.content,
                                    undefined,
                                    productionType,
                                  );
                                return (
                                  ls.title.toLowerCase().includes(query) ||
                                  ls.content.toLowerCase().includes(query) ||
                                  chars.some((c) =>
                                    c.toLowerCase().includes(query),
                                  )
                                );
                              })
                            : scenesWithCharacters;
                          const allSelected =
                            filtered.length > 0 &&
                            filtered.every((ls) =>
                              selectedLibrarySceneIds.has(ls.id),
                            );
                          const someSelected = filtered.some((ls) =>
                            selectedLibrarySceneIds.has(ls.id),
                          );
                          return (
                            <div className="border border-border rounded-lg overflow-hidden">
                              <label className="flex items-center gap-3 px-3 py-2 bg-dark-panel border-b border-border cursor-pointer hover:bg-white/5 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={allSelected}
                                  ref={(el) => {
                                    if (el)
                                      el.indeterminate =
                                        someSelected && !allSelected;
                                  }}
                                  onChange={() => {
                                    const next = new Set(
                                      selectedLibrarySceneIds,
                                    );
                                    if (allSelected)
                                      filtered.forEach((ls) =>
                                        next.delete(ls.id),
                                      );
                                    else
                                      filtered.forEach((ls) => next.add(ls.id));
                                    loadFromSceneIds(next);
                                  }}
                                  className="accent-accent-cyan"
                                />
                                <span className="text-xs font-semibold text-muted uppercase tracking-widest">
                                  All{query ? ` (${filtered.length})` : ""}
                                </span>
                              </label>
                              {filtered.map((ls) => {
                                const isSelected = selectedLibrarySceneIds.has(
                                  ls.id,
                                );
                                const chars =
                                  ls.characters ??
                                  extractSceneCharacters(
                                    ls.content,
                                    undefined,
                                    productionType,
                                  );
                                return (
                                  <label
                                    key={ls.id}
                                    className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer border-b border-border last:border-b-0 transition-colors ${isSelected ? "bg-accent-cyan/5" : "hover:bg-white/5"}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleLibraryScene(ls.id)}
                                      className="accent-accent-cyan mt-0.5 flex-shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <div className="text-sm text-light font-medium truncate">
                                        {ls.title}
                                      </div>
                                      {chars.length > 0 && (
                                        <div className="text-xs text-accent-cyan mt-0.5 truncate">
                                          {chars.join(", ")}
                                        </div>
                                      )}
                                    </div>
                                  </label>
                                );
                              })}
                              {filtered.length === 0 && (
                                <div className="px-3 py-4 text-muted text-sm text-center">
                                  No matches
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={libraryFilter}
                          onChange={(e) => setLibraryFilter(e.target.value)}
                          placeholder="Filter set pieces…"
                          className={inputCls}
                        />
                        {(() => {
                          const query = libraryFilter.trim().toLowerCase();
                          const filtered = query
                            ? librarySetPieceGroups.filter((group) => {
                                const groupChars = group.scenes.flatMap(
                                  (scene) =>
                                    scene.characters ??
                                    extractSceneCharacters(
                                      scene.content,
                                      undefined,
                                      productionType,
                                    ),
                                );
                                return (
                                  group.label.toLowerCase().includes(query) ||
                                  group.scenes.some((scene) =>
                                    scene.title.toLowerCase().includes(query),
                                  ) ||
                                  groupChars.some((c) =>
                                    c.toLowerCase().includes(query),
                                  )
                                );
                              })
                            : librarySetPieceGroups;
                          const allSelected =
                            filtered.length > 0 &&
                            filtered.every((group) =>
                              selectedLibrarySetPieces.has(group.label),
                            );
                          const someSelected = filtered.some((group) =>
                            selectedLibrarySetPieces.has(group.label),
                          );
                          return (
                            <div className="border border-border rounded-lg overflow-hidden">
                              <label className="flex items-center gap-3 px-3 py-2 bg-dark-panel border-b border-border cursor-pointer hover:bg-white/5 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={allSelected}
                                  ref={(el) => {
                                    if (el)
                                      el.indeterminate =
                                        someSelected && !allSelected;
                                  }}
                                  onChange={() => {
                                    const next = new Set(
                                      selectedLibrarySetPieces,
                                    );
                                    if (allSelected)
                                      filtered.forEach((group) =>
                                        next.delete(group.label),
                                      );
                                    else
                                      filtered.forEach((group) =>
                                        next.add(group.label),
                                      );
                                    loadFromSetPieceLabels(next);
                                  }}
                                  className="accent-accent-cyan"
                                />
                                <span className="text-xs font-semibold text-muted uppercase tracking-widest">
                                  All{query ? ` (${filtered.length})` : ""}
                                </span>
                              </label>
                              {filtered.map((group) => {
                                const isSelected = selectedLibrarySetPieces.has(
                                  group.label,
                                );
                                return (
                                  <label
                                    key={group.label}
                                    className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer border-b border-border last:border-b-0 transition-colors ${isSelected ? "bg-accent-cyan/5" : "hover:bg-white/5"}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() =>
                                        toggleLibrarySetPiece(group.label)
                                      }
                                      className="accent-accent-cyan mt-0.5 flex-shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <div className="text-sm text-light font-medium truncate">
                                        {group.label}
                                      </div>
                                      <div className="text-xs text-accent-cyan mt-0.5">
                                        {group.scenes.length} scene
                                        {group.scenes.length !== 1 ? "s" : ""}
                                      </div>
                                      <div className="text-[11px] text-muted mt-0.5 truncate">
                                        {group.scenes
                                          .map((scene) => scene.title)
                                          .join(" • ")}
                                      </div>
                                    </div>
                                  </label>
                                );
                              })}
                              {filtered.length === 0 && (
                                <div className="px-3 py-4 text-muted text-sm text-center">
                                  No matches
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}

                {/* Paste */}
                {loadSource === "paste" && (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2">
                      {(["single", "multiple"] as const).map((m) => (
                        <label
                          key={m}
                          className="flex items-center gap-2 text-sm text-muted cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="sceneMode"
                            value={m}
                            checked={sceneMode === m}
                            onChange={() => setSceneMode(m)}
                            className="accent-accent-cyan"
                          />
                          {m === "single" ? "Single scene" : "Multiple scenes"}
                        </label>
                      ))}
                    </div>
                    <textarea
                      value={scriptInput}
                      onChange={(e) =>
                        setScriptInput(normalizeScriptInput(e.target.value))
                      }
                      placeholder="SCENE 1: AUDITION ROOM&#10;MOM: You know the lines.&#10;JOEY: I always know them until..."
                      rows={8}
                      className={`${inputCls} font-mono resize-y`}
                    />
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={handleParseScript}
                        className={btnPrimary}
                      >
                        Load Script
                      </button>
                      <button
                        onClick={handleLoadSample}
                        className={btnSecondary}
                      >
                        Load Sample
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Main content ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Role & Options */}
          <section className="card space-y-4">
            <button
              onClick={() => setOptionsOpen((o) => !o)}
              className="w-full flex items-center justify-between"
            >
              <h2 className="text-base font-bold text-light">
                Role &amp; Options
              </h2>
              <span className="text-muted text-xs">
                {optionsOpen ? "▲ Hide" : "▼ Show"}
              </span>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>My Character</label>
                <select
                  value={selectedCharacter}
                  onChange={(e) => setSelectedCharacter(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Choose a character…</option>
                  {characters.map((char) => (
                    <option key={char} value={char}>
                      {char}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>On My Line</label>
                <select
                  value={pauseMode}
                  onChange={(e) =>
                    setPauseMode(
                      e.target.value as "manual" | "countdown" | "wpm",
                    )
                  }
                  className={inputCls}
                >
                  <option value="manual">Pause and wait</option>
                  <option value="countdown">Countdown then continue</option>
                  <option value="wpm">Words per minute</option>
                </select>
              </div>
            </div>

            {optionsOpen && (
              <div className="space-y-4 pt-2 border-t border-border">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Rehearsal Mode</label>
                    <select
                      value={rehearsalMode}
                      onChange={(e) =>
                        setRehearsalMode(e.target.value as "full" | "cue-only")
                      }
                      className={inputCls}
                    >
                      <option value="full">Full Scene</option>
                      <option value="cue-only">Cue Only</option>
                    </select>
                    {rehearsalMode === "cue-only" && (
                      <p className="text-muted text-xs mt-1">
                        Only the line before yours is spoken.
                      </p>
                    )}
                  </div>
                  {pauseMode === "countdown" && (
                    <div>
                      <label className={labelCls}>Countdown Seconds</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={countdownSeconds}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, "");
                          setCountdownSeconds(
                            raw === "" ? 1 : Math.max(1, parseInt(raw)),
                          );
                        }}
                        className={inputCls}
                      />
                    </div>
                  )}
                  {pauseMode === "wpm" && (
                    <div>
                      <label className={labelCls}>Words Per Minute</label>
                      <input
                        type="number"
                        min={50}
                        max={400}
                        value={wordsPerMinute}
                        onChange={(e) =>
                          setWordsPerMinute(
                            Math.max(50, parseInt(e.target.value) || 160),
                          )
                        }
                        className={inputCls}
                      />
                      <p className="text-muted text-xs mt-1">
                        Auto-advance based on line length
                      </p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      {
                        state: speakNames,
                        set: setSpeakNames,
                        label: "Speak names",
                      },
                      {
                        state: readOwnLines,
                        set: setReadOwnLines,
                        label: "Read my lines",
                      },
                      {
                        state: coverMyLines,
                        set: setCoverMyLines,
                        label: "Cover my lines in box",
                      },
                      {
                        state: skipNarration,
                        set: setSkipNarration,
                        label: "Skip narration",
                      },
                      {
                        state: skipStageDirections,
                        set: setSkipStageDirections,
                        label: "Skip stage directions",
                      },
                    ] as {
                      state: boolean;
                      set: (v: boolean) => void;
                      label: string;
                    }[]
                  ).map(({ state, set, label }) => (
                    <label
                      key={label}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={state}
                        onChange={(e) => set(e.target.checked)}
                        className="accent-accent-cyan flex-shrink-0"
                      />
                      <span className="text-sm text-muted">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Character Voices */}
          <section className="card space-y-4">
            <button
              onClick={() => setVoicesOpen((v) => !v)}
              className="w-full flex items-center justify-between"
            >
              <h2 className="text-base font-bold text-light">
                Character Voices
              </h2>
              <span className="text-muted text-xs">
                {voicesOpen ? "▲ Hide" : "▼ Show"}
              </span>
            </button>

            {voicesOpen && (
              <div className="space-y-4 pt-2 border-t border-border">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className={labelCls}>TTS Provider</label>
                    <select
                      value={ttsProvider}
                      onChange={async (e) => {
                        const provider = e.target.value as
                          | "browser"
                          | "api"
                          | "kokoro"
                          | "proxy";
                        if (provider === "proxy") {
                          setTtsProvider("proxy");
                          setApiVoices(BUILT_IN_PROXY_VOICES);
                        } else if (provider === "api") {
                          const s = getTTSSettings();
                          if (!s.apiUrl) {
                            alert(
                              "Configure your TTS API URL in Settings first.",
                            );
                            return;
                          }
                          setTtsProvider("api");
                          if (apiVoices.length === 0) {
                            setApiVoicesLoading(true);
                            setApiVoicesError(null);
                            fetchApiVoices(s)
                              .then((v) => {
                                setApiVoices(v);
                                if (v.length === 0)
                                  setApiVoicesError("No voices returned.");
                              })
                              .catch((err) =>
                                setApiVoicesError(
                                  err instanceof Error ? err.message : "Failed",
                                ),
                              )
                              .finally(() => setApiVoicesLoading(false));
                          }
                        } else if (provider === "kokoro") {
                          setTtsProvider("kokoro");
                          if (getKokoroLoadState() === "idle") {
                            setKokoroStatus("Loading model…");
                            try {
                              await loadKokoro({
                                device: getTTSSettings().kokoroDevice ?? "wasm",
                              });
                              setKokoroStatus(null);
                            } catch (err) {
                              setKokoroStatus(
                                err instanceof Error
                                  ? err.message
                                  : "Load failed",
                              );
                            }
                          }
                        } else {
                          setTtsProvider("browser");
                        }
                      }}
                      className={`${inputCls} w-auto`}
                    >
                      <option value="browser">Browser</option>
                      {canUseKokoro && (
                        <option value="kokoro">Kokoro AI</option>
                      )}
                      <option value="proxy">Built-in AI</option>
                      <option value="api">External API</option>
                    </select>
                  </div>
                  {ttsProvider === "browser" && (
                    <button
                      onClick={() => {
                        const voices = window.speechSynthesis.getVoices();
                        if (voices.length > 0) setAvailableVoices(voices);
                      }}
                      className={btnSecondary}
                    >
                      ↻ Load Voices
                    </button>
                  )}
                  {ttsProvider === "api" && (
                    <button
                      onClick={() => {
                        setApiVoicesLoading(true);
                        setApiVoicesError(null);
                        fetchApiVoices(getTTSSettings())
                          .then((v) => {
                            setApiVoices(v);
                            if (v.length === 0)
                              setApiVoicesError("No voices returned.");
                          })
                          .catch((err) =>
                            setApiVoicesError(
                              err instanceof Error ? err.message : "Failed",
                            ),
                          )
                          .finally(() => setApiVoicesLoading(false));
                      }}
                      disabled={apiVoicesLoading}
                      className={btnSecondary}
                    >
                      {apiVoicesLoading ? "Loading…" : "↻ Refresh Voices"}
                    </button>
                  )}
                  {ttsProvider === "kokoro" && (
                    <button
                      onClick={async () => {
                        setKokoroStatus("Loading model…");
                        try {
                          await loadKokoro({
                            device: getTTSSettings().kokoroDevice ?? "wasm",
                          });
                          setKokoroStatus(null);
                        } catch (err) {
                          setKokoroStatus(
                            err instanceof Error ? err.message : "Load failed",
                          );
                        }
                      }}
                      disabled={getKokoroLoadState() === "loading"}
                      className={btnSecondary}
                    >
                      {getKokoroLoadState() === "loading"
                        ? "Loading…"
                        : "↻ Reload Model"}
                    </button>
                  )}
                  {ttsProvider === "proxy" && (
                    <button
                      onClick={() => {
                        setApiVoices(BUILT_IN_PROXY_VOICES);
                      }}
                      className={btnSecondary}
                    >
                      ↻ Load Voices
                    </button>
                  )}
                  {ttsProvider === "kokoro" && kokoroStatus && (
                    <span className="text-xs text-muted">{kokoroStatus}</span>
                  )}
                  {ttsProvider === "kokoro" &&
                    getKokoroLoadState() === "ready" &&
                    !kokoroStatus && (
                      <span className="text-xs text-green-400">
                        Model ready
                      </span>
                    )}
                  {ttsProvider === "api" && apiVoicesError && (
                    <span className="text-xs text-red-400">
                      {apiVoicesError}
                    </span>
                  )}
                </div>

                {speakNames && (
                  <div
                    className="grid items-center gap-2 p-3 bg-dark-input border border-border rounded-lg"
                    style={{ gridTemplateColumns: "6rem 1fr auto auto auto" }}
                  >
                    <span className="text-sm font-semibold text-light truncate">
                      🎙 Narrator
                    </span>
                    {ttsProvider === "browser" ? (
                      <select
                        value={narratorVoiceIndex}
                        onChange={(e) =>
                          setNarratorVoiceIndex(parseInt(e.target.value))
                        }
                        className={inputCls}
                      >
                        {availableVoices.length === 0 ? (
                          <option>Default browser voice</option>
                        ) : (
                          availableVoices.map((v, i) => (
                            <option key={i} value={i}>
                              {v.name} ({v.lang})
                            </option>
                          ))
                        )}
                      </select>
                    ) : ttsProvider === "kokoro" ? (
                      <select
                        value={apiVoiceAssignments["NARRATOR"] || ""}
                        onChange={(e) =>
                          setApiVoiceAssignments((p) => ({
                            ...p,
                            NARRATOR: e.target.value,
                          }))
                        }
                        className={inputCls}
                      >
                        <option value="">
                          Default ({getTTSSettings().kokoroVoice || "am_puck"})
                        </option>
                        {KOKORO_VOICES.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={apiVoiceAssignments["NARRATOR"] || ""}
                        onChange={(e) =>
                          setApiVoiceAssignments((p) => ({
                            ...p,
                            NARRATOR: e.target.value,
                          }))
                        }
                        className={inputCls}
                      >
                        <option value="">
                          {apiVoices.length === 0
                            ? apiVoicesLoading
                              ? "Loading…"
                              : "Refresh voices"
                            : "Default"}
                        </option>
                        {apiVoices.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name ? `${v.name} (${v.id})` : v.id}
                          </option>
                        ))}
                      </select>
                    )}
                    <div />
                    <div />
                    <div />
                  </div>
                )}

                {(() => {
                  const stageCfg = voiceAssignments["[Stage Direction]"] || {
                    voiceIndex: 0,
                    rate: 1,
                    pitch: 1,
                  };
                  return (
                    <div
                      className="grid items-center gap-2 p-3 bg-dark-input border border-border rounded-lg"
                      style={{ gridTemplateColumns: "6rem 1fr auto auto auto" }}
                    >
                      <span className="text-sm font-semibold text-light truncate">
                        📋 Stage Dir.
                      </span>
                      {ttsProvider === "browser" ? (
                        <select
                          value={stageCfg.voiceIndex}
                          onChange={(e) =>
                            setVoiceAssignments((p) => ({
                              ...p,
                              "[Stage Direction]": {
                                ...stageCfg,
                                voiceIndex: parseInt(e.target.value),
                              },
                            }))
                          }
                          className={inputCls}
                        >
                          {availableVoices.length === 0 ? (
                            <option>Default</option>
                          ) : (
                            availableVoices.map((v, i) => (
                              <option key={i} value={i}>
                                {v.name}
                              </option>
                            ))
                          )}
                        </select>
                      ) : ttsProvider === "kokoro" ? (
                        <select
                          value={apiVoiceAssignments["[Stage Direction]"] || ""}
                          onChange={(e) =>
                            setApiVoiceAssignments((p) => ({
                              ...p,
                              "[Stage Direction]": e.target.value,
                            }))
                          }
                          className={inputCls}
                        >
                          <option value="">
                            Default ({getTTSSettings().kokoroVoice || "am_puck"})
                          </option>
                          {KOKORO_VOICES.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          value={apiVoiceAssignments["[Stage Direction]"] || ""}
                          onChange={(e) =>
                            setApiVoiceAssignments((p) => ({
                              ...p,
                              "[Stage Direction]": e.target.value,
                            }))
                          }
                          className={inputCls}
                        >
                          <option value="">
                            {apiVoices.length === 0
                              ? apiVoicesLoading
                                ? "Loading…"
                                : "Refresh voices"
                              : "Default"}
                          </option>
                          {apiVoices.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name ? `${v.name} (${v.id})` : v.id}
                            </option>
                          ))}
                        </select>
                      )}
                      <div />
                      <div />
                      <div />
                    </div>
                  );
                })()}

                {characters.length === 0 ? (
                  <p className="text-muted text-sm">
                    Load a scene to see character voices.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {characters.map((char) => {
                      const cfg = voiceAssignments[char] || {
                        voiceIndex: 0,
                        rate: 1,
                        pitch: 1,
                      };
                      return (
                        <div
                          key={char}
                          className="grid items-center gap-2 p-3 bg-dark-input border border-border rounded-lg"
                          style={{
                            gridTemplateColumns: "6rem 1fr auto auto auto",
                          }}
                        >
                          <span className="text-sm font-semibold text-light truncate">
                            {char}
                          </span>
                          {ttsProvider === "browser" ? (
                            <select
                              value={cfg.voiceIndex}
                              onChange={(e) =>
                                setVoiceAssignments((p) => ({
                                  ...p,
                                  [char]: {
                                    ...cfg,
                                    voiceIndex: parseInt(e.target.value),
                                  },
                                }))
                              }
                              className={inputCls}
                            >
                              {availableVoices.length === 0 ? (
                                <option>Default</option>
                              ) : (
                                availableVoices.map((v, i) => (
                                  <option key={i} value={i}>
                                    {v.name}
                                  </option>
                                ))
                              )}
                            </select>
                          ) : ttsProvider === "kokoro" ? (
                            <select
                              value={apiVoiceAssignments[char] || ""}
                              onChange={(e) =>
                                setApiVoiceAssignments((p) => ({
                                  ...p,
                                  [char]: e.target.value,
                                }))
                              }
                              className={inputCls}
                            >
                              <option value="">
                                Default (
                                {getTTSSettings().kokoroVoice || "am_puck"})
                              </option>
                              {KOKORO_VOICES.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <select
                              value={apiVoiceAssignments[char] || ""}
                              onChange={(e) =>
                                setApiVoiceAssignments((p) => ({
                                  ...p,
                                  [char]: e.target.value,
                                }))
                              }
                              className={inputCls}
                            >
                              <option value="">
                                {apiVoices.length === 0
                                  ? apiVoicesLoading
                                    ? "Loading…"
                                    : "Refresh voices"
                                  : "Default"}
                              </option>
                              {apiVoices.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.name ? `${v.name} (${v.id})` : v.id}
                                </option>
                              ))}
                            </select>
                          )}
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted">
                              {ttsProvider === "browser" ? "Rate" : "Spd"}
                            </span>
                            <input
                              type="number"
                              step="0.1"
                              min="0.5"
                              max="2"
                              value={cfg.rate}
                              onChange={(e) =>
                                setVoiceAssignments((p) => ({
                                  ...p,
                                  [char]: {
                                    ...cfg,
                                    rate: parseFloat(e.target.value) || 1,
                                  },
                                }))
                              }
                              className="w-14 bg-background border border-border rounded px-2 py-1 text-light text-xs focus:outline-none focus:border-accent-cyan"
                            />
                          </div>
                          {ttsProvider === "browser" ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted">Pitch</span>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="2"
                                value={cfg.pitch}
                                onChange={(e) =>
                                  setVoiceAssignments((p) => ({
                                    ...p,
                                    [char]: {
                                      ...cfg,
                                      pitch: parseFloat(e.target.value) || 1,
                                    },
                                  }))
                                }
                                className="w-14 bg-background border border-border rounded px-2 py-1 text-light text-xs focus:outline-none focus:border-accent-cyan"
                              />
                            </div>
                          ) : (
                            <div />
                          )}
                          <div className="flex gap-1">
                            <button
                              onClick={() => handlePreviewVoice(char)}
                              className={`px-2 py-1 rounded text-xs font-semibold border transition-colors ${previewingChar === char ? "border-red-400 text-red-400 bg-red-400/10" : "border-border text-muted hover:border-accent-cyan hover:text-light"}`}
                            >
                              {previewingChar === char ? "⏹" : "▶"}
                            </button>
                            <button
                              onClick={() => handleSaveVoiceToCast(char)}
                              title="Save to Cast"
                              className="px-2 py-1 rounded text-xs font-semibold border border-border text-muted hover:border-accent-cyan hover:text-light transition-colors"
                            >
                              💾
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
