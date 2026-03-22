"use client";

import React, { useState } from "react";
import { Scene } from "@/types/scene";
import { useScenes } from "@/contexts/SceneContext";
import { Button } from "@/components/ui/Button";

interface SceneListProps {
  projectId: string;
  onSelectScene?: (scene: Scene) => void;
}

export function SceneList({
  projectId,
  onSelectScene,
}: SceneListProps) {
  const { getProjectScenes, deleteScene } = useScenes();
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

  const scenes = getProjectScenes(projectId);

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
    }
  };

  const handleSelectScene = (scene: Scene) => {
    setSelectedSceneId(scene.id);
    onSelectScene?.(scene);
  };

  return (
    <div className="space-y-3">
      {scenes.map((scene) => (
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
            <div className="flex-1">
              <h3 className="text-light font-semibold">
                Scene {scene.order + 1}: {scene.title}
              </h3>
              {scene.description && (
                <p className="text-muted text-sm mt-1">{scene.description}</p>
              )}
              <p className="text-muted text-xs mt-2">
                {scene.content.split("\n").length} lines •{" "}
                {Math.ceil(scene.content.length / 5)} words
              </p>
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
      ))}
    </div>
  );
}
