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

export function SceneManager({
  projectId,
  projectName = "Project",
}: SceneManagerProps) {
  const { getProjectScenes } = useScenes();
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [isEditingScene, setIsEditingScene] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);

  const scenes = getProjectScenes(projectId);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-bold text-light mb-2">Scenes</h1>
            <p className="text-muted">
              Manage scenes for <span className="text-accent-cyan">{projectName}</span>
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => setShowImportForm(!showImportForm)}
          >
            {showImportForm ? "Hide Form" : "+ Import Scenes"}
          </Button>
        </div>

        {showImportForm && (
          <div className="mb-8">
            <SceneImportForm
              projectId={projectId}
              onSuccess={() => setShowImportForm(false)}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scenes List */}
        <div className="lg:col-span-1">
          <div className="card">
            <h2 className="text-2xl font-semibold text-light mb-6">
              Scenes ({scenes.length})
            </h2>
            <SceneList
              projectId={projectId}
              onSelectScene={(scene) => {
                setSelectedScene(scene);
                setIsEditingScene(false);
              }}
            />
          </div>
        </div>

        {/* Scene View/Edit */}
        <div className="lg:col-span-2">
          {selectedScene && isEditingScene ? (
            <SceneEditor
              scene={selectedScene}
              onClose={() => setIsEditingScene(false)}
            />
          ) : selectedScene ? (
            <SceneViewer
              scene={selectedScene}
              onEdit={() => setIsEditingScene(true)}
            />
          ) : (
            <div className="card text-center py-12">
              <p className="text-muted text-lg">Select a scene to view</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
