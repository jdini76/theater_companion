"use client";

import React, { useState } from "react";
import { useScenes } from "@/contexts/SceneContext";
import { useVoice } from "@/contexts/VoiceContext";
import { createScenesFromInput, detectSceneCount, extractSceneCharacters, extractCastNames, parseTOC, findSongsForScene, stripTocSection, SceneInputMode } from "@/lib/scenes";
import type { ParsedToc } from "@/types/scene";
import { extractTextFromPdf } from "@/lib/pdf-client";

// import dynamic from "next/dynamic";
import { Button } from "@/components/ui/Button";
import { OcrUploaderWrapper } from "../common/OcrUploaderWrapper";

interface SceneImportFormProps {
  projectId: string;
  onSuccess?: () => void;
}

type CharacterCategory = "individual" | "group" | "non-character";

interface CastReviewEntry {
  name: string;
  category: CharacterCategory;
}

interface ScenePreview {
  title: string;
  contentPreview: string;
  fullContent: string;
  characters: string[];
  songs: string[];
  deleted?: boolean;
}

export function SceneImportForm({
  projectId,
  onSuccess,
}: SceneImportFormProps) {
  const { createScenes, deleteScenes, getProjectScenes } = useScenes();
  const { importCastCharacters, getProjectCharacters, deleteCharacter } = useVoice();
  const [selectedTab, setSelectedTab] = useState<"paste" | "upload">("paste");
  const [uploadMode, setUploadMode] = useState<"text" | "image">("text");
  const [ocrText, setOcrText] = useState("");
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
  const [tocData, setTocData] = useState<ParsedToc | null>(null);
  const [castReview, setCastReview] = useState<CastReviewEntry[]>([]);
  const [castImportMode, setCastImportMode] = useState<"add" | "replace">("add");
  const [sceneImportMode, setSceneImportMode] = useState<"add" | "replace">("add");
  const [pendingParse, setPendingParse] = useState<{
    toc: ParsedToc | null;
    scenes: Array<{ title: string; content: string }>;
  } | null>(null);

  const handleParseText = (text: string) => {
    setError(null);
    if (!text.trim()) {
      setError("Please enter some text");
      setPreview([]);
      setCastReview([]);
      setPendingParse(null);
      setDetectedSceneCount(0);
      return;
    }

    try {
      // Parse TOC ("Scenes & Songs") section if present
      const toc = parseTOC(text);
      setTocData(toc);

      // Strip the TOC section from the text so it doesn't appear as a scene
      const sceneText = toc ? stripTocSection(text, toc) : text;

      // Detect scene count even if in "single" mode to show user info
      const sceneCount = detectSceneCount(sceneText);
      setDetectedSceneCount(sceneCount);

      // Extract known cast from the full text (if a cast page exists),
      // falling back to the project's existing cast page characters.
      let knownCast = extractCastNames(text);
      if (knownCast.length === 0) {
        knownCast = getProjectCharacters(projectId).map((c) => c.characterName);
      }
      setCastNames(knownCast);

      const scenes = createScenesFromInput(projectId, sceneText, inputMode);

      if (scenes.length === 0) {
        setError("No content to parse");
        setPreview([]);
        return;
      }

      // Collect every character detected across all scenes with no cast
      // filter — maximum recall so the user can review false positives.
      const allChars = new Set<string>();
      for (const scene of scenes) {
        extractSceneCharacters(scene.content).forEach((c) => allChars.add(c));
      }
      // Seed with any names from the cast page / existing project cast
      knownCast.forEach((name) => allChars.add(name.toUpperCase()));

      setCastReview(
        Array.from(allChars)
          .sort()
          .map((name) => ({ name, category: "individual" as CharacterCategory }))
      );

      setPendingParse({
        toc,
        scenes: scenes.map((s) => ({ title: s.title, content: s.content })),
      });

      // Clear any stale editing state
      setPreview([]);
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
      setCastReview([]);
      setPendingParse(null);
      setDetectedSceneCount(0);
    }
  };

  const handleConfirmCast = () => {
    if (!pendingParse) return;
    const { toc, scenes } = pendingParse;

    // Only keep characters the user didn't mark as non-character
    const confirmedCast = castReview
      .filter((e) => e.category !== "non-character")
      .map((e) => e.name);

    setPreview(
      scenes.map((scene) => ({
        title: scene.title,
        contentPreview: scene.content.substring(0, 200).replace(/\n/g, " ") + "...",
        fullContent: scene.content,
        characters: extractSceneCharacters(scene.content, confirmedCast),
        songs: toc ? findSongsForScene(toc, scene.title) : [],
        deleted: false,
      }))
    );

    setCastReview([]);
    setPendingParse(null);
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
        const text = await extractTextFromPdf(file);
        handleParseText(text);
        return;
      }

      throw new Error("Only .txt and .pdf files are supported in Text mode");
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
      const finalScenes = scenesToCreate.map((scene) => {
        // Find the original index in the full preview to get edited characters
        const originalIndex = preview.indexOf(scene);
        const chars = editingCharacters.get(originalIndex) ?? scene.characters;
        return {
          title: scene.title,
          content: scene.fullContent,
          characters: chars,
          songs: scene.songs.length > 0 ? scene.songs : undefined,
        };
      });

      if (sceneImportMode === "replace") {
        const existing = getProjectScenes(projectId);
        if (existing.length > 0) {
          deleteScenes(existing.map((s) => s.id));
        }
      }

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
        if (castImportMode === "replace") {
          for (const existing of getProjectCharacters(projectId)) {
            deleteCharacter(existing.id);
          }
        }
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
      setTocData(null);
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
    setCastReview([]);
    setPendingParse(null);
    setError(null);
    setDetectedSceneCount(0);
    setTocData(null);
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

      {/* Tab Switch — hidden once cast review or scene preview is active */}
      {castReview.length === 0 && preview.length === 0 && (
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
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded">
          {error}
        </div>
      )}

      {/* Input Mode Selector (visible when no preview and no cast review) */}
      {castReview.length === 0 && preview.length === 0 && (
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
      {selectedTab === "paste" && castReview.length === 0 && preview.length === 0 && (
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
      {selectedTab === "upload" && castReview.length === 0 && preview.length === 0 && (
        <div className="space-y-4">
          <div className="flex gap-4 mb-4">
            <button
              className={`px-4 py-2 rounded font-semibold border transition-colors ${uploadMode === "text" ? "bg-accent-cyan/20 border-accent-cyan text-accent-cyan" : "bg-background border-border text-muted hover:text-light"}`}
              onClick={() => setUploadMode("text")}
            >
              Upload Text/PDF
            </button>
            <button
              className={`px-4 py-2 rounded font-semibold border transition-colors ${uploadMode === "image" ? "bg-accent-cyan/20 border-accent-cyan text-accent-cyan" : "bg-background border-border text-muted hover:text-light"}`}
              onClick={() => setUploadMode("image")}
            >
              Upload Image (OCR)
            </button>
          </div>
          {uploadMode === "text" ? (
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
          ) : (
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <OcrUploaderWrapper onExtract={setOcrText} />
              {ocrText && (
                <div className="mt-4">
                  <Button variant="primary" onClick={() => handleParseText(ocrText)}>
                    Use Extracted Text
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Scene Info */}
      {detectedSceneCount > 1 && castReview.length === 0 && preview.length === 0 && (
        <div className="p-3 bg-accent-cyan/10 border border-accent-cyan rounded text-accent-cyan text-sm">
          <strong>Detected {detectedSceneCount} scenes</strong> in the input text.
          {inputMode === "single" && " (Single mode selected: will be treated as one scene)"}
        </div>
      )}

      {/* Cast Review Section */}
      {castReview.length > 0 && preview.length === 0 && (
        <div className="space-y-4 border-t border-border pt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-light font-semibold">
              Review Characters ({castReview.length})
            </h3>
            <button
              onClick={handleClear}
              className="text-muted text-xs hover:text-light transition-colors"
            >
              ← Back
            </button>
          </div>
          <p className="text-muted text-sm">
            Categorize each detected name before building scene previews. Mark
            anything that isn&apos;t a real character as <em>Non-character</em> to
            filter it out.
          </p>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {castReview.map((entry, i) => (
              <div
                key={entry.name}
                className="flex items-center gap-3 px-3 py-2 rounded border border-border bg-background"
              >
                <span className="flex-1 text-light text-sm font-mono">
                  {entry.name}
                </span>
                <select
                  value={entry.category}
                  onChange={(e) => {
                    const updated = [...castReview];
                    updated[i] = {
                      ...entry,
                      category: e.target.value as CharacterCategory,
                    };
                    setCastReview(updated);
                  }}
                  className={`bg-background border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent-cyan transition-colors ${
                    entry.category === "non-character"
                      ? "border-red-500/50 text-red-400"
                      : entry.category === "group"
                      ? "border-yellow-500/50 text-yellow-400"
                      : "border-border text-light"
                  }`}
                >
                  <option value="individual">Individual</option>
                  <option value="group">Group</option>
                  <option value="non-character">Non-character</option>
                </select>
              </div>
            ))}
          </div>

          <div className="space-y-3 pt-2 border-t border-border">
            <div>
              <label className="block text-light font-semibold text-sm mb-2">
                Cast page import mode
              </label>
              <div className="flex gap-3">
                {(["add", "replace"] as const).map((mode) => (
                  <label
                    key={mode}
                    className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors ${
                      castImportMode === mode
                        ? "border-accent-cyan bg-accent-cyan/10 text-accent-cyan"
                        : "border-border text-muted hover:text-light"
                    }`}
                  >
                    <input
                      type="radio"
                      name="castImportMode"
                      value={mode}
                      checked={castImportMode === mode}
                      onChange={() => setCastImportMode(mode)}
                      className="accent-accent-cyan"
                    />
                    <span className="text-sm font-semibold capitalize">
                      {mode === "add" ? "Add new only" : "Replace all"}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-muted text-xs mt-2">
                {castImportMode === "add"
                  ? "Only characters not already on the cast page will be added."
                  : "All existing cast members will be removed and replaced with this confirmed cast."}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={handleClear}>
                Back
              </Button>
              <Button variant="primary" onClick={handleConfirmCast}>
                Confirm Cast &amp; Preview Scenes
              </Button>
            </div>
          </div>
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

          {/* TOC Summary Banner */}
          {tocData && (
            <div className="p-3 rounded bg-yellow-500/10 border border-yellow-500/30">
              <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium mb-1">
                ♪ Scenes &amp; Songs detected
              </div>
              <p className="text-xs text-muted">
                {tocData.entries.length} scene{tocData.entries.length !== 1 ? "s" : ""},{" "}
                {tocData.entries.reduce((sum, e) => sum + e.songs.length, 0)} song
                {tocData.entries.reduce((sum, e) => sum + e.songs.length, 0) !== 1 ? "s" : ""}{" "}
                found in table of contents. Songs are shown on matching scene cards below.
              </p>
            </div>
          )}

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

                    {/* Songs (from TOC - read-only in edit view) */}
                    {scene.songs.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-xs text-muted">Songs:</span>
                        <div className="flex flex-wrap gap-1">
                          {scene.songs.map((song) => (
                            <span
                              key={song}
                              className="inline-flex items-center px-2 py-0.5 bg-yellow-500/15 text-yellow-400 text-xs rounded"
                            >
                              ♪ {song}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

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

                    {/* Songs (from TOC) */}
                    {scene.songs.length > 0 && (
                      <div className="text-xs">
                        <span className="text-muted">Songs: </span>
                        <span className="text-yellow-400">
                          {scene.songs.join(", ")}
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
          <div className="space-y-3 pt-4 border-t border-border">
            <div>
              <label className="block text-light font-semibold text-sm mb-2">
                Scene import mode
              </label>
              <div className="flex gap-3">
                {(["add", "replace"] as const).map((mode) => (
                  <label
                    key={mode}
                    className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors ${
                      sceneImportMode === mode
                        ? "border-accent-cyan bg-accent-cyan/10 text-accent-cyan"
                        : "border-border text-muted hover:text-light"
                    }`}
                  >
                    <input
                      type="radio"
                      name="sceneImportMode"
                      value={mode}
                      checked={sceneImportMode === mode}
                      onChange={() => setSceneImportMode(mode)}
                      className="accent-accent-cyan"
                    />
                    <span className="text-sm font-semibold">
                      {mode === "add" ? "Add new only" : "Replace all"}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-muted text-xs mt-2">
                {sceneImportMode === "add"
                  ? "Existing scenes are kept. Only these new scenes will be added."
                  : "All existing scenes in this project will be deleted before importing."}
              </p>
            </div>
            <div className="flex gap-3">
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
        </div>
      )}
    </div>
  );
}
