"use client";

import React, { useState } from "react";
import { Scene } from "@/types/scene";
import { Button } from "@/components/ui/Button";
import { getSceneSummary } from "@/lib/rehearsal";

interface RehearsalSetupProps {
  scenes: Scene[];
  onStart: (sceneId: string, characterName: string) => void;
  onCancel: () => void;
}

export function RehearsalSetup({
  scenes,
  onStart,
  onCancel,
}: RehearsalSetupProps) {
  const [selectedSceneId, setSelectedSceneId] = useState<string>("");
  const [selectedCharacter, setSelectedCharacter] = useState<string>("");
  const [error, setError] = useState<string>("");

  const selectedScene = scenes.find((s) => s.id === selectedSceneId);
  const summary = selectedScene ? getSceneSummary(selectedScene.content) : null;
  const sceneCharacters = summary?.characters || [];

  const handleStart = () => {
    if (!selectedSceneId) {
      setError("Please select a scene");
      return;
    }

    if (!selectedCharacter) {
      setError("Please select a character to play");
      return;
    }

    if (!sceneCharacters.includes(selectedCharacter)) {
      setError("Selected character is not in this scene");
      return;
    }

    onStart(selectedSceneId, selectedCharacter);
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
            setSelectedCharacter("");
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

      {/* Scene Summary */}
      {summary && (
        <div className="bg-gray-800 rounded-lg border border-cyan-600 p-5 space-y-3">
          <div className="border-b border-gray-700 pb-3">
            <h3 className="text-base font-bold text-cyan-300">Scene Breakdown</h3>
          </div>

          {/* Characters */}
          <div>
            <div className="text-xs font-semibold text-gray-400 mb-2">
              🎭 {summary.characters.length} Character{summary.characters.length !== 1 ? "s" : ""}
            </div>
            <div className="flex flex-wrap gap-2">
              {summary.characters.map((char) => (
                <span key={char} className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                  {char}
                </span>
              ))}
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-gray-700/50 rounded p-3">
              <div className="text-2xl font-bold text-cyan-400">
                {summary.dialogueLineCount}
              </div>
              <div className="text-xs text-gray-400">Dialogue lines</div>
            </div>

            {summary.stageDirectionCount > 0 && (
              <div className="bg-gray-700/50 rounded p-3">
                <div className="text-2xl font-bold text-amber-400">
                  {summary.stageDirectionCount}
                </div>
                <div className="text-xs text-gray-400">Stage directions</div>
              </div>
            )}

            {summary.narrativeLineCount > 0 && (
              <div className="bg-gray-700/50 rounded p-3">
                <div className="text-2xl font-bold text-gray-400">
                  {summary.narrativeLineCount}
                </div>
                <div className="text-xs text-gray-400">Narrative lines</div>
              </div>
            )}
          </div>

          {/* Character Line Breakdown */}
          <div className="bg-gray-700/50 rounded p-3 space-y-2 max-h-40 overflow-y-auto">
            <div className="text-xs font-semibold text-gray-400">Lines per character:</div>
            {Object.entries(summary.characterLineBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([char, count]) => (
                <div key={char} className="flex justify-between items-center text-xs">
                  <span className="text-gray-300">{char}</span>
                  <span className="bg-cyan-900/50 text-cyan-300 px-2 py-1 rounded">
                    {count} line{count !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Character Selection */}
      {selectedScene && sceneCharacters.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-300">
            🎬 Choose Your Role
          </label>
          <div className="grid grid-cols-2 gap-2">
            {sceneCharacters.map((char) => {
              const lineCount = summary?.characterLineBreakdown[char] || 0;
              const isSelected = selectedCharacter === char;

              return (
                <button
                  key={char}
                  onClick={() => {
                    setSelectedCharacter(char);
                    setError("");
                  }}
                  className={`p-3 rounded-lg border-2 transition text-sm font-semibold ${
                    isSelected
                      ? "bg-cyan-900/50 border-cyan-500 text-cyan-300"
                      : "bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-500"
                  }`}
                >
                  <div>{char}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {lineCount} line{lineCount !== 1 ? "s" : ""}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Character Info */}
      {selectedCharacter && (
        <div className="bg-cyan-900/20 rounded-lg border border-cyan-700 p-4">
          <div className="text-sm text-cyan-300">
            <p>
              <span className="font-semibold">Your role:</span> {selectedCharacter}
            </p>
            {summary && (
              <p className="mt-2 text-xs text-gray-400">
                You have <span className="font-semibold text-cyan-400">
                  {summary.characterLineBreakdown[selectedCharacter] || 0}
                </span> lines in this scene
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
          disabled={!selectedSceneId || !selectedCharacter}
          className="flex-1 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-lg py-3"
        >
          🎬 Start Rehearsal
        </Button>
        <Button
          onClick={onCancel}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-lg py-3"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
