"use client";

import React, { useMemo, useState } from "react";
import { useScenes } from "@/contexts/SceneContext";
import { useVoice } from "@/contexts/VoiceContext";
import { extractSongsFromScenes, SongEntry } from "@/lib/songs";
import { SongList } from "./SongList";
import { SongViewer } from "./SongViewer";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SongManagerProps {
  projectId: string;
  projectName?: string;
}

export function SongManager({
  projectId,
  projectName = "Project",
}: SongManagerProps) {
  const { getProjectScenes } = useScenes();
  const { getProjectCharacters } = useVoice();

  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const scenes = getProjectScenes(projectId);
  const knownCast = useMemo(
    () => getProjectCharacters(projectId).map((c) => c.characterName),
    [getProjectCharacters, projectId],
  );

  const songs = useMemo(
    () =>
      extractSongsFromScenes(
        scenes,
        knownCast.length > 0 ? knownCast : undefined,
      ),
    [scenes, knownCast],
  );

  const selectedSong = selectedSongId
    ? (songs.find((s) => s.id === selectedSongId) ?? null)
    : null;

  const handleSelectSong = (song: SongEntry) => {
    setSelectedSongId(song.id);
    setSidebarCollapsed(true);
  };

  const handleToggleSidebar = () => {
    setSidebarCollapsed((v) => {
      if (v) setSelectedSongId(null); // expanding -> clear selection
      return !v;
    });
  };

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
                />
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 min-w-0 flex flex-col">
          {selectedSong ? (
            <SongViewer song={selectedSong} />
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
