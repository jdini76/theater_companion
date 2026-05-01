"use client";

import React, { useState, useEffect, useRef } from "react";
import { Scene } from "@/types/scene";
// import { Button } from "@/components/ui/Button";
import { useVoice } from "@/contexts/VoiceContext";
import { useScenes } from "@/contexts/SceneContext";
import { extractSceneCharacters } from "@/lib/scenes";
import {
  type LineOverride,
  buildCharColorMap,
  HighlightedContent,
} from "./SceneHighlight";
import { MoreHorizontal } from "lucide-react";
import { useRehearsalNav } from "@/contexts/RehearsalNavContext";

interface SceneViewerProps {
  scene: Scene;
  projectId: string;
  onEdit?: () => void;
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

export function SceneViewer({ scene, projectId, onEdit }: SceneViewerProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { getProjectCharacters } = useVoice();
  const { navigateToCharacter } = useRehearsalNav();
  const { updateScene } = useScenes();
  const { overrides, assign } = useLineOverrides(scene.id);

  const projectCharacters = getProjectCharacters(projectId);
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
  const allNamesSet = new Set<string>();
  const allNames: string[] = [];
  const highlightSource =
    projectCast.length > 0
      ? [...canonicalNames, ...Array.from(aliasToCanonical.keys())]
      : sceneChars.map((n) => n.toUpperCase());
  for (const name of highlightSource) {
    if (!allNamesSet.has(name)) {
      allNamesSet.add(name);
      allNames.push(name);
    }
  }

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
        updateScene(scene.id, {
          characters: [...sceneChars, newName].sort(),
        });
      }
    }
    assign(lineIdx, assignment);
  };

  // Character tags: re-derive from scene content using the expanded cast
  // (canonical + aliases) so merged names and abbreviations both resolve.
  // Results are remapped to canonical names so each character appears once.
  const sceneCharSet = new Set<string>();
  const sceneCharacters: string[] = [];
  const expandedCast =
    projectCast.length > 0
      ? [...projectCast, ...Array.from(aliasToCanonical.keys())]
      : [];
  const rawTagNames =
    projectCast.length > 0
      ? extractSceneCharacters(scene.content, expandedCast)
      : sceneChars;
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

  const songs = scene.songs ?? [];

  return (
    <div className="card flex flex-col flex-1 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold text-light">{scene.title}</h2>
          {scene.description && (
            <p className="text-muted text-sm mt-1">{scene.description}</p>
          )}
          <p className="text-xs text-muted mt-2">
            {scene.content.split("\n").length} lines
            {" · "}~{Math.ceil(scene.content.length / 5)} words
            {" · "}edited {new Date(scene.updatedAt).toLocaleDateString()}
          </p>
        </div>

        {/* Ellipsis menu */}
        <div className="relative flex-shrink-0" ref={menuRef}>
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

      {/* Character tags */}
      {sceneCharacters.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
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
        </div>
      )}

      {/* Songs */}
      {songs.length > 0 && (
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
          content={scene.content}
          characters={allNames}
          colorMap={colorMap}
          overrides={overrides}
          onAssign={handleAssign}
          maxHeight="max-h-[calc(160vh-20rem)]"
          assignPanelProps={assignPanelProps}
        />
      </div>
    </div>
  );
}
