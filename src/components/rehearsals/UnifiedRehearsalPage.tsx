"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { parseScenes } from "@/lib/scenes";
import { parseDialogueLines } from "@/lib/rehearsal";

const CURRENT_PROJECT_KEY = "theater_current_project_id";

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
  // Active project ID (mirrors theater_current_project_id in localStorage)
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(
    () => (typeof window !== "undefined" ? localStorage.getItem(CURRENT_PROJECT_KEY) : null)
  );

  // Track whether initial load from storage has happened
  const loadedRef = useRef(false);

  // Script loading
  const [scriptInput, setScriptInput] = useState<string>("");
  const [sceneMode, setSceneMode] = useState<"single" | "multiple">("single");

  // Scenes
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number>(0);

  // Role and voice setup
  const [selectedCharacter, setSelectedCharacter] = useState<string>("");
  const [voiceAssignments, setVoiceAssignments] = useState<
    Record<string, VoiceAssignment>
  >({});
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>(
    []
  );

  // Rehearsal options
  const [speakNames, setSpeakNames] = useState<boolean>(false);
  const [readOwnLines, setReadOwnLines] = useState<boolean>(false);
  const [pauseMode, setPauseMode] = useState<"manual" | "countdown">("manual");
  const [countdownSeconds, setCountdownSeconds] = useState<number>(4);
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
    "Load a scene, pick your role, and press Start."
  );
  const [currentPrompt, setCurrentPrompt] = useState<string>("");
  const [rehearsalStatus, setRehearsalStatus] = useState<string>(
    "Ready when you are."
  );

  // Timers
  const [countdownInterval, setCountdownInterval] = useState<NodeJS.Timeout | null>(null);
  const [nextLineTimeout, setNextLineTimeout] = useState<NodeJS.Timeout | null>(null);

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
    setPauseMode("manual");
    setCountdownSeconds(4);
    setNarratorVoiceIndex(0);
    setCurrentSpeaker("");
    setCurrentDialogue("Load a scene, pick your role, and press Start.");
    setCurrentPrompt("");
    setRehearsalStatus("Ready when you are.");
    setRehearsal({ lines: [], index: 0, isPlaying: false, isPaused: false });

    if (!saved) return;

    if (saved.scriptInput) setScriptInput(saved.scriptInput as string);
    if (saved.sceneMode) setSceneMode(saved.sceneMode as "single" | "multiple");
    if (saved.selectedCharacter) setSelectedCharacter(saved.selectedCharacter as string);
    if (saved.voiceAssignments) setVoiceAssignments(saved.voiceAssignments as Record<string, VoiceAssignment>);
    if (typeof saved.speakNames === "boolean") setSpeakNames(saved.speakNames);
    if (typeof saved.readOwnLines === "boolean") setReadOwnLines(saved.readOwnLines);
    if (saved.pauseMode) setPauseMode(saved.pauseMode as "manual" | "countdown");
    if (saved.countdownSeconds) setCountdownSeconds(saved.countdownSeconds as number);
    if (typeof saved.narratorVoiceIndex === "number") setNarratorVoiceIndex(saved.narratorVoiceIndex);
    if (typeof saved.selectedSceneIndex === "number") setSelectedSceneIndex(saved.selectedSceneIndex as number);

    if (saved.scriptInput) {
      const mode = ((saved.sceneMode as string) || "auto") as "single" | "multiple" | "auto";
      const parsedScenes = parseScenes(saved.scriptInput as string, { mode });
      const processedScenes: Scene[] = parsedScenes
        .map((ps) => ({
          title: ps.title,
          lines: parseDialogueLines(ps.content).map((dl) => ({
            speaker: dl.character,
            text: dl.dialogue,
          })),
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

  // Watch for project changes (from ProjectSelector dropdown or projects page)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== CURRENT_PROJECT_KEY) return;
      const newProjectId = e.newValue;
      setCurrentProjectId(newProjectId);
      applySettings(loadSavedForProject(newProjectId));
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [applySettings]);

  // Also poll for same-tab project changes (storage events don't fire in the same tab)
  useEffect(() => {
    const interval = setInterval(() => {
      const pid = localStorage.getItem(CURRENT_PROJECT_KEY);
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

  // Get characters from current scene
  const getCharacters = (scene: Scene): string[] => {
    return [...new Set(scene.lines.map((l) => l.speaker))];
  };

  // Ensure voice assignments exist
  const ensureVoiceAssignments = useCallback(() => {
    if (!scenes[selectedSceneIndex]) return;
    const scene = scenes[selectedSceneIndex];
    const chars = getCharacters(scene);
    const updated = { ...voiceAssignments };

    chars.forEach((char, idx) => {
      if (!updated[char]) {
        updated[char] = {
          voiceIndex: idx % Math.max(availableVoices.length, 1),
          rate: 1,
          pitch: 1,
        };
      }
    });

    setVoiceAssignments(updated);
  }, [scenes, selectedSceneIndex, voiceAssignments, availableVoices]);

  // Parse script
  const handleParseScript = () => {
    if (!scriptInput.trim()) {
      setRehearsalStatus("Please enter script text.");
      return;
    }

    // First, parse scenes (splits by scene headers)
    const parsedScenes = parseScenes(scriptInput, { mode: sceneMode });
    if (parsedScenes.length === 0) {
      setRehearsalStatus("No scenes detected.");
      return;
    }

    // Then, convert each ParsedScene to a Scene with dialogue lines
    const processedScenes: Scene[] = parsedScenes.map((ps) => {
      const dialogueLines = parseDialogueLines(ps.content);
      return {
        title: ps.title,
        lines: dialogueLines.map((dl) => ({
          speaker: dl.character,
          text: dl.dialogue,
        })),
      };
    });

    // Filter out scenes with no dialogue
    const scenesWithDialogue = processedScenes.filter((s) => s.lines.length > 0);

    if (scenesWithDialogue.length === 0) {
      setRehearsalStatus("No dialogue detected. Use FORMAT: CHARACTER: line");
      return;
    }

    setScenes(scenesWithDialogue);
    setSelectedSceneIndex(0);
    setCurrentSpeaker("READY");
    setCurrentDialogue("Script loaded.");
    setCurrentPrompt("");
    setRehearsalStatus(
      `${scenesWithDialogue.length} scene${scenesWithDialogue.length === 1 ? "" : "s"} loaded.`
    );
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
MOM: See? You were ready.`
    );
  };

  // Clear everything for current project
  const handleClear = () => {
    window.speechSynthesis.cancel();
    localStorage.removeItem(saveKeyForProject(currentProjectId));
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
          pauseMode,
          countdownSeconds,
          narratorVoiceIndex,
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
    pauseMode,
    countdownSeconds,
    narratorVoiceIndex,
  ]);

  // Rehearsal playback logic
  const speakLine = useCallback(
    (line: { speaker: string; text: string }, onDone: () => void) => {
      const cfg = voiceAssignments[line.speaker] || { rate: 1, pitch: 1, voiceIndex: 0 };

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
    [voiceAssignments, speakNames, availableVoices, narratorVoiceIndex]
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
    const isMine = line.speaker === selectedCharacter;

    if (isMine && !readOwnLines) {
      setCurrentSpeaker(line.speaker);
      setCurrentDialogue(line.text);
      setCurrentPrompt("Your turn.");
      setRehearsalStatus("Waiting on your line.");

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
      } else {
        setRehearsal((prev) => ({ ...prev, isPaused: true }));
      }

      return;
    }

    setCurrentSpeaker(line.speaker);
    setCurrentDialogue(line.text);
    setCurrentPrompt(isMine ? "Read-through mode" : "Listening...");
    setRehearsalStatus(`Speaking: ${line.speaker}`);

    speakLine(line, () => {
      if (rehearsal.isPlaying && !rehearsal.isPaused) {
        const timeout = setTimeout(
          () => {
            setRehearsal((prev) => ({ ...prev, index: prev.index + 1 }));
          },
          250
        );
        setNextLineTimeout(timeout);
      }
    });
  }, [
    rehearsal,
    selectedCharacter,
    readOwnLines,
    pauseMode,
    countdownSeconds,
    speakLine,
  ]);

  // Trigger rehearsal advancement
  useEffect(() => {
    if (rehearsal.isPlaying && !rehearsal.isPaused) {
      runRehearsalLine();
    }
  }, [rehearsal.index, rehearsal.isPlaying, rehearsal.isPaused, runRehearsalLine]);

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

  const currentScene = scenes[selectedSceneIndex];
  const characters = currentScene ? getCharacters(currentScene) : [];

  return (
    <div style={styles.container}>
      <div style={styles.wrap}>
        {/* Header */}
        <section style={styles.hero}>
          <h1 style={styles.h1}>🎬 Scene Rehearsal</h1>
          <p style={styles.heroText}>
            One-page rehearsal experience. Load scenes, pick your role, assign voices, and
            rehearse without a live scene partner.
          </p>
        </section>

        <div style={styles.grid}>
          {/* Load Scenes */}
          <section style={{ ...styles.card, gridColumn: "span 12" }}>
            <h2 style={styles.h2}>Load Scenes</h2>
            <div style={styles.rowTight}>
              <label style={styles.pill}>
                <input
                  type="radio"
                  name="sceneMode"
                  value="single"
                  checked={sceneMode === "single"}
                  onChange={(e) => setSceneMode(e.target.value as "single" | "multiple")}
                />
                {" "}Single scene
              </label>
              <label style={styles.pill}>
                <input
                  type="radio"
                  name="sceneMode"
                  value="multiple"
                  checked={sceneMode === "multiple"}
                  onChange={(e) => setSceneMode(e.target.value as "single" | "multiple")}
                />
                {" "}Multiple scenes
              </label>
            </div>
            <label style={styles.label}>Paste script text</label>
            <textarea
              value={scriptInput}
              onChange={(e) => setScriptInput(e.target.value)}
              placeholder="SCENE 1: AUDITION ROOM
MOM: You know the lines.
JOEY: I know them until I have to say them out loud..."
              style={styles.textarea}
            />
            <div style={styles.row}>
              <button onClick={handleParseScript} style={styles.buttonPrimary}>
                Load script
              </button>
              <button onClick={handleLoadSample} style={styles.buttonSecondary}>
                Load sample
              </button>
              <button onClick={handleClear} style={styles.buttonSecondary}>
                Clear
              </button>
            </div>
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
                />
                {" "}Speak character names
              </label>
              <label style={styles.pill}>
                <input
                  type="checkbox"
                  checked={readOwnLines}
                  onChange={(e) => setReadOwnLines(e.target.checked)}
                />
                {" "}Read my lines too
              </label>
            </div>
            <div style={styles.fieldGroup}>
              <label htmlFor="pauseMode" style={styles.label}>
                On my line
              </label>
              <select
                id="pauseMode"
                value={pauseMode}
                onChange={(e) => setPauseMode(e.target.value as "manual" | "countdown")}
                style={styles.input}
              >
                <option value="manual">Wait for manual continue</option>
                <option value="countdown">Countdown then continue</option>
              </select>
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
                  max="20"
                  value={countdownSeconds}
                  onChange={(e) => setCountdownSeconds(Math.max(1, parseInt(e.target.value) || 1))}
                  style={styles.input}
                />
              </div>
            )}
          </section>

          {/* Voice Configuration */}
          <section style={{ ...styles.card, gridColumn: "span 8" }}>
            <h2 style={styles.h2}>Character Voices</h2>
            
            {/* Narrator Voice (only shown when "Speak character names" is checked) */}
            {speakNames && (
              <div style={{ ...styles.voiceRow, marginBottom: "12px", backgroundColor: "#1a2438" }}>
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
                <div style={{ gridColumn: "span 2", fontSize: "12px", color: "#9fb0d0" }}>
                  Reads character names
                </div>
              </div>
            )}
            
            <div style={styles.voiceTable}>
              {characters.map((char) => {
                const cfg = voiceAssignments[char] || { voiceIndex: 0, rate: 1, pitch: 1 };
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
                          [char]: { ...cfg, voiceIndex: parseInt(e.target.value) },
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
                            [char]: { ...cfg, rate: parseFloat(e.target.value) || 1 },
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
                            [char]: { ...cfg, pitch: parseFloat(e.target.value) || 1 },
                          }));
                        }}
                        style={styles.input}
                      />
                    </div>
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
            </div>
            <div style={styles.status}>{rehearsalStatus}</div>
          </section>

          {/* Rehearsal Player */}
          <section style={{ ...styles.card, gridColumn: "span 12" }}>
            <h2 style={styles.h2}>Rehearsal Player</h2>
            <div style={styles.lineBox}>
              <div style={styles.speaker}>{currentSpeaker}</div>
              <div style={styles.dialogue}>{currentDialogue}</div>
              {currentPrompt && <div style={styles.prompt}>{currentPrompt}</div>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: "linear-gradient(180deg, #050814, #0b1020 35%, #111827)",
    color: "#eef2ff",
    minHeight: "100vh",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  wrap: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "24px",
  },
  hero: {
    marginBottom: "24px",
  },
  h1: {
    fontSize: "32px",
    fontWeight: "bold",
    margin: "0 0 10px",
  },
  h2: {
    fontSize: "20px",
    fontWeight: "bold",
    margin: "0 0 10px",
  },
  heroText: {
    color: "#9fb0d0",
    lineHeight: 1.45,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(12, 1fr)",
    gap: "16px",
  } as React.CSSProperties,
  card: {
    background: "rgba(18,26,43,.95)",
    border: "1px solid #2b3957",
    borderRadius: "20px",
    padding: "18px",
    boxShadow: "0 12px 28px rgba(0,0,0,.22)",
    gridColumn: "span 12",
  } as React.CSSProperties,
  row: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: "12px",
  } as React.CSSProperties,
  rowTight: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: "12px",
  } as React.CSSProperties,
  fieldGroup: {
    flex: 1,
  } as React.CSSProperties,
  label: {
    display: "block",
    fontSize: "14px",
    fontWeight: "600",
    marginBottom: "6px",
    color: "#eef2ff",
  },
  miniLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#9fb0d0",
  },
  pill: {
    border: "1px solid #2b3957",
    background: "#0d1526",
    color: "#9fb0d0",
    borderRadius: "999px",
    padding: "7px 12px",
    fontSize: "12px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
  },
  input: {
    width: "100%",
    background: "#0c1324",
    color: "#eef2ff",
    border: "1px solid #2b3957",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "14px",
    fontFamily: "Arial, Helvetica, sans-serif",
  } as React.CSSProperties,
  textarea: {
    width: "100%",
    background: "#0c1324",
    color: "#eef2ff",
    border: "1px solid #2b3957",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "14px",
    minHeight: "150px",
    fontFamily: "Arial, Helvetica, sans-serif",
    marginBottom: "12px",
  } as React.CSSProperties,
  status: {
    border: "1px solid #2b3957",
    background: "#0c1324",
    borderRadius: "14px",
    padding: "12px",
    color: "#9fb0d0",
    fontSize: "14px",
    marginTop: "12px",
  },
  sceneList: {
    display: "grid",
    gap: "10px",
    marginTop: "12px",
  } as React.CSSProperties,
  sceneItem: {
    border: "1px solid #2b3957",
    background: "#0c1324",
    borderRadius: "14px",
    padding: "12px",
    cursor: "pointer",
    transition: "all 0.2s",
  } as React.CSSProperties,
  sceneItemActive: {
    borderColor: "#7dd3fc",
    boxShadow: "0 0 0 1px #7dd3fc inset",
  },
  small: {
    fontSize: "12px",
    color: "#9fb0d0",
    marginTop: "4px",
  },
  checkboxGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
    marginTop: "12px",
  },
  voiceTable: {
    display: "grid",
    gap: "10px",
  } as React.CSSProperties,
  voiceRow: {
    display: "grid",
    gridTemplateColumns: "1.1fr 1fr 0.6fr 0.6fr",
    gap: "10px",
    alignItems: "center",
    border: "1px solid #2b3957",
    borderRadius: "14px",
    background: "#0c1324",
    padding: "10px",
  } as React.CSSProperties,
  speaker: {
    color: "#7dd3fc",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "1px",
    marginBottom: "8px",
    textTransform: "uppercase",
  },
  dialogue: {
    fontSize: "24px",
    lineHeight: 1.3,
    minHeight: "80px",
    color: "#eef2ff",
  },
  prompt: {
    marginTop: "12px",
    color: "#fbbf24",
    fontWeight: "700",
  },
  lineBox: {
    minHeight: "220px",
    border: "1px solid #2b3957",
    borderRadius: "18px",
    background: "#0c1324",
    padding: "18px",
  },
  buttonPrimary: {
    border: "0",
    borderRadius: "12px",
    padding: "12px 16px",
    fontWeight: "700",
    cursor: "pointer",
    background: "#7dd3fc",
    color: "#082f49",
    fontSize: "14px",
    flex: 1,
  },
  buttonSecondary: {
    border: "0",
    borderRadius: "12px",
    padding: "12px 16px",
    fontWeight: "700",
    cursor: "pointer",
    background: "#334155",
    color: "#eef2ff",
    fontSize: "14px",
    flex: 1,
  },
  buttonSuccess: {
    border: "0",
    borderRadius: "12px",
    padding: "12px 16px",
    fontWeight: "700",
    cursor: "pointer",
    background: "#86efac",
    color: "#052e16",
    fontSize: "14px",
    flex: 1,
  },
  buttonWarn: {
    border: "0",
    borderRadius: "12px",
    padding: "12px 16px",
    fontWeight: "700",
    cursor: "pointer",
    background: "#fbbf24",
    color: "#422006",
    fontSize: "14px",
    flex: 1,
  },
} as const;
