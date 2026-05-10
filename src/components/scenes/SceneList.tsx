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
  onOpenSetPiece?: (scene: Scene) => void;
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
  onOpenSetPiece,
  onlyMyScenes,
  onOnlyMyScenesChange,
  hasMyRole,
}: SceneListProps) {
  const {
    getProjectScenes,
    deleteScene,
    deleteScenes,
    reorderScenes,
    updateScene,
  } = useScenes();
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
  const sceneGroups = useMemo(() => {
    const groups: Array<{
      key: string;
      label: string | null;
      scenes: Scene[];
    }> = [];
    const lookup = new Map<
      string,
      { key: string; label: string; scenes: Scene[] }
    >();

    for (const scene of scenes) {
      const label = scene.setPiece?.trim();
      if (!label) {
        groups.push({ key: scene.id, label: null, scenes: [scene] });
        continue;
      }

      const key = label.toLowerCase();
      const existing = lookup.get(key);
      if (existing) {
        existing.scenes.push(scene);
        continue;
      }

      const group = { key, label, scenes: [scene] };
      lookup.set(key, group);
      groups.push(group);
    }

    return groups;
  }, [scenes]);

  const renderedScenes = useMemo(
    () => sceneGroups.flatMap((group) => group.scenes),
    [sceneGroups],
  );

  const sceneIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    renderedScenes.forEach((scene, index) => map.set(scene.id, index));
    return map;
  }, [renderedScenes]);

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

  const handleBulkSetPiece = () => {
    const count = selectedForDelete.size;
    if (!count) return;

    const selectedScenes = renderedScenes.filter((scene) =>
      selectedForDelete.has(scene.id),
    );
    const existingLabels = selectedScenes
      .map((scene) => scene.setPiece?.trim())
      .filter(Boolean) as string[];
    const defaultLabel =
      existingLabels.length > 0 &&
      existingLabels.every(
        (label) => label.toLowerCase() === existingLabels[0].toLowerCase(),
      )
        ? existingLabels[0]
        : "";
    const label = window.prompt(
      `Set piece label for ${count} selected scene${count !== 1 ? "s" : ""}:`,
      defaultLabel,
    );

    if (label === null) return;

    const trimmed = label.trim();
    for (const scene of selectedScenes) {
      updateScene(scene.id, {
        setPiece: trimmed || undefined,
      });
    }
  };

  const handleClearSetPiece = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateScene(id, { setPiece: undefined });
  };

  const handleMove = (id: string, direction: -1 | 1, e: React.MouseEvent) => {
    e.stopPropagation();
    const ids = renderedScenes.map((s) => s.id);
    const idx = ids.indexOf(id);
    const target = idx + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    reorderScenes(projectId, ids);
  };

  const allSelected = selectedForDelete.size === renderedScenes.length;

  const renderSceneRow = (scene: Scene) => {
    const index = sceneIndexMap.get(scene.id) ?? 0;
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

        <span className="text-xs text-muted font-mono w-5 text-right flex-shrink-0 select-none">
          {String(index + 1).padStart(2, "0")}
        </span>

        <span
          className={`flex-1 text-sm min-w-0 whitespace-nowrap ${
            isSelected
              ? "text-light font-medium"
              : "text-muted group-hover:text-light"
          }`}
          title={scene.title}
        >
          {scene.title}
        </span>

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
          {scene.setPiece?.trim() && (
            <div className="inline-flex items-center justify-center min-w-[4.5rem] text-[10px] uppercase tracking-[0.16em] text-accent-cyan/70 border border-accent-cyan/30 rounded px-1.5 py-0.5">
              <button
                type="button"
                onClick={(e) => handleClearSetPiece(scene.id, e)}
                className="inline-flex w-full items-center justify-center text-accent-cyan/70 hover:text-accent-cyan leading-none"
                title="Remove scene from set piece"
                aria-label="Remove scene from set piece"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => handleMove(scene.id, -1, e)}
            disabled={index === 0}
            className="text-muted hover:text-light disabled:opacity-20 p-0.5 rounded transition-colors"
            title="Move up"
          >
            <ChevronUp size={13} />
          </button>
          <button
            onClick={(e) => handleMove(scene.id, 1, e)}
            disabled={index === renderedScenes.length - 1}
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
  };

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
          onClick={handleBulkSetPiece}
          className="text-xs text-accent-cyan hover:text-accent-cyan/80 transition-colors"
        >
          Set Piece
        </button>
        <button
          onClick={handleBulkDelete}
          className="text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          Delete ({selectedForDelete.size})
        </button>
      </div>

      <div className="space-y-3 overflow-y-auto flex-1">
        {sceneGroups.map((group) =>
          group.label ? (
            <div
              key={group.key}
              className="border border-border/60 rounded-xl bg-background/30 overflow-hidden"
            >
              <div className="px-3 py-2 border-b border-border/60 bg-white/5">
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted">
                  Set Piece
                </div>
                {onOpenSetPiece ? (
                  <button
                    type="button"
                    onClick={() => onOpenSetPiece(group.scenes[0])}
                    className="text-left text-sm font-semibold text-light hover:text-accent-cyan transition-colors"
                    title={`Open set piece ${group.label} in fullscreen screenplay view`}
                  >
                    {group.label}
                  </button>
                ) : (
                  <div className="text-sm font-semibold text-light">
                    {group.label}
                  </div>
                )}
                <div className="text-[11px] text-muted mt-0.5">
                  {group.scenes.length} scene
                  {group.scenes.length !== 1 ? "s" : ""}
                </div>
              </div>
              <div className="space-y-0.5 p-1.5">
                {group.scenes.map((scene) => renderSceneRow(scene))}
              </div>
            </div>
          ) : (
            <div key={group.key} className="space-y-0.5">
              {group.scenes.map((scene) => renderSceneRow(scene))}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
