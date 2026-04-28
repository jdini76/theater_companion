"use client";

import React, { useState } from "react";
import { extractSceneCharacters } from "@/lib/scenes";
import { Scene } from "@/types/scene";
import { useScenes } from "@/contexts/SceneContext";
import { Button } from "@/components/ui/Button";

interface SceneEditorProps {
  scene: Scene;
  onClose?: () => void;
}

export function SceneEditor({ scene, onClose }: SceneEditorProps) {
  const { updateScene } = useScenes();
  const [title, setTitle] = useState(scene.title);
  const [content, setContent] = useState(scene.content);
  const [description, setDescription] = useState(scene.description || "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);

    try {
      if (!title.trim()) {
        throw new Error("Scene title cannot be empty");
      }
      if (!content.trim()) {
        throw new Error("Scene content cannot be empty");
      }

      // Automatically reparse characters from the updated content
      const characters = extractSceneCharacters(content.trim());

      updateScene(scene.id, {
        title: title.trim(),
        content: content.trim(),
        description: description.trim() || undefined,
        characters,
      });

      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save scene");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="card space-y-6">
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
        <label className="block text-light font-semibold mb-2">Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={15}
          className="w-full bg-background border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan font-mono text-sm resize-vertical"
          placeholder="Scene content"
        />
      </div>

      <div className="flex gap-3 justify-end">
        {onClose && (
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
        )}
        <Button variant="primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
