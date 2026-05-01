"use client";

import React, { useState } from "react";
import { SongEntry } from "@/lib/songs";
import { Music, Link, X } from "lucide-react";

interface SongViewerProps {
  song: SongEntry;
  url?: string;
  onSetUrl?: (url: string) => void;
}

/** Convert a YouTube watch URL or youtu.be short link to an embed URL. */
function toEmbedUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    // youtube.com/watch?v=ID
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    }
    // youtu.be/ID
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    // Already an embed URL or another video service — use as-is
    if (raw.includes("/embed/")) return raw;
  } catch {
    // not a valid URL
  }
  return null;
}

export function SongViewer({ song, url = "", onSetUrl }: SongViewerProps) {
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState(url);

  // Keep draft in sync when the selected song changes
  React.useEffect(() => {
    setUrlDraft(url);
    setEditingUrl(false);
  }, [song.id, url]);

  // Determine if there are multiple distinct characters (ensemble number)
  const distinctChars = new Set(
    song.lines.map((l) => l.character).filter((c) => c !== "[Song]"),
  );
  const isEnsemble = distinctChars.size > 1;
  const embedUrl = url ? toEmbedUrl(url) : null;

  const commitUrl = () => {
    onSetUrl?.(urlDraft);
    setEditingUrl(false);
  };

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
        {/* URL button */}
        {onSetUrl && (
          <button
            onClick={() => setEditingUrl((v) => !v)}
            className={`flex-shrink-0 p-1.5 rounded transition-colors ${url ? "text-accent-cyan hover:bg-accent-cyan/10" : "text-muted hover:text-light hover:bg-white/5"}`}
            title={url ? "Edit link" : "Add link"}
          >
            <Link size={15} />
          </button>
        )}
      </div>

      {/* URL editor */}
      {editingUrl && onSetUrl && (
        <div className="flex gap-2 items-center py-2 border-b border-white/10 flex-shrink-0">
          <input
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitUrl();
              if (e.key === "Escape") setEditingUrl(false);
            }}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 bg-background border border-border rounded px-2 py-1 text-sm text-light placeholder-muted focus:outline-none focus:border-accent-cyan"
            autoFocus
          />
          <button
            onClick={commitUrl}
            className="px-2 py-1 text-xs bg-accent-cyan/20 text-accent-cyan rounded hover:bg-accent-cyan/30 transition-colors"
          >
            Save
          </button>
          {url && (
            <button
              onClick={() => {
                onSetUrl("");
                setUrlDraft("");
                setEditingUrl(false);
              }}
              className="p-1 text-muted hover:text-red-400 transition-colors"
              title="Remove link"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Embedded video */}
      {embedUrl && !editingUrl && (
        <div className="flex-shrink-0 py-3 border-b border-white/10">
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src={embedUrl}
              className="absolute inset-0 w-full h-full rounded"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={song.title}
            />
          </div>
        </div>
      )}

      {/* Non-embeddable link */}
      {url && !embedUrl && !editingUrl && (
        <div className="flex-shrink-0 py-2 border-b border-white/10">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent-cyan hover:underline flex items-center gap-1"
          >
            <Link size={11} />
            {url}
          </a>
        </div>
      )}

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
