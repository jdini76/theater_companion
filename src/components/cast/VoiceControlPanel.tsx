"use client";

import React, { useState } from "react";
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
  } = useVoice();
  const [showAddForm, setShowAddForm] = useState(false);
  const [characterName, setCharacterName] = useState("");
  const [actorName, setActorName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const characters = getProjectCharacters(projectId);

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Character List & Management */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-light">
                Characters ({characters.length})
              </h2>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAddForm(!showAddForm)}
              >
                {showAddForm ? "Cancel" : "+ Add"}
              </Button>
            </div>

            {/* Add Character Form */}
            {showAddForm && (
              <div className="space-y-3 p-4 bg-background border border-border rounded mb-4">
                {error && (
                  <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded text-sm">
                    {error}
                  </div>
                )}

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
                    placeholder="Actor name (optional)"
                    className="w-full bg-dark-base border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan text-sm"
                  />
                </div>

                <div>
                  <label className="block text-light font-semibold mb-1 text-sm">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Character details"
                    rows={2}
                    className="w-full bg-dark-base border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan text-sm resize-none"
                  />
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAddCharacter}
                  disabled={isCreating || !characterName.trim()}
                  className="w-full"
                >
                  {isCreating ? "Creating..." : "Create Character"}
                </Button>
              </div>
            )}

            {/* Characters List */}
            {characters.length === 0 ? (
              <p className="text-muted text-center py-6 text-sm">
                No characters yet. Add one to begin.
              </p>
            ) : (
              <div className="space-y-2">
                {characters.map((char) => (
                  <div
                    key={char.id}
                    className={`p-3 rounded-lg border transition-all cursor-pointer group ${
                      currentCharacterId === char.id
                        ? "border-accent-cyan bg-accent-cyan/10"
                        : "border-border hover:border-accent-cyan"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <p className="font-semibold text-light text-sm">
                          {char.characterName}
                        </p>
                        {char.actorName && (
                          <p className="text-xs text-muted">
                            {char.actorName}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCharacter(char.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted hover:text-warn-amber text-xs font-semibold transition-opacity"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Voice Configuration */}
        <div className="lg:col-span-2">
          <VoiceConfig />
        </div>
      </div>
    </div>
  );
}
