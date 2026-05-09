"use client";

import React, { useMemo, useState, useCallback } from "react";
import { useScenes } from "@/contexts/SceneContext";
import { useVoice } from "@/contexts/VoiceContext";
import { extractSongsFromScenes, SongEntry } from "@/lib/songs";
import { type LineOverride } from "@/components/scenes/SceneHighlight";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { ProductionType } from "@/types/project";
import { SongList } from "./SongList";
import { SongViewer } from "./SongViewer";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Read stored line overrides for all scenes from localStorage. */
function readAllSceneOverrides(
  sceneIds: string[],
): Map<string, Map<number, LineOverride>> {
  const result = new Map<string, Map<number, LineOverride>>();
  if (typeof window === "undefined") return result;
  for (const id of sceneIds) {
    try {
      const raw = localStorage.getItem(`theater_scene_line_overrides_${id}`);
      if (raw) {
        result.set(id, new Map(JSON.parse(raw) as [number, LineOverride][]));
      }
    } catch {
      // ignore corrupt entries
    }
  }
  return result;
}

interface SongManagerProps {
  projectId: string;
  projectName?: string;
  productionType?: ProductionType;
}

export function SongManager({
  projectId,
  projectName = "Project",
  productionType,
}: SongManagerProps) {
  const { getProjectScenes } = useScenes();
  const { getProjectCharacters } = useVoice();

  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  // Persistent song metadata: hidden IDs and per-song URLs
  const [hiddenSongIds, setHiddenSongIds] = useLocalStorage<string[]>(
    `theater_songs_hidden_${projectId}`,
    [],
  );
  const [songUrls, setSongUrls] = useLocalStorage<Record<string, string>>(
    `theater_songs_urls_${projectId}`,
    {},
  );

  const scenes = getProjectScenes(projectId);
  const knownCast = useMemo(
    () => getProjectCharacters(projectId).map((c) => c.characterName),
    [getProjectCharacters, projectId],
  );

  const allSongs = useMemo(() => {
    const sceneIds = scenes.map((s) => s.id);
    const overrides = readAllSceneOverrides(sceneIds);
    return extractSongsFromScenes(
      scenes,
      knownCast.length > 0 ? knownCast : undefined,
      overrides,
    );
  }, [scenes, knownCast]);

  const hiddenSet = useMemo(() => new Set(hiddenSongIds), [hiddenSongIds]);
  const songs = useMemo(
    () => allSongs.filter((s) => !hiddenSet.has(s.id)),
    [allSongs, hiddenSet],
  );

  const selectedSong = selectedSongId
    ? (songs.find((s) => s.id === selectedSongId) ?? null)
    : null;

  const handleSelectSong = (song: SongEntry) => {
    setSelectedSongId(song.id);
    setSidebarCollapsed(true);
  };

  const handleDeleteSong = useCallback(
    (id: string) => {
      setHiddenSongIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      if (selectedSongId === id) setSelectedSongId(null);
    },
    [setHiddenSongIds, selectedSongId],
  );

  const handleSetUrl = useCallback(
    (id: string, url: string) => {
      setSongUrls((prev) => {
        const next = { ...prev };
        if (url.trim()) {
          next[id] = url.trim();
        } else {
          delete next[id];
        }
        return next;
      });
    },
    [setSongUrls],
  );

  const handleToggleSidebar = () => {
    setSidebarCollapsed((v) => {
      if (v) setSelectedSongId(null);
      return !v;
    });
  };

  if (productionType === "Film") {
    return (
      <div className="max-w-7xl mx-auto px-4">
        <div className="card text-center py-12">
          <h1 className="text-2xl font-bold text-light mb-4">Songs Disabled</h1>
          <p className="text-muted">
            Film projects do not use song parsing or song menus.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4">
      {/* Page header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-light">Songs</h1>
          <p className="text-muted text-sm mt-1">{projectName}</p>
        </div>
        <span className="text-sm text-muted tabular-nums">
          {songs.length} {songs.length === 1 ? "song" : "songs"} detected
        </span>
      </div>

      {/* Main layout: slim sidebar + wide detail panel */}
      <div
        className="flex gap-4 items-stretch"
        style={{ minHeight: "calc(100vh - 14rem)" }}
      >
        {/* Sidebar */}
        <div
          className={`flex-shrink-0 flex flex-col transition-all duration-200 ${
            sidebarCollapsed ? "w-8" : "w-[32rem]"
          }`}
        >
          <div className="card flex flex-col flex-1 overflow-hidden relative">
            {/* Collapse toggle */}
            <button
              onClick={handleToggleSidebar}
              className="absolute top-3 right-2 z-10 p-0.5 rounded hover:bg-white/10 text-muted hover:text-light transition-colors"
              aria-label={
                sidebarCollapsed ? "Expand song list" : "Collapse song list"
              }
            >
              {sidebarCollapsed ? (
                <ChevronRight size={14} />
              ) : (
                <ChevronLeft size={14} />
              )}
            </button>

            {!sidebarCollapsed && (
              <div className="flex flex-col flex-1 p-2 overflow-hidden">
                <div className="flex items-center justify-between mb-2 flex-shrink-0 pr-5">
                  <span className="text-xs font-semibold text-muted uppercase tracking-widest">
                    Songs
                  </span>
                  <span className="text-xs text-muted tabular-nums">
                    {songs.length}
                  </span>
                </div>
                <SongList
                  songs={songs}
                  selectedSongId={selectedSongId}
                  onSelectSong={handleSelectSong}
                  onDeleteSong={handleDeleteSong}
                />
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 min-w-0 flex flex-col">
          {selectedSong ? (
            <SongViewer
              song={selectedSong}
              url={songUrls[selectedSong.id] ?? ""}
              onSetUrl={(url) => handleSetUrl(selectedSong.id, url)}
            />
          ) : (
            <div className="card flex-1 flex flex-col items-center justify-center text-center py-16">
              <p className="text-muted text-lg mb-2">Select a song</p>
              <p className="text-muted/60 text-sm">
                {songs.length === 0
                  ? "Import scenes containing song lyrics to get started"
                  : "Choose a song from the sidebar to view its lyrics"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
