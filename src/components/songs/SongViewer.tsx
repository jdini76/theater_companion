"use client";

import React from "react";
import { SongEntry } from "@/lib/songs";
import { Music } from "lucide-react";

interface SongViewerProps {
  song: SongEntry;
}

export function SongViewer({ song }: SongViewerProps) {
  // Determine if there are multiple distinct characters (ensemble number)
  const distinctChars = new Set(
    song.lines.map((l) => l.character).filter((c) => c !== "[Song]"),
  );
  const isEnsemble = distinctChars.size > 1;

  return (
    <div className="card flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 pb-4 border-b border-white/10 flex-shrink-0">
        <div className="p-2 rounded-lg bg-accent-cyan/10 flex-shrink-0">
          <Music size={18} className="text-accent-cyan" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold text-light leading-tight">
            {song.title}
          </h2>
          <p className="text-muted text-sm mt-1">{song.sceneTitle}</p>
          {song.characters.length > 0 && (
            <p className="text-xs text-muted/70 mt-1">
              {song.characters.join(" · ")}
            </p>
          )}
        </div>
      </div>

      {/* Lyrics */}
      <div className="flex-1 overflow-y-auto pt-4 pr-1">
        <div className="space-y-1">
          {song.lines.map((line, idx) => {
            const showChar = isEnsemble && line.character !== "[Song]";
            return (
              <div key={idx} className={showChar ? "mt-3 first:mt-0" : ""}>
                {showChar && (
                  <p className="text-xs font-semibold text-accent-cyan uppercase tracking-wider mb-0.5">
                    {line.character}
                  </p>
                )}
                <p className="text-light leading-relaxed whitespace-pre-wrap font-medium">
                  {line.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
