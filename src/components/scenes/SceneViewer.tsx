"use client";

import React, { useState, useEffect, useRef } from "react";
import { Scene } from "@/types/scene";
// import { Button } from "@/components/ui/Button";
import type { ProductionType } from "@/types/project";
import { useVoice } from "@/contexts/VoiceContext";
import { useScenes } from "@/contexts/SceneContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  buildSceneDisplayContent,
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
  onEdit?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

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
  onEdit,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: SceneViewerProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [highlightMyOnly, setHighlightMyOnly] = useLocalStorage(
    "theater_scene_highlight_my_only",
    false,
  );
  const [scriptTextSize, setScriptTextSize] = useLocalStorage<string>(
    "theater_scene_text_size",
    "text-xs",
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const { getProjectCharacters } = useVoice();
  const { navigateToCharacter } = useRehearsalNav();
  const { updateScene } = useScenes();
  const { overrides, assign } = useLineOverrides(scene.id);

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
  const displayContent = buildSceneDisplayContent(
    scene.content,
    scene.lines,
    productionType,
  );
  const displayDescription = scene.description
    ? reflowWrappedText(scene.description)
    : "";
  const showSongs = productionType !== "Film" && songs.length > 0;
  const setPiece = scene.setPiece?.trim();

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
      {sceneCharacters.length > 0 && (
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

          {/* My lines only toggle */}
          {myRoleChars.length > 0 && (
            <label className="ml-auto flex items-center gap-1.5 cursor-pointer select-none flex-shrink-0">
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
          <div
            className={`flex items-center gap-0.5 flex-shrink-0 ${
              myRoleChars.length === 0 ? "ml-auto" : ""
            }`}
          >
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
              onClick={() => setIsFullscreen(true)}
              title="Fullscreen"
              className="ml-1 p-0.5 rounded text-muted hover:text-light transition-colors"
              aria-label="Expand to fullscreen"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>
      )}

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
            <h2 className="text-lg font-bold text-light truncate min-w-0">
              {scene.title}
            </h2>
            <div className="flex items-center gap-1 flex-shrink-0">
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

              {/* Prev / Next */}
              {(onPrev || onNext) && (
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
          </div>
        </div>
      )}
    </div>
  );
}
