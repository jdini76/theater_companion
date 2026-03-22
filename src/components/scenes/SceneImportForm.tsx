"use client";

import React, { useState } from "react";
import { useScenes } from "@/contexts/SceneContext";
import { createScenesFromInput } from "@/lib/scenes";
import { Button } from "@/components/ui/Button";

interface SceneImportFormProps {
  projectId: string;
  onSuccess?: () => void;
}

interface ScenePreview {
  title: string;
  contentPreview: string;
  fullContent: string;
}

export function SceneImportForm({
  projectId,
  onSuccess,
}: SceneImportFormProps) {
  const { createScene } = useScenes();
  const [selectedTab, setSelectedTab] = useState<"paste" | "upload">("paste");
  const [pastedText, setPastedText] = useState("");
  const [preview, setPreview] = useState<ScenePreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleParseText = (text: string) => {
    setError(null);
    if (!text.trim()) {
      setError("Please enter some text");
      setPreview([]);
      return;
    }

    try {
      const scenes = createScenesFromInput(projectId, text);
      if (scenes.length === 0) {
        setError("No content to parse");
        setPreview([]);
        return;
      }

      setPreview(
        scenes.map((scene) => ({
          title: scene.title,
          contentPreview: scene.content.substring(0, 200).replace(/\n/g, " ") + "...",
          fullContent: scene.content,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse text");
      setPreview([]);
    }
  };

  const handlePasteInput = () => {
    handleParseText(pastedText);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    setError(null);
    setIsLoading(true);

    try {
      if (!file.name.endsWith(".txt")) {
        throw new Error("Only .txt files are supported");
      }

      const text = await file.text();
      handleParseText(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
      setPreview([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateScenes = async () => {
    setError(null);
    setIsCreating(true);

    try {
      if (preview.length === 0) {
        throw new Error("No scenes to create");
      }

      for (const scene of preview) {
        createScene(projectId, scene.title, scene.fullContent);
      }

      setPastedText("");
      setPreview([]);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create scenes");
    } finally {
      setIsCreating(false);
    }
  };

  const handleClear = () => {
    setPastedText("");
    setPreview([]);
    setError(null);
  };

  return (
    <div className="card space-y-6">
      <h2 className="text-2xl font-bold text-light">Import Scenes</h2>

      {/* Tab Switch */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => {
            setSelectedTab("paste");
            handleClear();
          }}
          className={`px-4 py-2 font-semibold transition-colors ${
            selectedTab === "paste"
              ? "text-accent-cyan border-b-2 border-accent-cyan"
              : "text-muted hover:text-light"
          }`}
        >
          Paste Text
        </button>
        <button
          onClick={() => {
            setSelectedTab("upload");
            handleClear();
          }}
          className={`px-4 py-2 font-semibold transition-colors ${
            selectedTab === "upload"
              ? "text-accent-cyan border-b-2 border-accent-cyan"
              : "text-muted hover:text-light"
          }`}
        >
          Upload File
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded">
          {error}
        </div>
      )}

      {/* Paste Tab */}
      {selectedTab === "paste" && (
        <div className="space-y-4">
          <div>
            <label className="block text-light font-semibold mb-2">
              Paste your scene(s)
            </label>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder={`Paste your scene text here. Supports:
• Single scene: Just paste the text
• Multiple scenes: Use format like "SCENE 1:" or "---" to separate scenes`}
              rows={10}
              className="w-full bg-background border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan font-mono text-sm resize-vertical"
            />
          </div>
          {!preview.length && (
            <Button
              variant="primary"
              onClick={handlePasteInput}
              disabled={!pastedText.trim()}
            >
              Parse Text
            </Button>
          )}
        </div>
      )}

      {/* Upload Tab */}
      {selectedTab === "upload" && (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                disabled={isLoading}
                className="hidden"
              />
              <div className="space-y-2">
                <p className="text-light font-semibold">
                  {isLoading ? "Loading..." : "Click to upload .txt file"}
                </p>
                <p className="text-muted text-sm">
                  or drag and drop
                </p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="space-y-4 border-t border-border pt-6">
          <h3 className="text-light font-semibold">
            Preview ({preview.length} scene{preview.length !== 1 ? "s" : ""})
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {preview.map((scene, index) => (
              <div
                key={index}
                className="p-3 bg-background border border-border rounded"
              >
                <p className="text-light font-semibold">{scene.title}</p>
                <p className="text-muted text-sm mt-1">{scene.contentPreview}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              variant="secondary"
              onClick={handleClear}
              disabled={isCreating}
            >
              Clear
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateScenes}
              disabled={isCreating || preview.length === 0}
            >
              {isCreating
                ? "Creating..."
                : `Create ${preview.length} Scene${preview.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
