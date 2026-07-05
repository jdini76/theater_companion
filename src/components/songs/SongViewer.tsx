"use client";

import React, { useState } from "react";
import { SongEntry } from "@/lib/songs";
import { Music, Link, X } from "lucide-react";

interface SongReferenceLink {
  title: string;
  url: string;
}

interface SongViewerProps {
  song: SongEntry;
  links?: SongReferenceLink[];
  onSetLinks?: (links: SongReferenceLink[]) => void;
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

function getUrlTabLabel(link: SongReferenceLink, index: number): string {
  if (link.title.trim()) return link.title.trim();
  try {
    const parsed = new URL(link.url);
    const host = parsed.hostname.replace(/^www\./, "");
    return host || `Link ${index + 1}`;
  } catch {
    return `Link ${index + 1}`;
  }
}

export function SongViewer({ song, links = [], onSetLinks }: SongViewerProps) {
  const [editingUrl, setEditingUrl] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [urlDraft, setUrlDraft] = useState("");
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  // Keep draft in sync when the selected song changes
  React.useEffect(() => {
    setTitleDraft("");
    setUrlDraft("");
    setEditingIndex(null);
    setEditingUrl(false);
    setActiveTabIndex(0);
  }, [song.id]);

  React.useEffect(() => {
    if (links.length === 0) {
      setActiveTabIndex(0);
      return;
    }
    if (activeTabIndex >= links.length) {
      setActiveTabIndex(links.length - 1);
    }
  }, [links, activeTabIndex]);

  // Determine if there are multiple distinct characters (ensemble number)
  const distinctChars = new Set(
    song.lines.map((l) => l.character).filter((c) => c !== "[Song]"),
  );
  const isEnsemble = distinctChars.size > 1;
  const activeLink = links[activeTabIndex] ?? null;
  const activeUrl = activeLink?.url ?? "";
  const embedUrl = activeUrl ? toEmbedUrl(activeUrl) : null;

  const startAddUrl = () => {
    setEditingIndex(links.length);
    setTitleDraft("");
    setUrlDraft("");
    setEditingUrl(true);
  };

  const startEditUrl = () => {
    if (!links.length) {
      startAddUrl();
      return;
    }
    setEditingIndex(activeTabIndex);
    setTitleDraft(links[activeTabIndex]?.title ?? "");
    setUrlDraft(links[activeTabIndex]?.url ?? "");
    setEditingUrl(true);
  };

  const commitUrl = () => {
    if (!onSetLinks || editingIndex === null) {
      setEditingUrl(false);
      return;
    }

    const cleaned = urlDraft.trim();
    const cleanedTitle = titleDraft.trim();
    const next = [...links];
    if (cleaned) {
      next[editingIndex] = { title: cleanedTitle, url: cleaned };
      onSetLinks(next);
      setActiveTabIndex(editingIndex);
    }
    setEditingUrl(false);
    setEditingIndex(null);
    setTitleDraft("");
    setUrlDraft("");
  };

  const removeTab = (index: number) => {
    if (!onSetLinks || !links.length) return;
    const next = links.filter((_, idx) => idx !== index);
    onSetLinks(next);
    setEditingUrl(false);
    setEditingIndex(null);
    setTitleDraft("");
    setUrlDraft("");
    setActiveTabIndex((prev) => {
      if (index < prev) return prev - 1;
      return Math.max(0, Math.min(prev, next.length - 1));
    });
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
        {onSetLinks && (
          <button
            onClick={startEditUrl}
            className={`flex-shrink-0 p-1.5 rounded transition-colors ${links.length > 0 ? "text-accent-cyan hover:bg-accent-cyan/10" : "text-muted hover:text-light hover:bg-white/5"}`}
            title={links.length > 0 ? "Edit selected link" : "Add link"}
          >
            <Link size={15} />
          </button>
        )}
      </div>

      {/* URL tabs */}
      {links.length > 0 && !editingUrl && (
        <div className="flex gap-1 items-center py-2 border-b border-white/10 flex-shrink-0 overflow-x-auto">
          {links.map((link, index) => (
            <div
              key={`${link.url}_${index}`}
              className="inline-flex items-center"
            >
              <button
                onClick={() => setActiveTabIndex(index)}
                className={`px-2 py-1 text-xs rounded-l border whitespace-nowrap transition-colors ${
                  index === activeTabIndex
                    ? "border-accent-cyan text-accent-cyan bg-accent-cyan/10"
                    : "border-white/10 text-muted hover:text-light hover:border-white/20"
                }`}
                title={link.url}
              >
                {getUrlTabLabel(link, index)}
              </button>
              {onSetLinks && (
                <button
                  onClick={() => removeTab(index)}
                  className={`px-1.5 py-1 text-xs rounded-r border-l-0 border transition-colors ${
                    index === activeTabIndex
                      ? "border-accent-cyan text-accent-cyan bg-accent-cyan/10 hover:bg-accent-cyan/20"
                      : "border-white/10 text-muted hover:text-red-300 hover:border-red-400/50"
                  }`}
                  title="Delete this link tab"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          ))}
          {onSetLinks && (
            <button
              onClick={startAddUrl}
              className="ml-1 px-2 py-1 text-xs rounded border border-dashed border-white/20 text-muted hover:text-light hover:border-white/40 transition-colors"
              title="Add another link"
            >
              + Add link
            </button>
          )}
        </div>
      )}

      {/* URL editor */}
      {editingUrl && onSetLinks && (
        <div className="py-2 border-b border-white/10 flex-shrink-0 space-y-2">
          <input
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitUrl();
              if (e.key === "Escape") {
                setEditingUrl(false);
                setEditingIndex(null);
                setTitleDraft("");
                setUrlDraft("");
              }
            }}
            placeholder="Tab title (optional)"
            className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-light placeholder-muted focus:outline-none focus:border-accent-cyan"
          />
          <input
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitUrl();
              if (e.key === "Escape") {
                setEditingUrl(false);
                setEditingIndex(null);
                setTitleDraft("");
                setUrlDraft("");
              }
            }}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-light placeholder-muted focus:outline-none focus:border-accent-cyan"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              onClick={commitUrl}
              className="px-2 py-1 text-xs bg-accent-cyan/20 text-accent-cyan rounded hover:bg-accent-cyan/30 transition-colors"
            >
              Save
            </button>
            {links.length > 0 &&
              editingIndex !== null &&
              editingIndex < links.length && (
                <button
                  onClick={() => removeTab(editingIndex)}
                  className="p-1 text-muted hover:text-red-400 transition-colors"
                  title="Remove selected link"
                >
                  <X size={14} />
                </button>
              )}
            <button
              onClick={() => {
                setEditingUrl(false);
                setEditingIndex(null);
                setTitleDraft("");
                setUrlDraft("");
              }}
              className="px-2 py-1 text-xs text-muted hover:text-light transition-colors"
            >
              Cancel
            </button>
          </div>
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
      {activeUrl && !embedUrl && !editingUrl && (
        <div className="flex-shrink-0 py-2 border-b border-white/10">
          <a
            href={activeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent-cyan hover:underline flex items-center gap-1"
          >
            <Link size={11} />
            {activeUrl}
          </a>
        </div>
      )}

      {/* Lyrics */}
      <div className="flex-1 overflow-y-auto pt-4 pr-1">
        <div className="space-y-1">
          {song.lines.map((line, idx) => {
            const prevChar = idx > 0 ? song.lines[idx - 1]!.character : null;
            const showChar =
              isEnsemble &&
              line.character !== "[Song]" &&
              line.character !== prevChar;
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
