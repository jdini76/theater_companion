"use client";

import React, { useState } from "react";
import { Scene } from "@/types/scene";
import { CharacterRole } from "@/types/voice";
import { Button } from "@/components/ui/Button";
import { extractCharacterNames, parseDialogueLines } from "@/lib/rehearsal";

interface RehearsalSetupProps {
  scenes: Scene[];
  characters: CharacterRole[];
  onStart: (sceneId: string, characterId: string, characterName: string) => void;
  onCancel: () => void;
}

export function RehearsalSetup({
  scenes,
  characters,
  onStart,
  onCancel,
}: RehearsalSetupProps) {
  const [selectedSceneId, setSelectedSceneId] = useState<string>("");
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>("");
  const [error, setError] = useState<string>("");

  const selectedScene = scenes.find((s) => s.id === selectedSceneId);
  const selectedCharacter = characters.find((c) => c.id === selectedCharacterId);

  // Extract available characters from the selected scene
  const sceneCharacters = selectedScene
    ? extractCharacterNames(parseDialogueLines(selectedScene.content))
    : [];

  const handleStart = () => {
    if (!selectedSceneId) {
      setError("Please select a scene");
      return;
    }

    if (!selectedCharacterId) {
      setError("Please select a character to play");
      return;
    }

    if (!selectedCharacter) {
      setError("Character not found");
      return;
    }

    // Check if the character exists in the scene
    if (!sceneCharacters.includes(selectedCharacter.characterName)) {
      setError(
        `Character "${selectedCharacter.characterName}" is not in this scene. Available characters: ${sceneCharacters.join(", ")}`
      );
      return;
    }

    onStart(selectedSceneId, selectedCharacterId, selectedCharacter.characterName);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Scene Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-300">
          📽️ Select Scene
        </label>
        <select
          value={selectedSceneId}
          onChange={(e) => {
            setSelectedSceneId(e.target.value);
            setError("");
          }}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
        >
          <option value="">-- Choose a scene --</option>
          {scenes.map((scene) => (
            <option key={scene.id} value={scene.id}>
              {scene.title}
            </option>
          ))}
        </select>
      </div>

      {/* Scene Preview */}
      {selectedScene && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 space-y-2">
          <div className="text-sm text-gray-400">
            <p>
              <span className="font-semibold">Characters in scene:</span>{" "}
              {sceneCharacters.join(", ") || "None detected"}
            </p>
            <p>
              <span className="font-semibold">Total lines:</span>{" "}
              {parseDialogueLines(selectedScene.content).length}
            </p>
          </div>
        </div>
      )}

      {/* Character Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-300">
          🎭 Play as Character
        </label>
        <select
          value={selectedCharacterId}
          onChange={(e) => {
            setSelectedCharacterId(e.target.value);
            setError("");
          }}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
        >
          <option value="">-- Choose your character --</option>
          {characters.map((char) => (
            <option key={char.id} value={char.id}>
              {char.characterName}
              {char.actorName ? ` (${char.actorName})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Selected Character Info */}
      {selectedCharacter && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 space-y-2">
          <div className="text-sm text-gray-300">
            <p>
              <span className="font-semibold">Character:</span>{" "}
              {selectedCharacter.characterName}
            </p>
            {selectedCharacter.actorName && (
              <p>
                <span className="font-semibold">Actor:</span>{" "}
                {selectedCharacter.actorName}
              </p>
            )}
            {selectedCharacter.description && (
              <p>
                <span className="font-semibold">Description:</span>{" "}
                {selectedCharacter.description}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <Button
          onClick={handleStart}
          disabled={!selectedSceneId || !selectedCharacterId}
          className="flex-1 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
        >
          🎬 Start Rehearsal
        </Button>
        <Button
          onClick={onCancel}
          variant="outline"
          className="flex-1 border-gray-600 hover:bg-gray-800"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
