"use client";

import React, { useState } from "react";
import { useProjects } from "@/contexts/ProjectContext";
import { useScenes } from "@/contexts/SceneContext";
import { useVoice } from "@/contexts/VoiceContext";
import type { ProductionType } from "@/types/project";
import {
  createScenesFromInput,
  detectSceneCount,
  extractSceneCharacters,
  extractCharacterIntroductionsFromScenes,
  extractCastNames,
  parseTOC,
  findSongsForScene,
  stripTocSection,
  getSceneParseFormat,
  SceneInputMode,
} from "@/lib/scenes";
import { parseDialogueLines } from "@/lib/rehearsal";
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
  productionType?: ProductionType;
  onSuccess?: () => void;
}

type CastCategory =
  | "Individual"
  | "Group"
  | "Non-character"
  | "Merge Characters"
  | "Split";

interface ParsedSceneData {
  title: string;
  content: string;
  songs: string[];
}

// ── Master-list name matching ─────────────────────────────────────────────────
type MatchResult =
  | { kind: "exact"; canonical: string }
  | { kind: "partial"; canonical: string }
  | { kind: "new" };

/**
 * Split a combined speaker label into individual names.
 * "NORA & ELI" → ["NORA", "ELI"]
 * "NORA, ELI, AND MARA" → ["NORA", "ELI", "MARA"]
 */
function splitCastName(name: string): string[] {
  if (!/[&,]/.test(name)) return [name];
  return name
    .split(/\s*[&,]\s*/)
    .map((p) => p.replace(/^\bAND\b\s*/i, "").trim())
    .filter((p) => p.length > 0 && !/^\bAND\b$/i.test(p));
}

function matchAgainstMaster(name: string, masterList: string[]): MatchResult {
  const upper = name.toUpperCase().trim();
  for (const master of masterList) {
    if (master.toUpperCase().trim() === upper)
      return { kind: "exact", canonical: master };
  }
  for (const master of masterList) {
    const masterUpper = master.toUpperCase().trim();
    const masterWords = masterUpper.split(/\s+/);
    const detectedWords = upper.split(/\s+/);
    // Detected is a single word that is the first or last word of a master name
    if (masterWords.length > 1 && detectedWords.length < masterWords.length) {
      if (
        masterWords[0] === upper ||
        masterWords[masterWords.length - 1] === upper
      )
        return { kind: "partial", canonical: master };
    }
    // Master is a single word that is the first or last word of the detected name
    if (detectedWords.length > 1 && masterWords.length < detectedWords.length) {
      if (
        detectedWords[0] === masterUpper ||
        detectedWords[detectedWords.length - 1] === masterUpper
      )
        return { kind: "partial", canonical: master };
    }
  }
  return { kind: "new" };
}

// Common English words that appear in ALL CAPS in scripts but are never character names.
const OBVIOUS_NON_CHARACTER_WORDS = new Set([
  // Pronouns
  "I",
  "YOU",
  "HE",
  "SHE",
  "IT",
  "WE",
  "THEY",
  "ME",
  "HIM",
  "HER",
  "US",
  "THEM",
  "MY",
  "YOUR",
  "HIS",
  "ITS",
  "OUR",
  "THEIR",
  "MINE",
  "YOURS",
  "OURS",
  "THEIRS",
  "MYSELF",
  "YOURSELF",
  "HIMSELF",
  "HERSELF",
  "ITSELF",
  "OURSELVES",
  "THEMSELVES",
  "WHO",
  "WHOM",
  "WHOSE",
  "WHICH",
  "THAT",
  "THIS",
  "THESE",
  "THOSE",
  // Articles
  "A",
  "AN",
  "THE",
  // Conjunctions / prepositions
  "AND",
  "BUT",
  "OR",
  "NOR",
  "SO",
  "YET",
  "FOR",
  "IF",
  "AS",
  "OF",
  "IN",
  "ON",
  "AT",
  "BY",
  "TO",
  "UP",
  "DO",
  "NOT",
  "NO",
  "YES",
  "OH",
  "AH",
  // Auxiliary verbs
  "IS",
  "ARE",
  "WAS",
  "WERE",
  "BE",
  "BEEN",
  "BEING",
  "HAS",
  "HAVE",
  "HAD",
  "DO",
  "DOES",
  "DID",
  "WILL",
  "WOULD",
  "SHALL",
  "SHOULD",
  "MAY",
  "MIGHT",
  "MUST",
  "CAN",
  "COULD",
  // Stage direction words sometimes leaking through
  "ENTER",
  "EXIT",
  "EXEUNT",
  "ASIDE",
  "PAUSE",
  "BEAT",
]);

/**
 * Returns true if the name looks like a plain English word rather than a
 * character name. Used to pre-classify obvious false positives as Non-character.
 */
function looksLikeNonCharacter(name: string): boolean {
  const upper = name.toUpperCase().trim();
  // Single-word match against known non-character words
  if (OBVIOUS_NON_CHARACTER_WORDS.has(upper)) return true;
  // Very short single-character tokens (except common 1-letter stage initials)
  if (/^[A-Z]$/.test(upper)) return true;
  return false;
}

/**
 * Returns true if the name looks like a group label rather than an individual.
 * Heuristic: single ALL-CAPS word ending in S that isn't a known proper name
 * ending (James, Thomas, Lucas, etc.).
 */
function looksLikeGroup(name: string): boolean {
  const upper = name.toUpperCase().trim();
  // Only apply to single-word names
  if (/\s/.test(upper)) return false;
  // Must end in S
  if (!upper.endsWith("S")) return false;
  // Exclude common proper names that end in S so we don't falsely flag them
  const PROPER_S_ENDINGS = new Set([
    "JAMES",
    "THOMAS",
    "LUCAS",
    "MARCUS",
    "NICOLAS",
    "ALEXIS",
    "TRAVIS",
    "JULES",
    "MILES",
    "GILES",
    "ROSS",
    "TESS",
    "BESS",
    "JESS",
    "LEWIS",
    "CHRIS",
    "PARIS",
    "IRIS",
    "DORIS",
    "GLADYS",
    "PHYLLIS",
    "FRANCIS",
    "CHARLES",
    "DOUGLAS",
    "JULIUS",
    "CORNELIUS",
    "SILAS",
    "JESUS",
  ]);
  if (PROPER_S_ENDINGS.has(upper)) return false;
  return true;
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
  productionType,
  onSuccess,
}: SceneImportFormProps) {
  const { getCurrentProject } = useProjects();
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
  // Names auto-resolved against the master list (not shown in review UI)
  const [autoAcceptedNames, setAutoAcceptedNames] = useState<string[]>([]);
  // Partial match suggestions: detected name → canonical master name
  const [partialMatchSuggestions, setPartialMatchSuggestions] = useState<
    Map<string, string>
  >(new Map());
  // Whether to expand the review list to include auto-matched characters
  const [showAllChars, setShowAllChars] = useState(false);

  const handleParseText = (text: string) => {
    setError(null);
    if (!text.trim()) {
      setError("Please enter some text");
      setDetectedSceneCount(0);
      return;
    }

    try {
      const currentProject = getCurrentProject();
      const toc = parseTOC(text);
      setTocData(toc);
      const sceneText = toc ? stripTocSection(text, toc) : text;
      setDetectedSceneCount(detectSceneCount(sceneText));
      const activeProductionType =
        productionType ?? currentProject?.productionType;
      const scenes = createScenesFromInput(
        projectId,
        sceneText,
        inputMode,
        activeProductionType,
      );

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
      const existingCast = getProjectCharacters(projectId).map(
        (c) => c.characterName,
      );
      // Master list: cast page names take priority, then existing project chars
      const masterList =
        castPageNames.length > 0 ? castPageNames : existingCast;

      // Collect all raw character names detected across scenes
      const rawDetectedSet = new Set<string>();
      for (const scene of scenes) {
        for (const char of extractSceneCharacters(
          scene.content,
          masterList,
          activeProductionType,
        ))
          rawDetectedSet.add(char);
      }

      // Classify each detected name against the master list
      const autoAccepted: string[] =
        masterList.length > 0 ? [...masterList] : [];
      const autoAcceptedUpperSet = new Set(
        autoAccepted.map((n) => n.toUpperCase()),
      );
      const flagged: string[] = [];
      const suggestions = new Map<string, string>();
      const initCategories = new Map<string, CastCategory>();
      const initMergeTargets = new Map<string, string>();
      const initMergeAliases = new Map<string, string[]>();

      for (const name of rawDetectedSet) {
        if (autoAcceptedUpperSet.has(name.toUpperCase())) continue;
        if (masterList.length === 0) {
          // No master list — send everything to review (original behaviour)
          flagged.push(name);
          initCategories.set(name, "Individual");
        } else {
          const result = matchAgainstMaster(name, masterList);
          if (result.kind === "exact") {
            autoAccepted.push(result.canonical);
            autoAcceptedUpperSet.add(result.canonical.toUpperCase());
          } else if (result.kind === "partial") {
            // Partial match — flag for review with pre-filled merge suggestion
            flagged.push(name);
            suggestions.set(name, result.canonical);
            initCategories.set(name, "Merge Characters");
            initMergeTargets.set(name, result.canonical);
            const existing = initMergeAliases.get(result.canonical) ?? [];
            initMergeAliases.set(result.canonical, [...existing, name]);
          } else {
            // New name not in master list — apply heuristics before flagging
            flagged.push(name);
            if (looksLikeNonCharacter(name)) {
              initCategories.set(name, "Non-character");
            } else if (looksLikeGroup(name)) {
              initCategories.set(name, "Group");
            } else {
              initCategories.set(name, "Individual");
            }
          }
        }
      }

      const localScenesData = scenes.map((scene) => ({
        title: scene.title,
        content: scene.content,
        songs: toc ? findSongsForScene(toc, scene.title) : [],
      }));

      if (flagged.length === 0) {
        // Everything exactly matched — skip review entirely
        const allCats = new Map<string, CastCategory>();
        for (const n of autoAccepted) allCats.set(n, "Individual");
        doCreateScenes(
          localScenesData,
          autoAccepted,
          allCats,
          new Map(),
          "add",
        );
      } else {
        // Show review for flagged names only
        setAutoAcceptedNames(autoAccepted);
        setPartialMatchSuggestions(suggestions);
        setParsedSceneData(localScenesData);
        setCastNames(flagged.sort());
        setCastCategories(initCategories);
        setMergeTargets(initMergeTargets);
        setMergeAliases(initMergeAliases);
        setShowCastReview(true);
      }
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

  // Confirm split: replace the combined name with the individual parts
  const handleConfirmSplit = (combinedName: string) => {
    const parts = splitCastName(combinedName);
    if (parts.length < 2) return;
    setCastNames((prev) => {
      const without = prev.filter((n) => n !== combinedName);
      // Add new parts that aren't already in the list (or auto-accepted)
      const autoUpper = new Set(autoAcceptedNames.map((n) => n.toUpperCase()));
      const toAdd = parts.filter(
        (p) =>
          !without.some((n) => n.toUpperCase() === p.toUpperCase()) &&
          !autoUpper.has(p.toUpperCase()),
      );
      return [...without, ...toAdd].sort();
    });
    setCastCategories((prev) => {
      const next = new Map(prev);
      next.delete(combinedName);
      for (const part of parts) {
        if (!next.has(part)) next.set(part, "Individual");
      }
      return next;
    });
  };

  const doCreateScenes = (
    scenesData: ParsedSceneData[],
    activeCastNames: string[],
    categories: Map<string, CastCategory>,
    aliases: Map<string, string[]>,
    importMode: "add" | "replace" | "skip",
  ) => {
    setError(null);
    try {
      const activeCast = activeCastNames.filter(
        (name) => categories.get(name) !== "Non-character",
      );

      const currentProject = getCurrentProject();
      const activeProductionType =
        productionType ?? currentProject?.productionType;
      const introDescriptions =
        currentProject?.id === projectId && activeProductionType === "Film"
          ? extractCharacterIntroductionsFromScenes(
              scenesData,
              activeCast,
              activeProductionType,
            )
          : {};

      const finalScenes = scenesData.map((scene) => ({
        title: scene.title,
        content: scene.content,
        characters: extractSceneCharacters(
          scene.content,
          activeCast,
          activeProductionType,
        ),
        songs: scene.songs.length > 0 ? scene.songs : undefined,
        lines: parseDialogueLines(
          scene.content,
          getSceneParseFormat(activeProductionType),
          activeCast,
        ),
      }));

      if (finalScenes.length === 0) {
        setError("No scenes to create");
        return;
      }

      createScenes(projectId, finalScenes, activeProductionType);

      // Build per-character metadata
      const charData = new Map<
        string,
        { category?: string; aliases?: string[]; description?: string }
      >();
      for (const name of activeCast) {
        const cat = categories.get(name);
        charData.set(name, {
          category: cat === "Group" ? "Group" : "Individual",
          aliases: aliases.get(name),
          description: introDescriptions[name.toUpperCase()],
        });
      }
      // Include any scene-detected names not in the reviewed cast list
      for (const scene of finalScenes) {
        for (const c of scene.characters ?? []) {
          if (!charData.has(c)) {
            charData.set(c, {
              category: "Individual",
              description: introDescriptions[c.toUpperCase()],
            });
          }
        }
      }

      if (charData.size > 0 && importMode !== "skip") {
        const importData = Array.from(charData.entries()).map(
          ([name, meta]) => ({
            name,
            ...meta,
          }),
        );
        if (importMode === "replace") {
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

  const handleCreateScenes = () => {
    // Combine auto-accepted (exact master matches) with the reviewed flagged names
    const allCategories = new Map(castCategories);
    for (const n of autoAcceptedNames) {
      if (!allCategories.has(n)) allCategories.set(n, "Individual");
    }
    doCreateScenes(
      parsedSceneData,
      [...autoAcceptedNames, ...castNames],
      allCategories,
      mergeAliases,
      castImportMode,
    );
  };

  const handlePasteInput = () => handleParseText(pastedText);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    setError(null);
    setIsLoading(true);
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith(".txt") || name.endsWith(".fountain")) {
        handleParseText(await file.text());
        return;
      }
      if (name.endsWith(".pdf")) {
        handleParseText(await extractTextFromPdf(file));
        return;
      }
      throw new Error(
        "Only .txt, .fountain, and .pdf files are supported in Text mode",
      );
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
    setAutoAcceptedNames([]);
    setPartialMatchSuggestions(new Map());
    setShowAllChars(false);
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
                      accept=".txt,.fountain,.pdf"
                      onChange={handleFileUpload}
                      disabled={isLoading}
                      className="hidden"
                    />
                    <div className="space-y-2">
                      <div className="text-4xl">📄</div>
                      <p className="text-light font-semibold">
                        {isLoading
                          ? "Parsingâ€¦"
                          : "Click to upload a script file"}
                      </p>
                      <p className="text-muted text-sm">
                        Supports <strong>.pdf</strong>, <strong>.txt</strong>,
                        and <strong>.fountain</strong>
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
              Review Flagged Characters
            </h3>
            <p className="text-muted text-sm mt-1">
              These names could not be automatically resolved. Partial matches
              are pre-filled — confirm or reclassify as needed.
            </p>
          </div>

          {autoAcceptedNames.length > 0 && (
            <div className="p-3 bg-accent-cyan/10 border border-accent-cyan/30 rounded text-sm flex flex-wrap items-center gap-2">
              <span className="text-accent-cyan font-semibold">
                {autoAcceptedNames.length} character
                {autoAcceptedNames.length !== 1 ? "s" : ""} auto-matched
              </span>
              <span className="text-muted flex-1">
                from the master cast list and will be imported automatically.
              </span>
              <label className="flex items-center gap-1.5 cursor-pointer ml-auto select-none flex-shrink-0">
                <input
                  type="checkbox"
                  checked={showAllChars}
                  onChange={(e) => setShowAllChars(e.target.checked)}
                  className="accent-accent-cyan"
                />
                <span className="text-muted text-xs">Show all characters</span>
              </label>
            </div>
          )}

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

          {castNames.length === 0 &&
          !(showAllChars && autoAcceptedNames.length > 0) ? (
            <p className="text-muted text-sm italic">
              No cast names identified.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {(showAllChars
                ? [
                    ...autoAcceptedNames.map((n) => ({
                      name: n,
                      autoMatched: true as const,
                    })),
                    ...castNames.map((n) => ({
                      name: n,
                      autoMatched: false as const,
                    })),
                  ]
                : castNames.map((n) => ({
                    name: n,
                    autoMatched: false as const,
                  }))
              ).map(({ name, autoMatched }) => {
                const category = castCategories.get(name) ?? "Individual";
                const mergeTarget = mergeTargets.get(name) ?? "";
                return (
                  <div
                    key={name}
                    className={`px-3 py-2 rounded border transition-colors ${
                      category === "Non-character"
                        ? "bg-background border-border opacity-50"
                        : autoMatched
                          ? "bg-background border-accent-cyan/20"
                          : "bg-background border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span
                          className={`text-sm font-mono ${category === "Non-character" ? "text-muted line-through" : "text-light"}`}
                        >
                          {name}
                        </span>
                        {autoMatched && category !== "Non-character" && (
                          <span className="ml-2 text-xs text-accent-cyan/60">
                            auto-matched
                          </span>
                        )}
                        {partialMatchSuggestions.has(name) && (
                          <p className="text-xs text-yellow-400 mt-0.5">
                            Possible match: {partialMatchSuggestions.get(name)}
                          </p>
                        )}
                      </div>
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
                                : category === "Split"
                                  ? "border-orange-500/50 text-orange-400"
                                  : "border-accent-cyan/50 text-accent-cyan"
                        }`}
                      >
                        <option value="Individual">Individual</option>
                        <option value="Group">Group</option>
                        <option value="Non-character">Non-character</option>
                        <option value="Merge Characters">
                          Merge Characters
                        </option>
                        <option value="Split">Split into individuals</option>
                      </select>
                    </div>

                    {category === "Split" && (
                      <div className="mt-2 pt-2 border-t border-border">
                        {(() => {
                          const parts = splitCastName(name);
                          return parts.length > 1 ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted whitespace-nowrap">
                                Split into:
                              </span>
                              {parts.map((p) => (
                                <span
                                  key={p}
                                  className="text-xs font-mono px-2 py-0.5 rounded bg-orange-500/10 text-orange-300 border border-orange-500/30"
                                >
                                  {p}
                                </span>
                              ))}
                              <button
                                onClick={() => handleConfirmSplit(name)}
                                className="ml-auto px-3 py-1 bg-orange-500/20 text-orange-400 text-xs rounded hover:bg-orange-500/30 transition-colors"
                              >
                                Confirm split
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-muted italic">
                              Cannot split — no separator (&nbsp;
                              <code>&amp;</code> or <code>,</code>) found in
                              name.
                            </p>
                          );
                        })()}
                      </div>
                    )}

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
                          <option value="">Select character…</option>
                          {[
                            ...autoAcceptedNames,
                            ...castNames.filter(
                              (n) =>
                                n !== name &&
                                (castCategories.get(n) ?? "Individual") !==
                                  "Merge Characters",
                            ),
                          ].map((n) => (
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
