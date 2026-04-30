"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { extractCharacterNames, parseDialogueLines } from "@/lib/rehearsal";
import { getAvailableVoices, speakText } from "@/lib/voice";
import { VoiceConfig } from "@/types/voice";
import {
  createVoiceConfig as createVoiceConfigUtil,
  updateVoiceConfig as updateVoiceConfigUtil,
} from "@/lib/voice";
import { parseScenes } from "@/lib/scenes";
import { ParsedScene } from "@/types/scene";

interface RehearsalOnboardingProps {
  onRehearsalReady: (config: {
    sceneContent: string;
    userCharacterName: string;
    voiceConfigs: Record<string, VoiceConfig>;
  }) => void;
  onCancel: () => void;
}

type Stage =
  | "scene-input"
  | "scene-selection"
  | "character-select"
  | "voice-config";

export function RehearsalOnboarding({
  onRehearsalReady,
  onCancel,
}: RehearsalOnboardingProps) {
  const [stage, setStage] = useState<Stage>("scene-input");
  const [sceneContent, setSceneContent] = useState<string>("");
  const [detectedScenes, setDetectedScenes] = useState<ParsedScene[]>([]);
  const [selectedSceneIndices, setSelectedSceneIndices] = useState<Set<number>>(
    new Set(),
  );
  const [detectedCharacters, setDetectedCharacters] = useState<string[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string>("");
  const [voiceConfigs, setVoiceConfigs] = useState<Record<string, VoiceConfig>>(
    {},
  );
  const [error, setError] = useState<string>("");
  const [speakingChar, setSpeakingChar] = useState<string | null>(null);
  // Get language preferences from settings (localStorage, multi-select)
  const [voiceLangs, setVoiceLangs] = useState<string[]>([]);
  const [voices, setVoices] = useState(getAvailableVoices());

  useEffect(() => {
    // Read language(s) from settings
    try {
      const raw = localStorage.getItem("theater_tts_settings");
      if (raw) {
        const settings = JSON.parse(raw);
        if (
          settings.provider === "browser" &&
          Array.isArray(settings.voiceLangs)
        ) {
          setVoiceLangs(settings.voiceLangs);
        } else {
          setVoiceLangs([]);
        }
      }
    } catch {}
    // Listen for voice changes
    const updateVoices = () => setVoices(getAvailableVoices());
    window.speechSynthesis?.addEventListener("voiceschanged", updateVoices);
    return () =>
      window.speechSynthesis?.removeEventListener(
        "voiceschanged",
        updateVoices,
      );
  }, []);

  // Handle scene input to detect scenes
  const handleSceneSubmit = () => {
    if (!sceneContent.trim()) {
      setError("Please paste or enter scene content");
      return;
    }

    // Parse scenes using auto mode to detect multiple scenes
    const parsed = parseScenes(sceneContent, { mode: "auto" });

    if (parsed.length === 0) {
      setError("No content detected");
      return;
    }

    setDetectedScenes(parsed);
    setError("");

    // If multiple scenes detected, show selection stage
    if (parsed.length > 1) {
      setSelectedSceneIndices(new Set([0])); // Default: select first scene
      setStage("scene-selection");
    } else {
      // Single scene: skip to character detection
      handleScenesSelected([0]);
    }
  };

  // Handle scene selection
  const handleScenesSelected = (indices: number[]) => {
    if (indices.length === 0) {
      setError("Please select at least one scene");
      return;
    }

    // Combine selected scenes
    const selectedSceneContents = indices
      .map((i) => detectedScenes[i].content)
      .join("\n\n");

    // Parse characters from combined scene content
    const lines = parseDialogueLines(selectedSceneContents);
    const characters = extractCharacterNames(lines);

    if (characters.length === 0) {
      setError(
        "No characters detected in selected scene(s). Make sure scene uses 'CHARACTER: dialogue' format.",
      );
      return;
    }

    setDetectedCharacters(characters);
    setError("");

    // Initialize voice configs for all detected characters
    const initConfigs: Record<string, VoiceConfig> = {};
    characters.forEach((char) => {
      initConfigs[char] = createVoiceConfigUtil(
        char,
        voices[0]?.name || "Default",
      );
    });
    setVoiceConfigs(initConfigs);
    setSelectedSceneIndices(new Set(indices));
    setStage("character-select");
  };

  // Handle character selection
  const handleCharacterSelect = (characterName: string) => {
    setSelectedCharacter(characterName);
    setStage("voice-config");
  };

  // Handle voice config update
  const handleVoiceConfigChange = (
    characterName: string,
    updates: Partial<Omit<VoiceConfig, "id" | "characterName" | "createdAt">>,
  ) => {
    const config = voiceConfigs[characterName];
    if (!config) return;

    const updated = updateVoiceConfigUtil(config, updates);
    setVoiceConfigs((prev) => ({
      ...prev,
      [characterName]: updated,
    }));
  };

  // Test voice for a character
  const handleTestVoice = async (characterName: string) => {
    const config = voiceConfigs[characterName];
    if (!config) return;

    setSpeakingChar(characterName);
    try {
      const testText = `Hello, I am ${characterName}.`;
      await speakText(testText, config);
    } catch (err) {
      console.error("Voice test error:", err);
    } finally {
      setSpeakingChar(null);
    }
  };

  // Start rehearsal
  const handleStartRehearsalSession = () => {
    if (!selectedCharacter) {
      setError("Please select your character role");
      return;
    }

    onRehearsalReady({
      sceneContent,
      userCharacterName: selectedCharacter,
      voiceConfigs,
    });
  };

  // Stage 1: Scene Input
  if (stage === "scene-input") {
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            📝 Enter Your Scene(s)
          </h2>
          <p className="text-gray-400 text-sm">
            Paste your scene text below. You can paste single or multiple
            scenes&mdash;we&apos;ll detect them for you.
          </p>
        </div>

        <textarea
          value={sceneContent}
          onChange={(e) => {
            setSceneContent(e.target.value);
            setError("");
          }}
          placeholder={`Example - Single Scene:

ROMEO: O Romeo, Romeo! Wherefore art thou Romeo?

JULIET: What's in a name? That which we call a rose
         by any other name would smell as sweet.

---

Example - Multiple Scenes:

SCENE 1: The Street
ROMEO: Tybalt! Take the "villain" back again
  That late thou gavest me!

SCENE 2: The Balcony
JULIET: Art thou gone so? Love, lord, ay husband, friend!`}
          className="w-full h-64 px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-cyan-500 placeholder:text-gray-500"
        />

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            onClick={handleSceneSubmit}
            className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-lg py-3"
          >
            📽️ Detect Characters
          </Button>
          <Button
            onClick={onCancel}
            className="bg-gray-700 hover:bg-gray-600 text-lg py-3"
          >
            Cancel
          </Button>
        </div>

        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 text-blue-300 text-sm">
          <p className="font-semibold">💡 Tips:</p>
          <p>• Character names should be in ALL CAPS followed by a colon</p>
          <p>
            • Separate multiple scenes with headers like &quot;SCENE 1:&quot; or
            &quot;---&quot;
          </p>
          <p className="font-mono text-xs mt-2">HAMLET: To be, or not to be</p>
        </div>
      </div>
    );
  }

  // Stage 2: Scene Selection (if multiple scenes detected)
  if (stage === "scene-selection") {
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            🎬 Select Scene(s)
          </h2>
          <p className="text-gray-400 text-sm">
            {detectedScenes.length} scene
            {detectedScenes.length !== 1 ? "s" : ""} detected. Select which
            one(s) to rehearse:
          </p>
        </div>

        <div className="space-y-3">
          {detectedScenes.map((scene, index) => {
            const isSelected = selectedSceneIndices.has(index);
            const lineCount = scene.content.split("\n").length;

            return (
              <button
                key={index}
                onClick={() => {
                  const newIndices = new Set(selectedSceneIndices);
                  if (isSelected) {
                    newIndices.delete(index);
                  } else {
                    // For now, only single scene selection at a time
                    newIndices.clear();
                    newIndices.add(index);
                  }
                  setSelectedSceneIndices(newIndices);
                }}
                className={`w-full text-left p-4 rounded-lg border-2 transition ${
                  isSelected
                    ? "border-cyan-500 bg-cyan-900/30"
                    : "border-gray-700 bg-gray-800 hover:border-gray-600"
                } text-white`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-lg">{scene.title}</p>
                    <p className="text-gray-400 text-sm mt-1">
                      {lineCount} lines • {Math.ceil(scene.content.length / 5)}{" "}
                      words
                    </p>
                    <p className="text-gray-500 text-xs mt-2 line-clamp-2">
                      {scene.content.substring(0, 120).replace(/\n/g, " ")}...
                    </p>
                  </div>
                  {isSelected && (
                    <div className="ml-4 text-cyan-400 text-2xl">✓</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            onClick={() =>
              handleScenesSelected(Array.from(selectedSceneIndices))
            }
            disabled={selectedSceneIndices.size === 0}
            className="flex-1 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-lg py-3"
          >
            Continue (Scene{selectedSceneIndices.size !== 1 ? "s" : ""}{" "}
            Selected)
          </Button>
          <Button
            onClick={() => {
              setStage("scene-input");
              setDetectedScenes([]);
              setSelectedSceneIndices(new Set());
            }}
            className="bg-gray-700 hover:bg-gray-600 text-lg py-3"
          >
            Back
          </Button>
        </div>
      </div>
    );
  }

  // Stage 3: Character Selection
  if (stage === "character-select") {
    const selectedScenesInfo =
      selectedSceneIndices.size > 0
        ? `${selectedSceneIndices.size} scene${selectedSceneIndices.size !== 1 ? "s" : ""}`
        : "all scenes";

    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            🎭 Choose Your Role
          </h2>
          <p className="text-gray-400 text-sm">
            {detectedCharacters.length} character
            {detectedCharacters.length !== 1 ? "s" : ""} detected in{" "}
            {selectedScenesInfo}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {detectedCharacters.map((char) => (
            <button
              key={char}
              onClick={() => handleCharacterSelect(char)}
              className="text-left p-4 bg-gray-800 border-2 border-gray-700 rounded-lg hover:border-cyan-500 hover:bg-gray-750 transition text-white font-semibold"
            >
              {char}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <Button
            onClick={() => setStage("scene-selection")}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-lg py-3"
          >
            ← Back
          </Button>
          <Button
            onClick={onCancel}
            className="bg-gray-700 hover:bg-gray-600 text-lg py-3"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Stage 4: Voice Configuration
  if (stage === "voice-config") {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            🎙️ Configure Voices
          </h2>
          <p className="text-gray-400 text-sm">
            Set up voices for all characters in the scene
          </p>
        </div>

        {/* Your Character Highlight */}
        <div className="bg-cyan-900/30 border border-cyan-700 rounded-lg p-4">
          <p className="text-cyan-300 font-semibold">
            ▶️ You are playing:{" "}
            <span className="text-cyan-400">{selectedCharacter}</span>
          </p>
        </div>

        {/* Voice Config Cards */}
        <div className="space-y-4">
          {detectedCharacters.map((char) => {
            const config = voiceConfigs[char];
            if (!config) return null;

            const isUser = char === selectedCharacter;

            return (
              <div
                key={char}
                className={`rounded-lg border p-4 space-y-3 ${
                  isUser
                    ? "bg-gray-750 border-cyan-600"
                    : "bg-gray-800 border-gray-700"
                }`}
              >
                {/* Character Name */}
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-lg">{char}</span>
                  {isUser && (
                    <span className="text-xs bg-cyan-600 text-white px-2 py-1 rounded">
                      YOUR ROLE
                    </span>
                  )}
                </div>

                {/* Voice Selection */}
                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    🎙️ Voice
                  </label>
                  <select
                    value={config.voiceName}
                    onChange={(e) =>
                      handleVoiceConfigChange(char, {
                        voiceName: e.target.value,
                      })
                    }
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                  >
                    {(voiceLangs.length > 0
                      ? voices.filter((v) =>
                          voiceLangs.some((lang) => v.lang.startsWith(lang)),
                        )
                      : voices
                    ).map((voice) => (
                      <option
                        key={voice.voiceURI || voice.name}
                        value={voice.name}
                      >
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Rate Control */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm text-gray-300">⚡ Speed</label>
                    <span className="text-cyan-400 text-sm font-mono">
                      {config.rate.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={config.rate}
                    onChange={(e) =>
                      handleVoiceConfigChange(char, {
                        rate: parseFloat(e.target.value),
                      })
                    }
                    className="w-full h-2 bg-gray-700 border border-gray-600 rounded cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>0.5x</span>
                    <span>1.0x</span>
                    <span>2.0x</span>
                  </div>
                </div>

                {/* Pitch Control */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm text-gray-300">🎵 Pitch</label>
                    <span className="text-cyan-400 text-sm font-mono">
                      {config.pitch.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={config.pitch}
                    onChange={(e) =>
                      handleVoiceConfigChange(char, {
                        pitch: parseFloat(e.target.value),
                      })
                    }
                    className="w-full h-2 bg-gray-700 border border-gray-600 rounded cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Low</span>
                    <span>Normal</span>
                    <span>High</span>
                  </div>
                </div>

                {/* Mute Toggle */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`mute-${char}`}
                    checked={config.muted}
                    onChange={(e) =>
                      handleVoiceConfigChange(char, { muted: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 cursor-pointer"
                  />
                  <label
                    htmlFor={`mute-${char}`}
                    className="text-sm text-gray-300"
                  >
                    Mute this character
                  </label>
                </div>

                {/* Test Voice Button */}
                {!config.muted && (
                  <button
                    onClick={() => handleTestVoice(char)}
                    disabled={speakingChar !== null}
                    className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm font-semibold transition"
                  >
                    {speakingChar === char ? "⏹️ Stop Test" : "▶️ Test Voice"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            onClick={() => {
              setSelectedCharacter("");
              setStage("character-select");
            }}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-lg py-3"
          >
            ← Change Character
          </Button>
          <Button
            onClick={handleStartRehearsalSession}
            className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-lg py-3"
          >
            🎬 Start Rehearsal
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
