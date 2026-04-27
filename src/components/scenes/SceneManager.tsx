"use client";

import React, { useState } from "react";
import { Scene } from "@/types/scene";
import { useScenes } from "@/contexts/SceneContext";
import { SceneImportForm } from "./SceneImportForm";
import { SceneList } from "./SceneList";
import { SceneViewer } from "./SceneViewer";
import { SceneEditor } from "./SceneEditor";
import { Button } from "@/components/ui/Button";

interface SceneManagerProps {
  projectId: string;
  projectName?: string;
}

export function SceneManager({ projectId, projectName = "Project" }: SceneManagerProps) {
  const { getProjectScenes } = useScenes();
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [isEditingScene, setIsEditingScene] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);

  const scenes = getProjectScenes(projectId);

  const handleSelectScene = (scene: Scene) => {
    setSelectedScene(scene);
    setIsEditingScene(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4">
      {/* Page header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-light">Scenes</h1>
          <p className="text-muted text-sm mt-1">
            {projectName}
          </p>
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
      <div className="flex gap-4" style={{ minHeight: "calc(100vh - 14rem)" }}>
        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 flex flex-col">
          <div className="card flex flex-col flex-1 p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <span className="text-xs font-semibold text-muted uppercase tracking-widest">
                Scenes
              </span>
              <span className="text-xs text-muted tabular-nums">
                {scenes.length}
              </span>
            </div>
            <SceneList
              projectId={projectId}
              selectedSceneId={selectedScene?.id ?? null}
              onSelectScene={handleSelectScene}
            />
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 min-w-0">
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
            <div className="card h-full flex flex-col items-center justify-center text-center py-16">
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
