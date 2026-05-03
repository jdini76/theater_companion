"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Scene } from "@/types/scene";
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
  initialSceneId?: string | null;
  onSceneNavigated?: () => void;
}

export function SceneManager({
  projectId,
  projectName = "Project",
  initialSceneId,
  onSceneNavigated,
}: SceneManagerProps) {
  const { getProjectScenes } = useScenes();
  const { getProjectCharacters } = useVoice();
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [isEditingScene, setIsEditingScene] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [onlyMyScenes, setOnlyMyScenes] = useLocalStorage(
    "theater_scene_list_only_my",
    false,
  );
  const [searchQuery, setSearchQuery] = useState("");

  // When a navigation request arrives, select that scene and collapse sidebar
  useEffect(() => {
    if (initialSceneId) {
      setSelectedSceneId(initialSceneId);
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
      names.add(c.characterName.toUpperCase());
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
      map.set(
        scene.id,
        scene.characters ?? extractSceneCharacters(scene.content, cast),
      );
    }
    return map;
  }, [allScenes, projectCharacters]);

  const scenes = useMemo(() => {
    let result = allScenes;
    if (onlyMyScenes && hasMyRole) {
      result = result.filter((scene) => {
        const chars = sceneCharacters.get(scene.id) ?? [];
        return chars.some((c) => myRoleNames.has(c.toUpperCase()));
      });
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
    sceneCharacters,
    myRoleNames,
    searchQuery,
  ]);

  const selectedScene = selectedSceneId
    ? (allScenes.find((s) => s.id === selectedSceneId) ?? null)
    : null;
  const selectedIndex = selectedSceneId
    ? scenes.findIndex((s) => s.id === selectedSceneId)
    : -1;

  const handleSelectScene = (scene: Scene) => {
    setSelectedSceneId(scene.id);
    setIsEditingScene(false);
    setSidebarCollapsed(true);
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
          className={`flex-shrink-0 flex flex-col transition-all duration-200 ${sidebarCollapsed ? "w-8" : "w-[32rem]"}`}
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
                <SceneList
                  projectId={projectId}
                  filteredScenes={scenes}
                  selectedSceneId={selectedSceneId}
                  onSelectScene={handleSelectScene}
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
              onClose={() => setIsEditingScene(false)}
            />
          ) : selectedScene ? (
            <SceneViewer
              scene={selectedScene}
              projectId={projectId}
              onEdit={() => setIsEditingScene(true)}
              onPrev={handlePrevScene}
              onNext={handleNextScene}
              hasPrev={selectedIndex > 0}
              hasNext={selectedIndex >= 0 && selectedIndex < scenes.length - 1}
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
