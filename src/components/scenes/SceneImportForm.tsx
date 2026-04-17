"use client";

import React, { useState } from "react";
import { useScenes } from "@/contexts/SceneContext";
import { useVoice } from "@/contexts/VoiceContext";
import { createScenesFromInput, detectSceneCount, extractSceneCharacters, extractCastNames, SceneInputMode } from "@/lib/scenes";
import { Button } from "@/components/ui/Button";

interface SceneImportFormProps {
  projectId: string;
  onSuccess?: () => void;
}

interface ScenePreview {
  title: string;
  contentPreview: string;
  fullContent: string;
  characters: string[];
  deleted?: boolean;
}

export function SceneImportForm({
  projectId,
  onSuccess,
}: SceneImportFormProps) {
  const { createScenes } = useScenes();
  const { importCastCharacters, getProjectCharacters } = useVoice();
  const [selectedTab, setSelectedTab] = useState<"paste" | "upload">("paste");
  const [pastedText, setPastedText] = useState("");
  const [inputMode, setInputMode] = useState<SceneInputMode>("auto");
  const [preview, setPreview] = useState<ScenePreview[]>([]);
  const [editingIndices, setEditingIndices] = useState<Set<number>>(new Set());
  const [editingTitles, setEditingTitles] = useState<Map<number, string>>(new Map());
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState<Map<number, string>>(new Map());
  const [editingCharacters, setEditingCharacters] = useState<Map<number, string[]>>(new Map());
  const [newCharInput, setNewCharInput] = useState<string>("");
  const [selectedForDelete, setSelectedForDelete] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [detectedSceneCount, setDetectedSceneCount] = useState<number>(0);
  const [castNames, setCastNames] = useState<string[]>([]);

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

      // Extract known cast from the full text (if a cast page exists),
      // falling back to the project's existing cast page characters.
      let cast = extractCastNames(text);
      if (cast.length === 0) {
        cast = getProjectCharacters(projectId).map((c) => c.characterName);
      }
      setCastNames(cast);

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
          characters: extractSceneCharacters(scene.content, cast),
          deleted: false,
        }))
      );
      
      // Clear editing state
      setEditingIndices(new Set());
      setEditingTitles(new Map());
      setExpandedIndex(null);
      setEditingContent(new Map());
      setEditingCharacters(new Map());
      setNewCharInput("");
      setSelectedForDelete(new Set());
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
      const name = file.name.toLowerCase();

      if (name.endsWith(".txt")) {
        const text = await file.text();
        handleParseText(text);
        return;
      }

      if (name.endsWith(".pdf")) {
        const form = new FormData();
        form.append("file", file);

        const res = await fetch("/api/parse-pdf", {
          method: "POST",
          body: form,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? "Failed to parse PDF");
        }

        handleParseText(data.text as string);
        return;
      }

      throw new Error("Only .txt and .pdf files are supported");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
      setPreview([]);
      setDetectedSceneCount(0);
    } finally {
      setIsLoading(false);
      if (e.currentTarget) {
        e.currentTarget.value = "";
      }
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
    setError(null);
  };

  const handleTitleChange = (index: number, newTitle: string) => {
    const newTitles = new Map(editingTitles);
    newTitles.set(index, newTitle);
    setEditingTitles(newTitles);
  };

  const handleDeleteScene = (index: number) => {
    const newPreview = [...preview];
    newPreview[index].deleted = true;
    setPreview(newPreview);
  };

  const handleRestoreScene = (index: number) => {
    const newPreview = [...preview];
    newPreview[index].deleted = false;
    setPreview(newPreview);
  };

  const handleToggleSelectForDelete = (index: number) => {
    const newSelected = new Set(selectedForDelete);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedForDelete(newSelected);
  };

  const handleSelectAllForDelete = () => {
    const activeIndices = preview
      .map((s, i) => (!s.deleted ? i : -1))
      .filter((i) => i !== -1);
    const allSelected = activeIndices.every((i) => selectedForDelete.has(i));
    if (allSelected) {
      setSelectedForDelete(new Set());
    } else {
      setSelectedForDelete(new Set(activeIndices));
    }
  };

  const handleBulkDelete = () => {
    if (selectedForDelete.size === 0) return;
    const newPreview = [...preview];
    for (const index of selectedForDelete) {
      newPreview[index].deleted = true;
    }
    setPreview(newPreview);
    setSelectedForDelete(new Set());
  };

  const handleExpandContent = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
    if (!editingContent.has(index)) {
      const newEditingContent = new Map(editingContent);
      newEditingContent.set(index, preview[index].fullContent);
      setEditingContent(newEditingContent);
    }
    if (!editingCharacters.has(index)) {
      const newEditingChars = new Map(editingCharacters);
      newEditingChars.set(index, [...preview[index].characters]);
      setEditingCharacters(newEditingChars);
    }
    setNewCharInput("");
  };

  const handleSaveContent = (index: number) => {
    const newContent = editingContent.get(index)?.trim();
    if (!newContent) {
      setError("Scene content cannot be empty");
      return;
    }

    const newPreview = [...preview];
    newPreview[index].fullContent = newContent;
    newPreview[index].contentPreview = newContent.substring(0, 200).replace(/\n/g, " ") + "...";
    newPreview[index].characters = editingCharacters.get(index) ?? extractSceneCharacters(newContent, castNames);
    setPreview(newPreview);
    setExpandedIndex(null);
    setNewCharInput("");
    setError(null);
  };

  const handleCancelContentEdit = () => {
    setExpandedIndex(null);
  };

  const handleCreateScenes = async () => {
    setError(null);
    setIsCreating(true);

    try {
      const scenesToCreate = preview.filter(scene => !scene.deleted);
      if (scenesToCreate.length === 0) {
        throw new Error("No scenes to create (all scenes were deleted)");
      }

      // Use batch createScenes method to create all scenes at once,
      // including the final (possibly edited) character lists per scene.
      const finalScenes = scenesToCreate.map((scene, i) => {
        // Find the original index in the full preview to get edited characters
        const originalIndex = preview.indexOf(scene);
        const chars = editingCharacters.get(originalIndex) ?? scene.characters;
        return {
          title: scene.title,
          content: scene.fullContent,
          characters: chars,
        };
      });

      createScenes(projectId, finalScenes);

      // Auto-populate cast page: collect all unique characters across scenes
      const allCharacters = new Set<string>();
      for (const scene of finalScenes) {
        if (scene.characters) {
          for (const c of scene.characters) allCharacters.add(c);
        }
      }
      // Also include any names from the cast page in the script
      for (const name of castNames) allCharacters.add(name);

      if (allCharacters.size > 0) {
        importCastCharacters(projectId, Array.from(allCharacters));
      }

      setPastedText("");
      setPreview([]);
      setEditingIndices(new Set());
      setEditingTitles(new Map());
      setExpandedIndex(null);
      setEditingContent(new Map());
      setEditingCharacters(new Map());
      setNewCharInput("");
      setSelectedForDelete(new Set());
      setDetectedSceneCount(0);
      setCastNames([]);
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
    setExpandedIndex(null);
    setEditingContent(new Map());
    setEditingCharacters(new Map());
    setNewCharInput("");
    setSelectedForDelete(new Set());
    setCastNames([]);
  };

  const activeScenesCount = preview.filter(s => !s.deleted).length;

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
                accept=".txt,.pdf"
                onChange={handleFileUpload}
                disabled={isLoading}
                className="hidden"
              />
              <div className="space-y-2">
                <div className="text-4xl">📄</div>
                <p className="text-light font-semibold">
                  {isLoading ? "Parsing…" : "Click to upload a script file"}
                </p>
                <p className="text-muted text-sm">
                  Supports <strong>.pdf</strong> and <strong>.txt</strong>
                </p>
                <p className="text-muted text-xs">
                  Note: PDFs must have a selectable text layer. Image-based or
                  print-locked PDFs cannot be parsed automatically.
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
          <div className="flex items-center justify-between">
            <h3 className="text-light font-semibold">
              Preview ({preview.length} scene{preview.length !== 1 ? "s" : ""})
              {inputMode !== "auto" && (
                <span className="text-muted text-sm ml-2 capitalize">
                  (mode: {inputMode})
                </span>
              )}
            </h3>
            <div className="flex items-center gap-3">
              {selectedForDelete.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1 bg-red-500/20 text-red-400 text-sm rounded hover:bg-red-500/30 transition-colors"
                >
                  Delete Selected ({selectedForDelete.size})
                </button>
              )}
              <label className="flex items-center gap-2 text-sm text-muted cursor-pointer hover:text-light transition-colors">
                <input
                  type="checkbox"
                  checked={
                    preview.some((s) => !s.deleted) &&
                    preview.every((s, i) => s.deleted || selectedForDelete.has(i))
                  }
                  onChange={handleSelectAllForDelete}
                  className="accent-accent-cyan"
                />
                Select All
              </label>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {preview.map((scene, index) => (
              <div
                key={index}
                className={`p-4 rounded border space-y-3 transition-all ${
                  scene.deleted
                    ? "bg-red-500/10 border-red-500/50 opacity-60"
                    : "bg-background border-border"
                }`}
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
                      <div className="flex items-center gap-2">
                        {!scene.deleted && (
                          <input
                            type="checkbox"
                            checked={selectedForDelete.has(index)}
                            onChange={() => handleToggleSelectForDelete(index)}
                            className="accent-accent-cyan"
                          />
                        )}
                        <p
                          className={`font-semibold ${
                            scene.deleted ? "text-muted line-through" : "text-light"
                          }`}
                        >
                          {scene.title}
                        </p>
                      </div>
                      {!scene.deleted && (
                        <button
                          onClick={() => handleStartEditTitle(index)}
                          className="text-muted text-xs hover:text-accent-cyan transition-colors"
                        >
                          Edit Title
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Content Preview / Edit Section */}
                {expandedIndex === index ? (
                  <div className="space-y-2 border-t border-border pt-3">
                    <textarea
                      value={editingContent.get(index) ?? scene.fullContent}
                      onChange={(e) => {
                        const newEditingContent = new Map(editingContent);
                        newEditingContent.set(index, e.target.value);
                        setEditingContent(newEditingContent);
                      }}
                      rows={8}
                      className="w-full bg-background border border-accent-cyan rounded px-2 py-1 text-light focus:outline-none font-mono text-sm resize-vertical"
                    />

                    {/* Editable character list */}
                    {(() => {
                      const chars = editingCharacters.get(index) ?? scene.characters;
                      return (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted">Characters:</span>
                            <button
                              onClick={() => {
                                const currentContent = editingContent.get(index) ?? scene.fullContent;
                                const autoChars = extractSceneCharacters(currentContent, castNames);
                                const newEditingChars = new Map(editingCharacters);
                                newEditingChars.set(index, autoChars);
                                setEditingCharacters(newEditingChars);
                              }}
                              className="text-xs text-muted hover:text-accent-cyan transition-colors"
                              title="Re-scan content for characters"
                            >
                              ↻ Re-scan
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {chars.map((char) => (
                              <span
                                key={char}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-cyan/15 text-accent-cyan text-xs rounded"
                              >
                                {char}
                                <button
                                  onClick={() => {
                                    const updated = chars.filter((c) => c !== char);
                                    const newEditingChars = new Map(editingCharacters);
                                    newEditingChars.set(index, updated);
                                    setEditingCharacters(newEditingChars);
                                  }}
                                  className="text-red-400 hover:text-red-300 font-bold leading-none"
                                  title={`Remove ${char}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={newCharInput}
                              onChange={(e) => setNewCharInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && newCharInput.trim()) {
                                  e.preventDefault();
                                  const name = newCharInput.trim().toUpperCase();
                                  if (!chars.includes(name)) {
                                    const newEditingChars = new Map(editingCharacters);
                                    newEditingChars.set(index, [...chars, name].sort());
                                    setEditingCharacters(newEditingChars);
                                  }
                                  setNewCharInput("");
                                }
                              }}
                              placeholder="Add character..."
                              className="flex-1 bg-background border border-border rounded px-2 py-0.5 text-xs text-light placeholder-muted focus:outline-none focus:border-accent-cyan"
                            />
                            <button
                              onClick={() => {
                                if (newCharInput.trim()) {
                                  const name = newCharInput.trim().toUpperCase();
                                  if (!chars.includes(name)) {
                                    const newEditingChars = new Map(editingCharacters);
                                    newEditingChars.set(index, [...chars, name].sort());
                                    setEditingCharacters(newEditingChars);
                                  }
                                  setNewCharInput("");
                                }
                              }}
                              className="px-2 py-0.5 bg-accent-cyan/20 text-accent-cyan text-xs rounded hover:bg-accent-cyan/30 transition-colors"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveContent(index)}
                        className="px-3 py-1 bg-accent-cyan/20 text-accent-cyan rounded text-sm hover:bg-accent-cyan/30 transition-colors"
                      >
                        Save Content
                      </button>
                      <button
                        onClick={handleCancelContentEdit}
                        className="px-3 py-1 bg-border text-muted rounded text-sm hover:bg-border/50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Content Preview */}
                    <p className="text-muted text-sm">{scene.contentPreview}</p>

                    {/* Content Stats */}
                    <p className="text-muted text-xs">
                      {scene.fullContent.split("\n").length} lines •{" "}
                      {Math.ceil(scene.fullContent.length / 5)} words
                    </p>

                    {/* Characters */}
                    {scene.characters.length > 0 && (
                      <div className="text-xs">
                        <span className="text-muted">Characters: </span>
                        <span className="text-accent-cyan">
                          {scene.characters.join(", ")}
                        </span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {!scene.deleted && (
                      <div className="flex gap-2 pt-2 border-t border-border">
                        <button
                          onClick={() => handleExpandContent(index)}
                          className="flex-1 px-3 py-1 bg-border text-muted text-sm rounded hover:bg-accent-cyan/20 hover:text-accent-cyan transition-colors"
                        >
                          Edit Content
                        </button>
                        <button
                          onClick={() => handleDeleteScene(index)}
                          className="px-3 py-1 bg-red-500/20 text-red-400 text-sm rounded hover:bg-red-500/30 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                    {scene.deleted && (
                      <div className="pt-2 border-t border-border">
                        <button
                          onClick={() => handleRestoreScene(index)}
                          className="w-full px-3 py-1 bg-accent-cyan/20 text-accent-cyan text-sm rounded hover:bg-accent-cyan/30 transition-colors"
                        >
                          Restore
                        </button>
                      </div>
                    )}
                  </>
                )}
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
              disabled={isCreating || activeScenesCount === 0}
            >
              {isCreating
                ? "Creating..."
                : `Create ${activeScenesCount} Scene${activeScenesCount !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
