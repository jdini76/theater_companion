"use client";

import React, { useState } from "react";
import { Scene } from "@/types/scene";
import { useScenes } from "@/contexts/SceneContext";
import { SceneImportForm } from "./SceneImportForm";
import { SceneList } from "./SceneList";
import { SceneViewer } from "./SceneViewer";
import { SceneEditor } from "./SceneEditor";
import { Button } from "@/components/ui/Button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SceneManagerProps {
  projectId: string;
  projectName?: string;
}

export function SceneManager({
  projectId,
  projectName = "Project",
}: SceneManagerProps) {
  const { getProjectScenes } = useScenes();
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [isEditingScene, setIsEditingScene] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const scenes = getProjectScenes(projectId);
  const selectedScene = selectedSceneId
    ? (scenes.find((s) => s.id === selectedSceneId) ?? null)
    : null;

  const handleSelectScene = (scene: Scene) => {
    setSelectedSceneId(scene.id);
    setIsEditingScene(false);
    setSidebarCollapsed(true);
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
      <div className="flex gap-4 items-stretch" style={{ minHeight: "calc(100vh - 14rem)" }}>
        {/* Sidebar */}
        <div className={`flex-shrink-0 flex flex-col transition-all duration-200 ${sidebarCollapsed ? "w-8" : "w-72"}`}>
          <div className="card flex flex-col flex-1 overflow-hidden relative">
            {/* Collapse toggle */}
            <button
              onClick={handleToggleSidebar}
              className="absolute top-3 right-2 z-10 p-0.5 rounded hover:bg-white/10 text-muted hover:text-light transition-colors"
              aria-label={sidebarCollapsed ? "Expand scene list" : "Collapse scene list"}
            >
              {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            {!sidebarCollapsed && (
              <div className="flex flex-col flex-1 p-2 overflow-hidden">
                <div className="flex items-center justify-between mb-2 flex-shrink-0 pr-5">
                  <span className="text-xs font-semibold text-muted uppercase tracking-widest">
                    Scenes
                  </span>
                  <span className="text-xs text-muted tabular-nums">
                    {scenes.length}
                  </span>
                </div>
                <SceneList
                  projectId={projectId}
                  selectedSceneId={selectedSceneId}
                  onSelectScene={handleSelectScene}
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
