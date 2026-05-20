"use client";

import React, { useEffect, useState } from "react";
import { reflowWrappedText } from "@/lib/scenes";
import { Scene } from "@/types/scene";
import type { ProductionType } from "@/types/project";
import { useScenes } from "@/contexts/SceneContext";
import { Button } from "@/components/ui/Button";

interface SceneEditorProps {
  scene: Scene;
  productionType?: ProductionType;
  onClose?: () => void;
}

export function SceneEditor({
  scene,
  productionType: _productionType,
  onClose,
}: SceneEditorProps) {
  const { updateScene } = useScenes();
  const [title, setTitle] = useState(scene.title);
  const [description, setDescription] = useState(() =>
    scene.description ? reflowWrappedText(scene.description) : "",
  );
  const [setPiece, setSetPiece] = useState(() => scene.setPiece ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(scene.title);
    setDescription(
      scene.description ? reflowWrappedText(scene.description) : "",
    );
    setSetPiece(scene.setPiece ?? "");
  }, [scene]);

  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Scene title cannot be empty");
      return;
    }
    setError(null);
    updateScene(scene.id, {
      title: trimmedTitle,
      description: description.trim() || undefined,
      setPiece: setPiece.trim() || undefined,
    });
    onClose?.();
  };

  return (
    <div className="card flex flex-col flex-1 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-light">Edit Scene</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted hover:text-light text-2xl"
          >
            ×
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-light font-semibold mb-2">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-background border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan"
          placeholder="Scene title"
        />
      </div>

      <div>
        <label className="block text-light font-semibold mb-2">
          Description (optional)
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-background border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan"
          placeholder="Scene description"
        />
      </div>

      <div>
        <label className="block text-light font-semibold mb-2">
          Set Piece (optional)
        </label>
        <input
          type="text"
          value={setPiece}
          onChange={(e) => setSetPiece(e.target.value)}
          className="w-full bg-background border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan"
          placeholder="Group name for related scenes"
        />
      </div>

      <div className="flex gap-3 justify-end">
        {onClose && (
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        )}
        <Button variant="primary" onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
}
