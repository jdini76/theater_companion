"use client";

import React, { useState, useEffect } from "react";
import { Scene } from "@/types/scene";
import { Button } from "@/components/ui/Button";
import { useVoice } from "@/contexts/VoiceContext";
import { useScenes } from "@/contexts/SceneContext";
import {
  type LineOverride,
  buildCharColorMap,
  HighlightedContent,
} from "./SceneHighlight";

interface SceneViewerProps {
  scene: Scene;
  projectId: string;
  onEdit?: () => void;
}

function useLineOverrides(sceneId: string) {
  const storageKey = `scene_line_overrides_${sceneId}`;

  const [overrides, setOverrides] = useState<Map<number, LineOverride>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return new Map(JSON.parse(raw) as [number, LineOverride][]);
    } catch {}
    return new Map();
  });

  // Re-load when the scene changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setOverrides(
        raw ? new Map(JSON.parse(raw) as [number, LineOverride][]) : new Map(),
      );
    } catch {
      setOverrides(new Map());
    }
  }, [sceneId, storageKey]);

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
  const { getProjectCharacters } = useVoice();
  const { updateScene } = useScenes();
  const { overrides, assign } = useLineOverrides(scene.id);

  const projectCast = getProjectCharacters(projectId).map(
    (c) => c.characterName,
  );
  const sceneChars = scene.characters ?? [];
  // Deduplicate by uppercased name, always display as ALL CAPS
  const nameSet = new Set<string>();
  const allNames: string[] = [];
  for (const name of [...projectCast, ...sceneChars]) {
    const upper = name.toUpperCase();
    if (!nameSet.has(upper)) {
      nameSet.add(upper);
      allNames.push(upper);
    }
  }
  const colorMap = buildCharColorMap(allNames);

  const handleCopyContent = () => {
    navigator.clipboard.writeText(scene.content);
    setIsCopied(true);
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

  // Fix: define assignPanelProps before return
  // Deduplicate and uppercase for assignPanelProps
  const sceneCharSet = new Set<string>();
  const sceneCharacters: string[] = [];
  for (const name of sceneChars) {
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
    <div className="card space-y-4">
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
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" onClick={handleCopyContent}>
            {isCopied ? "Copied!" : "Copy"}
          </Button>
          <Button size="sm" onClick={handleDownload}>
            Download
          </Button>
          {onEdit && (
            <Button size="sm" variant="primary" onClick={onEdit}>
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Character tags */}
      {sceneCharacters.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sceneCharacters.map((char) => {
            const color = colorMap.get(char);
            return (
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
      <HighlightedContent
        content={scene.content}
        characters={allNames}
        colorMap={colorMap}
        overrides={overrides}
        onAssign={handleAssign}
        maxHeight="max-h-[calc(100vh-20rem)]"
        assignPanelProps={assignPanelProps}
      />
    </div>
  );
}
