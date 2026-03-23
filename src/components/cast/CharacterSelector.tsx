"use client";

import React, { useState } from "react";
import { useVoice } from "@/contexts/VoiceContext";
import { Button } from "@/components/ui/Button";

interface CharacterSelectorProps {
  projectId: string;
  onSelect?: (characterId: string) => void;
}

export function CharacterSelector({
  projectId,
  onSelect,
}: CharacterSelectorProps) {
  const { getProjectCharacters, currentCharacterId, setCurrentCharacter } =
    useVoice();
  const [showForm, setShowForm] = useState(false);
  const [characterName, setCharacterName] = useState("");
  const [actorName, setActorName] = useState("");
  const [description, setDescription] = useState("");

  const characters = getProjectCharacters(projectId);

  const handleSelectCharacter = (characterId: string) => {
    setCurrentCharacter(characterId);
    onSelect?.(characterId);
  };

  return (
    <div className="card space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-light">
          Characters ({characters.length})
        </h2>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Hide" : "+ Add Character"}
        </Button>
      </div>

      {/* Character List */}
      {characters.length === 0 ? (
        <p className="text-muted text-center py-4">
          No characters yet. Create one to get started.
        </p>
      ) : (
        <div className="space-y-2">
          {characters.map((char) => (
            <button
              key={char.id}
              onClick={() => handleSelectCharacter(char.id)}
              className={`w-full p-3 rounded-lg text-left border transition-all ${
                currentCharacterId === char.id
                  ? "border-accent-cyan bg-accent-cyan/10"
                  : "border-border hover:border-accent-cyan"
              }`}
            >
              <div className="font-semibold text-light">{char.characterName}</div>
              {char.actorName && (
                <div className="text-sm text-muted">Played by: {char.actorName}</div>
              )}
              {char.description && (
                <div className="text-xs text-muted mt-1">{char.description}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Add Character Form */}
      {showForm && (
        <div className="border-t border-border pt-4">
          <div className="space-y-3">
            <div>
              <label className="block text-light font-semibold mb-2">
                Character Name *
              </label>
              <input
                type="text"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="e.g., Hamlet"
                className="w-full bg-background border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan"
              />
            </div>

            <div>
              <label className="block text-light font-semibold mb-2">
                Actor Name
              </label>
              <input
                type="text"
                value={actorName}
                onChange={(e) => setActorName(e.target.value)}
                placeholder="e.g., John Smith"
                className="w-full bg-background border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan"
              />
            </div>

            <div>
              <label className="block text-light font-semibold mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Character details or notes"
                rows={3}
                className="w-full bg-background border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan resize-none"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setCharacterName("");
                  setActorName("");
                  setDescription("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (characterName.trim()) {
                    // Note: This is handled by parent or would need createCharacter call
                    // For now, this is a UI component
                    setShowForm(false);
                    setCharacterName("");
                    setActorName("");
                    setDescription("");
                  }
                }}
              >
                Add Character
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
