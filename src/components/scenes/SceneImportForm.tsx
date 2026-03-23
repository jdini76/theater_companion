"use client";

import React, { useState } from "react";
import { useScenes } from "@/contexts/SceneContext";
import { createScenesFromInput, detectSceneCount, SceneInputMode } from "@/lib/scenes";
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
  const [inputMode, setInputMode] = useState<SceneInputMode>("auto");
  const [preview, setPreview] = useState<ScenePreview[]>([]);
  const [editingIndices, setEditingIndices] = useState<Set<number>>(new Set());
  const [editingTitles, setEditingTitles] = useState<Map<number, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [detectedSceneCount, setDetectedSceneCount] = useState<number>(0);

  const handleParseText = (text: string) => {
    setError(null);
    if (!text.trim()) {
      setError("Please enter some text");
      setPreview([]);
      setDetectedSceneCount(0);
      return;
    }

    try {
      // Detect scene count even if in "single" mode to show user info
      const sceneCount = detectSceneCount(text);
      setDetectedSceneCount(sceneCount);

      const scenes = createScenesFromInput(projectId, text, inputMode);
      
      if (scenes.length === 0) {
        setError("No content to parse");
        setPreview([]);
        return;
      }

      // Prepare previews with editable titles
      setPreview(
        scenes.map((scene) => ({
          title: scene.title,
          contentPreview: scene.content.substring(0, 200).replace(/\n/g, " ") + "...",
          fullContent: scene.content,
        }))
      );
      
      // Clear editing state
      setEditingIndices(new Set());
      setEditingTitles(new Map());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse text");
      setPreview([]);
      setDetectedSceneCount(0);
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
      setDetectedSceneCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEditTitle = (index: number) => {
    const newEditing = new Set(editingIndices);
    newEditing.add(index);
    setEditingIndices(newEditing);
    
    // Initialize with current title if not already editing
    if (!editingTitles.has(index)) {
      const newTitles = new Map(editingTitles);
      newTitles.set(index, preview[index].title);
      setEditingTitles(newTitles);
    }
  };

  const handleSaveTitleEdit = (index: number) => {
    const newTitle = editingTitles.get(index)?.trim();
    if (!newTitle) {
      setError("Scene title cannot be empty");
      return;
    }

    const newPreview = [...preview];
    newPreview[index].title = newTitle;
    setPreview(newPreview);

    const newEditing = new Set(editingIndices);
    newEditing.delete(index);
    setEditingIndices(newEditing);
  };

  const handleCancelEditTitle = (index: number) => {
    const newEditing = new Set(editingIndices);
    newEditing.delete(index);
    setEditingIndices(newEditing);
  };

  const handleTitleChange = (index: number, newTitle: string) => {
    const newTitles = new Map(editingTitles);
    newTitles.set(index, newTitle);
    setEditingTitles(newTitles);
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
      setEditingIndices(new Set());
      setEditingTitles(new Map());
      setDetectedSceneCount(0);
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
    setDetectedSceneCount(0);
    setEditingIndices(new Set());
    setEditingTitles(new Map());
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

      {/* Input Mode Selector (visible when no preview) */}
      {preview.length === 0 && (
        <div className="space-y-3">
          <label className="block text-light font-semibold">Input Mode</label>
          <div className="grid grid-cols-3 gap-3">
            {["auto", "single", "multiple"].map((mode) => (
              <button
                key={mode}
                onClick={() => setInputMode(mode as SceneInputMode)}
                className={`p-3 rounded border transition-all capitalize ${
                  inputMode === mode
                    ? "border-accent-cyan bg-accent-cyan/20 text-accent-cyan"
                    : "border-border text-muted hover:border-accent-cyan hover:text-light"
                }`}
              >
                <div className="font-semibold">{mode}</div>
                <div className="text-xs mt-1">
                  {mode === "auto" && "Auto-detect mode"}
                  {mode === "single" && "Single scene only"}
                  {mode === "multiple" && "Detect multiple scenes"}
                </div>
              </button>
            ))}
          </div>
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
• Multiple scenes: Use format like "SCENE 1:", "Scene 2:", "ACT 1 SCENE 1", or "---" separators
• Multiline dialogue: Indent continuation lines`}
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

      {/* Scene Info */}
      {detectedSceneCount > 1 && preview.length === 0 && (
        <div className="p-3 bg-accent-cyan/10 border border-accent-cyan rounded text-accent-cyan text-sm">
          <strong>Detected {detectedSceneCount} scenes</strong> in the input text.
          {inputMode === "single" && " (Single mode selected: will be treated as one scene)"}
        </div>
      )}

      {/* Preview Section */}
      {preview.length > 0 && (
        <div className="space-y-4 border-t border-border pt-6">
          <h3 className="text-light font-semibold">
            Preview ({preview.length} scene{preview.length !== 1 ? "s" : ""})
            {inputMode !== "auto" && (
              <span className="text-muted text-sm ml-2 capitalize">
                (mode: {inputMode})
              </span>
            )}
          </h3>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {preview.map((scene, index) => (
              <div
                key={index}
                className="p-4 bg-background border border-border rounded space-y-3"
              >
                {/* Scene Title - Editable */}
                <div>
                  {editingIndices.has(index) ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editingTitles.get(index) ?? scene.title}
                        onChange={(e) =>
                          handleTitleChange(index, e.target.value)
                        }
                        autoFocus
                        className="flex-1 bg-background border border-accent-cyan rounded px-2 py-1 text-light focus:outline-none"
                      />
                      <button
                        onClick={() => handleSaveTitleEdit(index)}
                        className="px-3 py-1 bg-accent-cyan/20 text-accent-cyan rounded text-sm hover:bg-accent-cyan/30 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => handleCancelEditTitle(index)}
                        className="px-3 py-1 bg-border text-muted rounded text-sm hover:bg-border/50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start">
                      <p className="text-light font-semibold">{scene.title}</p>
                      <button
                        onClick={() => handleStartEditTitle(index)}
                        className="text-muted text-xs hover:text-accent-cyan transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>

                {/* Content Preview */}
                <p className="text-muted text-sm">{scene.contentPreview}</p>

                {/* Content Stats */}
                <p className="text-muted text-xs">
                  {scene.fullContent.split("\n").length} lines •{" "}
                  {Math.ceil(scene.fullContent.length / 5)} words
                </p>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
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
