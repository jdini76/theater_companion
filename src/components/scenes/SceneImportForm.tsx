"use client";

import React, { useState } from "react";
import { useScenes } from "@/contexts/SceneContext";
import { useVoice } from "@/contexts/VoiceContext";
import {
  createScenesFromInput,
  detectSceneCount,
  extractSceneCharacters,
  extractCastNames,
  parseTOC,
  findSongsForScene,
  stripTocSection,
  SceneInputMode,
} from "@/lib/scenes";
import type { ParsedToc } from "@/types/scene";
import { extractTextFromPdf } from "@/lib/pdf-client";

// import dynamic from "next/dynamic";
import { Button } from "@/components/ui/Button";
import { OcrUploaderWrapper } from "../common/OcrUploaderWrapper";
// import {
//   type CharColor,
//   type LineOverride,
//   buildCharColorMap,
//   HighlightedContent,
// } from "./SceneHighlight";

interface SceneImportFormProps {
  projectId: string;
  onSuccess?: () => void;
}

type CastCategory =
  | "Individual"
  | "Group"
  | "Non-character"
  | "Merge Characters";

interface ParsedSceneData {
  title: string;
  content: string;
  songs: string[];
}

// interface ScenePreview {
//   title: string;
//   contentPreview: string;
//   fullContent: string;
//   characters: string[];
//   songs: string[];
//   deleted?: boolean;
// }

export function SceneImportForm({
  projectId,
  onSuccess,
}: SceneImportFormProps) {
  const { createScenes } = useScenes();
  const {
    importCastCharacters,
    replaceProjectCharacters,
    getProjectCharacters,
  } = useVoice();
  const [selectedTab, setSelectedTab] = useState<"paste" | "upload">("paste");
  const [uploadMode, setUploadMode] = useState<"text" | "image">("text");
  const [ocrText, setOcrText] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [inputMode, setInputMode] = useState<SceneInputMode>("auto");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [detectedSceneCount, setDetectedSceneCount] = useState<number>(0);
  const [castNames, setCastNames] = useState<string[]>([]);
  const [_tocData, setTocData] = useState<ParsedToc | null>(null);
  const [showCastReview, setShowCastReview] = useState(false);
  const [castCategories, setCastCategories] = useState<
    Map<string, CastCategory>
  >(new Map());
  const [parsedSceneData, setParsedSceneData] = useState<ParsedSceneData[]>([]);
  const [mergeTargets, setMergeTargets] = useState<Map<string, string>>(
    new Map(),
  );
  // mergeAliases: target name → list of source names merged into it
  const [mergeAliases, setMergeAliases] = useState<Map<string, string[]>>(
    new Map(),
  );
  const [castImportMode, setCastImportMode] = useState<
    "add" | "replace" | "skip"
  >("add");

  const handleParseText = (text: string) => {
    setError(null);
    if (!text.trim()) {
      setError("Please enter some text");
      setDetectedSceneCount(0);
      return;
    }

    try {
      const toc = parseTOC(text);
      setTocData(toc);
      const sceneText = toc ? stripTocSection(text, toc) : text;
      setDetectedSceneCount(detectSceneCount(sceneText));
      const scenes = createScenesFromInput(projectId, sceneText, inputMode);

      if (scenes.length === 0) {
        setError("No content to parse");
        return;
      }

      setParsedSceneData(
        scenes.map((scene) => ({
          title: scene.title,
          content: scene.content,
          songs: toc ? findSongsForScene(toc, scene.title) : [],
        })),
      );

      const castPageNames = extractCastNames(text);
      const castSet = new Set<string>(castPageNames);
      for (const scene of scenes) {
        for (const char of extractSceneCharacters(scene.content))
          castSet.add(char);
      }
      let cast = Array.from(castSet).sort();
      if (cast.length === 0) {
        cast = getProjectCharacters(projectId).map((c) => c.characterName);
      }

      const categories = new Map<string, CastCategory>();
      for (const name of cast) categories.set(name, "Individual");
      setCastCategories(categories);
      setCastNames(cast);
      setShowCastReview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse text");
      setDetectedSceneCount(0);
    }
  };

  const handleMerge = (sourceName: string, targetName: string) => {
    if (!targetName) return;
    setCastNames((prev) => prev.filter((n) => n !== sourceName));
    setCastCategories((prev) => {
      const next = new Map(prev);
      next.delete(sourceName);
      return next;
    });
    setMergeTargets((prev) => {
      const next = new Map(prev);
      next.delete(sourceName);
      return next;
    });
    setMergeAliases((prev) => {
      const next = new Map(prev);
      next.set(targetName, [...(next.get(targetName) ?? []), sourceName]);
      return next;
    });
  };

  const handleCreateScenes = () => {
    setError(null);
    try {
      const activeCast = castNames.filter(
        (name) => castCategories.get(name) !== "Non-character",
      );

      const finalScenes = parsedSceneData.map((scene) => ({
        title: scene.title,
        content: scene.content,
        characters: extractSceneCharacters(scene.content, activeCast),
        songs: scene.songs.length > 0 ? scene.songs : undefined,
      }));

      if (finalScenes.length === 0) {
        setError("No scenes to create");
        return;
      }

      createScenes(projectId, finalScenes);

      // Build per-character metadata from the cast review
      const charData = new Map<string, { category?: string; aliases?: string[] }>();
      for (const name of activeCast) {
        const cat = castCategories.get(name);
        charData.set(name, {
          category: cat === "Group" ? "Group" : "Individual",
          aliases: mergeAliases.get(name),
        });
      }
      // Include any scene-detected names not in the reviewed cast list
      for (const scene of finalScenes) {
        for (const c of scene.characters ?? []) {
          if (!charData.has(c)) charData.set(c, { category: "Individual" });
        }
      }

      if (charData.size > 0 && castImportMode !== "skip") {
        const importData = Array.from(charData.entries()).map(([name, meta]) => ({
          name,
          ...meta,
        }));
        if (castImportMode === "replace") {
          replaceProjectCharacters(projectId, importData);
        } else {
          importCastCharacters(projectId, importData);
        }
      }

      handleClear();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create scenes");
    }
  };

  const handlePasteInput = () => handleParseText(pastedText);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    setError(null);
    setIsLoading(true);
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith(".txt")) {
        handleParseText(await file.text());
        return;
      }
      if (name.endsWith(".pdf")) {
        handleParseText(await extractTextFromPdf(file));
        return;
      }
      throw new Error("Only .txt and .pdf files are supported in Text mode");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
      setDetectedSceneCount(0);
    } finally {
      setIsLoading(false);
      if (e.currentTarget) e.currentTarget.value = "";
    }
  };

  const handleClear = () => {
    setPastedText("");
    setOcrText("");
    setError(null);
    setDetectedSceneCount(0);
    setTocData(null);
    setCastNames([]);
    setShowCastReview(false);
    setCastCategories(new Map());
    setParsedSceneData([]);
    setMergeTargets(new Map());
    setCastImportMode("add");
  };

  return (
    <div className="card space-y-6">
      <h2 className="text-2xl font-bold text-light">Import Scenes</h2>

      {/* Tab Switch */}
      <div className="flex gap-2 border-b border-border">
        {(["paste", "upload"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setSelectedTab(tab);
              handleClear();
            }}
            className={`px-4 py-2 font-semibold transition-colors ${
              selectedTab === tab
                ? "text-accent-cyan border-b-2 border-accent-cyan"
                : "text-muted hover:text-light"
            }`}
          >
            {tab === "paste" ? "Paste Text" : "Upload File"}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded">
          {error}
        </div>
      )}

      {!showCastReview && (
        <>
          {/* Input Mode */}
          <div className="space-y-3">
            <label className="block text-light font-semibold">Input Mode</label>
            <div className="grid grid-cols-3 gap-3">
              {(["auto", "single", "multiple"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setInputMode(mode)}
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
                  placeholder={`Paste your scene text here. Supports:\nâ€¢ Single scene: Just paste the text\nâ€¢ Multiple scenes: Use "SCENE 1:", "---" separators, etc.\nâ€¢ Multiline dialogue: Indent continuation lines`}
                  rows={10}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan font-mono text-sm resize-vertical"
                />
              </div>
              <Button
                variant="primary"
                onClick={handlePasteInput}
                disabled={!pastedText.trim()}
              >
                Parse Text
              </Button>
            </div>
          )}

          {/* Upload Tab */}
          {selectedTab === "upload" && (
            <div className="space-y-4">
              <div className="flex gap-4 mb-4">
                {(["text", "image"] as const).map((mode) => (
                  <button
                    key={mode}
                    className={`px-4 py-2 rounded font-semibold border transition-colors ${
                      uploadMode === mode
                        ? "bg-accent-cyan/20 border-accent-cyan text-accent-cyan"
                        : "bg-background border-border text-muted hover:text-light"
                    }`}
                    onClick={() => setUploadMode(mode)}
                  >
                    {mode === "text" ? "Upload Text/PDF" : "Upload Image (OCR)"}
                  </button>
                ))}
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
                      <div className="text-4xl">ðŸ“„</div>
                      <p className="text-light font-semibold">
                        {isLoading
                          ? "Parsingâ€¦"
                          : "Click to upload a script file"}
                      </p>
                      <p className="text-muted text-sm">
                        Supports <strong>.pdf</strong> and <strong>.txt</strong>
                      </p>
                      <p className="text-muted text-xs">
                        Note: PDFs must have a selectable text layer.
                      </p>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <OcrUploaderWrapper onExtract={setOcrText} />
                  {ocrText && (
                    <div className="mt-4">
                      <Button
                        variant="primary"
                        onClick={() => handleParseText(ocrText)}
                      >
                        Use Extracted Text
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Scene count info */}
          {detectedSceneCount > 1 && (
            <div className="p-3 bg-accent-cyan/10 border border-accent-cyan rounded text-accent-cyan text-sm">
              <strong>Detected {detectedSceneCount} scenes</strong> in the input
              text.
              {inputMode === "single" &&
                " (Single mode: will be treated as one scene)"}
            </div>
          )}
        </>
      )}

      {/* Cast Review */}
      {showCastReview && (
        <div className="space-y-4 border-t border-border pt-6">
          <div>
            <h3 className="text-light font-semibold text-lg">
              Review Identified Cast
            </h3>
            <p className="text-muted text-sm mt-1">
              Categorize each name. Non-characters are excluded from the cast.
            </p>
          </div>

          {getProjectCharacters(projectId).length > 0 && (
            <div className="p-3 rounded border border-border bg-background/50 space-y-2">
              <p className="text-sm font-medium text-light">
                This project already has{" "}
                {getProjectCharacters(projectId).length} character
                {getProjectCharacters(projectId).length !== 1 ? "s" : ""}. How
                should the cast list be updated?
              </p>
              {(
                [
                  {
                    value: "add" as const,
                    label: "Add new characters",
                    desc: "Keep existing and add any new ones.",
                  },
                  {
                    value: "replace" as const,
                    label: "Replace all",
                    desc: "Remove existing characters and replace with this cast. Voice settings will be lost.",
                  },
                  {
                    value: "skip" as const,
                    label: "Skip",
                    desc: "Keep the cast list as is.",
                  },
                ] as const
              ).map(({ value, label, desc }) => (
                <label
                  key={value}
                  className="flex items-start gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="castImportMode"
                    value={value}
                    checked={castImportMode === value}
                    onChange={() => setCastImportMode(value)}
                    className="mt-0.5 accent-accent-cyan"
                  />
                  <div>
                    <span
                      className={`text-sm font-medium ${castImportMode === value ? "text-accent-cyan" : "text-light"}`}
                    >
                      {label}
                    </span>
                    <p className="text-xs text-muted">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          )}

          {castNames.length === 0 ? (
            <p className="text-muted text-sm italic">
              No cast names identified.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {castNames.map((name) => {
                const category = castCategories.get(name) ?? "Individual";
                const mergeTarget = mergeTargets.get(name) ?? "";
                return (
                  <div
                    key={name}
                    className={`px-3 py-2 rounded border transition-colors ${
                      category === "Non-character"
                        ? "bg-background border-border opacity-50"
                        : "bg-background border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-sm font-mono ${category === "Non-character" ? "text-muted line-through" : "text-light"}`}
                      >
                        {name}
                      </span>
                      <select
                        value={category}
                        onChange={(e) => {
                          const newCategories = new Map(castCategories);
                          newCategories.set(
                            name,
                            e.target.value as CastCategory,
                          );
                          setCastCategories(newCategories);
                          if (e.target.value !== "Merge Characters") {
                            const newTargets = new Map(mergeTargets);
                            newTargets.delete(name);
                            setMergeTargets(newTargets);
                          }
                        }}
                        className={`text-xs rounded px-2 py-1 border focus:outline-none focus:border-accent-cyan bg-background transition-colors ${
                          category === "Non-character"
                            ? "border-border text-muted"
                            : category === "Group"
                              ? "border-yellow-500/50 text-yellow-400"
                              : category === "Merge Characters"
                                ? "border-purple-500/50 text-purple-400"
                                : "border-accent-cyan/50 text-accent-cyan"
                        }`}
                      >
                        <option value="Individual">Individual</option>
                        <option value="Group">Group</option>
                        <option value="Non-character">Non-character</option>
                        <option value="Merge Characters">
                          Merge Characters
                        </option>
                      </select>
                    </div>

                    {category === "Merge Characters" && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                        <span className="text-xs text-muted whitespace-nowrap">
                          Merge into:
                        </span>
                        <select
                          value={mergeTarget}
                          onChange={(e) => {
                            const newTargets = new Map(mergeTargets);
                            newTargets.set(name, e.target.value);
                            setMergeTargets(newTargets);
                          }}
                          className="flex-1 text-xs rounded px-2 py-1 border border-border bg-background text-light focus:outline-none focus:border-accent-cyan"
                        >
                          <option value="">Select characterâ€¦</option>
                          {castNames
                            .filter(
                              (n) =>
                                n !== name &&
                                (castCategories.get(n) ?? "Individual") !==
                                  "Merge Characters",
                            )
                            .map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                        </select>
                        <button
                          onClick={() => handleMerge(name, mergeTarget)}
                          disabled={!mergeTarget}
                          className="px-3 py-1 bg-purple-500/20 text-purple-400 text-xs rounded hover:bg-purple-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-3 pt-2 border-t border-border">
            <Button variant="secondary" onClick={handleClear}>
              Back
            </Button>
            <Button variant="primary" onClick={handleCreateScenes}>
              Create {parsedSceneData.length} Scene
              {parsedSceneData.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
