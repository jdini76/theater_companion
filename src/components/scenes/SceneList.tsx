"use client";

import React, { useState, useMemo } from "react";
import { Scene } from "@/types/scene";
import type { ProductionType } from "@/types/project";
import { useScenes } from "@/contexts/SceneContext";
import { useVoice } from "@/contexts/VoiceContext";
import { extractSceneCharacters } from "@/lib/scenes";
import { ChevronUp, ChevronDown } from "lucide-react";

interface SceneListProps {
  projectId: string;
  productionType?: ProductionType;
  filteredScenes: Scene[];
  selectedSceneId: string | null;
  onSelectScene: (scene: Scene) => void;
  onlyMyScenes: boolean;
  onOnlyMyScenesChange: (v: boolean) => void;
  hasMyRole: boolean;
}

export function SceneList({
  projectId,
  productionType,
  filteredScenes,
  selectedSceneId,
  onSelectScene,
  onlyMyScenes,
  onOnlyMyScenesChange,
  hasMyRole,
}: SceneListProps) {
  const { getProjectScenes, deleteScene, deleteScenes, reorderScenes } =
    useScenes();
  const { getProjectCharacters } = useVoice();
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(
    new Set(),
  );

  const allScenes = getProjectScenes(projectId);
  const projectCharacters = getProjectCharacters(projectId);
  const knownCast = useMemo(
    () => projectCharacters.map((c) => c.characterName),
    [projectCharacters],
  );

  const sceneCharacters = useMemo(() => {
    const cast = knownCast.length > 0 ? knownCast : undefined;
    const map = new Map<string, string[]>();
    for (const scene of allScenes) {
      map.set(
        scene.id,
        scene.characters ??
          extractSceneCharacters(scene.content, cast, productionType),
      );
    }
    return map;
  }, [allScenes, knownCast, productionType]);

  const scenes = filteredScenes;

  if (allScenes.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted text-sm">No scenes yet</p>
      </div>
    );
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this scene?")) {
      deleteScene(id);
      setSelectedForDelete((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }
  };

  const handleToggleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedForDelete((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const handleBulkDelete = () => {
    const count = selectedForDelete.size;
    if (!count) return;
    if (confirm(`Delete ${count} scene${count !== 1 ? "s" : ""}?`)) {
      deleteScenes(Array.from(selectedForDelete));
      setSelectedForDelete(new Set());
    }
  };

  const handleMove = (id: string, direction: -1 | 1, e: React.MouseEvent) => {
    e.stopPropagation();
    const ids = scenes.map((s) => s.id);
    const idx = ids.indexOf(id);
    const target = idx + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    reorderScenes(projectId, ids);
  };

  const allSelected = selectedForDelete.size === scenes.length;

  return (
    <div className="flex flex-col h-full">
      {/* Only my scenes filter */}
      {hasMyRole && (
        <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer hover:text-light mb-2 select-none">
          <input
            type="checkbox"
            checked={onlyMyScenes}
            onChange={(e) => onOnlyMyScenesChange(e.target.checked)}
            className="accent-accent-cyan w-3.5 h-3.5"
          />
          Only my scenes
        </label>
      )}

      {/* Bulk-action bar — only visible when something is checked */}
      <div
        className={`flex items-center justify-between mb-2 transition-all ${selectedForDelete.size > 0 ? "opacity-100" : "opacity-0 pointer-events-none h-0 mb-0 overflow-hidden"}`}
      >
        <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer hover:text-light">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() =>
              setSelectedForDelete(
                allSelected ? new Set() : new Set(scenes.map((s) => s.id)),
              )
            }
            className="accent-accent-cyan"
          />
          All
        </label>
        <button
          onClick={handleBulkDelete}
          className="text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          Delete ({selectedForDelete.size})
        </button>
      </div>

      <div className="space-y-0.5 overflow-y-auto flex-1">
        {scenes.map((scene, idx) => {
          const chars = sceneCharacters.get(scene.id) ?? [];
          const songs = scene.songs ?? [];
          const isSelected = selectedSceneId === scene.id;
          const isChecked = selectedForDelete.has(scene.id);

          return (
            <div
              key={scene.id}
              onClick={() => onSelectScene(scene)}
              className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all ${
                isSelected
                  ? "bg-accent-cyan/15 border border-accent-cyan/40"
                  : "border border-transparent hover:bg-background hover:border-border"
              }`}
            >
              {/* Checkbox — visible on hover or when any are checked */}
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => {}}
                onClick={(e) => handleToggleDelete(scene.id, e)}
                className={`accent-accent-cyan flex-shrink-0 transition-opacity ${
                  selectedForDelete.size > 0
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-60"
                }`}
              />

              {/* Scene number */}
              <span className="text-xs text-muted font-mono w-5 text-right flex-shrink-0 select-none">
                {String(idx + 1).padStart(2, "0")}
              </span>

              {/* Title */}
              <span
                className={`flex-1 text-sm truncate min-w-0 ${
                  isSelected
                    ? "text-light font-medium"
                    : "text-muted group-hover:text-light"
                }`}
                title={scene.title}
              >
                {scene.title}
              </span>

              {/* Badges */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {chars.length > 0 && (
                  <span
                    className="text-xs text-muted/60 tabular-nums"
                    title={`${chars.length} character${chars.length !== 1 ? "s" : ""}`}
                  >
                    {chars.length}
                    <span className="ml-0.5 opacity-60">👤</span>
                  </span>
                )}
                {productionType !== "Film" && songs.length > 0 && (
                  <span
                    className="text-xs text-yellow-500/60 tabular-nums ml-1"
                    title={`${songs.length} song${songs.length !== 1 ? "s" : ""}`}
                  >
                    {songs.length}
                    <span className="ml-0.5 opacity-60">♪</span>
                  </span>
                )}
              </div>

              {/* Reorder + Delete — on hover */}
              <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => handleMove(scene.id, -1, e)}
                  disabled={idx === 0}
                  className="text-muted hover:text-light disabled:opacity-20 p-0.5 rounded transition-colors"
                  title="Move up"
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  onClick={(e) => handleMove(scene.id, 1, e)}
                  disabled={idx === scenes.length - 1}
                  className="text-muted hover:text-light disabled:opacity-20 p-0.5 rounded transition-colors"
                  title="Move down"
                >
                  <ChevronDown size={13} />
                </button>
                <button
                  onClick={(e) => handleDelete(scene.id, e)}
                  className="text-red-400/70 hover:text-red-400 text-sm leading-none transition-colors px-0.5 ml-0.5"
                  title="Delete scene"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
