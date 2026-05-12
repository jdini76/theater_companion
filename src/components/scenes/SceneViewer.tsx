"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Scene } from "@/types/scene";
// import { Button } from "@/components/ui/Button";
import type { ProductionType } from "@/types/project";
import type { DialogueLine } from "@/types/rehearsal";
import { useVoice } from "@/contexts/VoiceContext";
import { useScenes } from "@/contexts/SceneContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  extractSceneCharacters,
  getSceneParseFormat,
  reflowWrappedText,
} from "@/lib/scenes";
import { parseDialogueLines } from "@/lib/rehearsal";
import {
  type LineOverride,
  buildCharColorMap,
  GROUP_COLOR,
  GROUP_CHARACTER_NAMES,
  HighlightedContent,
} from "./SceneHighlight";
import {
  MoreHorizontal,
  Maximize2,
  Minimize2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useRehearsalNav } from "@/contexts/RehearsalNavContext";

interface SceneViewerProps {
  scene: Scene;
  projectId: string;
  productionType?: ProductionType;
  sceneOpenMode?: "scene" | "set-piece";
  onEdit?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  fullscreenOpenToken?: number;
  fullscreenOpenView?: "interactive" | "screenplay";
}

type ScreenplayPageItem =
  | { kind: "line"; line: DialogueLine }
  | { kind: "spacer" };

type ScreenplayPage = {
  items: ScreenplayPageItem[];
};

function useLineOverrides(sceneId: string) {
  const storageKey = `theater_scene_line_overrides_${sceneId}`;
  const legacyKey = `scene_line_overrides_${sceneId}`;

  const [overrides, setOverrides] = useState<Map<number, LineOverride>>(() => {
    try {
      const raw =
        localStorage.getItem(storageKey) ?? localStorage.getItem(legacyKey);
      if (raw) return new Map(JSON.parse(raw) as [number, LineOverride][]);
    } catch {}
    return new Map();
  });

  // Re-load when the scene changes; migrate legacy key on first encounter
  useEffect(() => {
    try {
      let raw = localStorage.getItem(storageKey);
      if (!raw) {
        const legacy = localStorage.getItem(legacyKey);
        if (legacy) {
          localStorage.setItem(storageKey, legacy);
          localStorage.removeItem(legacyKey);
          raw = legacy;
        }
      }
      setOverrides(
        raw ? new Map(JSON.parse(raw) as [number, LineOverride][]) : new Map(),
      );
    } catch {
      setOverrides(new Map());
    }
  }, [sceneId, storageKey, legacyKey]);

  const assign = (lineIdx: number, assignment: LineOverride | undefined) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      if (assignment === undefined) {
        next.delete(lineIdx);
      } else {
        next.set(lineIdx, assignment);
      }
      const pairs = Array.from(next.entries());
      if (pairs.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(pairs));
      } else {
        localStorage.removeItem(storageKey);
      }
      return next;
    });
  };

  return { overrides, assign };
}

export function SceneViewer({
  scene,
  projectId,
  productionType,
  sceneOpenMode = "scene",
  onEdit,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  fullscreenOpenToken,
  fullscreenOpenView,
}: SceneViewerProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenView, setFullscreenView] = useState<
    "interactive" | "screenplay"
  >("interactive");
  const [highlightMyOnly, setHighlightMyOnly] = useLocalStorage(
    "theater_scene_highlight_my_only",
    false,
  );
  const [scriptTextSize, setScriptTextSize] = useLocalStorage<string>(
    "theater_scene_text_size",
    "text-xs",
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const screenplayScrollRef = useRef<HTMLDivElement>(null);
  const { getProjectCharacters } = useVoice();
  const { navigateToCharacter } = useRehearsalNav();
  const { getProjectScenes, updateScene } = useScenes();
  const { overrides, assign } = useLineOverrides(scene.id);
  const [screenplayPageIndex, setScreenplayPageIndex] = useState(0);

  const projectCharacters = getProjectCharacters(projectId);
  const myRoleChars = projectCharacters.filter((c) => c.isMyRole);
  const projectCast = projectCharacters.map((c) => c.characterName);
  const sceneChars = scene.characters ?? [];

  // Build alias → canonical map (uppercase) so merged names resolve correctly.
  // e.g. "APPLE" was merged into "MISS HANNIGAN" → aliasToCanonical("APPLE") = "MISS HANNIGAN"
  const aliasToCanonical = new Map<string, string>();
  for (const char of projectCharacters) {
    for (const alias of char.aliases ?? []) {
      aliasToCanonical.set(
        alias.toUpperCase(),
        char.characterName.toUpperCase(),
      );
    }
  }

  // Canonical names for color assignment (determines which hue each character gets).
  const canonicalUpperSet = new Set<string>();
  const canonicalNames: string[] = [];
  for (const name of projectCast) {
    const upper = name.toUpperCase();
    if (!canonicalUpperSet.has(upper)) {
      canonicalUpperSet.add(upper);
      canonicalNames.push(upper);
    }
  }

  // Color map: built from canonical names only, then alias entries are added
  // pointing to the same color as their canonical so highlights match.
  const colorMap = buildCharColorMap(
    projectCast.length > 0
      ? canonicalNames
      : sceneChars.map((n) => n.toUpperCase()),
  );
  for (const [alias, canonical] of aliasToCanonical) {
    const color = colorMap.get(canonical);
    if (color) colorMap.set(alias, color);
  }

  // allNames: canonical + alias names so HighlightedContent can match both forms.
  // When no project cast exists, fall back to scene.characters.
  // Always include sceneChars so manually textbox-added characters appear in
  // the colored-buttons list even when a project cast exists.
  const allNamesSet = new Set<string>();
  const allNames: string[] = [];
  const highlightSource =
    projectCast.length > 0
      ? [
          ...canonicalNames,
          ...Array.from(aliasToCanonical.keys()),
          // scene-only chars (textbox-added or group names not in project cast)
          ...sceneChars
            .map((n) => n.toUpperCase())
            .filter((n) => !canonicalUpperSet.has(n)),
        ]
      : sceneChars.map((n) => n.toUpperCase());
  for (const name of highlightSource) {
    if (!allNamesSet.has(name)) {
      allNamesSet.add(name);
      allNames.push(name);
    }
  }

  // Give scene-only chars (textbox-added + group names) a color in the map.
  // Group-named characters get GROUP_COLOR; others get hue-based colors.
  for (const name of sceneChars.map((n) => n.toUpperCase())) {
    if (!colorMap.has(name)) {
      if (GROUP_CHARACTER_NAMES.has(name)) {
        colorMap.set(name, GROUP_COLOR);
      } else {
        // Assign the next hue in sequence after existing entries.
        const newMap = buildCharColorMap([...colorMap.keys(), name]);
        const color = newMap.get(name);
        if (color) colorMap.set(name, color);
      }
    }
  }

  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  useEffect(() => {
    if (fullscreenOpenToken === undefined) return;
    setIsFullscreen(true);
    setFullscreenView(fullscreenOpenView ?? "screenplay");
    if (fullscreenOpenView === "screenplay") {
      setScreenplayPageIndex(0);
    }
  }, [fullscreenOpenToken, fullscreenOpenView]);

  const handleCopyContent = () => {
    navigator.clipboard.writeText(scene.content);
    setIsCopied(true);
    setMenuOpen(false);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([scene.content], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${scene.title.replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setMenuOpen(false);
  };

  const handleAssign = (
    lineIdx: number,
    assignment: LineOverride | undefined,
  ) => {
    // If a new character name is introduced, add it to scene.characters
    if (assignment && "char" in assignment) {
      const newName = assignment.char.trim().toUpperCase();
      if (newName && !allNames.some((n) => n.toUpperCase() === newName)) {
        const updatedCharacters = Array.from(
          new Set([...sceneChars, newName]),
        ).sort();
        const updatedLines = parseDialogueLines(
          scene.content,
          getSceneParseFormat(productionType),
          updatedCharacters,
        );
        updateScene(scene.id, {
          characters: updatedCharacters,
          lines: updatedLines,
        });
      }
    }
    assign(lineIdx, assignment);
  };

  // Character tags: use pre-parsed lines when available; fall back to
  // re-extracting from raw content for scenes that pre-date persistent lines.
  // Results are remapped to canonical names so each character appears once.
  const sceneCharSet = new Set<string>();
  const sceneCharacters: string[] = [];
  const expandedCast =
    projectCast.length > 0
      ? [...projectCast, ...Array.from(aliasToCanonical.keys())]
      : [];
  let rawTagNames: string[];
  if (scene.lines && scene.lines.length > 0) {
    // Derive from parsed lines — no re-parse of content needed
    rawTagNames = Array.from(
      new Set(
        scene.lines
          .filter((l) => !l.isStageDirection && !l.character.startsWith("["))
          .flatMap((l) =>
            l.character
              .split(/\s*[,&+]\s*/)
              .map((n) => n.trim().toUpperCase())
              .filter(Boolean),
          ),
      ),
    );
  } else {
    rawTagNames =
      projectCast.length > 0
        ? extractSceneCharacters(scene.content, expandedCast, productionType)
        : sceneChars;
  }
  const resolvedTagNames = rawTagNames.map((name) => {
    const upper = name.toUpperCase();
    return aliasToCanonical.get(upper) ?? upper;
  });
  for (const name of resolvedTagNames) {
    const upper = name.toUpperCase();
    if (!sceneCharSet.has(upper)) {
      sceneCharSet.add(upper);
      sceneCharacters.push(upper);
    }
  }
  const allCharSet = new Set<string>();
  const allCharacters: string[] = [];
  for (const name of projectCast) {
    const upper = name.toUpperCase();
    if (!allCharSet.has(upper)) {
      allCharSet.add(upper);
      allCharacters.push(upper);
    }
  }
  const assignPanelProps = {
    sceneCharacters,
    allCharacters,
  };
  const stageDirectionLabel =
    productionType === "Film" ? "Action Line" : "Stage Direction";

  // When "highlight my lines only" is on, filter the colorMap so only the
  // user's role(s) lines get coloured. We always pass allNames as characters
  // so that non-user character headers are still detected — this prevents
  // currentChar from "leaking" the user's color onto the next character's lines.
  const myRoleNames: string[] = myRoleChars.flatMap((c) => [
    c.characterName.toUpperCase(),
    ...(c.aliases ?? []).map((a) => a.toUpperCase()),
  ]);
  const myRoleNamesSet = new Set(myRoleNames);
  // Group characters that are NOT in the project cast should always be
  // highlighted (they're scene-only ensemble cues). If they ARE in the cast,
  // treat them like any other character — only highlight when "my role" is set.
  const projectCastUpperSet = new Set(projectCast.map((n) => n.toUpperCase()));
  const alwaysShowNames = new Set(
    [...GROUP_CHARACTER_NAMES].filter((g) => !projectCastUpperSet.has(g)),
  );
  const displayColorMap =
    highlightMyOnly && myRoleNames.length > 0
      ? new Map(
          [...colorMap].filter(
            ([k]) => myRoleNamesSet.has(k) || alwaysShowNames.has(k),
          ),
        )
      : colorMap;

  const songs = scene.songs ?? [];
  const displayContent = scene.content;
  const displayDescription = scene.description
    ? reflowWrappedText(scene.description)
    : "";
  const showSongs = productionType !== "Film" && songs.length > 0;
  const setPiece = scene.setPiece?.trim();
  const screenplaySourceScenes = useMemo(() => {
    if (sceneOpenMode !== "set-piece" || !setPiece) return [scene];

    const label = setPiece.toLowerCase();
    const scenesInSetPiece = getProjectScenes(projectId)
      .filter((item) => item.setPiece?.trim().toLowerCase() === label)
      .sort((left, right) => left.order - right.order);

    return scenesInSetPiece.length > 0 ? scenesInSetPiece : [scene];
  }, [getProjectScenes, projectId, scene, sceneOpenMode, setPiece]);

  useEffect(() => {
    setScreenplayPageIndex(0);
  }, [scene.id, sceneOpenMode, setPiece]);

  const isSetPieceScreenplay =
    sceneOpenMode === "set-piece" && Boolean(setPiece);

  const screenplayFontSize =
    scriptTextSize === "text-xs"
      ? "11pt"
      : scriptTextSize === "text-sm"
        ? "12pt"
        : "13pt";

  const screenplayPageBudget =
    screenplayFontSize === "11pt"
      ? 56
      : screenplayFontSize === "12pt"
        ? 52
        : 48;

  const screenplayPages = useMemo<ScreenplayPage[]>(() => {
    const pages: ScreenplayPage[] = [];
    let currentItems: ScreenplayPageItem[] = [];
    let currentUnits = 0;

    const estimateTextLines = (text: string, charsPerLine: number) => {
      const segments = text.split(/\r?\n/);
      return Math.max(
        1,
        segments.reduce((count, segment) => {
          const trimmed = segment.trim();
          if (!trimmed) return count + 1;
          return count + Math.max(1, Math.ceil(trimmed.length / charsPerLine));
        }, 0),
      );
    };

    const estimateUnits = (item: ScreenplayPageItem) => {
      if (item.kind === "spacer") return 1;
      const line = item.line;
      const text = line.dialogue.trim();

      if (line.character === "[Scene Heading]") return 1.2;
      if (line.character === "[Narrative]") return estimateTextLines(text, 68);
      if (line.character === "[Song]" || line.isSong)
        return estimateTextLines(text, 66);
      if (line.isStageDirection) return estimateTextLines(text, 68);

      return 1 + estimateTextLines(text, 54);
    };

    const pushPage = () => {
      if (currentItems.length === 0) return;
      pages.push({ items: currentItems });
      currentItems = [];
      currentUnits = 0;
    };

    for (const screenplayScene of screenplaySourceScenes) {
      const screenplayLines: DialogueLine[] = parseDialogueLines(
        screenplayScene.content,
        getSceneParseFormat(productionType),
      );

      const hasLeadingHeading =
        screenplayLines[0]?.character === "[Scene Heading]";
      const screenplayHeadingText = screenplayScene.title.trim();
      const sceneLines =
        !hasLeadingHeading && screenplayHeadingText
          ? [
              {
                lineNumber: -1,
                character: "[Scene Heading]",
                dialogue: screenplayHeadingText,
                isStageDirection: true,
              },
              ...screenplayLines,
            ]
          : screenplayLines;

      const screenplayItems: ScreenplayPageItem[] = sceneLines.map((line) => ({
        kind: "line",
        line,
      }));

      if (currentItems.length > 0) {
        screenplayItems.unshift({ kind: "spacer" });
      }

      for (const item of screenplayItems) {
        const units = estimateUnits(item);
        if (
          currentItems.length > 0 &&
          currentUnits + units > screenplayPageBudget
        ) {
          pushPage();
        }
        if (item.kind === "spacer" && currentItems.length === 0) {
          continue;
        }
        currentItems.push(item);
        currentUnits += units;
      }
    }

    pushPage();

    for (let index = 0; index < pages.length - 1; index++) {
      const page = pages[index];
      const nextPage = pages[index + 1];
      const lastLineIndex = [...page.items]
        .map((item, itemIndex) => ({ item, itemIndex }))
        .reverse()
        .find(({ item }) => item.kind === "line");

      if (
        !lastLineIndex ||
        lastLineIndex.item.kind !== "line" ||
        lastLineIndex.item.line.character !== "[Scene Heading]"
      ) {
        continue;
      }

      const movedItems = page.items.splice(lastLineIndex.itemIndex);
      if (movedItems.length === 0) {
        continue;
      }

      while (nextPage.items[0]?.kind === "spacer") {
        nextPage.items.shift();
      }
      nextPage.items.unshift(...movedItems);
      while (page.items[page.items.length - 1]?.kind === "spacer") {
        page.items.pop();
      }
    }

    return pages.length > 0 ? pages : [{ items: [] }];
  }, [productionType, screenplayPageBudget, screenplaySourceScenes]);

  const screenplayPage =
    screenplayPages[screenplayPageIndex] ?? screenplayPages[0];
  const screenplayPageNumber = screenplayPageIndex + 1;
  const screenplayPageCount = screenplayPages.length;
  const screenplayPageTitle = isSetPieceScreenplay
    ? `Page ${screenplayPageNumber}`
    : scene.title;
  const screenplayPageSubtitle = isSetPieceScreenplay ? setPiece : undefined;

  useEffect(() => {
    setScreenplayPageIndex((value) =>
      Math.min(value, Math.max(0, screenplayPageCount - 1)),
    );
  }, [screenplayPageCount]);

  const handleFullscreenOpen = () => {
    if (isSetPieceScreenplay) {
      setFullscreenView("screenplay");
      setScreenplayPageIndex(0);
    } else {
      setFullscreenView("interactive");
    }
    setIsFullscreen(true);
  };

  const handlePrevScreenplayPage = () => {
    setScreenplayPageIndex((value) => Math.max(0, value - 1));
    screenplayScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  };

  const handleNextScreenplayPage = () => {
    setScreenplayPageIndex((value) =>
      Math.min(screenplayPageCount - 1, value + 1),
    );
    screenplayScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  };

  const renderScreenplayLine = (line: DialogueLine, index: number) => {
    const text = line.dialogue.trim();
    const isHeading = line.character === "[Scene Heading]";
    const isNarrative = line.character === "[Narrative]";
    const isStageDirection = line.isStageDirection;
    const isSong = line.isSong || line.character === "[Song]";
    const looksLikeParenthetical =
      isStageDirection && /^\(.*\)$/.test(text) && text.length < 80;

    if (isHeading) {
      return (
        <div
          key={index}
          className="whitespace-pre-wrap uppercase font-bold tracking-normal text-black"
        >
          {text}
        </div>
      );
    }

    if (isNarrative || isSong) {
      return (
        <div key={index} className={isSong ? "italic text-amber-900" : ""}>
          <div className="whitespace-pre-wrap leading-[1.3]">{text}</div>
        </div>
      );
    }

    if (looksLikeParenthetical) {
      return (
        <div
          key={index}
          className="italic leading-[1.2]"
          style={{ marginLeft: "2.2in", maxWidth: "2.4in" }}
        >
          {text}
        </div>
      );
    }

    if (isStageDirection) {
      return (
        <div key={index} className="leading-[1.3] whitespace-pre-wrap">
          {text}
        </div>
      );
    }

    return (
      <div key={index}>
        <div
          className="uppercase font-semibold tracking-wide"
          style={{ margin: "0 auto", width: "2.4in", textAlign: "center" }}
        >
          {line.character}
        </div>
        <div
          className="leading-[1.45] whitespace-pre-wrap"
          style={{ margin: "0 auto", maxWidth: "3.9in" }}
        >
          {text}
        </div>
      </div>
    );
  };

  return (
    <div className="card flex flex-col flex-1 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold text-light">{scene.title}</h2>
          {displayDescription && (
            <p className="text-muted text-sm mt-1 whitespace-pre-line">
              {displayDescription}
            </p>
          )}
          {setPiece && (
            <p className="text-xs uppercase tracking-[0.2em] text-accent-cyan/80 mt-2">
              Set Piece: {setPiece}
            </p>
          )}
          <p className="text-xs text-muted mt-2">
            {scene.content.split("\n").length} lines
            {" · "}~{Math.ceil(scene.content.length / 5)} words
            {" · "}edited {new Date(scene.updatedAt).toLocaleDateString()}
          </p>
        </div>

        {/* Ellipsis menu */}
        <div className="relative flex-shrink-0" ref={menuRef}>
          {/* Prev / Next nav */}
          {(onPrev || onNext) && (
            <div className="inline-flex items-center gap-0.5 mr-1">
              <button
                onClick={onPrev}
                disabled={!hasPrev}
                title="Previous scene"
                className="p-1 rounded hover:bg-white/10 text-muted hover:text-light disabled:opacity-25 disabled:cursor-default transition-colors"
                aria-label="Previous scene"
              >
                <ChevronUp size={16} />
              </button>
              <button
                onClick={onNext}
                disabled={!hasNext}
                title="Next scene"
                className="p-1 rounded hover:bg-white/10 text-muted hover:text-light disabled:opacity-25 disabled:cursor-default transition-colors"
                aria-label="Next scene"
              >
                <ChevronDown size={16} />
              </button>
            </div>
          )}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded hover:bg-white/10 text-muted hover:text-light transition-colors"
            aria-label="Scene options"
          >
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-dark-card/70 backdrop-blur-sm border border-white/10 rounded-lg shadow-lg z-20 overflow-hidden">
              <button
                onClick={handleCopyContent}
                className="w-full text-left px-4 py-2.5 text-sm text-light hover:bg-white/10 transition-colors"
              >
                {isCopied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={handleDownload}
                className="w-full text-left px-4 py-2.5 text-sm text-light hover:bg-white/10 transition-colors"
              >
                Download
              </button>
              {onEdit && (
                <button
                  onClick={() => {
                    onEdit();
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-light hover:bg-white/10 transition-colors"
                >
                  Edit
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Character tags + My lines toggle */}
      <div className="flex flex-wrap items-center gap-1.5">
        {sceneCharacters.map((char) => {
          const color = colorMap.get(char);
          const projectChar = getProjectCharacters(projectId).find(
            (c) =>
              c.characterName.toUpperCase() === char ||
              (c.aliases ?? []).some((a) => a.toUpperCase() === char),
          );
          return projectChar ? (
            <button
              key={char}
              onClick={() => navigateToCharacter(projectChar.id)}
              style={{
                color: color?.color,
                backgroundColor: color?.bgColor,
                borderColor: color?.color ? `${color.color}40` : undefined,
              }}
              className="px-2 py-0.5 rounded-full text-xs font-mono border hover:opacity-80 hover:ring-1 hover:ring-white/20 transition-opacity cursor-pointer"
              title={`View ${char} in Cast`}
            >
              {char}
            </button>
          ) : (
            <span
              key={char}
              style={{
                color: color?.color,
                backgroundColor: color?.bgColor,
                borderColor: color?.color ? `${color.color}40` : undefined,
              }}
              className="px-2 py-0.5 rounded-full text-xs font-mono border"
            >
              {char}
            </span>
          );
        })}

        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          {/* My lines only toggle */}
          {myRoleChars.length > 0 && (
            <label className="flex items-center gap-1.5 cursor-pointer select-none flex-shrink-0">
              <input
                type="checkbox"
                checked={highlightMyOnly}
                onChange={(e) => setHighlightMyOnly(e.target.checked)}
                className="accent-accent-cyan w-3.5 h-3.5"
              />
              <span className="text-xs text-muted">My lines only</span>
            </label>
          )}

          {/* Text size control */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {(["text-xs", "text-sm", "text-base"] as const).map((size) => (
              <button
                key={size}
                onClick={() => setScriptTextSize(size)}
                title={
                  size === "text-xs"
                    ? "Small"
                    : size === "text-sm"
                      ? "Medium"
                      : "Large"
                }
                className={`px-1 rounded leading-none transition-colors ${
                  scriptTextSize === size
                    ? "text-light bg-white/15"
                    : "text-muted hover:text-light"
                } ${
                  size === "text-xs"
                    ? "text-xs"
                    : size === "text-sm"
                      ? "text-sm"
                      : "text-base"
                }`}
              >
                A
              </button>
            ))}
            <button
              onClick={handleFullscreenOpen}
              title="Fullscreen"
              className="ml-1 p-0.5 rounded text-muted hover:text-light transition-colors"
              aria-label="Expand to fullscreen"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Songs */}
      {showSongs && (
        <div className="flex flex-wrap gap-1.5">
          {songs.map((song) => (
            <span
              key={song}
              className="px-2 py-0.5 bg-yellow-500/15 text-yellow-400 text-xs rounded-full border border-yellow-500/20"
            >
              ♪ {song}
            </span>
          ))}
        </div>
      )}

      {/* Highlighted content — fully interactive */}
      <div className="flex-1 min-h-0">
        <HighlightedContent
          content={displayContent}
          characters={allNames}
          colorMap={displayColorMap}
          overrides={overrides}
          onAssign={handleAssign}
          maxHeight="max-h-[calc(160vh-20rem)]"
          textSize={scriptTextSize}
          allowColonHeaders={productionType !== "Film"}
          allowSongMenus={productionType !== "Film"}
          stageDirectionLabel={stageDirectionLabel}
          assignPanelProps={assignPanelProps}
        />
      </div>

      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-dark-base flex flex-col">
          {/* Fullscreen header row */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border flex-shrink-0 gap-2">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-light truncate">
                {isSetPieceScreenplay ? screenplayPageTitle : scene.title}
              </h2>
              {isSetPieceScreenplay && (
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted truncate">
                  {screenplayPageSubtitle ? `${screenplayPageSubtitle} · ` : ""}
                  {screenplayPageNumber} / {screenplayPageCount}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {isSetPieceScreenplay ? (
                <div className="inline-flex items-center gap-1 mr-1 rounded-md border border-white/10 px-2 py-1 text-xs text-light bg-white/5">
                  Screenplay
                </div>
              ) : (
                <div className="inline-flex rounded-md border border-white/10 overflow-hidden mr-1">
                  <button
                    onClick={() => setFullscreenView("interactive")}
                    className={`px-2 py-1 text-xs transition-colors ${
                      fullscreenView === "interactive"
                        ? "bg-white/15 text-light"
                        : "text-muted hover:text-light hover:bg-white/5"
                    }`}
                    aria-pressed={fullscreenView === "interactive"}
                  >
                    Interactive
                  </button>
                  <button
                    onClick={() => setFullscreenView("screenplay")}
                    className={`px-2 py-1 text-xs transition-colors border-l border-white/10 ${
                      fullscreenView === "screenplay"
                        ? "bg-white/15 text-light"
                        : "text-muted hover:text-light hover:bg-white/5"
                    }`}
                    aria-pressed={fullscreenView === "screenplay"}
                  >
                    Screenplay
                  </button>
                </div>
              )}

              {/* Text size */}
              {(["text-xs", "text-sm", "text-base"] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setScriptTextSize(size)}
                  title={
                    size === "text-xs"
                      ? "Small"
                      : size === "text-sm"
                        ? "Medium"
                        : "Large"
                  }
                  className={`px-1 rounded leading-none transition-colors ${
                    scriptTextSize === size
                      ? "text-light bg-white/15"
                      : "text-muted hover:text-light"
                  } ${
                    size === "text-xs"
                      ? "text-xs"
                      : size === "text-sm"
                        ? "text-sm"
                        : "text-base"
                  }`}
                >
                  A
                </button>
              ))}

              {/* My lines only */}
              {myRoleChars.length > 0 && (
                <label className="flex items-center gap-1 cursor-pointer select-none ml-1">
                  <input
                    type="checkbox"
                    checked={highlightMyOnly}
                    onChange={(e) => setHighlightMyOnly(e.target.checked)}
                    className="accent-accent-cyan w-3.5 h-3.5"
                  />
                  <span className="text-xs text-muted whitespace-nowrap">
                    My lines
                  </span>
                </label>
              )}

              {/* Pagination */}
              {isSetPieceScreenplay ? (
                <>
                  <button
                    onClick={handlePrevScreenplayPage}
                    disabled={screenplayPageIndex === 0}
                    title="Previous page"
                    className="p-1 rounded hover:bg-white/10 text-muted hover:text-light disabled:opacity-25 disabled:cursor-default transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    onClick={handleNextScreenplayPage}
                    disabled={screenplayPageIndex >= screenplayPageCount - 1}
                    title="Next page"
                    className="p-1 rounded hover:bg-white/10 text-muted hover:text-light disabled:opacity-25 disabled:cursor-default transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronDown size={16} />
                  </button>
                </>
              ) : (
                (onPrev || onNext) && (
                  <>
                    <button
                      onClick={onPrev}
                      disabled={!hasPrev}
                      title="Previous scene"
                      className="p-1 rounded hover:bg-white/10 text-muted hover:text-light disabled:opacity-25 disabled:cursor-default transition-colors"
                      aria-label="Previous scene"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      onClick={onNext}
                      disabled={!hasNext}
                      title="Next scene"
                      className="p-1 rounded hover:bg-white/10 text-muted hover:text-light disabled:opacity-25 disabled:cursor-default transition-colors"
                      aria-label="Next scene"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </>
                )
              )}

              {/* ⋯ menu */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="p-1.5 rounded hover:bg-white/10 text-muted hover:text-light transition-colors"
                  aria-label="Scene options"
                >
                  <MoreHorizontal size={18} />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-40 bg-dark-card/70 backdrop-blur-sm border border-white/10 rounded-lg shadow-lg z-20 overflow-hidden">
                    <button
                      onClick={handleCopyContent}
                      className="w-full text-left px-4 py-2.5 text-sm text-light hover:bg-white/10 transition-colors"
                    >
                      {isCopied ? "Copied!" : "Copy"}
                    </button>
                    <button
                      onClick={handleDownload}
                      className="w-full text-left px-4 py-2.5 text-sm text-light hover:bg-white/10 transition-colors"
                    >
                      Download
                    </button>
                    {onEdit && (
                      <button
                        onClick={() => {
                          onEdit();
                          setMenuOpen(false);
                          setIsFullscreen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-light hover:bg-white/10 transition-colors"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Minimize */}
              <button
                onClick={() => setIsFullscreen(false)}
                title="Exit fullscreen (Esc)"
                className="p-1.5 rounded hover:bg-white/10 text-muted hover:text-light transition-colors"
                aria-label="Exit fullscreen"
              >
                <Minimize2 size={18} />
              </button>
            </div>
          </div>

          {/* Character tags + songs */}
          {(sceneCharacters.length > 0 || showSongs) && (
            <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b border-border flex-shrink-0">
              {sceneCharacters.map((char) => {
                const color = colorMap.get(char);
                const projectChar = getProjectCharacters(projectId).find(
                  (c) =>
                    c.characterName.toUpperCase() === char ||
                    (c.aliases ?? []).some((a) => a.toUpperCase() === char),
                );
                return projectChar ? (
                  <button
                    key={char}
                    onClick={() => navigateToCharacter(projectChar.id)}
                    style={{
                      color: color?.color,
                      backgroundColor: color?.bgColor,
                      borderColor: color?.color
                        ? `${color.color}40`
                        : undefined,
                    }}
                    className="px-2 py-0.5 rounded-full text-xs font-mono border hover:opacity-80 transition-opacity cursor-pointer"
                    title={`View ${char} in Cast`}
                  >
                    {char}
                  </button>
                ) : (
                  <span
                    key={char}
                    style={{
                      color: color?.color,
                      backgroundColor: color?.bgColor,
                      borderColor: color?.color
                        ? `${color.color}40`
                        : undefined,
                    }}
                    className="px-2 py-0.5 rounded-full text-xs font-mono border"
                  >
                    {char}
                  </span>
                );
              })}
              {showSongs &&
                songs.map((song) => (
                  <span
                    key={song}
                    className="px-2 py-0.5 bg-yellow-500/15 text-yellow-400 text-xs rounded-full border border-yellow-500/20"
                  >
                    ♪ {song}
                  </span>
                ))}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-h-0 p-4">
            {fullscreenView === "interactive" && !isSetPieceScreenplay ? (
              <HighlightedContent
                content={displayContent}
                characters={allNames}
                colorMap={displayColorMap}
                overrides={overrides}
                onAssign={handleAssign}
                maxHeight="max-h-[calc(100vh-5rem)]"
                textSize={scriptTextSize}
                allowColonHeaders={productionType !== "Film"}
                allowSongMenus={productionType !== "Film"}
                stageDirectionLabel={stageDirectionLabel}
                assignPanelProps={assignPanelProps}
              />
            ) : (
              <div
                ref={screenplayScrollRef}
                className="h-full overflow-auto px-2 pb-4"
              >
                <div
                  className="mx-auto bg-[#f7f3e8] text-black shadow-2xl border border-black/10"
                  style={{
                    width: "min(92vw, 8.5in)",
                    minHeight: "11in",
                    padding: "1in 1in 1in 1.5in",
                    fontFamily: '"Courier New", Courier, monospace',
                    fontSize: screenplayFontSize,
                    lineHeight: 1.45,
                  }}
                >
                  <div className="space-y-2.5">
                    {screenplayPage.items.map((item, index) =>
                      item.kind === "spacer" ? (
                        <div
                          key={`spacer-${index}`}
                          className="h-2"
                          aria-hidden="true"
                        />
                      ) : (
                        renderScreenplayLine(item.line, index)
                      ),
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
