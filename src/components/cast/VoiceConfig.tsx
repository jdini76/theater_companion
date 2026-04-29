"use client";

import React, { useState, useEffect, useRef } from "react";
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

type Tab = "general" | "voice";

interface VoiceConfigProps {
  characterId?: string;
}

export function VoiceConfig({ characterId }: VoiceConfigProps) {
  const {
    characters,
    currentCharacterId,
    updateVoiceConfig,
    updateCharacter,
    createCharacter,
    deleteCharacter,
    getVoiceConfig,
    getProjectCharacters,
  } = useVoice();

  const charId = characterId || currentCharacterId;
  const character = charId ? characters.find((c) => c.id === charId) : null;
  const voiceConfig =
    character && character.voiceConfigId
      ? getVoiceConfig(character.voiceConfigId)
      : null;

  const [activeTab, setActiveTab] = useState<Tab>("general");
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

  // General tab local state
  const [editName, setEditName] = useState(character?.characterName ?? "");
  const [editCategory, setEditCategory] = useState(character?.category ?? "");
  const [aliasSelect, setAliasSelect] = useState("");
  const [aliasSearch, setAliasSearch] = useState("");
  const [aliasDropdownOpen, setAliasDropdownOpen] = useState(false);
  const [aliasDropdownRect, setAliasDropdownRect] = useState<DOMRect | null>(null);
  const aliasDropdownRef = useRef<HTMLDivElement>(null);
  const aliasTriggerRef = useRef<HTMLButtonElement>(null);

  // Sync local state when character changes
  useEffect(() => {
    setEditName(character?.characterName ?? "");
    setEditCategory(character?.category ?? "");
    setAliasSelect("");
    setAliasSearch("");
    setAliasDropdownOpen(false);
  }, [character?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!aliasDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (aliasDropdownRef.current && !aliasDropdownRef.current.contains(e.target as Node)) {
        setAliasDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [aliasDropdownOpen]);

  useEffect(() => {
    setTtsSettings(getTTSSettings());
  }, []);

  const isApiMode = ttsSettings?.provider === "api" && !!ttsSettings.apiUrl;
  const isKokoroMode = ttsSettings?.provider === "kokoro";

  useEffect(() => {
    const loadVoices = () => {
      const available = getAvailableVoices();
      if (available.length > 0) setVoices(available);
    };
    loadVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
  }, []);

  useEffect(() => {
    if (!isApiMode || !ttsSettings || apiVoices.length > 0) return;
    setApiVoicesLoading(true);
    setApiVoicesError(null);
    fetchApiVoices(ttsSettings)
      .then((v) => { setApiVoices(v); if (v.length === 0) setApiVoicesError("No voices returned."); })
      .catch((err) => setApiVoicesError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setApiVoicesLoading(false));
  }, [isApiMode, ttsSettings, apiVoices.length]);

  useEffect(() => {
    if (character?.characterName) setTestText(`Hello, I am ${character.characterName}.`);
  }, [character?.characterName]);

  if (!character || !voiceConfig) {
    return (
      <div className="card flex-1 flex flex-col items-center justify-center text-center py-16">
        <p className="text-muted">Select a character to configure voice settings</p>
      </div>
    );
  }

  // General tab handlers
  const handleNameBlur = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== character.characterName) {
      updateCharacter(character.id, { characterName: trimmed });
    }
  };

  const handleAddAlias = () => {
    if (!aliasSelect) return;
    const current = character.aliases ?? [];
    if (!current.some((a) => a.toLowerCase() === aliasSelect.toLowerCase())) {
      updateCharacter(character.id, { aliases: [...current, aliasSelect] });
      const match = getProjectCharacters(character.projectId).find(
        (c) => c.characterName.toLowerCase() === aliasSelect.toLowerCase()
      );
      if (match) deleteCharacter(match.id);
    }
    setAliasSelect("");
  };

  const handleRemoveAlias = (alias: string) => {
    const updated = (character.aliases ?? []).filter((a) => a !== alias);
    updateCharacter(character.id, { aliases: updated.length > 0 ? updated : undefined });
    createCharacter(character.projectId, alias);
  };

  // Voice tab handlers
  const handleVoiceChange = (voiceName: string) => updateVoiceConfig(voiceConfig.id, { voiceName });
  const handleApiVoiceChange = (apiVoiceId: string) => updateVoiceConfig(voiceConfig.id, { apiVoiceId: apiVoiceId || undefined });
  const handleRateChange = (rate: number) => updateVoiceConfig(voiceConfig.id, { rate });
  const handlePitchChange = (pitch: number) => updateVoiceConfig(voiceConfig.id, { pitch });
  const handleVolumeChange = (volume: number) => updateVoiceConfig(voiceConfig.id, { volume });
  const handleMuteToggle = () => updateVoiceConfig(voiceConfig.id, { muted: !voiceConfig.muted });

  const handleTestSpeech = async () => {
    if (voiceConfig.muted) { alert("Character is muted. Unmute to hear voice."); return; }
    try {
      setIsSpeaking(true);
      await speakLine(testText, voiceConfig);
    } catch (error) {
      alert(`Error speaking: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSpeaking(false);
    }
  };

  const handleStopSpeech = () => { stopLine(); setIsSpeaking(false); };

  return (
    <div className="card flex flex-col flex-1 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-light">{character.characterName}</h2>
        {character.actorName && (
          <p className="text-muted text-sm mt-0.5">{character.actorName}</p>
        )}
        {character.category && (
          <p className="text-xs text-accent-cyan mt-0.5">{character.category}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["general", "voice"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-accent-cyan text-accent-cyan"
                : "border-transparent text-muted hover:text-light"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">

        {activeTab === "general" && (
          <div className="space-y-5">
            <div>
              <label className="block text-light font-semibold mb-1 text-sm">Character Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                className="w-full bg-background border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan text-sm"
              />
            </div>

            <div>
              <label className="block text-light font-semibold mb-1 text-sm">Category</label>
              <select
                value={editCategory}
                onChange={(e) => {
                  setEditCategory(e.target.value);
                  updateCharacter(character.id, { category: e.target.value || undefined });
                }}
                className="w-full bg-background border border-border rounded px-3 py-2 text-light focus:outline-none focus:border-accent-cyan text-sm"
              >
                <option value="">— Select —</option>
                <option value="Individual">Individual</option>
                <option value="Group">Group</option>
              </select>
            </div>

            <div>
              <label className="block text-light font-semibold mb-1 text-sm">Merged Character Names</label>
              <p className="text-muted text-xs mb-2">Character names that map to this character&apos;s voice</p>
              <div className="flex gap-2 mb-2">
                <div className="relative flex-1" ref={aliasDropdownRef}>
                  <button
                    ref={aliasTriggerRef}
                    type="button"
                    onClick={() => {
                      const rect = aliasTriggerRef.current?.getBoundingClientRect() ?? null;
                      setAliasDropdownRect(rect);
                      setAliasDropdownOpen((v) => !v);
                      setAliasSearch("");
                    }}
                    className={`w-full text-left bg-background border rounded px-3 py-2 text-sm flex items-center justify-between focus:outline-none ${aliasDropdownOpen ? "border-accent-cyan" : "border-border"}`}
                  >
                    <span className={aliasSelect ? "text-light" : "text-muted"}>
                      {aliasSelect || "Select a character..."}
                    </span>
                    <span className="text-muted ml-2">{aliasDropdownOpen ? "▲" : "▼"}</span>
                  </button>

                  {aliasDropdownOpen && aliasDropdownRect && (
                    <div
                      className="fixed z-50 bg-dark-card/90 backdrop-blur-sm border border-border rounded shadow-lg flex flex-col overflow-hidden"
                      style={(() => {
                        const spaceBelow = window.innerHeight - aliasDropdownRect.bottom - 8;
                        const spaceAbove = aliasDropdownRect.top - 8;
                        const flip = spaceBelow < 200 && spaceAbove > spaceBelow;
                        return {
                          left: aliasDropdownRect.left,
                          width: aliasDropdownRect.width,
                          ...(flip
                            ? { bottom: window.innerHeight - aliasDropdownRect.top + 4, maxHeight: Math.min(spaceAbove, 224) }
                            : { top: aliasDropdownRect.bottom + 4, maxHeight: Math.min(spaceBelow, 224) }),
                        };
                      })()}
                    >
                      <div className="p-1.5 border-b border-border relative">
                        <input
                          type="text"
                          value={aliasSearch}
                          onChange={(e) => setAliasSearch(e.target.value)}
                          placeholder="Search..."
                          autoFocus
                          className="w-full bg-background border border-border rounded px-2 py-1 pr-6 text-light placeholder-muted focus:outline-none focus:border-accent-cyan text-xs"
                        />
                        {aliasSearch && (
                          <button
                            onClick={() => setAliasSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-light text-sm leading-none"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <div className="overflow-y-auto flex-1">
                        {(() => {
                          const opts = getProjectCharacters(character.projectId).filter((c) =>
                            c.id !== character.id &&
                            !(character.aliases ?? []).some((a) => a.toLowerCase() === c.characterName.toLowerCase()) &&
                            c.characterName.toLowerCase().includes(aliasSearch.toLowerCase())
                          );
                          return opts.length === 0 ? (
                            <p className="text-muted text-xs text-center py-3">No matches</p>
                          ) : opts.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => { setAliasSelect(c.characterName); setAliasDropdownOpen(false); }}
                              className={`w-full text-left px-3 py-2 text-sm transition-colors ${aliasSelect === c.characterName ? "bg-accent-cyan/10 text-accent-cyan" : "text-light hover:bg-white/5"}`}
                            >
                              {c.characterName}
                            </button>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>
                <Button variant="secondary" size="sm" onClick={handleAddAlias} disabled={!aliasSelect}>
                  Add
                </Button>
              </div>
              {(character.aliases ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(character.aliases ?? []).map((alias) => (
                    <span
                      key={alias}
                      className="flex items-center gap-1 px-2 py-0.5 bg-white/5 border border-border rounded-full text-xs text-light"
                    >
                      {alias}
                      <button
                        onClick={() => handleRemoveAlias(alias)}
                        className="text-muted hover:text-red-400 transition-colors leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "voice" && (
          <div className="space-y-6">
            <p className="text-xs text-muted">
              TTS Provider:{" "}
              <span className="text-accent-cyan">
                {isKokoroMode ? "Kokoro AI" : isApiMode ? "API TTS" : "Browser TTS"}
              </span>
              {(isApiMode || isKokoroMode) && <span className="text-muted"> — change in Settings</span>}
            </p>

            {/* Voice Selection */}
            {isKokoroMode ? (
              <div>
                <label className="block text-light font-semibold mb-2">🎙️ Kokoro Voice</label>
                <select
                  value={voiceConfig.apiVoiceId || ""}
                  onChange={(e) => handleApiVoiceChange(e.target.value)}
                  disabled={voiceConfig.muted}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-light focus:outline-none focus:border-accent-cyan disabled:opacity-50"
                >
                  <option value="">Default ({ttsSettings?.kokoroVoice || "am_puck"})</option>
                  {KOKORO_VOICES.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <p className="text-muted text-xs mt-1">Override the default Kokoro voice for this character.</p>
              </div>
            ) : isApiMode ? (
              <div>
                <label className="block text-light font-semibold mb-2">🎙️ API Voice</label>
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
                      <option key={v.id} value={v.id}>{v.name ? `${v.name} (${v.id})` : v.id}</option>
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
                        .then((v) => { setApiVoices(v); if (v.length === 0) setApiVoicesError("No voices returned."); })
                        .catch((err) => setApiVoicesError(err instanceof Error ? err.message : "Failed"))
                        .finally(() => setApiVoicesLoading(false));
                    }}
                    disabled={apiVoicesLoading}
                  >
                    {apiVoicesLoading ? "..." : "↻"}
                  </Button>
                </div>
                {apiVoicesError && <p className="text-red-400 text-xs mt-1">{apiVoicesError}</p>}
                {voiceConfig.apiVoiceId && <p className="text-muted text-xs mt-1">Current: {voiceConfig.apiVoiceId}</p>}
              </div>
            ) : (
              <div>
                <label className="block text-light font-semibold mb-2">🎙️ Voice</label>
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

            {/* Rate */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-light font-semibold">⚡ {isApiMode || isKokoroMode ? "Speed" : "Speech Rate"}</label>
                <span className="text-accent-cyan font-mono">{voiceConfig.rate.toFixed(1)}x</span>
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

            {/* Pitch — browser only */}
            {!isApiMode && !isKokoroMode && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-light font-semibold">🎵 Pitch</label>
                  <span className="text-accent-cyan font-mono">{voiceConfig.pitch.toFixed(1)}</span>
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
                  <span>Deep (0)</span><span>Normal (1)</span><span>High (2)</span>
                </div>
              </div>
            )}

            {/* Volume */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-light font-semibold">🔊 Volume</label>
                <span className="text-accent-cyan font-mono">{Math.round(voiceConfig.volume * 100)}%</span>
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
                <span>Silent</span><span>Normal</span><span>Loud</span>
              </div>
            </div>

            {/* Mute */}
            <div className="flex items-center gap-3 p-4 bg-background border border-border rounded-lg">
              <button
                onClick={handleMuteToggle}
                className={`px-4 py-2 rounded font-semibold transition-all ${
                  voiceConfig.muted ? "bg-warn-amber text-yellow-900" : "bg-accent-cyan text-dark-base"
                }`}
              >
                {voiceConfig.muted ? "🔇 Muted" : "🔊 Active"}
              </button>
              <div>
                <p className="text-light font-semibold">
                  {voiceConfig.muted ? "Character is Muted" : "Character Voice Active"}
                </p>
                <p className="text-muted text-sm">
                  {voiceConfig.muted ? "Click to unmute and enable voice" : "Click to mute character voice"}
                </p>
              </div>
            </div>

            {/* Test Speech */}
            <div className="space-y-3 p-4 bg-background border border-border rounded-lg">
              <label className="block text-light font-semibold">🎬 Test Voice</label>
              <input
                type="text"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                disabled={voiceConfig.muted || isSpeaking}
                placeholder="Enter text to hear how the character sounds"
                className="w-full bg-dark-base border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan disabled:opacity-50"
              />
              <div className="flex gap-2">
                {isSpeaking ? (
                  <Button variant="warn" onClick={handleStopSpeech} className="flex-1">⏹️ Stop Speaking</Button>
                ) : (
                  <Button variant="primary" onClick={handleTestSpeech} disabled={voiceConfig.muted || !testText.trim()} className="flex-1">▶️ Play Voice</Button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
