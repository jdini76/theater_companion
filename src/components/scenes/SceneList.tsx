"use client";

import React, { useState, useMemo } from "react";
import { Scene } from "@/types/scene";
import { useScenes } from "@/contexts/SceneContext";
import { useVoice } from "@/contexts/VoiceContext";
import { extractSceneCharacters } from "@/lib/scenes";
import { Button } from "@/components/ui/Button";

interface SceneListProps {
  projectId: string;
  onSelectScene?: (scene: Scene) => void;
}

export function SceneList({
  projectId,
  onSelectScene,
}: SceneListProps) {
  const { getProjectScenes, deleteScene, deleteScenes, updateScene } = useScenes();
  const { getProjectCharacters } = useVoice();
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [editingCharsId, setEditingCharsId] = useState<string | null>(null);
  const [editingChars, setEditingChars] = useState<string[]>([]);
  const [newCharInput, setNewCharInput] = useState("");

  const scenes = getProjectScenes(projectId);
  const knownCast = useMemo(
    () => getProjectCharacters(projectId).map((c) => c.characterName),
    [getProjectCharacters, projectId],
  );

  // Memoize character extraction per scene (used as fallback when no override)
  const sceneCharacters = useMemo(() => {
    const cast = knownCast.length > 0 ? knownCast : undefined;
    const map = new Map<string, string[]>();
    for (const scene of scenes) {
      map.set(scene.id, scene.characters ?? extractSceneCharacters(scene.content, cast));
    }
    return map;
  }, [scenes, knownCast]);

  if (scenes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted text-lg">No scenes yet</p>
        <p className="text-muted text-sm mt-2">
          Create your first scene by uploading or pasting text
        </p>
      </div>
    );
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this scene?")) {
      deleteScene(id);
      if (selectedSceneId === id) {
        setSelectedSceneId(null);
      }
      selectedForDelete.delete(id);
      setSelectedForDelete(new Set(selectedForDelete));
    }
  };

  const handleSelectScene = (scene: Scene) => {
    setSelectedSceneId(scene.id);
    onSelectScene?.(scene);
  };

  const handleToggleSelectForDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedForDelete);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedForDelete(newSelected);
  };

  const handleSelectAllForDelete = () => {
    if (selectedForDelete.size === scenes.length) {
      setSelectedForDelete(new Set());
    } else {
      setSelectedForDelete(new Set(scenes.map((s) => s.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedForDelete.size === 0) return;
    const count = selectedForDelete.size;
    if (confirm(`Are you sure you want to delete ${count} scene${count !== 1 ? "s" : ""}?`)) {
      deleteScenes(Array.from(selectedForDelete));
      if (selectedSceneId && selectedForDelete.has(selectedSceneId)) {
        setSelectedSceneId(null);
      }
      setSelectedForDelete(new Set());
    }
  };

  const handleStartEditChars = (sceneId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const chars = sceneCharacters.get(sceneId) ?? [];
    setEditingCharsId(sceneId);
    setEditingChars([...chars]);
    setNewCharInput("");
  };

  const handleRemoveChar = (char: string) => {
    setEditingChars(editingChars.filter((c) => c !== char));
  };

  const handleAddChar = () => {
    const name = newCharInput.trim().toUpperCase();
    if (name && !editingChars.includes(name)) {
      setEditingChars([...editingChars, name].sort());
    }
    setNewCharInput("");
  };

  const handleRescanChars = (sceneId: string) => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (scene) {
      const cast = knownCast.length > 0 ? knownCast : undefined;
      setEditingChars(extractSceneCharacters(scene.content, cast));
    }
  };

  const handleSaveChars = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingCharsId) {
      updateScene(editingCharsId, { characters: editingChars });
      setEditingCharsId(null);
      setEditingChars([]);
      setNewCharInput("");
    }
  };

  const handleCancelEditChars = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCharsId(null);
    setEditingChars([]);
    setNewCharInput("");
  };

  return (
    <div className="space-y-3">
      {/* Bulk actions bar */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-muted cursor-pointer hover:text-light transition-colors">
          <input
            type="checkbox"
            checked={selectedForDelete.size === scenes.length && scenes.length > 0}
            onChange={handleSelectAllForDelete}
            className="accent-accent-cyan"
          />
          Select All
        </label>
        {selectedForDelete.size > 0 && (
          <Button
            variant="warn"
            size="sm"
            onClick={handleBulkDelete}
          >
            Delete Selected ({selectedForDelete.size})
          </Button>
        )}
      </div>

      {scenes.map((scene) => {
        const chars = sceneCharacters.get(scene.id) ?? [];
        const isEditingChars = editingCharsId === scene.id;

        return (
          <div
            key={scene.id}
            className={`
              p-4 border rounded-lg cursor-pointer transition-all
              ${
                selectedSceneId === scene.id
                  ? "border-accent-cyan bg-accent-cyan/10"
                  : "border-border hover:border-accent-cyan"
              }
            `}
            onClick={() => handleSelectScene(scene)}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-3 flex-1">
                <input
                  type="checkbox"
                  checked={selectedForDelete.has(scene.id)}
                  onChange={() => {}}
                  onClick={(e) => handleToggleSelectForDelete(scene.id, e)}
                  className="accent-accent-cyan mt-1"
                />
                <div className="flex-1">
                  <h3 className="text-light font-semibold">
                    {scene.title}
                  </h3>
                  {scene.description && (
                    <p className="text-muted text-sm mt-1">{scene.description}</p>
                  )}
                  <p className="text-muted text-xs mt-2">
                    {scene.content.split("\n").length} lines •{" "}
                    {Math.ceil(scene.content.length / 5)} words
                  </p>

                  {/* Character display / edit */}
                  {isEditingChars ? (
                    <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted">Characters:</span>
                        <button
                          onClick={() => handleRescanChars(scene.id)}
                          className="text-xs text-muted hover:text-accent-cyan transition-colors"
                          title="Re-scan content for characters"
                        >
                          ↻ Re-scan
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {editingChars.map((char) => (
                          <span
                            key={char}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-cyan/15 text-accent-cyan text-xs rounded"
                          >
                            {char}
                            <button
                              onClick={() => handleRemoveChar(char)}
                              className="text-red-400 hover:text-red-300 font-bold leading-none"
                              title={`Remove ${char}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        {editingChars.length === 0 && (
                          <span className="text-xs text-muted">No characters</span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={newCharInput}
                          onChange={(e) => setNewCharInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddChar();
                            }
                          }}
                          placeholder="Add character..."
                          className="flex-1 bg-background border border-border rounded px-2 py-0.5 text-xs text-light placeholder-muted focus:outline-none focus:border-accent-cyan"
                        />
                        <button
                          onClick={handleAddChar}
                          className="px-2 py-0.5 bg-accent-cyan/20 text-accent-cyan text-xs rounded hover:bg-accent-cyan/30 transition-colors"
                        >
                          Add
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveChars}
                          className="px-3 py-1 bg-accent-cyan/20 text-accent-cyan rounded text-xs hover:bg-accent-cyan/30 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEditChars}
                          className="px-3 py-1 bg-border text-muted rounded text-xs hover:bg-border/50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    chars.length > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs">
                          <span className="text-muted">Characters: </span>
                          <span className="text-accent-cyan">
                            {chars.join(", ")}
                          </span>
                        </p>
                        <button
                          onClick={(e) => handleStartEditChars(scene.id, e)}
                          className="text-muted text-xs hover:text-accent-cyan transition-colors"
                        >
                          Edit
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
              <Button
                variant="warn"
                size="sm"
                onClick={(e) => handleDelete(scene.id, e)}
              >
                Delete
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
