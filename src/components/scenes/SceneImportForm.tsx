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

interface ScenePreview {
  title: string;
  contentPreview: string;
  fullContent: string;
  characters: string[];
  songs: string[];
  deleted?: boolean;
}

type CharColor = { color: string; bgColor: string };

function buildCharColorMap(names: string[]): Map<string, CharColor> {
  const map = new Map<string, CharColor>();
  // Golden angle distribution ensures every character gets a visually distinct hue
  // regardless of cast size — no two adjacent hues are ever close together.
  const goldenAngle = 137.508;
  [...names].sort().forEach((name, i) => {
    const hue = Math.round((i * goldenAngle) % 360);
    map.set(name.toUpperCase(), {
      color: `hsl(${hue}, 70%, 65%)`,
      bgColor: `hsla(${hue}, 70%, 65%, 0.12)`,
    });
  });
  return map;
}

type LineOverride =
  | { kind: "dialogue"; char: string }
  | { kind: "header"; char: string }
  | { kind: "stage-direction" };

// Returns the canonical character name and the prefix actually present in the
// line (which may be a first-name abbreviation of the canonical name).
function matchCharInLine(
  line: string,
  charSet: Set<string>,
): { char: string; prefix: string } | null {
  const upper = line.trim().toUpperCase();
  if (!upper) return null;

  const isMatch = (u: string, name: string) =>
    u === name ||
    u.startsWith(name + " ") ||
    u.startsWith(name + "(") ||
    u.startsWith(name + ",") ||
    u.startsWith(name + ":");

  // First pass: full character name
  for (const char of charSet) {
    if (isMatch(upper, char)) return { char, prefix: char };
  }

  // Second pass: first word only (e.g. "PHIL" matches "PHIL CONNORS")
  for (const char of charSet) {
    const firstName = char.split(" ")[0];
    if (firstName && firstName !== char && isMatch(upper, firstName)) {
      return { char, prefix: firstName };
    }
  }

  return null;
}

// If a line is "PREFIX: dialogue text", returns the two parts separately.
// prefix is the text actually present in the line (may be an abbreviation).
// Returns null for dialogue when the character name stands alone.
function splitAtColon(
  prefix: string,
  trimmedLine: string,
): { header: string; dialogue: string | null } {
  const colonPrefix = prefix.toUpperCase() + ":";
  if (trimmedLine.toUpperCase().startsWith(colonPrefix)) {
    const rest = trimmedLine.slice(colonPrefix.length).trim();
    if (rest) {
      return { header: trimmedLine.slice(0, colonPrefix.length), dialogue: rest };
    }
  }
  return { header: trimmedLine, dialogue: null };
}

function LineAssignPanel({
  characters,
  colorMap,
  currentAssignment,
  onAssign,
  onReset,
  onClose,
}: {
  characters: string[];
  colorMap: Map<string, CharColor>;
  currentAssignment: LineOverride | undefined;
  onAssign: (override: LineOverride) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"dialogue" | "header">(
    currentAssignment?.kind === "header" ? "header" : "dialogue",
  );
  const [newCharInput, setNewCharInput] = useState("");
  const isHeader = mode === "header";

  const commitNew = () => {
    const name = newCharInput.trim().toUpperCase();
    if (!name) return;
    onAssign(isHeader ? { kind: "header", char: name } : { kind: "dialogue", char: name });
    setNewCharInput("");
  };

  return (
    <div className="my-1 p-2 rounded border border-border bg-background shadow space-y-2 text-xs">
      <div className="flex gap-1">
        <button
          onClick={() => setMode("dialogue")}
          className={`px-2 py-0.5 rounded transition-colors ${!isHeader ? "bg-accent-cyan/20 text-accent-cyan" : "text-muted hover:text-light"}`}
        >
          Dialogue
        </button>
        <button
          onClick={() => setMode("header")}
          className={`px-2 py-0.5 rounded transition-colors ${isHeader ? "bg-accent-cyan/20 text-accent-cyan" : "text-muted hover:text-light"}`}
        >
          Character Header
        </button>
      </div>
      <p className="text-muted">
        {isHeader ? "Mark as start of:" : "Assign as dialogue for:"}
      </p>
      <div className="flex flex-wrap gap-1">
        {characters.map((char) => {
          const color = colorMap.get(char.toUpperCase());
          const isSelected = isHeader
            ? currentAssignment?.kind === "header" && currentAssignment.char === char
            : currentAssignment?.kind === "dialogue" && currentAssignment.char === char;
          return (
            <button
              key={char}
              onClick={() =>
                onAssign(isHeader ? { kind: "header", char } : { kind: "dialogue", char })
              }
              style={{ color: color?.color, backgroundColor: color?.bgColor }}
              className={`px-2 py-0.5 rounded font-mono hover:opacity-80 transition-opacity border ${isSelected ? "border-current" : "border-transparent"}`}
            >
              {char}
            </button>
          );
        })}
      </div>
      <div className="flex gap-1">
        <input
          type="text"
          value={newCharInput}
          onChange={(e) => setNewCharInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commitNew(); }}
          placeholder="Add character name…"
          className="flex-1 bg-background border border-border rounded px-2 py-0.5 text-light placeholder-muted focus:outline-none focus:border-accent-cyan"
        />
        <button
          onClick={commitNew}
          disabled={!newCharInput.trim()}
          className="px-2 py-0.5 bg-accent-cyan/20 text-accent-cyan rounded hover:bg-accent-cyan/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
      <div className="flex gap-2 pt-1 border-t border-border">
        <button
          onClick={() => onAssign({ kind: "stage-direction" })}
          className={`px-2 py-0.5 rounded border transition-colors hover:text-light ${currentAssignment?.kind === "stage-direction" ? "border-current text-light" : "border-border text-muted"}`}
        >
          Stage Direction
        </button>
        <button
          onClick={onReset}
          className="px-2 py-0.5 rounded border border-border text-muted hover:text-light transition-colors"
        >
          Auto-detect
        </button>
        <button
          onClick={onClose}
          className="ml-auto px-2 py-0.5 text-muted hover:text-light transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function HighlightedContent({
  content,
  characters,
  colorMap,
  overrides = new Map(),
  onAssign,
}: {
  content: string;
  characters: string[];
  colorMap: Map<string, CharColor>;
  overrides?: Map<number, LineOverride>;
  onAssign?: (lineIdx: number, assignment: LineOverride | undefined) => void;
}) {
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const charSet = new Set(characters.map((c) => c.toUpperCase()));
  const lines = content.split("\n");
  let currentChar: string | null = null;

  // Pre-compute paren stage direction blocks: a line that starts with "(" opens
  // a block; every line (including the opener) is a stage direction until the
  // first ")" is found, which closes the block.
  const parenStageLines = new Set<number>();
  {
    let inParen = false;
    for (let j = 0; j < lines.length; j++) {
      const t = lines[j].trim();
      if (!inParen && t.startsWith("(")) inParen = true;
      if (inParen) {
        parenStageLines.add(j);
        if (t.includes(")")) inParen = false;
      }
    }
  }

  const editIcon = onAssign ? (
    <span className="opacity-0 group-hover:opacity-50 text-muted transition-opacity select-none flex-shrink-0">
      ✎
    </span>
  ) : null;

  const makePanel = (i: number, override: LineOverride | undefined) =>
    onAssign ? (
      <LineAssignPanel
        characters={characters}
        colorMap={colorMap}
        currentAssignment={override}
        onAssign={(ov) => { onAssign(i, ov); setActiveLine(null); }}
        onReset={() => { onAssign(i, undefined); setActiveLine(null); }}
        onClose={() => setActiveLine(null)}
      />
    ) : null;

  return (
    <div className="font-mono text-xs max-h-80 overflow-y-auto rounded border border-border p-3 bg-background/50 leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) {
          currentChar = null;
          return <div key={i} className="h-2" />;
        }

        const isActive = activeLine === i;
        const hasOverride = overrides.has(i);
        const override = overrides.get(i);
        const toggle = () => onAssign && setActiveLine(isActive ? null : i);
        const clickClass = onAssign ? "cursor-pointer" : "";

        // Explicit override
        if (hasOverride && override) {
          if (override.kind === "header") {
            currentChar = override.char.toUpperCase();
            const color = colorMap.get(override.char.toUpperCase());
            const { header, dialogue } = splitAtColon(override.char, trimmed);
            return (
              <div key={i}>
                <div
                  style={{ color: color?.color, backgroundColor: color?.bgColor }}
                  className={`font-bold px-1 rounded-sm flex items-center gap-1 group ${clickClass}`}
                  onClick={toggle}
                >
                  <span className="flex-1">{header}</span>
                  {editIcon}
                </div>
                {dialogue && (
                  <div style={{ color: color?.color, opacity: 0.8 }} className="pl-3">
                    {dialogue}
                  </div>
                )}
                {isActive && makePanel(i, override)}
              </div>
            );
          }
          if (override.kind === "dialogue") {
            const color = colorMap.get(override.char.toUpperCase());
            return (
              <div key={i}>
                <div
                  style={{ color: color?.color, opacity: 0.8 }}
                  className={`pl-3 flex items-center gap-1 group ${clickClass}`}
                  onClick={toggle}
                >
                  <span className="flex-1">{line}</span>
                  {editIcon}
                </div>
                {isActive && makePanel(i, override)}
              </div>
            );
          }
          // stage-direction override
          return (
            <div key={i}>
              <div
                className={`text-muted italic flex items-center gap-1 group ${clickClass}`}
                onClick={toggle}
              >
                <span className="flex-1">{line}</span>
                {editIcon}
              </div>
              {isActive && makePanel(i, override)}
            </div>
          );
        }

        // Parenthetical stage directions (single-line or multi-line block)
        if (parenStageLines.has(i)) {
          return (
            <div key={i}>
              <div
                className={`text-muted italic flex items-center gap-1 group ${clickClass}`}
                onClick={toggle}
              >
                <span className="flex-1">{line}</span>
                {editIcon}
              </div>
              {isActive && makePanel(i, undefined)}
            </div>
          );
        }

        // Auto-detect
        const matchResult = matchCharInLine(line, charSet);
        if (matchResult) {
          const { char: matched, prefix } = matchResult;
          currentChar = matched;
          const color = colorMap.get(matched);
          const { header, dialogue } = splitAtColon(prefix, trimmed);
          return (
            <div key={i}>
              <div
                style={{ color: color?.color, backgroundColor: color?.bgColor }}
                className={`font-bold px-1 rounded-sm flex items-center gap-1 group ${clickClass}`}
                onClick={toggle}
              >
                <span className="flex-1">{header}</span>
                {editIcon}
              </div>
              {dialogue && (
                <div style={{ color: color?.color, opacity: 0.8 }} className="pl-3">
                  {dialogue}
                </div>
              )}
              {isActive && makePanel(i, undefined)}
            </div>
          );
        }

        if (currentChar) {
          const color = colorMap.get(currentChar);
          return (
            <div key={i}>
              <div
                style={{ color: color?.color, opacity: 0.8 }}
                className={`pl-3 flex items-center gap-1 group ${clickClass}`}
                onClick={toggle}
              >
                <span className="flex-1">{line}</span>
                {editIcon}
              </div>
              {isActive && makePanel(i, undefined)}
            </div>
          );
        }

        // Unattributed
        return (
          <div key={i}>
            <div
              className={`text-muted italic flex items-center gap-1 group ${clickClass}`}
              onClick={toggle}
            >
              <span className="flex-1">{line}</span>
              {editIcon}
            </div>
            {isActive && makePanel(i, undefined)}
          </div>
        );
      })}
    </div>
  );
}

export function SceneImportForm({
  projectId,
  onSuccess,
}: SceneImportFormProps) {
  const { createScenes } = useScenes();
  const { importCastCharacters, replaceProjectCharacters, getProjectCharacters } = useVoice();
  const [selectedTab, setSelectedTab] = useState<"paste" | "upload">("paste");
  const [uploadMode, setUploadMode] = useState<"text" | "image">("text");
  const [ocrText, setOcrText] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [inputMode, setInputMode] = useState<SceneInputMode>("auto");
  const [preview, setPreview] = useState<ScenePreview[]>([]);
  const [editingIndices, setEditingIndices] = useState<Set<number>>(new Set());
  const [editingTitles, setEditingTitles] = useState<Map<number, string>>(
    new Map(),
  );
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState<Map<number, string>>(
    new Map(),
  );
  const [editingCharacters, setEditingCharacters] = useState<
    Map<number, string[]>
  >(new Map());
  const [newCharInput, setNewCharInput] = useState<string>("");
  const [selectedForDelete, setSelectedForDelete] = useState<Set<number>>(
    new Set(),
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [detectedSceneCount, setDetectedSceneCount] = useState<number>(0);
  const [castNames, setCastNames] = useState<string[]>([]);
  const [tocData, setTocData] = useState<ParsedToc | null>(null);
  const [showCastReview, setShowCastReview] = useState(false);
  const [castCategories, setCastCategories] = useState<
    Map<string, CastCategory>
  >(new Map());
  const [parsedSceneData, setParsedSceneData] = useState<ParsedSceneData[]>([]);
  const [mergeTargets, setMergeTargets] = useState<Map<string, string>>(
    new Map(),
  );
  const [castImportMode, setCastImportMode] = useState<
    "add" | "replace" | "skip"
  >("add");
  const [editingContentActive, setEditingContentActive] = useState<
    Set<number>
  >(new Set());
  const [lineAssignments, setLineAssignments] = useState<
    Map<number, Map<number, LineOverride>>
  >(new Map());

  const handleParseText = (text: string) => {
    setError(null);
    if (!text.trim()) {
      setError("Please enter some text");
      setPreview([]);
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

      const scenes = createScenesFromInput(projectId, sceneText, inputMode);

      if (scenes.length === 0) {
        setError("No content to parse");
        setPreview([]);
        return;
      }

      // Store raw scene data for use after cast review
      const parsedSceneDataLocal = scenes.map((scene) => ({
        title: scene.title,
        content: scene.content,
        songs: toc ? findSongsForScene(toc, scene.title) : [],
      }));
      setParsedSceneData(parsedSceneDataLocal);

      // Build cast list: start with any formal cast page, then add every
      // speaker name found in the scene dialogue so pasted scripts without
      // a cast page still populate the cast review.
      const castPageNames = extractCastNames(text);
      const castSet = new Set<string>(castPageNames);
      for (const scene of scenes) {
        for (const char of extractSceneCharacters(scene.content)) {
          castSet.add(char);
        }
      }
      let cast = Array.from(castSet).sort();
      if (cast.length === 0) {
        cast = getProjectCharacters(projectId).map((c) => c.characterName);
      }

      // Initialize cast categories (all Individual by default)
      const categories = new Map<string, CastCategory>();
      for (const name of cast) {
        categories.set(name, "Individual");
      }
      setCastCategories(categories);

      if (castPageNames.length > 0) {
        // Script has a formal cast page — skip the review step and go
        // straight to scene preview using the cast page names as active cast.
        setCastNames(castPageNames);
        setPreview(
          parsedSceneDataLocal.map((scene) => ({
            title: scene.title,
            contentPreview:
              scene.content.substring(0, 200).replace(/\n/g, " ") + "...",
            fullContent: scene.content,
            characters: extractSceneCharacters(scene.content, castPageNames),
            songs: scene.songs,
            deleted: false,
          })),
        );
        setShowCastReview(false);
      } else {
        // No formal cast page — show the cast review step.
        setCastNames(cast);
        setShowCastReview(true);
        setPreview([]);
      }

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
  };

  const handleConfirmCast = () => {
    const activeCast = castNames.filter(
      (name) => castCategories.get(name) !== "Non-character",
    );
    setCastNames(activeCast);

    setPreview(
      parsedSceneData.map((scene) => ({
        title: scene.title,
        contentPreview:
          scene.content.substring(0, 200).replace(/\n/g, " ") + "...",
        fullContent: scene.content,
        characters: extractSceneCharacters(scene.content, activeCast),
        songs: scene.songs,
        deleted: false,
      })),
    );

    setShowCastReview(false);
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

    const reparsedChars = extractSceneCharacters(newContent, castNames);
    const newPreview = [...preview];
    newPreview[index].fullContent = newContent;
    newPreview[index].contentPreview =
      newContent.substring(0, 200).replace(/\n/g, " ") + "...";
    newPreview[index].characters = reparsedChars;
    setPreview(newPreview);
    const newEditingChars = new Map(editingCharacters);
    newEditingChars.set(index, reparsedChars);
    setEditingCharacters(newEditingChars);
    setEditingContentActive((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    setNewCharInput("");
    setError(null);
  };

  const handleCancelContentEdit = () => {
    if (expandedIndex !== null) {
      setEditingContentActive((prev) => {
        const next = new Set(prev);
        next.delete(expandedIndex);
        return next;
      });
    }
  };

  const handleCreateScenes = async () => {
    setError(null);
    setIsCreating(true);

    try {
      const scenesToCreate = preview.filter((scene) => !scene.deleted);
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

      createScenes(projectId, finalScenes);

      // Auto-populate cast page: collect all unique characters across scenes
      const allCharacters = new Set<string>();
      for (const scene of finalScenes) {
        if (scene.characters) {
          for (const c of scene.characters) allCharacters.add(c);
        }
      }
      // Also include cast page names that aren't marked Non-character
      for (const name of castNames) {
        if (castCategories.get(name) !== "Non-character")
          allCharacters.add(name);
      }

      if (allCharacters.size > 0 && castImportMode !== "skip") {
        if (castImportMode === "replace") {
          replaceProjectCharacters(projectId, Array.from(allCharacters));
        } else {
          importCastCharacters(projectId, Array.from(allCharacters));
        }
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
      setShowCastReview(false);
      setCastCategories(new Map());
      setParsedSceneData([]);
      setCastImportMode("add");
      setEditingContentActive(new Set());
      setLineAssignments(new Map());
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
    setTocData(null);
    setEditingIndices(new Set());
    setEditingTitles(new Map());
    setExpandedIndex(null);
    setEditingContent(new Map());
    setEditingCharacters(new Map());
    setNewCharInput("");
    setSelectedForDelete(new Set());
    setCastNames([]);
    setShowCastReview(false);
    setCastCategories(new Map());
    setParsedSceneData([]);
    setMergeTargets(new Map());
    setCastImportMode("add");
    setEditingContentActive(new Set());
    setLineAssignments(new Map());
  };

  const activeScenesCount = preview.filter((s) => !s.deleted).length;
  const charColorMap = buildCharColorMap(castNames);

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

      {/* Input Mode Selector (visible when no preview and not in cast review) */}
      {preview.length === 0 && !showCastReview && (
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
      {selectedTab === "paste" && !showCastReview && (
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
      {selectedTab === "upload" && !showCastReview && (
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

      {/* Scene Info */}
      {detectedSceneCount > 1 && preview.length === 0 && !showCastReview && (
        <div className="p-3 bg-accent-cyan/10 border border-accent-cyan rounded text-accent-cyan text-sm">
          <strong>Detected {detectedSceneCount} scenes</strong> in the input
          text.
          {inputMode === "single" &&
            " (Single mode selected: will be treated as one scene)"}
        </div>
      )}

      {/* Cast Review Step */}
      {showCastReview && (
        <div className="space-y-4 border-t border-border pt-6">
          <div>
            <h3 className="text-light font-semibold text-lg">
              Review Identified Cast
            </h3>
            <p className="text-muted text-sm mt-1">
              Categorize each name before previewing scenes. Non-characters are
              excluded from the cast.
            </p>
          </div>

          {/* Cast import mode — only shown when the project already has characters */}
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
                    value: "add",
                    label: "Add new characters",
                    desc: "Keep existing characters and add any new ones from this import.",
                  },
                  {
                    value: "replace",
                    label: "Replace all",
                    desc: "Remove all existing characters and replace with this cast. Voice settings will be lost.",
                  },
                  {
                    value: "skip",
                    label: "Skip",
                    desc: "Keep the cast list as is. No characters will be added or removed.",
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
                      className={`text-sm font-medium ${
                        castImportMode === value
                          ? "text-accent-cyan"
                          : "text-light"
                      }`}
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
              No cast names were identified in the script.
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
                        className={`text-sm font-mono ${
                          category === "Non-character"
                            ? "text-muted line-through"
                            : "text-light"
                        }`}
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
                          <option value="">Select character…</option>
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
            <Button variant="primary" onClick={handleConfirmCast}>
              Confirm Cast &amp; Preview Scenes
            </Button>
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
                    preview.every(
                      (s, i) => s.deleted || selectedForDelete.has(i),
                    )
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
                {tocData.entries.length} scene
                {tocData.entries.length !== 1 ? "s" : ""},{" "}
                {tocData.entries.reduce((sum, e) => sum + e.songs.length, 0)}{" "}
                song
                {tocData.entries.reduce((sum, e) => sum + e.songs.length, 0) !==
                1
                  ? "s"
                  : ""}{" "}
                found in table of contents. Songs are shown on matching scene
                cards below.
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
                            scene.deleted
                              ? "text-muted line-through"
                              : "text-light"
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
                  editingContentActive.has(index) ? (
                  /* ── Edit mode: textarea ── */
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
                      const chars =
                        editingCharacters.get(index) ?? scene.characters;
                      return (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted">
                              Characters:
                            </span>
                            <button
                              onClick={() => {
                                const currentContent =
                                  editingContent.get(index) ??
                                  scene.fullContent;
                                const autoChars = extractSceneCharacters(
                                  currentContent,
                                  castNames,
                                );
                                const newEditingChars = new Map(
                                  editingCharacters,
                                );
                                newEditingChars.set(index, autoChars);
                                setEditingCharacters(newEditingChars);
                                const newPreview = [...preview];
                                newPreview[index].characters = autoChars;
                                setPreview(newPreview);
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
                                    const updated = chars.filter(
                                      (c) => c !== char,
                                    );
                                    const newEditingChars = new Map(
                                      editingCharacters,
                                    );
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
                                  const name = newCharInput
                                    .trim()
                                    .toUpperCase();
                                  if (!chars.includes(name)) {
                                    const newEditingChars = new Map(
                                      editingCharacters,
                                    );
                                    newEditingChars.set(
                                      index,
                                      [...chars, name].sort(),
                                    );
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
                                  const name = newCharInput
                                    .trim()
                                    .toUpperCase();
                                  if (!chars.includes(name)) {
                                    const newEditingChars = new Map(
                                      editingCharacters,
                                    );
                                    newEditingChars.set(
                                      index,
                                      [...chars, name].sort(),
                                    );
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
                  /* ── View mode: highlighted content ── */
                  <div className="space-y-2 border-t border-border pt-3">
                    <HighlightedContent
                      content={scene.fullContent}
                      characters={scene.characters}
                      colorMap={charColorMap}
                      overrides={lineAssignments.get(index)}
                      onAssign={(lineIdx, assignment) => {
                        // If the assignment names a character not yet in the
                        // cast, register it so it gets a color and is imported.
                        if (assignment && "char" in assignment) {
                          const newName = assignment.char.trim().toUpperCase();
                          if (
                            newName &&
                            !castNames.some(
                              (n) => n.toUpperCase() === newName,
                            )
                          ) {
                            setCastNames((prev) =>
                              [...prev, newName].sort(),
                            );
                            setPreview((prev) => {
                              const updated = [...prev];
                              if (
                                !updated[index].characters.some(
                                  (c) => c.toUpperCase() === newName,
                                )
                              ) {
                                updated[index] = {
                                  ...updated[index],
                                  characters: [
                                    ...updated[index].characters,
                                    newName,
                                  ].sort(),
                                };
                              }
                              return updated;
                            });
                          }
                        }
                        setLineAssignments((prev) => {
                          const next = new Map(prev);
                          const sceneMap = new Map(prev.get(index) ?? []);
                          if (assignment === undefined) {
                            sceneMap.delete(lineIdx);
                          } else {
                            sceneMap.set(lineIdx, assignment);
                          }
                          if (sceneMap.size === 0) {
                            next.delete(index);
                          } else {
                            next.set(index, sceneMap);
                          }
                          return next;
                        });
                      }}
                    />
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
                        onClick={() =>
                          setEditingContentActive((prev) => {
                            const next = new Set(prev);
                            next.add(index);
                            return next;
                          })
                        }
                        className="px-3 py-1 bg-accent-cyan/20 text-accent-cyan rounded text-sm hover:bg-accent-cyan/30 transition-colors"
                      >
                        Edit Content
                      </button>
                      <button
                        onClick={() => setExpandedIndex(null)}
                        className="px-3 py-1 bg-border text-muted rounded text-sm hover:bg-border/50 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )
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
                    <div className="text-xs space-y-1">
                      <span className="text-muted">Characters: </span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {scene.characters.map((char) => {
                          const color = charColorMap.get(char.toUpperCase());
                          return (
                            <span
                              key={char}
                              style={{ color: color?.color, backgroundColor: color?.bgColor }}
                              className="px-1.5 py-0.5 rounded font-mono text-xs"
                            >
                              {char}
                            </span>
                          );
                        })}
                      </div>
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
                        View Lines
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
