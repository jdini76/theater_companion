"use client";

import React, { useState, useEffect } from "react";
import { useVoice } from "@/contexts/VoiceContext";
import {
  getAvailableVoices,
  getTTSSettings,
  fetchApiVoices,
  speakLine,
  stopLine,
  ApiVoice,
} from "@/lib/voice";
import { KOKORO_VOICES } from "@/lib/kokoro-tts";
import { TTSSettings } from "@/types/voice";
import { Button } from "@/components/ui/Button";

interface VoiceConfigProps {
  characterId?: string;
}

export function VoiceConfig({ characterId }: VoiceConfigProps) {
  const {
    characters,
    currentCharacterId,
    updateVoiceConfig,
    getVoiceConfig,
  } = useVoice();

  const charId = characterId || currentCharacterId;
  const character = charId ? characters.find((c) => c.id === charId) : null;
  const voiceConfig =
    character && character.voiceConfigId
      ? getVoiceConfig(character.voiceConfigId)
      : null;

  const [voices, setVoices] = useState(getAvailableVoices());
  const [ttsSettings, setTtsSettings] = useState<TTSSettings | null>(null);
  const [apiVoices, setApiVoices] = useState<ApiVoice[]>([]);
  const [apiVoicesLoading, setApiVoicesLoading] = useState(false);
  const [apiVoicesError, setApiVoicesError] = useState<string | null>(null);
  const [testText, setTestText] = useState(
    character?.characterName
      ? `Hello, I am ${character.characterName}.`
      : "Hello, this is a test of the voice."
  );
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Load TTS settings to know which provider is active
  useEffect(() => {
    setTtsSettings(getTTSSettings());
  }, []);

  const isApiMode = ttsSettings?.provider === "api" && !!ttsSettings.apiUrl;
  const isKokoroMode = ttsSettings?.provider === "kokoro";

  useEffect(() => {
    // Reload browser voices when component mounts
    const loadVoices = () => {
      const availableVoices = getAvailableVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
      }
    };

    loadVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  // Load API voices when in API mode
  useEffect(() => {
    if (!isApiMode || !ttsSettings || apiVoices.length > 0) return;
    setApiVoicesLoading(true);
    setApiVoicesError(null);
    fetchApiVoices(ttsSettings)
      .then((v) => {
        setApiVoices(v);
        if (v.length === 0) setApiVoicesError("No voices returned.");
      })
      .catch((err) => setApiVoicesError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setApiVoicesLoading(false));
  }, [isApiMode, ttsSettings, apiVoices.length]);

  // Update test text when character changes
  useEffect(() => {
    if (character?.characterName) {
      setTestText(`Hello, I am ${character.characterName}.`);
    }
  }, [character?.characterName]);

  if (!character || !voiceConfig) {
    return (
      <div className="card">
        <p className="text-muted text-center py-8">
          Select a character to configure voice settings
        </p>
      </div>
    );
  }

  const handleVoiceChange = (voiceName: string) => {
    updateVoiceConfig(voiceConfig.id, { voiceName });
  };

  const handleApiVoiceChange = (apiVoiceId: string) => {
    updateVoiceConfig(voiceConfig.id, { apiVoiceId: apiVoiceId || undefined });
  };

  const handleRateChange = (rate: number) => {
    updateVoiceConfig(voiceConfig.id, { rate });
  };

  const handlePitchChange = (pitch: number) => {
    updateVoiceConfig(voiceConfig.id, { pitch });
  };

  const handleVolumeChange = (volume: number) => {
    updateVoiceConfig(voiceConfig.id, { volume });
  };

  const handleMuteToggle = () => {
    updateVoiceConfig(voiceConfig.id, { muted: !voiceConfig.muted });
  };

  const handleTestSpeech = async () => {
    if (voiceConfig.muted) {
      alert("Character is muted. Unmute to hear voice.");
      return;
    }

    try {
      setIsSpeaking(true);
      await speakLine(testText, voiceConfig);
    } catch (error) {
      alert(
        `Error speaking: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsSpeaking(false);
    }
  };

  const handleStopSpeech = () => {
    stopLine();
    setIsSpeaking(false);
  };

  return (
    <div className="card space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-light mb-2">
          Voice Configuration
        </h2>
        <p className="text-muted">
          Character: <span className="text-accent-cyan font-semibold">{character.characterName}</span>
        </p>
        <p className="text-xs text-muted mt-1">
          TTS Provider:{" "}
          <span className="text-accent-cyan">
            {isKokoroMode ? "Kokoro AI" : isApiMode ? "API TTS" : "Browser TTS"}
          </span>
          {(isApiMode || isKokoroMode) && (
            <span className="text-muted"> — change in Settings</span>
          )}
        </p>
      </div>

      {/* Voice Selection — Kokoro mode */}
      {isKokoroMode ? (
        <div>
          <label className="block text-light font-semibold mb-2">
            🎙️ Kokoro Voice
          </label>
          <select
            value={voiceConfig.apiVoiceId || ""}
            onChange={(e) => handleApiVoiceChange(e.target.value)}
            disabled={voiceConfig.muted}
            className="w-full bg-background border border-border rounded px-3 py-2 text-light focus:outline-none focus:border-accent-cyan disabled:opacity-50"
          >
            <option value="">Default ({ttsSettings?.kokoroVoice || "am_puck"})</option>
            {KOKORO_VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <p className="text-muted text-xs mt-1">
            Override the default Kokoro voice for this character.
          </p>
        </div>
      ) : isApiMode ? (
        <div>
          <label className="block text-light font-semibold mb-2">
            🎙️ API Voice
          </label>
          <div className="flex gap-2">
            <select
              value={voiceConfig.apiVoiceId || ""}
              onChange={(e) => handleApiVoiceChange(e.target.value)}
              disabled={voiceConfig.muted}
              className="flex-1 bg-background border border-border rounded px-3 py-2 text-light focus:outline-none focus:border-accent-cyan disabled:opacity-50"
            >
              <option value="">
                {apiVoices.length === 0
                  ? (apiVoicesLoading ? "Loading voices..." : "Click Refresh to load")
                  : "Default voice"}
              </option>
              {apiVoices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name ? `${v.name} (${v.id})` : v.id}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (!ttsSettings) return;
                setApiVoicesLoading(true);
                setApiVoicesError(null);
                fetchApiVoices(ttsSettings)
                  .then((v) => {
                    setApiVoices(v);
                    if (v.length === 0) setApiVoicesError("No voices returned.");
                  })
                  .catch((err) => setApiVoicesError(err instanceof Error ? err.message : "Failed"))
                  .finally(() => setApiVoicesLoading(false));
              }}
              disabled={apiVoicesLoading}
            >
              {apiVoicesLoading ? "..." : "↻"}
            </Button>
          </div>
          {apiVoicesError && (
            <p className="text-red-400 text-xs mt-1">{apiVoicesError}</p>
          )}
          {voiceConfig.apiVoiceId && (
            <p className="text-muted text-xs mt-1">Current: {voiceConfig.apiVoiceId}</p>
          )}
        </div>
      ) : (
        /* Voice Selection — Browser mode */
        <div>
          <label className="block text-light font-semibold mb-2">
            🎙️ Voice
          </label>
          <select
            value={voiceConfig.voiceName}
            onChange={(e) => handleVoiceChange(e.target.value)}
            disabled={voiceConfig.muted}
            className="w-full bg-background border border-border rounded px-3 py-2 text-light focus:outline-none focus:border-accent-cyan disabled:opacity-50"
          >
            <option value="">-- Select Voice --</option>
            {voices.map((voice) => (
              <option key={voice.voiceURI || voice.name} value={voice.name}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
          <p className="text-muted text-xs mt-1">Select the voice for this character</p>
        </div>
      )}

      {/* Rate / Speed Control */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-light font-semibold">
            ⚡ {isApiMode || isKokoroMode ? "Speed" : "Speech Rate"}
          </label>
          <span className="text-accent-cyan font-mono">
            {voiceConfig.rate.toFixed(1)}x
          </span>
        </div>
        <input
          type="range"
          min={isApiMode || isKokoroMode ? "0.5" : "0.1"}
          max={isApiMode || isKokoroMode ? "2" : "10"}
          step="0.1"
          value={voiceConfig.rate}
          onChange={(e) => handleRateChange(parseFloat(e.target.value))}
          disabled={voiceConfig.muted}
          className="w-full h-2 bg-background border border-border rounded cursor-pointer disabled:opacity-50"
        />
        <div className="flex justify-between text-xs text-muted mt-1">
          <span>Slow ({isApiMode || isKokoroMode ? "0.5x" : "0.1x"})</span>
          <span>Normal (1x)</span>
          <span>Fast ({isApiMode || isKokoroMode ? "2x" : "10x"})</span>
        </div>
      </div>

      {/* Pitch Control — browser TTS only */}
      {!isApiMode && !isKokoroMode && (
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-light font-semibold">
            🎵 Pitch
          </label>
          <span className="text-accent-cyan font-mono">
            {voiceConfig.pitch.toFixed(1)}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={voiceConfig.pitch}
          onChange={(e) => handlePitchChange(parseFloat(e.target.value))}
          disabled={voiceConfig.muted}
          className="w-full h-2 bg-background border border-border rounded cursor-pointer disabled:opacity-50"
        />
        <div className="flex justify-between text-xs text-muted mt-1">
          <span>Deep (0)</span>
          <span>Normal (1)</span>
          <span>High (2)</span>
        </div>
      </div>
      )}

      {/* Volume Control */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-light font-semibold">
            🔊 Volume
          </label>
          <span className="text-accent-cyan font-mono">
            {Math.round(voiceConfig.volume * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={voiceConfig.volume}
          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
          disabled={voiceConfig.muted}
          className="w-full h-2 bg-background border border-border rounded cursor-pointer disabled:opacity-50"
        />
        <div className="flex justify-between text-xs text-muted mt-1">
          <span>Silent</span>
          <span>Normal</span>
          <span>Loud</span>
        </div>
      </div>

      {/* Mute Toggle */}
      <div className="flex items-center gap-3 p-4 bg-background border border-border rounded-lg">
        <button
          onClick={handleMuteToggle}
          className={`px-4 py-2 rounded font-semibold transition-all ${
            voiceConfig.muted
              ? "bg-warn-amber text-yellow-900"
              : "bg-accent-cyan text-dark-base"
          }`}
        >
          {voiceConfig.muted ? "🔇 Muted" : "🔊 Active"}
        </button>
        <div>
          <p className="text-light font-semibold">
            {voiceConfig.muted ? "Character is Muted" : "Character Voice Active"}
          </p>
          <p className="text-muted text-sm">
            {voiceConfig.muted
              ? "Click to unmute and enable voice"
              : "Click to mute character voice"}
          </p>
        </div>
      </div>

      {/* Test Speech */}
      <div className="space-y-3 p-4 bg-background border border-border rounded-lg">
        <label className="block text-light font-semibold">
          🎬 Test Voice
        </label>
        <textarea
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          disabled={voiceConfig.muted || isSpeaking}
          placeholder="Enter text to hear how the character sounds"
          rows={3}
          className="w-full bg-dark-base border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan disabled:opacity-50 resize-none"
        />
        <div className="flex gap-2">
          {isSpeaking ? (
            <Button
              variant="warn"
              onClick={handleStopSpeech}
              className="flex-1"
            >
              ⏹️ Stop Speaking
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleTestSpeech}
              disabled={voiceConfig.muted || !testText.trim()}
              className="flex-1"
            >
              ▶️ Play Voice
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
