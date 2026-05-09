"use client";

import React, { useEffect, useState } from "react";
import {
  extractSceneCharacters,
  getSceneParseFormat,
  normalizeSceneContent,
  reflowWrappedText,
} from "@/lib/scenes";
import { parseDialogueLines } from "@/lib/rehearsal";
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
  productionType,
  onClose,
}: SceneEditorProps) {
  const { updateScene } = useScenes();
  const [title, setTitle] = useState(scene.title);
  const [content, setContent] = useState(() =>
    normalizeSceneContent(scene.content),
  );
  const [description, setDescription] = useState(() =>
    scene.description ? reflowWrappedText(scene.description) : "",
  );
  const [setPiece, setSetPiece] = useState(() => scene.setPiece ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTitle(scene.title);
    setContent(normalizeSceneContent(scene.content));
    setDescription(
      scene.description ? reflowWrappedText(scene.description) : "",
    );
    setSetPiece(scene.setPiece ?? "");
  }, [scene, productionType]);

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);

    try {
      console.log("[SceneEditor] save started", {
        sceneId: scene.id,
        titleLength: title.length,
        contentLength: content.length,
      });
      const trimmedTitle = title.trim();
      const normalizedContent = normalizeSceneContent(content);
      const trimmedContent = normalizedContent.trim();
      const rawContent = normalizedContent;

      if (!trimmedTitle) {
        throw new Error("Scene title cannot be empty");
      }
      if (!trimmedContent) {
        throw new Error("Scene content cannot be empty");
      }

      // Preserve the existing curated cast while refreshing the parse from the
      // updated content so rehearsal views keep the same speaker resolution.
      const detectedCharacters = extractSceneCharacters(
        rawContent,
        undefined,
        productionType,
      ).map((character) => character.toUpperCase());
      const existingCharacters = (scene.characters ?? []).map((character) =>
        character.toUpperCase(),
      );
      const characters = Array.from(
        new Set([...existingCharacters, ...detectedCharacters]),
      ).sort();
      console.log("[SceneEditor] parsing scene content", {
        sceneId: scene.id,
        characterCount: characters.length,
        productionType: productionType ?? null,
      });
      const lines = parseDialogueLines(
        rawContent,
        getSceneParseFormat(productionType),
        characters,
      );
      console.log("[SceneEditor] parse complete", {
        sceneId: scene.id,
        lineCount: lines.length,
      });

      console.log("[SceneEditor] updating scene", {
        sceneId: scene.id,
        characterCount: characters.length,
        lineCount: lines.length,
      });
      updateScene(scene.id, {
        title: trimmedTitle,
        content: rawContent,
        description: description.trim() || undefined,
        setPiece: setPiece.trim() || undefined,
        characters,
        lines,
      });

      console.log("[SceneEditor] save finished", { sceneId: scene.id });

      onClose?.();
    } catch (err) {
      console.log("[SceneEditor] save failed", {
        sceneId: scene.id,
        error: err instanceof Error ? err.message : String(err),
      });
      setError(err instanceof Error ? err.message : "Failed to save scene");
    } finally {
      setIsSaving(false);
    }
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
