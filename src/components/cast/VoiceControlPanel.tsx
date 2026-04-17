"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useVoice } from "@/contexts/VoiceContext";
import { VoiceConfig } from "./VoiceConfig";
import { Button } from "@/components/ui/Button";

interface VoiceControlPanelProps {
  projectId: string;
}

export function VoiceControlPanel({ projectId }: VoiceControlPanelProps) {
  const {
    createCharacter,
    deleteCharacter,
    getProjectCharacters,
    currentCharacterId,
    setCurrentCharacter,
  } = useVoice();
  const [showAddForm, setShowAddForm] = useState(false);
  const [characterName, setCharacterName] = useState("");
  const [actorName, setActorName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const characters = getProjectCharacters(projectId);
  const selectedChar = characters.find((c) => c.id === currentCharacterId) || null;

  const filteredCharacters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return characters;
    return characters.filter(
      (c) =>
        c.characterName.toLowerCase().includes(q) ||
        (c.actorName && c.actorName.toLowerCase().includes(q))
    );
  }, [characters, searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddCharacter = async () => {
    setError(null);

    if (!characterName.trim()) {
      setError("Character name is required");
      return;
    }

    try {
      setIsCreating(true);
      createCharacter(
        projectId,
        characterName.trim(),
        description.trim() || undefined,
        actorName.trim() || undefined
      );

      setCharacterName("");
      setActorName("");
      setDescription("");
      setShowAddForm(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create character"
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCharacter = (characterId: string) => {
    if (confirm("Delete this character and their voice configuration?")) {
      deleteCharacter(characterId);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-light mb-2">Character Voice Control</h1>
        <p className="text-muted">
          Create characters and configure their voice settings for text-to-speech
        </p>
      </div>

      <div className="space-y-6">
        {/* Character Selector Row */}
        <div className="card">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[240px]" ref={dropdownRef}>
              <label className="block text-light font-semibold mb-1 text-sm">
                Character ({characters.length})
              </label>
              <button
                type="button"
                onClick={() => { setDropdownOpen(!dropdownOpen); setSearchQuery(""); }}
                className={`w-full text-left bg-dark-input border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent-cyan flex items-center justify-between ${
                  dropdownOpen ? "border-accent-cyan" : "border-border"
                }`}
              >
                <span className={selectedChar ? "text-light" : "text-muted"}>
                  {selectedChar
                    ? `${selectedChar.characterName}${selectedChar.actorName ? ` — ${selectedChar.actorName}` : ""}`
                    : "Select a character..."}
                </span>
                <span className="text-muted ml-2">{dropdownOpen ? "▲" : "▼"}</span>
              </button>

              {dropdownOpen && (
                <div className="absolute z-50 mt-1 w-full bg-dark-panel border border-border rounded shadow-lg max-h-72 flex flex-col">
                  <div className="p-2 border-b border-border">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search characters..."
                      autoFocus
                      className="w-full bg-dark-input border border-border rounded px-3 py-1.5 text-light placeholder-muted focus:outline-none focus:border-accent-cyan text-sm"
                    />
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {filteredCharacters.length === 0 ? (
                      <p className="text-muted text-center py-4 text-sm">
                        {characters.length === 0 ? "No characters yet" : "No matches"}
                      </p>
                    ) : (
                      filteredCharacters.map((char) => (
                        <div
                          key={char.id}
                          onClick={() => {
                            setCurrentCharacter(char.id);
                            setDropdownOpen(false);
                            setSearchQuery("");
                          }}
                          className={`px-3 py-2 cursor-pointer flex items-center justify-between group text-sm ${
                            currentCharacterId === char.id
                              ? "bg-accent-cyan/10 text-accent-cyan"
                              : "text-light hover:bg-dark-panel-2"
                          }`}
                        >
                          <div>
                            <span className="font-semibold">{char.characterName}</span>
                            {char.actorName && (
                              <span className="text-muted ml-2 text-xs">({char.actorName})</span>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCharacter(char.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-muted hover:text-warn-amber text-xs font-semibold transition-opacity"
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 items-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAddForm(!showAddForm)}
              >
                {showAddForm ? "Cancel" : "+ Add"}
              </Button>
            </div>
          </div>

          {/* Add Character Form */}
          {showAddForm && (
            <div className="space-y-3 p-4 bg-background border border-border rounded mt-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-light font-semibold mb-1 text-sm">
                    Character Name *
                  </label>
                  <input
                    type="text"
                    value={characterName}
                    onChange={(e) => setCharacterName(e.target.value)}
                    placeholder="e.g., Hamlet"
                    className="w-full bg-dark-base border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan text-sm"
                  />
                </div>
                <div>
                  <label className="block text-light font-semibold mb-1 text-sm">
                    Actor Name
                  </label>
                  <input
                    type="text"
                    value={actorName}
                    onChange={(e) => setActorName(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-dark-base border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan text-sm"
                  />
                </div>
                <div>
                  <label className="block text-light font-semibold mb-1 text-sm">
                    Description
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-dark-base border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan text-sm"
                  />
                </div>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleAddCharacter}
                disabled={isCreating || !characterName.trim()}
              >
                {isCreating ? "Creating..." : "Create Character"}
              </Button>
            </div>
          )}
        </div>

        {/* Voice Configuration */}
        <VoiceConfig />
      </div>
    </div>
  );
}
