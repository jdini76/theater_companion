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
import { parseDialogueLines } from "@/lib/rehearsal";
import { useScenes } from "@/contexts/SceneContext";
import { useProjects } from "@/contexts/ProjectContext";
import { Scene as StoredScene } from "@/types/scene";
import { DialogueLine } from "@/types/rehearsal";
import {
  getTTSSettings,
  fetchApiVoices,
  speakTextViaApi,
  stopApiAudio,
  ApiVoice,
  characterNamesMatch,
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

const CURRENT_PROJECT_KEY = "theater_current_project_id";

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

interface Scene {
  title: string;
  lines: DialogueLine[];
  characters?: string[];
  setPiece?: string;
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
function getCharacters(scene: {
  lines: DialogueLine[];
  characters?: string[];
}): string[] {
  // Prefer the curated list from SceneViewer/SceneHighlight (stored on the scene)
  // which uses extractSceneCharacters and any manual overrides applied in the
  // Scenes tab. Fall back to deriving from parsed dialogue lines only when absent.
  if (scene.characters && scene.characters.length > 0) {
    return scene.characters.map((c) => c.toUpperCase());
  }

  const chars = new Set<string>();
  for (const line of scene.lines) {
    if (
      line.character &&
      line.character !== "[Narrative]" &&
      line.character !== "[Stage Direction]" &&
      line.character !== "[Scene Heading]" &&
      !line.isNarratorCue
    ) {
      // Split combined speakers ("MOM + JOEY", "A & B") into individuals
      line.character
        .split(/\s*[,&+]\s*/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((name) => chars.add(name));
    }
  }
  return Array.from(chars);
}

export default function UnifiedRehearsalPage() {
  // Access saved scenes from the Scene Library (scenes page)
  const { getProjectScenes } = useScenes();
  const { getCurrentProject } = useProjects();

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

  // Script loading
  const [loadSource, setLoadSource] = useState<"paste" | "library">("paste");
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
  const [ttsProvider, setTtsProvider] = useState<"browser" | "api" | "kokoro">(
    "browser",
  );
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

  const buildKnownCharacters = useCallback(
    (sceneCharacters: string[] = []) => {
      const names = new Set<string>();

      if (currentProjectId) {
        for (const character of getProjectCharacters(currentProjectId)) {
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
    [currentProjectId, getProjectCharacters],
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

  const buildLibraryScenePage = useCallback(
    (scene: StoredScene): Scene | null => {
      const dialogueLines = parseDialogueLines(
        scene.content,
        productionType === "Film" ? "screenplay" : "mixed",
        buildKnownCharacters(scene.characters ?? []),
      );

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

      const mergedChars = Array.from(
        new Set([
          ...(scene.characters ?? []).map((c) => c.toUpperCase()),
          ...lineChars,
        ]),
      );

      return {
        title: scene.title,
        lines: dialogueLines,
        characters: mergedChars.length > 0 ? mergedChars : scene.characters,
        setPiece: scene.setPiece?.trim() || undefined,
      };
    },
    [buildKnownCharacters, productionType],
  );

  const buildSetPieceScenePage = useCallback(
    (label: string, scenesInSetPiece: StoredScene[]): Scene | null => {
      const flattenedLines: DialogueLine[] = [];
      const mergedChars = new Set<string>();

      for (const scene of scenesInSetPiece) {
        const dialogueLines = parseDialogueLines(
          scene.content,
          productionType === "Film" ? "screenplay" : "mixed",
          buildKnownCharacters(scene.characters ?? []),
        );

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

        for (const characterName of [
          ...(scene.characters ?? []),
          ...lineChars,
        ]) {
          const upper = characterName.trim().toUpperCase();
          if (upper) mergedChars.add(upper);
        }
      }

      if (flattenedLines.length === 0) return null;

      return {
        title: label,
        lines: flattenedLines,
        characters: Array.from(mergedChars),
        setPiece: label,
      };
    },
    [buildKnownCharacters, parseSceneHeading, productionType],
  );

  const normalizeScriptInput = useCallback(
    (text: string) => decodeHtmlEntities(text),
    [],
  );

  // Helper: apply a saved settings blob to component state
  const applySettings = useCallback((saved: Record<string, unknown> | null) => {
    // Reset to defaults first so stale state from another project is cleared
    window.speechSynthesis.cancel();
    setScriptInput("");
    setSceneMode("single");
    setScenes([]);
    setSelectedSceneIndex(0);
    setSelectedCharacter("");
    setVoiceAssignments({});
    setSpeakNames(false);
    setReadOwnLines(false);
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

    if (!saved) return;

    if (saved.scriptInput)
      setScriptInput(normalizeScriptInput(saved.scriptInput as string));
    if (saved.sceneMode) setSceneMode(saved.sceneMode as "single" | "multiple");
    if (saved.selectedCharacter)
      setSelectedCharacter(saved.selectedCharacter as string);
    if (saved.voiceAssignments)
      setVoiceAssignments(
        saved.voiceAssignments as Record<string, VoiceAssignment>,
      );
    if (typeof saved.speakNames === "boolean") setSpeakNames(saved.speakNames);
    if (typeof saved.readOwnLines === "boolean")
      setReadOwnLines(saved.readOwnLines);
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
      setTtsProvider(saved.ttsProvider as "browser" | "api" | "kokoro");
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
        .map((ps) => ({
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

  // Load browser voices
  useEffect(() => {
    const loadVoices = () => {
      setAvailableVoices(window.speechSynthesis.getVoices());
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Load saved settings exactly once on mount
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    applySettings(loadSavedForProject(currentProjectId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-expand Run Lines and collapse Scenes Selector when scenes load
  useEffect(() => {
    if (scenes.length > 0) {
      setRunLinesOpen(true);
      setScenesOpen(false);
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
    const chars = getCharacters(scene);
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

    setVoiceAssignments(updatedVoice);
    setApiVoiceAssignments(updatedApi);
  }, [
    scenes,
    selectedSceneIndex,
    voiceAssignments,
    apiVoiceAssignments,
    availableVoices,
    getVoiceConfigByCharacter,
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
    const processedScenes: Scene[] = parsedScenes.map((ps) => {
      const dialogueLines = parseDialogueLines(
        ps.content,
        productionType === "Film" ? "screenplay" : "mixed",
        buildKnownCharacters(),
      );
      return {
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

  // Load scenes from the library (scenes page)
  const handleLoadFromLibrary = () => {
    if (!currentProjectId) {
      return;
    }

    let processedScenes: Scene[] = [];

    if (libraryLoadMode === "set-pieces") {
      const selectedLabels =
        selectedLibrarySetPieces.size > 0
          ? librarySetPieceGroups
              .map((group) => group.label)
              .filter((label) => selectedLibrarySetPieces.has(label))
          : librarySetPieceGroups.map((group) => group.label);

      processedScenes = selectedLabels
        .map((label) => {
          const group = librarySetPieceGroups.find(
            (item) => item.label.toLowerCase() === label.toLowerCase(),
          );
          if (!group) return null;
          return buildSetPieceScenePage(group.label, group.scenes);
        })
        .filter((scene): scene is Scene => scene !== null);
    } else {
      const toLoad: StoredScene[] =
        selectedLibrarySceneIds.size > 0
          ? libraryScenes.filter((s) => selectedLibrarySceneIds.has(s.id))
          : libraryScenes;

      if (toLoad.length === 0) {
        return;
      }

      processedScenes = toLoad
        .map((scene) => buildLibraryScenePage(scene))
        .filter((scene): scene is Scene => scene !== null);
    }

    if (processedScenes.length === 0) {
      return;
    }

    setScenes(processedScenes);
    setSelectedSceneIndex(0);
    setCurrentSpeaker("READY");
    setCurrentDialogue(
      libraryLoadMode === "set-pieces"
        ? "Set pieces loaded from library."
        : "Scenes loaded from library.",
    );
    setCurrentPrompt("");
    setScenesOpen(false);
  };

  const toggleLibraryScene = (sceneId: string) => {
    setSelectedLibrarySceneIds((prev) => {
      const next = new Set(prev);
      if (next.has(sceneId)) {
        next.delete(sceneId);
      } else {
        next.add(sceneId);
      }
      return next;
    });
  };

  const toggleLibrarySetPiece = (label: string) => {
    setSelectedLibrarySetPieces((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
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
        } else if (ttsProvider === "api") {
          const apiVoiceId =
            apiVoiceAssignments[char] || ttsSettings.defaultVoiceId;
          await speakTextViaApi(text, { voice: apiVoiceId, speed: cfg.rate });
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
    const timer = setTimeout(() => {
      try {
        const toSave = {
          scriptInput,
          sceneMode,
          selectedSceneIndex,
          selectedCharacter,
          voiceAssignments,
          speakNames,
          readOwnLines,
          rehearsalMode,
          pauseMode,
          countdownSeconds,
          wordsPerMinute,
          narratorVoiceIndex,
          ttsProvider,
          apiVoiceAssignments,
        };
        localStorage.setItem(saveKeyForProject(pid), JSON.stringify(toSave));
      } catch {
        // Ignore storage errors
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [
    currentProjectId,
    scriptInput,
    sceneMode,
    selectedSceneIndex,
    selectedCharacter,
    voiceAssignments,
    speakNames,
    readOwnLines,
    rehearsalMode,
    pauseMode,
    countdownSeconds,
    wordsPerMinute,
    narratorVoiceIndex,
    ttsProvider,
    apiVoiceAssignments,
  ]);

  // Rehearsal playback logic
  const speakLine = useCallback(
    (line: DialogueLine, onDone: () => void) => {
      // For combined speakers like "MOM + JOEY", use the first individual's voice
      const isNarratorCue = line.isNarratorCue === true;
      const primarySpeaker = isNarratorCue
        ? "NARRATOR"
        : splitSpeaker(line.character)[0] || line.character;
      const cacheEnabled = getTTSSettings().enableAudioCache ?? false;
      if (isNarratorCue) {
        if (ttsProvider === "kokoro") {
          const ttsSettings = getTTSSettings();
          speakTextViaKokoro(line.dialogue, {
            voice: ttsSettings.kokoroVoice || "am_puck",
            speed: 1,
            characterName: primarySpeaker,
            cacheAudio: cacheEnabled,
            voiceSignature: `kokoro:${ttsSettings.kokoroVoice || "am_puck"}`,
          })
            .then(onDone)
            .catch(() => onDone());
          return;
        }

        if (ttsProvider === "api") {
          const ttsSettings = getTTSSettings();
          speakTextViaApi(line.dialogue, {
            voice: ttsSettings.defaultVoiceId || "",
            speed: 1,
            characterName: primarySpeaker,
            cacheAudio: cacheEnabled,
          })
            .then(onDone)
            .catch(() => onDone());
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

      if (isNarratorCue) {
        if (ttsProvider === "kokoro") {
          const ttsSettings = getTTSSettings();
          speakTextViaKokoro(line.dialogue, {
            voice: ttsSettings.kokoroVoice || "am_puck",
            speed: 1,
            characterName: primarySpeaker,
            cacheAudio: cacheEnabled,
            voiceSignature: `kokoro:${ttsSettings.kokoroVoice || "am_puck"}`,
          })
            .then(onDone)
            .catch(() => onDone());
          return;
        }

        if (ttsProvider === "api") {
          const ttsSettings = getTTSSettings();
          speakTextViaApi(line.dialogue, {
            voice: ttsSettings.defaultVoiceId || "",
            speed: 1,
            characterName: primarySpeaker,
            cacheAudio: cacheEnabled,
          })
            .then(onDone)
            .catch(() => onDone());
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
      if (ttsProvider === "api") {
        const voiceId = apiVoiceAssignments[primarySpeaker] || "";
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
              .catch(() => onDone());
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

    // Combined line is "mine" if any speaker matches selectedCharacter
    const isMine = splitSpeaker(line.character).some((name) =>
      characterNamesMatch(name, selectedCharacter),
    );

    if (isMine && !readOwnLines) {
      setCurrentSpeaker(line.character);
      setCurrentDialogue(line.dialogue);
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
        (l, i) => i > rehearsal.index && l.character === selectedCharacter,
      );
      if (nextUserIdx !== -1 && rehearsal.index < nextUserIdx - 1) {
        setRehearsal((prev) => ({ ...prev, index: prev.index + 1 }));
        return;
      }
    }

    setCurrentSpeaker(line.character);
    setCurrentDialogue(line.dialogue);
    setCurrentPrompt(isMine ? "Read-through mode" : "Listening...");

    // Pre-generate the next non-user Kokoro line in the background (if enabled)
    if (ttsProvider === "kokoro") {
      const ttsSettings = getTTSSettings();
      if (ttsSettings.kokoroPreGenEnabled !== false) {
        for (let i = rehearsal.index + 1; i < rehearsal.lines.length; i++) {
          const upcoming = rehearsal.lines[i];
          const upcomingIsMine = splitSpeaker(upcoming.character).some((n) =>
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
    setRehearsal({
      lines: scene.lines,
      index: 0,
      isPlaying: true,
      isPaused: false,
    });
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

    setRehearsal((prev) => ({ ...prev, isPaused: false }));
  };

  // Reset rehearsal back to beginning
  const handleReset = () => {
    window.speechSynthesis.cancel();
    stopApiAudio();
    stopKokoroAudio();
    if (countdownInterval) clearInterval(countdownInterval);
    if (nextLineTimeout) clearTimeout(nextLineTimeout);
    setRehearsal({ lines: [], index: 0, isPlaying: false, isPaused: false });
    setCurrentSpeaker("");
    setCurrentDialogue("Load a scene, pick your role, and press Start.");
    setCurrentPrompt("");
  };

  const [optionsOpen, setOptionsOpen] = useState(false);
  const [voicesOpen, setVoicesOpen] = useState(false);

  const currentScene = scenes[selectedSceneIndex];
  const characters = currentScene ? getCharacters(currentScene) : [];
  const isActive = rehearsal.isPlaying || rehearsal.isPaused;
  const isMyTurn = rehearsal.isPaused && currentPrompt.startsWith("Your turn");

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
          <h2 className="text-lg font-bold text-light">Run Lines</h2>
          <span className="text-muted text-xs">
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
                        <input
                          type="text"
                          value={libraryFilter}
                          onChange={(e) => setLibraryFilter(e.target.value)}
                          placeholder="Filter scenes…"
                          className={inputCls}
                        />
                        {(() => {
                          const query = libraryFilter.trim().toLowerCase();
                          const filtered = query
                            ? libraryScenes.filter((ls) => {
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
                            : libraryScenes;
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
                                  onChange={() =>
                                    setSelectedLibrarySceneIds((prev) => {
                                      const next = new Set(prev);
                                      if (allSelected)
                                        filtered.forEach((ls) =>
                                          next.delete(ls.id),
                                        );
                                      else
                                        filtered.forEach((ls) =>
                                          next.add(ls.id),
                                        );
                                      return next;
                                    })
                                  }
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
                        <button
                          onClick={handleLoadFromLibrary}
                          className={btnPrimary}
                        >
                          {selectedLibrarySceneIds.size > 0
                            ? `Load ${selectedLibrarySceneIds.size} scene${selectedLibrarySceneIds.size !== 1 ? "s" : ""}`
                            : `Load all ${libraryScenes.length}`}
                        </button>
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
                                  onChange={() =>
                                    setSelectedLibrarySetPieces((prev) => {
                                      const next = new Set(prev);
                                      if (allSelected)
                                        filtered.forEach((group) =>
                                          next.delete(group.label),
                                        );
                                      else
                                        filtered.forEach((group) =>
                                          next.add(group.label),
                                        );
                                      return next;
                                    })
                                  }
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
                        <button
                          onClick={handleLoadFromLibrary}
                          className={btnPrimary}
                        >
                          {selectedLibrarySetPieces.size > 0
                            ? `Load ${selectedLibrarySetPieces.size} set piece${selectedLibrarySetPieces.size !== 1 ? "s" : ""}`
                            : `Load all ${librarySetPieceGroups.length} set pieces`}
                        </button>
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
                        type="number"
                        min={1}
                        max={20}
                        value={countdownSeconds}
                        onChange={(e) =>
                          setCountdownSeconds(
                            Math.max(1, parseInt(e.target.value) || 1),
                          )
                        }
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
                          | "kokoro";
                        if (provider === "api") {
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
                      <option value="kokoro">Kokoro AI</option>
                      <option value="api">External API</option>
                    </select>
                  </div>
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
                  <div className="flex items-center gap-3 p-3 bg-dark-input border border-border rounded-lg">
                    <span className="text-sm font-semibold text-light w-20 flex-shrink-0">
                      🎙 Narrator
                    </span>
                    <select
                      value={narratorVoiceIndex}
                      onChange={(e) =>
                        setNarratorVoiceIndex(parseInt(e.target.value))
                      }
                      className={`${inputCls} flex-1`}
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
                  </div>
                )}

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
