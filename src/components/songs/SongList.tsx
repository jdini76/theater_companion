"use client";

import React from "react";
import { SongEntry } from "@/lib/songs";
import { Music } from "lucide-react";

interface SongListProps {
  songs: SongEntry[];
  selectedSongId: string | null;
  onSelectSong: (song: SongEntry) => void;
  onDeleteSong?: (id: string) => void;
}

export function SongList({
  songs,
  selectedSongId,
  onSelectSong,
  onDeleteSong,
}: SongListProps) {
  if (songs.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted text-sm">No songs detected</p>
        <p className="text-muted/60 text-xs mt-1">
          Import scenes containing song lyrics to see them here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 overflow-y-auto flex-1">
      {songs.map((song) => {
        const isSelected = song.id === selectedSongId;
        return (
          <div key={song.id} className="group relative">
            <button
              onClick={() => onSelectSong(song)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors border ${
                isSelected
                  ? "border-accent-cyan bg-accent-cyan/10 text-light"
                  : "border-transparent hover:border-white/10 hover:bg-white/5 text-light"
              }`}
            >
              <div className="flex items-start gap-2 min-w-0 pr-4">
                <Music
                  size={13}
                  className={`mt-0.5 flex-shrink-0 ${isSelected ? "text-accent-cyan" : "text-muted"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{song.title}</p>
                  <p className="text-xs text-muted truncate mt-0.5">
                    {song.sceneTitle}
                  </p>
                  {song.characters.length > 0 && (
                    <p className="text-xs text-muted/70 truncate mt-0.5">
                      {song.characters.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </button>
            {onDeleteSong && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSong(song.id);
                }}
                className="absolute top-1/2 right-2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-400/70 hover:text-red-400 text-sm leading-none transition-opacity px-1"
                title="Remove song"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
