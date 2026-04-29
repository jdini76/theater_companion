"use client";

import React, { useState, useMemo } from "react";
import { useVoice } from "@/contexts/VoiceContext";
import { VoiceConfig } from "./VoiceConfig";
import { Button } from "@/components/ui/Button";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const characters = getProjectCharacters(projectId);
  const selectedChar = characters.find((c) => c.id === currentCharacterId) ?? null;

  const filteredCharacters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return characters;
    return characters.filter(
      (c) =>
        c.characterName.toLowerCase().includes(q) ||
        (c.actorName && c.actorName.toLowerCase().includes(q))
    );
  }, [characters, searchQuery]);

  const handleSelectCharacter = (characterId: string) => {
    setCurrentCharacter(characterId);
    setSidebarCollapsed(true);
  };

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
      setError(err instanceof Error ? err.message : "Failed to create character");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCharacter = (characterId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this character and their voice configuration?")) {
      deleteCharacter(characterId);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4">
      {/* Page header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-light">Cast</h1>
          <p className="text-muted text-sm mt-1">Voice configuration</p>
        </div>
        <Button variant="primary" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? "Cancel" : "+ Add Character"}
        </Button>
      </div>

      {/* Add character form — drops in below the header */}
      {showAddForm && (
        <div className="mb-6 card space-y-3">
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

      {/* Main layout: slim sidebar + wide detail panel */}
      <div className="flex gap-4 items-stretch" style={{ minHeight: "calc(100vh - 14rem)" }}>
        {/* Sidebar */}
        <div className={`flex-shrink-0 flex flex-col transition-all duration-200 ${sidebarCollapsed ? "w-8" : "w-[32rem]"}`}>
          <div className="card flex flex-col flex-1 overflow-hidden relative">
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="absolute top-3 right-2 z-10 p-0.5 rounded hover:bg-white/10 text-muted hover:text-light transition-colors"
              aria-label={sidebarCollapsed ? "Expand character list" : "Collapse character list"}
            >
              {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            {!sidebarCollapsed && (
              <div className="flex flex-col flex-1 p-2 overflow-hidden">
                <div className="flex items-center justify-between mb-2 flex-shrink-0 pr-5">
                  <span className="text-xs font-semibold text-muted uppercase tracking-widest">
                    Characters
                  </span>
                  <span className="text-xs text-muted tabular-nums">
                    {characters.length}
                  </span>
                </div>

                <div className="relative mb-2 flex-shrink-0">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full bg-background border border-border rounded px-2 py-1 pr-6 text-light placeholder-muted focus:outline-none focus:border-accent-cyan text-xs"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted hover:text-light leading-none text-sm"
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>

                {characters.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted text-sm">No characters yet</p>
                  </div>
                ) : filteredCharacters.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted text-sm">No matches</p>
                  </div>
                ) : (
                  <div className="space-y-0.5 overflow-y-auto flex-1">
                    {filteredCharacters.map((char) => {
                      const isSelected = currentCharacterId === char.id;
                      return (
                        <div
                          key={char.id}
                          onClick={() => handleSelectCharacter(char.id)}
                          className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all ${
                            isSelected
                              ? "bg-accent-cyan/15 border border-accent-cyan/40"
                              : "border border-transparent hover:bg-background hover:border-border"
                          }`}
                        >
                          <span
                            className={`flex-1 text-sm truncate min-w-0 font-semibold ${
                              isSelected ? "text-light" : "text-muted group-hover:text-light"
                            }`}
                            title={char.characterName}
                          >
                            {char.characterName}
                          </span>
                          {char.actorName && (
                            <span
                              className="text-xs text-muted/70 truncate max-w-[8rem] flex-shrink-0"
                              title={char.actorName}
                            >
                              {char.actorName}
                            </span>
                          )}
                          <button
                            onClick={(e) => handleDeleteCharacter(char.id, e)}
                            className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-red-400/70 hover:text-red-400 text-sm leading-none transition-opacity px-0.5"
                            title="Delete character"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 min-w-0 flex flex-col">
          {selectedChar ? (
            <VoiceConfig />
          ) : (
            <div className="card flex-1 flex flex-col items-center justify-center text-center py-16">
              <p className="text-muted text-lg mb-2">Select a character</p>
              <p className="text-muted/60 text-sm">
                {characters.length === 0
                  ? "Add characters to get started"
                  : "Choose a character from the sidebar to configure their voice"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
