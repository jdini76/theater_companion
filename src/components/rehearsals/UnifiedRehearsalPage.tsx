"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { extractSceneCharacters } from "@/lib/scenes";
import { useScenes } from "@/contexts/SceneContext";
import { Scene as StoredScene } from "@/types/scene";
import {
  getTTSSettings,
  fetchApiVoices,
  speakTextViaApi,
  stopApiAudio,
  ApiVoice,
  characterNamesMatch,
} from "@/lib/voice";

import styles from "./UnifiedRehearsalPage.styles.ts";

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
  lines: Array<{ speaker: string; text: string }>;
  characters?: string[];
}

interface VoiceAssignment {
  voiceIndex: number;
  rate: number;
  pitch: number;
}

interface RehearsalState {
  lines: Array<{ speaker: string; text: string }>;
  index: number;
  isPlaying: boolean;
  isPaused: boolean;
}

export default function UnifiedRehearsalPage() {
  // --- STUBS FOR MISSING HANDLERS/UTILITIES ---
  function handleParseScript() {
    /* TODO: implement */
  }
  function handleLoadSample() {
    /* TODO: implement */
  }
  function handleLoadFromLibrary() {
    /* TODO: implement */
  }
  function toggleLibraryScene(id?: string) {
    /* TODO: implement */
  }
  function handlePreviewVoice(char?: string) {
    /* TODO: implement */
  }
  function handleSaveVoiceToCast(char?: string) {
    /* TODO: implement */
  }
  function getCharacters(scene: { characters?: string[] }) {
    return scene.characters || [];
  }
  function ensureVoiceAssignments() {
    /* TODO: implement */
  }
  // Access saved scenes from the Scene Library (scenes page)
  const { getProjectScenes } = useScenes();

  // Access cast voice configs
  // const { getVoiceConfigByCharacter, updateVoiceConfig: updateCastVoiceConfig, getProjectCharacters, createVoiceConfig: createCastVoiceConfig, updateCharacter: updateCastCharacter, getVoiceConfig: getCastVoiceConfig } = useVoice();

  // Active project ID (mirrors theater_current_project_id in localStorage)
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() =>
    parseStoredProjectId(),
  );

  // Track whether initial load from storage has happened
  const loadedRef = useRef(false);

  // Script loading
  const [loadSource, setLoadSource] = useState<"paste" | "library">("paste");
  const [scriptInput, setScriptInput] = useState<string>("");
  const [sceneMode, setSceneMode] = useState<"single" | "multiple">("single");
  const [selectedLibrarySceneIds, setSelectedLibrarySceneIds] = useState<
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

  // Step state: 'role' (confirm cast) or 'scene' (scene selection)
  const [step, setStep] = useState<"role" | "scene">("scene");

  // Rehearsal mode
  const [rehearsalMode, setRehearsalMode] = useState<"full" | "cue-only">(
    "full",
  );

  // TTS provider: browser speech synthesis vs external API
  const [ttsProvider, setTtsProvider] = useState<"browser" | "api">("browser");
  const [apiVoices, setApiVoices] = useState<ApiVoice[]>([]);
  const [apiVoicesLoading, setApiVoicesLoading] = useState(false);
  const [apiVoicesError, setApiVoicesError] = useState<string | null>(null);
  const [apiVoiceAssignments, setApiVoiceAssignments] = useState<
    Record<string, string>
  >({});
  const [previewingChar, setPreviewingChar] = useState<string | null>(null);

  // Rehearsal options
  const [speakNames, setSpeakNames] = useState<boolean>(false);
  const [readOwnLines, setReadOwnLines] = useState<boolean>(false);
  const [pauseMode, setPauseMode] = useState<"manual" | "countdown" | "wpm">(
    "manual",
  );
  const [countdownSeconds, setCountdownSeconds] = useState<number>(4);
  const [wordsPerMinute, setWordsPerMinute] = useState<number>(120);
  const [narratorVoiceIndex, setNarratorVoiceIndex] = useState<number>(0);

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
  const [rehearsalStatus, setRehearsalStatus] = useState<string>(
    "Ready when you are.",
  );

  // Timers
  const [countdownInterval, setCountdownInterval] =
    useState<NodeJS.Timeout | null>(null);
  const [nextLineTimeout, setNextLineTimeout] = useState<NodeJS.Timeout | null>(
    null,
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
    setWordsPerMinute(120);
    setNarratorVoiceIndex(0);
    setTtsProvider("browser");
    setApiVoiceAssignments({});
    setCurrentSpeaker("");
    setCurrentDialogue("Load a scene, pick your role, and press Start.");
    setCurrentPrompt("");
  }, []);
  // Removed duplicate unreachable JSX block after main return
  // Removed unreachable and broken code after return

  // Clear everything for current project
  const handleClear = () => {
    window.speechSynthesis.cancel();
    localStorage.removeItem(saveKeyForProject(currentProjectId));
    setSelectedLibrarySceneIds(new Set());
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
    (line: { speaker: string; text: string }, onDone: () => void) => {
      // For combined speakers like "MOM + JOEY", use the first individual's voice
      const primarySpeaker = splitSpeaker(line.speaker)[0] || line.speaker;

      // ── API TTS path ──────────────────────────────────────────────────
      if (ttsProvider === "api") {
        const voiceId = apiVoiceAssignments[primarySpeaker] || "";
        const cfg = voiceAssignments[primarySpeaker] || {
          rate: 1,
          pitch: 1,
          voiceIndex: 0,
        };

        console.log("[TTS API]", {
          speaker: line.speaker,
          primarySpeaker,
          voiceId,
          allAssignments: { ...apiVoiceAssignments },
        });

        const speakViaApi = (text: string, voice: string, speed: number) => {
          speakTextViaApi(text, { voice, speed })
            .then(onDone)
            .catch(() => onDone());
        };

        if (speakNames) {
          // Narrator reads the character name via browser TTS, then API speaks the line
          const nameUtter = new SpeechSynthesisUtterance();
          nameUtter.text = `${line.speaker}.`;
          nameUtter.rate = 1;
          nameUtter.pitch = 1;
          if (availableVoices.length && availableVoices[narratorVoiceIndex]) {
            nameUtter.voice = availableVoices[narratorVoiceIndex];
          }
          nameUtter.onend = () =>
            speakViaApi(line.text, voiceId, cfg.rate || 1);
          nameUtter.onerror = () =>
            speakViaApi(line.text, voiceId, cfg.rate || 1);
          window.speechSynthesis.speak(nameUtter);
        } else {
          speakViaApi(line.text, voiceId, cfg.rate || 1);
        }
        return;
      }

      // ── Browser TTS path ──────────────────────────────────────────────
      const cfg = voiceAssignments[primarySpeaker] || {
        rate: 1,
        pitch: 1,
        voiceIndex: 0,
      };

      // If speakNames is enabled, speak character name with narrator voice first
      if (speakNames) {
        const nameUtter = new SpeechSynthesisUtterance();
        nameUtter.text = `${line.speaker}.`;
        nameUtter.rate = 1;
        nameUtter.pitch = 1;

        if (availableVoices.length && availableVoices[narratorVoiceIndex]) {
          nameUtter.voice = availableVoices[narratorVoiceIndex];
        }

        nameUtter.onend = () => {
          // After narrator says character name, speak the dialogue
          const dialogueUtter = new SpeechSynthesisUtterance();
          dialogueUtter.text = line.text;
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
        utter.text = line.text;
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
      setRehearsalStatus("Scene complete!");
      setCurrentSpeaker("DONE");
      setCurrentDialogue("End of scene. Nice work.");
      setCurrentPrompt("");
      setRehearsal((prev) => ({ ...prev, isPlaying: false }));
      return;
    }

    const line = rehearsal.lines[rehearsal.index];
    // Combined line is "mine" if any speaker matches selectedCharacter
    const isMine = splitSpeaker(line.speaker).some((name) =>
      characterNamesMatch(name, selectedCharacter),
    );

    if (isMine && !readOwnLines) {
      setCurrentSpeaker(line.speaker);
      setCurrentDialogue(line.text);
      setCurrentPrompt("Your turn.");
      setRehearsalStatus("Waiting on your line.");

      if (pauseMode === "countdown" || pauseMode === "wpm") {
        let sec: number;
        if (pauseMode === "wpm") {
          const wordCount = line.text
            .trim()
            .split(/\s+/)
            .filter(Boolean).length;
          sec = Math.max(
            2,
            Math.ceil((wordCount / Math.max(1, wordsPerMinute)) * 60),
          );
        } else {
          sec = Math.max(1, countdownSeconds);
        }
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
      } else {
        setRehearsal((prev) => ({ ...prev, isPaused: true }));
      }

      return;
    }

    // Cue Only mode: silently advance past lines that are not the immediate
    // cue (the line directly before the next user line).
    if (rehearsalMode === "cue-only") {
      const nextUserIdx = rehearsal.lines.findIndex(
        (l, i) => i > rehearsal.index && l.speaker === selectedCharacter,
      );
      if (nextUserIdx !== -1 && rehearsal.index < nextUserIdx - 1) {
        setRehearsal((prev) => ({ ...prev, index: prev.index + 1 }));
        return;
      }
    }

    setCurrentSpeaker(line.speaker);
    setCurrentDialogue(line.text);
    setCurrentPrompt(isMine ? "Read-through mode" : "Listening...");
    setRehearsalStatus(`Speaking: ${line.speaker}`);

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
      setRehearsalStatus("Please load a script first.");
      return;
    }

    if (!selectedCharacter) {
      setRehearsalStatus("Please select a character.");
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
    setRehearsalStatus(`Rehearsing: ${scene.title}`);
  };

  // Pause rehearsal
  const handlePause = () => {
    if (!rehearsal.isPlaying) return;
    window.speechSynthesis.pause();
    stopApiAudio();
    setRehearsal((prev) => ({ ...prev, isPaused: true }));
    setRehearsalStatus("Paused.");

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
    setRehearsalStatus("Resumed.");
  };

  // Reset rehearsal back to beginning
  const handleReset = () => {
    window.speechSynthesis.cancel();
    stopApiAudio();
    if (countdownInterval) clearInterval(countdownInterval);
    if (nextLineTimeout) clearTimeout(nextLineTimeout);
    setRehearsal({ lines: [], index: 0, isPlaying: false, isPaused: false });
    setCurrentSpeaker("");
    setCurrentDialogue("Load a scene, pick your role, and press Start.");
    setCurrentPrompt("");
    setRehearsalStatus("Ready when you are.");
  };

  const currentScene = scenes[selectedSceneIndex];
  // Use extractSceneCharacters to get character list from scene content
  const characters =
    currentScene && currentScene.lines && currentScene.title
      ? extractSceneCharacters(
          // Try to find a content property, else reconstruct from lines
          (currentScene as any).content ||
            currentScene.lines.map((l) => `${l.speaker}: ${l.text}`).join("\n"),
        )
      : [];

  // Utility to split combined speaker names (e.g., "MOM + JOEY")
  function splitSpeaker(speaker: string): string[] {
    return speaker
      .split(/\s*[+&]\\s*|,| and /i)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return (
    <div style={styles.container}>
      <div style={styles.wrap}>
        {/* Header */}
        <section style={styles.hero}>
          <h1 style={styles.h1}>🎬 Scene Rehearsal</h1>
          <p style={styles.heroText}>
            One-page rehearsal experience. Load scenes, pick your role, assign
            voices, and rehearse without a live scene partner.
          </p>
        </section>

        <div style={styles.grid}>
          {/* Load Scenes */}
          <section style={{ ...styles.card, gridColumn: "span 12" }}>
            <h2 style={styles.h2}>Load Scenes</h2>

            {/* Source tabs */}
            <div style={{ ...styles.rowTight, marginBottom: "16px" }}>
              <button
                onClick={() => setLoadSource("paste")}
                style={{
                  ...styles.sourceTab,
                  ...(loadSource === "paste" ? styles.sourceTabActive : {}),
                }}
              >
                Paste Script
              </button>
              <button
                onClick={() => setLoadSource("library")}
                style={{
                  ...styles.sourceTab,
                  ...(loadSource === "library" ? styles.sourceTabActive : {}),
                }}
              >
                From Scene Library
              </button>
            </div>

            {loadSource === "paste" && (
              <>
                <div style={styles.rowTight}>
                  <label style={styles.pill}>
                    <input
                      type="radio"
                      name="sceneMode"
                      value="single"
                      checked={sceneMode === "single"}
                      onChange={(e) =>
                        setSceneMode(e.target.value as "single" | "multiple")
                      }
                    />{" "}
                    Single scene
                  </label>
                  <label style={styles.pill}>
                    <input
                      type="radio"
                      name="sceneMode"
                      value="multiple"
                      checked={sceneMode === "multiple"}
                      onChange={(e) =>
                        setSceneMode(e.target.value as "single" | "multiple")
                      }
                    />{" "}
                    Multiple scenes
                  </label>
                </div>
                <label style={styles.label}>Paste script text</label>
                <textarea
                  value={scriptInput}
                  onChange={(e) => setScriptInput(e.target.value)}
                  placeholder="SCENE 1: AUDITION ROOM MOM: You know the lines. JOEY: I know them until I have to say them out loud..."
                  style={styles.textarea}
                />
                <div style={styles.row}>
                  <button
                    onClick={handleParseScript}
                    style={styles.buttonPrimary}
                  >
                    Load script
                  </button>
                  <button
                    onClick={handleLoadSample}
                    style={styles.buttonSecondary}
                  >
                    Load sample
                  </button>
                  <button onClick={handleClear} style={styles.buttonSecondary}>
                    Clear
                  </button>
                </div>
              </>
            )}

            {loadSource === "library" && (
              <>
                {(() => {
                  const libraryScenes: StoredScene[] = currentProjectId
                    ? getProjectScenes(currentProjectId)
                    : [];
                  if (libraryScenes.length === 0) {
                    return (
                      <div style={styles.status}>
                        No scenes found for this project. Import scenes on the
                        Scenes page first.
                      </div>
                    );
                  }
                  return (
                    <>
                      <div
                        style={{
                          fontSize: "14px",
                          color: "#9fb0d0",
                          marginBottom: "12px",
                        }}
                      >
                        Select scenes to rehearse, or load all.
                      </div>
                      <input
                        type="text"
                        value={libraryFilter}
                        onChange={(e) => setLibraryFilter(e.target.value)}
                        placeholder="Filter by title, character, or keyword..."
                        style={{ ...styles.input, marginBottom: "12px" }}
                      />
                      <div style={styles.sceneList}>
                        {(() => {
                          const query = libraryFilter.trim().toLowerCase();
                          const filtered = query
                            ? libraryScenes.filter((ls) => {
                                const chars =
                                  ls.characters ??
                                  extractSceneCharacters(ls.content);
                                return (
                                  ls.title.toLowerCase().includes(query) ||
                                  ls.content.toLowerCase().includes(query) ||
                                  chars.some((c) =>
                                    c.toLowerCase().includes(query),
                                  )
                                );
                              })
                            : libraryScenes;
                          if (filtered.length === 0) {
                            return (
                              <div
                                style={{ ...styles.status, padding: "12px" }}
                              >
                                No scenes match &ldquo;{libraryFilter.trim()}
                                &rdquo;
                              </div>
                            );
                          }
                          const allFilteredSelected = filtered.every((ls) =>
                            selectedLibrarySceneIds.has(ls.id),
                          );
                          const someFilteredSelected = filtered.some((ls) =>
                            selectedLibrarySceneIds.has(ls.id),
                          );
                          const handleToggleAll = () => {
                            setSelectedLibrarySceneIds((prev) => {
                              const next = new Set(prev);
                              if (allFilteredSelected) {
                                filtered.forEach((ls) => next.delete(ls.id));
                              } else {
                                filtered.forEach((ls) => next.add(ls.id));
                              }
                              return next;
                            });
                          };
                          return (
                            <>
                              <div
                                onClick={handleToggleAll}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  padding: "8px 12px",
                                  borderBottom: "1px solid #334155",
                                  cursor: "pointer",
                                  fontSize: "14px",
                                  color: "#9fb0d0",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={allFilteredSelected}
                                  ref={(el) => {
                                    if (el)
                                      el.indeterminate =
                                        someFilteredSelected &&
                                        !allFilteredSelected;
                                  }}
                                  onChange={handleToggleAll}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ accentColor: "#7dd3fc" }}
                                />
                                <span>
                                  Select All
                                  {query
                                    ? ` (${filtered.length} matching)`
                                    : ""}
                                </span>
                              </div>
                              {filtered.map((ls) => {
                                const isSelected = selectedLibrarySceneIds.has(
                                  ls.id,
                                );
                                return (
                                  <div
                                    key={ls.id}
                                    onClick={() => toggleLibraryScene(ls.id)}
                                    style={{
                                      ...styles.sceneItem,
                                      ...(isSelected
                                        ? styles.sceneItemActive
                                        : {}),
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() =>
                                          toggleLibraryScene(ls.id)
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ accentColor: "#7dd3fc" }}
                                      />
                                      <strong>{ls.title}</strong>
                                    </div>
                                    <div style={styles.small}>
                                      {ls.content.split("\n").length} lines •{" "}
                                      {Math.ceil(ls.content.length / 5)} words
                                    </div>
                                    {(() => {
                                      const chars =
                                        ls.characters ??
                                        extractSceneCharacters(ls.content);
                                      return chars.length > 0 ? (
                                        <div
                                          style={{
                                            fontSize: "12px",
                                            marginTop: "2px",
                                          }}
                                        >
                                          <span style={{ color: "#9fb0d0" }}>
                                            Characters:{" "}
                                          </span>
                                          <span style={{ color: "#7dd3fc" }}>
                                            {chars.join(", ")}
                                          </span>
                                        </div>
                                      ) : null;
                                    })()}
                                    <div
                                      style={{
                                        ...styles.small,
                                        marginTop: "4px",
                                      }}
                                    >
                                      {ls.content
                                        .substring(0, 120)
                                        .replace(/\n/g, " ")}
                                      {ls.content.length > 120 ? "..." : ""}
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          );
                        })()}
                      </div>
                      <div style={{ ...styles.row, marginTop: "12px" }}>
                        <button
                          onClick={handleLoadFromLibrary}
                          style={styles.buttonPrimary}
                        >
                          {selectedLibrarySceneIds.size > 0
                            ? `Load ${selectedLibrarySceneIds.size} selected scene${selectedLibrarySceneIds.size === 1 ? "" : "s"}`
                            : `Load all ${libraryScenes.length} scene${libraryScenes.length === 1 ? "" : "s"}`}
                        </button>
                        <button
                          onClick={handleClear}
                          style={styles.buttonSecondary}
                        >
                          Clear
                        </button>
                      </div>
                    </>
                  );
                })()}
              </>
            )}
          </section>

          {/* Scene Library */}
          <section style={{ ...styles.card, gridColumn: "span 4" }}>
            <h2 style={styles.h2}>Scene Library</h2>
            <div style={styles.status}>
              {scenes.length === 0
                ? "No scenes loaded yet."
                : `${scenes.length} scene${scenes.length === 1 ? "" : "s"} loaded.`}
            </div>
            <div style={styles.sceneList}>
              {scenes.map((scene, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedSceneIndex(i)}
                  style={{
                    ...styles.sceneItem,
                    ...(i === selectedSceneIndex ? styles.sceneItemActive : {}),
                  }}
                >
                  <strong>{scene.title}</strong>
                  <div style={styles.small}>
                    {scene.lines.length} lines • {getCharacters(scene).length}{" "}
                    characters
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Role Setup */}
          <section style={{ ...styles.card, gridColumn: "span 4" }}>
            <h2 style={styles.h2}>Role Setup</h2>
            <div style={styles.fieldGroup}>
              <label htmlFor="roleSelect" style={styles.label}>
                My character
              </label>
              <select
                id="roleSelect"
                value={selectedCharacter}
                onChange={(e) => setSelectedCharacter(e.target.value)}
                style={styles.input}
              >
                <option value="">Choose a character...</option>
                {characters.map((char) => (
                  <option key={char} value={char}>
                    {char}
                  </option>
                ))}
              </select>
            </div>
            <div style={styles.checkboxGroup}>
              <label style={styles.pill}>
                <input
                  type="checkbox"
                  checked={speakNames}
                  onChange={(e) => setSpeakNames(e.target.checked)}
                />{" "}
                Speak character names
              </label>
              <label style={styles.pill}>
                <input
                  type="checkbox"
                  checked={readOwnLines}
                  onChange={(e) => setReadOwnLines(e.target.checked)}
                />{" "}
                Read my lines too
              </label>
            </div>
            <div style={styles.fieldGroup}>
              <label htmlFor="pauseMode" style={styles.label}>
                On my line
              </label>
              <select
                id="pauseMode"
                value={pauseMode}
                onChange={(e) =>
                  setPauseMode(e.target.value as "manual" | "countdown" | "wpm")
                }
                style={styles.input}
              >
                <option value="manual">Wait for manual continue</option>
                <option value="countdown">Countdown then continue</option>
                <option value="wpm">Auto-time by words per minute</option>
              </select>
            </div>
            <div style={styles.fieldGroup}>
              <label htmlFor="rehearsalMode" style={styles.label}>
                Rehearsal mode
              </label>
              <select
                id="rehearsalMode"
                value={rehearsalMode}
                onChange={(e) =>
                  setRehearsalMode(e.target.value as "full" | "cue-only")
                }
                style={styles.input}
              >
                <option value="full">Full Scene</option>
                <option value="cue-only">Cue Only</option>
              </select>
              {rehearsalMode === "cue-only" && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#9fb0d0",
                    marginTop: "4px",
                  }}
                >
                  Only the line immediately before your next line is spoken.
                </div>
              )}
            </div>

            {pauseMode === "countdown" && (
              <div style={styles.fieldGroup}>
                <label htmlFor="countdownSeconds" style={styles.label}>
                  Countdown seconds
                </label>
                <input
                  id="countdownSeconds"
                  type="number"
                  min="1"
                  max="60"
                  value={countdownSeconds}
                  onChange={(e) =>
                    setCountdownSeconds(
                      Math.max(1, parseInt(e.target.value) || 1),
                    )
                  }
                  style={styles.input}
                />
              </div>
            )}
            {pauseMode === "wpm" && (
              <div style={styles.fieldGroup}>
                <label htmlFor="wordsPerMinute" style={styles.label}>
                  Words per minute
                </label>
                <input
                  id="wordsPerMinute"
                  type="number"
                  min="60"
                  max="300"
                  value={wordsPerMinute}
                  onChange={(e) =>
                    setWordsPerMinute(
                      Math.min(
                        300,
                        Math.max(60, parseInt(e.target.value) || 120),
                      ),
                    )
                  }
                  style={styles.input}
                />
                <div
                  style={{
                    fontSize: "12px",
                    color: "#9fb0d0",
                    marginTop: "4px",
                  }}
                >
                  Wait time adjusts per line based on word count. Average
                  speaking pace is ~130 wpm.
                </div>
              </div>
            )}
          </section>

          {/* Voice Configuration */}
          <section style={{ ...styles.card, gridColumn: "span 8" }}>
            <h2 style={styles.h2}>Character Voices</h2>

            {/* TTS Provider Toggle */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <button
                onClick={() => setTtsProvider("browser")}
                style={{
                  ...styles.buttonSecondary,
                  ...(ttsProvider === "browser"
                    ? {
                        borderColor: "#00d4ff",
                        color: "#00d4ff",
                        backgroundColor: "rgba(0,212,255,0.1)",
                      }
                    : {}),
                }}
              >
                Browser TTS
              </button>
              <button
                onClick={() => {
                  const ttsSettings = getTTSSettings();
                  if (!ttsSettings.apiUrl) {
                    alert("Configure your TTS API in Settings first.");
                    return;
                  }
                  setTtsProvider("api");
                  if (apiVoices.length === 0) {
                    setApiVoicesLoading(true);
                    setApiVoicesError(null);
                    fetchApiVoices(ttsSettings)
                      .then((voices) => {
                        setApiVoices(voices);
                        if (voices.length === 0)
                          setApiVoicesError("No voices returned.");
                      })
                      .catch((err) =>
                        setApiVoicesError(
                          err instanceof Error ? err.message : "Failed",
                        ),
                      )
                      .finally(() => setApiVoicesLoading(false));
                  }
                }}
                style={{
                  ...styles.buttonSecondary,
                  ...(ttsProvider === "api"
                    ? {
                        borderColor: "#00d4ff",
                        color: "#00d4ff",
                        backgroundColor: "rgba(0,212,255,0.1)",
                      }
                    : {}),
                }}
              >
                API TTS
              </button>
              {ttsProvider === "api" && (
                <button
                  onClick={() => {
                    setApiVoicesLoading(true);
                    setApiVoicesError(null);
                    fetchApiVoices(getTTSSettings())
                      .then((voices) => {
                        setApiVoices(voices);
                        if (voices.length === 0)
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
                  style={styles.buttonSecondary}
                >
                  {apiVoicesLoading ? "Loading..." : "↻ Refresh Voices"}
                </button>
              )}
            </div>
            {apiVoicesError && ttsProvider === "api" && (
              <div
                style={{
                  color: "#ff6b6b",
                  fontSize: "12px",
                  marginBottom: "8px",
                }}
              >
                {apiVoicesError}
              </div>
            )}

            {/* Narrator Voice (only shown when "Speak character names" is checked) */}
            {speakNames && (
              <div
                style={{
                  ...styles.voiceRow,
                  marginBottom: "12px",
                  backgroundColor: "#1a2438",
                }}
              >
                <div>
                  <strong>🎙️ Narrator</strong>
                </div>
                <select
                  value={narratorVoiceIndex}
                  onChange={(e) => {
                    setNarratorVoiceIndex(parseInt(e.target.value));
                  }}
                  style={styles.input}
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
                <div
                  style={{
                    gridColumn: "span 2",
                    fontSize: "12px",
                    color: "#9fb0d0",
                  }}
                >
                  Reads character names (always uses browser voice)
                </div>
              </div>
            )}

            <div style={styles.voiceTable}>
              {characters.map((char) => {
                const cfg = voiceAssignments[char] || {
                  voiceIndex: 0,
                  rate: 1,
                  pitch: 1,
                };

                if (ttsProvider === "api") {
                  // API TTS: voice dropdown + speed control
                  const apiVoiceId = apiVoiceAssignments[char] || "";
                  return (
                    <div key={char} style={styles.voiceRow}>
                      <div>
                        <strong>{char}</strong>
                      </div>
                      <select
                        value={apiVoiceId}
                        onChange={(e) => {
                          setApiVoiceAssignments((prev) => ({
                            ...prev,
                            [char]: e.target.value,
                          }));
                        }}
                        style={styles.input}
                      >
                        <option value="">
                          {apiVoices.length === 0
                            ? apiVoicesLoading
                              ? "Loading voices..."
                              : "Click Refresh Voices"
                            : "Default voice"}
                        </option>
                        {apiVoices.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name ? `${v.name} (${v.id})` : v.id}
                          </option>
                        ))}
                      </select>
                      <div style={styles.fieldGroup}>
                        <label style={styles.miniLabel}>Speed</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.5"
                          max="2"
                          value={cfg.rate}
                          onChange={(e) => {
                            setVoiceAssignments((prev) => ({
                              ...prev,
                              [char]: {
                                ...cfg,
                                rate: parseFloat(e.target.value) || 1,
                              },
                            }));
                          }}
                          style={styles.input}
                        />
                      </div>
                      <button
                        onClick={() => handlePreviewVoice(char)}
                        style={{
                          ...styles.buttonSecondary,
                          padding: "4px 10px",
                          fontSize: "13px",
                          minWidth: "auto",
                          ...(previewingChar === char
                            ? { borderColor: "#ff6b6b", color: "#ff6b6b" }
                            : {}),
                        }}
                      >
                        {previewingChar === char ? "⏹ Stop" : "▶ Preview"}
                      </button>
                      <button
                        onClick={() => handleSaveVoiceToCast(char)}
                        style={{
                          ...styles.buttonSecondary,
                          padding: "4px 10px",
                          fontSize: "13px",
                          minWidth: "auto",
                        }}
                        title="Save voice settings to cast page"
                      >
                        💾 Save
                      </button>
                    </div>
                  );
                }

                // Browser TTS: voice dropdown + rate/pitch
                return (
                  <div key={char} style={styles.voiceRow}>
                    <div>
                      <strong>{char}</strong>
                    </div>
                    <select
                      value={cfg.voiceIndex}
                      onChange={(e) => {
                        setVoiceAssignments((prev) => ({
                          ...prev,
                          [char]: {
                            ...cfg,
                            voiceIndex: parseInt(e.target.value),
                          },
                        }));
                      }}
                      style={styles.input}
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
                    <div style={styles.fieldGroup}>
                      <label style={styles.miniLabel}>Rate</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="2"
                        value={cfg.rate}
                        onChange={(e) => {
                          setVoiceAssignments((prev) => ({
                            ...prev,
                            [char]: {
                              ...cfg,
                              rate: parseFloat(e.target.value) || 1,
                            },
                          }));
                        }}
                        style={styles.input}
                      />
                    </div>
                    <div style={styles.fieldGroup}>
                      <label style={styles.miniLabel}>Pitch</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        value={cfg.pitch}
                        onChange={(e) => {
                          setVoiceAssignments((prev) => ({
                            ...prev,
                            [char]: {
                              ...cfg,
                              pitch: parseFloat(e.target.value) || 1,
                            },
                          }));
                        }}
                        style={styles.input}
                      />
                    </div>
                    <button
                      onClick={() => handlePreviewVoice(char)}
                      style={{
                        ...styles.buttonSecondary,
                        padding: "4px 10px",
                        fontSize: "13px",
                        minWidth: "auto",
                        ...(previewingChar === char
                          ? { borderColor: "#ff6b6b", color: "#ff6b6b" }
                          : {}),
                      }}
                    >
                      {previewingChar === char ? "⏹ Stop" : "▶ Preview"}
                    </button>
                    <button
                      onClick={() => handleSaveVoiceToCast(char)}
                      style={{
                        ...styles.buttonSecondary,
                        padding: "4px 10px",
                        fontSize: "13px",
                        minWidth: "auto",
                      }}
                      title="Save voice settings to cast page"
                    >
                      💾 Save
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Rehearsal Controls */}
          <section style={{ ...styles.card, gridColumn: "span 4" }}>
            <h2 style={styles.h2}>Rehearsal Controls</h2>
            <div style={styles.row}>
              <button onClick={handleStart} style={styles.buttonSuccess}>
                ▶ Start
              </button>
              <button onClick={handlePause} style={styles.buttonWarn}>
                ⏸ Pause
              </button>
              <button onClick={handleResume} style={styles.buttonSecondary}>
                ▶ Resume
              </button>
              <button onClick={handleReset} style={styles.buttonDanger}>
                ⏹ Reset
              </button>
            </div>
            <div style={styles.status}>{rehearsalStatus}</div>
          </section>

          {/* Rehearsal Player */}
          <section style={{ ...styles.card, gridColumn: "span 12" }}>
            <h2 style={styles.h2}>Rehearsal Player</h2>
            <div style={styles.lineBox}>
              <div style={styles.speaker}>{currentSpeaker}</div>
              <div style={styles.dialogue}>{currentDialogue}</div>
              {currentPrompt && (
                <div style={styles.prompt}>{currentPrompt}</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
