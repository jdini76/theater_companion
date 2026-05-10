"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Scene } from "@/types/scene";
import type { ProductionType } from "@/types/project";
import { useScenes } from "@/contexts/SceneContext";
import { useVoice } from "@/contexts/VoiceContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { extractSceneCharacters } from "@/lib/scenes";
import { SceneImportForm } from "./SceneImportForm";
import { SceneList } from "./SceneList";
import { SceneViewer } from "./SceneViewer";
import { SceneEditor } from "./SceneEditor";
import { Button } from "@/components/ui/Button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SceneManagerProps {
  projectId: string;
  projectName?: string;
  productionType?: ProductionType;
  initialSceneId?: string | null;
  onSceneNavigated?: () => void;
}

export function SceneManager({
  projectId,
  projectName = "Project",
  productionType,
  initialSceneId,
  onSceneNavigated,
}: SceneManagerProps) {
  const { getProjectScenes } = useScenes();
  const { getProjectCharacters } = useVoice();
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [sceneOpenMode, setSceneOpenMode] = useState<"scene" | "set-piece">(
    "scene",
  );
  const [isEditingScene, setIsEditingScene] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [fullscreenRequest, setFullscreenRequest] = useState(0);
  const [onlyMyScenes, setOnlyMyScenes] = useLocalStorage(
    "theater_scene_list_only_my",
    false,
  );
  const [hideEmptyScenes, setHideEmptyScenes] = useLocalStorage(
    "theater_scene_list_hide_empty",
    false,
  );
  const [searchQuery, setSearchQuery] = useState("");

  // When a navigation request arrives, select that scene and collapse sidebar
  useEffect(() => {
    if (initialSceneId) {
      setSelectedSceneId(initialSceneId);
      setSceneOpenMode("scene");
      setIsEditingScene(false);
      setSidebarCollapsed(true);
      onSceneNavigated?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSceneId]);

  const allScenes = getProjectScenes(projectId);
  const projectCharacters = getProjectCharacters(projectId);

  const myRoleNames = useMemo(() => {
    const names = new Set<string>();
    for (const c of projectCharacters) {
      if (!c.isMyRole) continue;
      const full = c.characterName.toUpperCase();
      names.add(full);
      // Also add individual words (first/last name) so abbreviated scene
      // characters like "PHIL" match a canonical name like "PHIL CONNORS".
      for (const word of full.split(/\s+/)) names.add(word);
      for (const alias of c.aliases ?? []) names.add(alias.toUpperCase());
    }
    return names;
  }, [projectCharacters]);

  const hasMyRole = myRoleNames.size > 0;

  const sceneCharacters = useMemo(() => {
    const cast =
      projectCharacters.length > 0
        ? projectCharacters.map((c) => c.characterName)
        : undefined;
    const map = new Map<string, string[]>();
    for (const scene of allScenes) {
      // Use pre-parsed lines when available to avoid re-parsing content.
      // Fall back to extractSceneCharacters for scenes without cached lines.
      const lineChars =
        scene.lines && scene.lines.length > 0
          ? Array.from(
              new Set(
                scene.lines
                  .filter(
                    (l) => !l.isStageDirection && !l.character.startsWith("["),
                  )
                  .flatMap((l) =>
                    l.character
                      .split(/\s*[,&+]\s*/)
                      .map((n) => n.trim().toUpperCase())
                      .filter(Boolean),
                  ),
              ),
            )
          : extractSceneCharacters(scene.content, cast, productionType).map(
              (n) => n.toUpperCase(),
            );
      const stored = (scene.characters ?? []).map((n) => n.toUpperCase());
      map.set(scene.id, Array.from(new Set([...lineChars, ...stored])));
    }
    return map;
  }, [allScenes, projectCharacters, productionType]);

  const scenes = useMemo(() => {
    let result = allScenes;
    if (onlyMyScenes && hasMyRole) {
      result = result.filter((scene) => {
        const chars = sceneCharacters.get(scene.id) ?? [];
        return chars.some((c) => myRoleNames.has(c.toUpperCase()));
      });
    }
    if (hideEmptyScenes) {
      result = result.filter(
        (scene) => (sceneCharacters.get(scene.id) ?? []).length > 0,
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((scene) => scene.title.toLowerCase().includes(q));
    }
    return result;
  }, [
    allScenes,
    onlyMyScenes,
    hasMyRole,
    hideEmptyScenes,
    sceneCharacters,
    myRoleNames,
    searchQuery,
  ]);

  useEffect(() => {
    if (!selectedSceneId) return;
    if (scenes.some((scene) => scene.id === selectedSceneId)) return;
    setSelectedSceneId(scenes[0]?.id ?? null);
  }, [scenes, selectedSceneId]);

  const selectedScene = selectedSceneId
    ? (scenes.find((s) => s.id === selectedSceneId) ?? null)
    : null;
  const selectedIndex = selectedSceneId
    ? scenes.findIndex((s) => s.id === selectedSceneId)
    : -1;

  const handleSelectScene = (scene: Scene) => {
    setSelectedSceneId(scene.id);
    setSceneOpenMode("scene");
    setIsEditingScene(false);
    setSidebarCollapsed(true);
  };

  const handleOpenSetPiece = (scene: Scene) => {
    setSelectedSceneId(scene.id);
    setSceneOpenMode("set-piece");
    setIsEditingScene(false);
    setSidebarCollapsed(true);
    setFullscreenRequest((value) => value + 1);
  };

  const handlePrevScene = () => {
    if (selectedIndex > 0) {
      handleSelectScene(scenes[selectedIndex - 1]);
    }
  };

  const handleNextScene = () => {
    if (selectedIndex >= 0 && selectedIndex < scenes.length - 1) {
      handleSelectScene(scenes[selectedIndex + 1]);
    }
  };

  const handleToggleSidebar = () => {
    setSidebarCollapsed((v) => {
      if (v) setSelectedSceneId(null); // expanding → clear scene
      return !v;
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4">
      {/* Page header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-light">Scenes</h1>
          <p className="text-muted text-sm mt-1">{projectName}</p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowImportForm(!showImportForm)}
        >
          {showImportForm ? "Hide Form" : "+ Import Scenes"}
        </Button>
      </div>

      {/* Import form — drops in below the header */}
      {showImportForm && (
        <div className="mb-6">
          <SceneImportForm
            projectId={projectId}
            productionType={productionType}
            onSuccess={() => setShowImportForm(false)}
          />
        </div>
      )}

      {/* Main layout: slim sidebar + wide detail panel */}
      <div
        className="flex gap-4 items-stretch"
        style={{ minHeight: "calc(100vh - 14rem)" }}
      >
        {/* Sidebar */}
        <div
          className={`flex-shrink-0 flex flex-col transition-all duration-200 ${sidebarCollapsed ? "w-8" : "w-[44rem]"}`}
        >
          <div className="card flex flex-col flex-1 overflow-hidden relative">
            {/* Collapse toggle */}
            <button
              onClick={handleToggleSidebar}
              className="absolute top-3 right-2 z-10 p-0.5 rounded hover:bg-white/10 text-muted hover:text-light transition-colors"
              aria-label={
                sidebarCollapsed ? "Expand scene list" : "Collapse scene list"
              }
            >
              {sidebarCollapsed ? (
                <ChevronRight size={14} />
              ) : (
                <ChevronLeft size={14} />
              )}
            </button>

            {!sidebarCollapsed && (
              <div className="flex flex-col flex-1 p-2 overflow-hidden">
                <div className="flex items-center justify-between mb-2 flex-shrink-0 pr-5">
                  <span className="text-xs font-semibold text-muted uppercase tracking-widest">
                    Scenes
                  </span>
                  <span className="text-xs text-muted tabular-nums">
                    {scenes.length}
                    {scenes.length !== allScenes.length
                      ? `/${allScenes.length}`
                      : ""}
                  </span>
                </div>
                {/* Search input */}
                <div className="relative mb-2 flex-shrink-0">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search scenes…"
                    className="w-full bg-bg-input border border-border-dark rounded px-2.5 py-1 text-xs text-light placeholder:text-muted/50 focus:outline-none focus:border-accent-cyan/50"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-light text-sm leading-none"
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>
                <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer hover:text-light mb-2 select-none">
                  <input
                    type="checkbox"
                    checked={hideEmptyScenes}
                    onChange={(e) => setHideEmptyScenes(e.target.checked)}
                    className="accent-accent-cyan w-3.5 h-3.5"
                  />
                  Hide empty scenes
                </label>
                <SceneList
                  projectId={projectId}
                  filteredScenes={scenes}
                  selectedSceneId={selectedSceneId}
                  onSelectScene={handleSelectScene}
                  onOpenSetPiece={handleOpenSetPiece}
                  onlyMyScenes={onlyMyScenes}
                  onOnlyMyScenesChange={setOnlyMyScenes}
                  hasMyRole={hasMyRole}
                />
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 min-w-0 flex flex-col">
          {selectedScene && isEditingScene ? (
            <SceneEditor
              scene={selectedScene}
              productionType={productionType}
              onClose={() => setIsEditingScene(false)}
            />
          ) : selectedScene ? (
            <SceneViewer
              scene={selectedScene}
              projectId={projectId}
              productionType={productionType}
              sceneOpenMode={sceneOpenMode}
              onEdit={() => setIsEditingScene(true)}
              onPrev={handlePrevScene}
              onNext={handleNextScene}
              hasPrev={selectedIndex > 0}
              hasNext={selectedIndex >= 0 && selectedIndex < scenes.length - 1}
              fullscreenOpenToken={fullscreenRequest}
              fullscreenOpenView="screenplay"
            />
          ) : (
            <div className="card flex-1 flex flex-col items-center justify-center text-center py-16">
              <p className="text-muted text-lg mb-2">Select a scene</p>
              <p className="text-muted/60 text-sm">
                {scenes.length === 0
                  ? "Import scenes to get started"
                  : "Choose a scene from the sidebar to view its content"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
