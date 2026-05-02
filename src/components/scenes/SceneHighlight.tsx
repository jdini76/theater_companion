"use client";

import React, { useState } from "react";

export type CharColor = { color: string; bgColor: string };

export type LineOverride =
  | { kind: "dialogue"; char: string }
  | { kind: "header"; char: string }
  | { kind: "stage-direction" }
  | { kind: "group" }
  | { kind: "song-title"; text: string };

// Distinct neutral color for group/ensemble lines — sits outside the hue-based palette.
const GROUP_COLOR: CharColor = {
  color: "hsl(45, 80%, 72%)",
  bgColor: "hsla(45, 80%, 72%, 0.12)",
};

// Color for song-title lines — distinct gold so it stands out from group/dialogue.
const SONG_TITLE_COLOR: CharColor = {
  color: "hsl(52, 100%, 68%)",
  bgColor: "hsla(52, 100%, 68%, 0.12)",
};

// Golden angle (~137.5°) hue rotation for maximum hue spread across any cast size.
//
// VARIANT CYCLE (k=4): With 4 S/L variants, same-variant characters are always
// 4 × 137.5° = 550° → 190° apart in hue (near-complementary). k=3 gave only
// 52.5° — too close. k=4 is the sweet spot.
//
// PERCEPTUAL CORRECTIONS: The human eye has unequal hue sensitivity. Equal hue
// spacing in HSL does NOT mean equal perceived difference:
//   • Yellow-green (55–110°): appears brighter/glaring → darken by dropping L
//   • Blue-indigo (210–255°): reads darker than other hues → raise L slightly
//   • Cyan-teal (158–205°): can look washed-out → boost S
// These corrections keep perceived brightness roughly uniform across all hues.
const GOLDEN_ANGLE = 137.508; // degrees — 360° × (1 − 1/φ)
const CHAR_VARIANTS: { s: number; l: number }[] = [
  { s: 80, l: 63 }, // standard
  { s: 91, l: 49 }, // vivid-dark
  { s: 55, l: 76 }, // light-muted
  { s: 86, l: 57 }, // vivid-medium
];

function perceptualCorrection(hue: number): { ds: number; dl: number } {
  if (hue >= 55 && hue < 110) return { ds: 0, dl: -10 }; // yellow-green: darken
  if (hue >= 210 && hue < 255) return { ds: 0, dl: +8 }; // blue-indigo: lighten
  if (hue >= 158 && hue < 205) return { ds: +10, dl: 0 }; // cyan-teal: vivify
  return { ds: 0, dl: 0 };
}

export function buildCharColorMap(names: string[]): Map<string, CharColor> {
  const map = new Map<string, CharColor>();
  [...names].sort().forEach((name, i) => {
    const hue = Math.round((i * GOLDEN_ANGLE) % 360);
    const { s: baseS, l: baseL } = CHAR_VARIANTS[i % CHAR_VARIANTS.length];
    const { ds, dl } = perceptualCorrection(hue);
    const s = Math.min(95, Math.max(40, baseS + ds));
    const l = Math.min(80, Math.max(40, baseL + dl));
    map.set(name.toUpperCase(), {
      color: `hsl(${hue}, ${s}%, ${l}%)`,
      bgColor: `hsla(${hue}, ${s}%, ${l}%, 0.12)`,
    });
  });
  return map;
}

export function matchCharInLine(
  line: string,
  charSet: Set<string>,
): { char: string; prefix: string } | null {
  const upper = line.trim().toUpperCase();
  if (!upper) return null;

  const isMatch = (u: string, name: string) =>
    u === name ||
    u.startsWith(name + " ") ||
    u.startsWith(name + "(") ||
    u.startsWith(name + ",") ||
    u.startsWith(name + ":");

  for (const char of charSet) {
    if (isMatch(upper, char)) return { char, prefix: char };
  }

  for (const char of charSet) {
    const firstName = char.split(" ")[0];
    if (firstName && firstName !== char && isMatch(upper, firstName)) {
      return { char, prefix: firstName };
    }
  }

  return null;
}

function tryMatchAllParts(
  parts: string[],
  charSet: Set<string>,
): string[] | null {
  const result: string[] = [];
  for (const raw of parts) {
    const p = raw.trim();
    if (!p) return null;
    if (charSet.has(p)) {
      result.push(p);
      continue;
    }
    let found = false;
    for (const char of charSet) {
      if (char === p || char.startsWith(p + " ")) {
        result.push(char);
        found = true;
        break;
      }
    }
    if (!found) return null;
  }
  return result;
}

const MULTI_CHAR_SEP = /\s*[&/]\s*|\s+AND\s+/i;

// Detect headers with multiple characters (e.g. "ANNIE & GRACE:" or "TOM AND JERRY:").
// Returns the canonical (uppercase) char names and any inline dialogue after the colon.
export function matchMultiCharInLine(
  line: string,
  charSet: Set<string>,
): { chars: string[]; rawPrefix: string; dialogue: string | null } | null {
  const trimmed = line.trim();
  const colonIdx = trimmed.indexOf(":");
  if (colonIdx === -1) return null;

  const rawPrefix = trimmed.slice(0, colonIdx);
  const upperPrefix = rawPrefix.toUpperCase();
  const afterColon = trimmed.slice(colonIdx + 1).trim();

  // Primary separators: &  /  AND
  const primaryParts = upperPrefix.split(MULTI_CHAR_SEP);
  if (primaryParts.length >= 2) {
    const matched = tryMatchAllParts(primaryParts, charSet);
    if (matched && matched.length >= 2) {
      return { chars: matched, rawPrefix, dialogue: afterColon || null };
    }
  }

  // Comma separator — only treat as multi-char when ALL parts match known characters
  const commaParts = upperPrefix.split(/\s*,\s*/);
  if (commaParts.length >= 2) {
    const matched = tryMatchAllParts(commaParts, charSet);
    if (matched && matched.length >= 2) {
      return { chars: matched, rawPrefix, dialogue: afterColon || null };
    }
  }

  return null;
}

export function splitAtColon(
  prefix: string,
  trimmedLine: string,
): { header: string; dialogue: string | null } {
  const colonPrefix = prefix.toUpperCase() + ":";
  if (trimmedLine.toUpperCase().startsWith(colonPrefix)) {
    const rest = trimmedLine.slice(colonPrefix.length).trim();
    if (rest) {
      return {
        header: trimmedLine.slice(0, colonPrefix.length),
        dialogue: rest,
      };
    }
  }
  return { header: trimmedLine, dialogue: null };
}

interface LineAssignPanelProps {
  characters: string[];
  colorMap: Map<string, CharColor>;
  currentAssignment: LineOverride | undefined;
  onAssign: (override: LineOverride) => void;
  onReset: () => void;
  onClose: () => void;
  allCharacters?: string[];
  lineText?: string;
}

export function LineAssignPanel({
  characters,
  colorMap,
  currentAssignment,
  onAssign,
  onReset,
  onClose,
  allCharacters = [],
  lineText = "",
}: LineAssignPanelProps) {
  const [mode, setMode] = useState<"dialogue" | "header" | "song-title">(
    currentAssignment?.kind === "header"
      ? "header"
      : currentAssignment?.kind === "song-title"
        ? "song-title"
        : "dialogue",
  );
  const [newCharInput, setNewCharInput] = useState("");
  const [dropdownValue, setDropdownValue] = useState("");
  const [songTitleInput, setSongTitleInput] = useState(
    currentAssignment?.kind === "song-title" ? currentAssignment.text : "",
  );
  const isHeader = mode === "header";
  const isSongTitle = mode === "song-title";

  const switchMode = (newMode: "dialogue" | "header" | "song-title") => {
    if (newMode === "song-title" && mode !== "song-title") {
      // Pre-fill with the raw line text if no title is set yet
      if (!songTitleInput) setSongTitleInput(lineText);
    }
    setMode(newMode);
  };

  const commitNew = () => {
    const name = (newCharInput || dropdownValue).trim().toUpperCase();
    if (!name) return;
    onAssign(
      isHeader
        ? { kind: "header", char: name }
        : { kind: "dialogue", char: name },
    );
    setNewCharInput("");
    setDropdownValue("");
  };

  // Deduplicate and uppercase characters and allCharacters
  const charSet = new Set<string>();
  const dedupedChars: string[] = [];
  for (const c of characters) {
    const upper = c.toUpperCase();
    if (!charSet.has(upper)) {
      charSet.add(upper);
      dedupedChars.push(upper);
    }
  }
  const allCharSet = new Set<string>();
  const dedupedAllChars: string[] = [];
  for (const c of allCharacters) {
    const upper = c.toUpperCase();
    if (!allCharSet.has(upper)) {
      allCharSet.add(upper);
      dedupedAllChars.push(upper);
    }
  }
  return (
    <div className="my-1 p-2 rounded border border-border bg-background shadow space-y-2 text-xs">
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => switchMode("dialogue")}
          className={`px-2 py-0.5 rounded transition-colors ${mode === "dialogue" ? "bg-accent-cyan/20 text-accent-cyan" : "text-muted hover:text-light"}`}
        >
          Dialogue
        </button>
        <button
          onClick={() => switchMode("header")}
          className={`px-2 py-0.5 rounded transition-colors ${mode === "header" ? "bg-accent-cyan/20 text-accent-cyan" : "text-muted hover:text-light"}`}
        >
          Character Header
        </button>
        <button
          onClick={() => switchMode("song-title")}
          style={
            mode === "song-title"
              ? {
                  color: SONG_TITLE_COLOR.color,
                  backgroundColor: SONG_TITLE_COLOR.bgColor,
                }
              : undefined
          }
          className={`px-2 py-0.5 rounded transition-colors ${mode === "song-title" ? "" : "text-muted hover:text-light"}`}
        >
          ♪ Song Title
        </button>
      </div>

      {isSongTitle ? (
        <div className="flex gap-1 items-center">
          <input
            type="text"
            value={songTitleInput}
            onChange={(e) => setSongTitleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && songTitleInput.trim()) {
                onAssign({ kind: "song-title", text: songTitleInput.trim() });
              }
            }}
            placeholder="Song title…"
            className="flex-1 bg-background border border-border rounded px-2 py-0.5 text-light placeholder-muted focus:outline-none focus:border-accent-cyan"
            autoFocus
          />
          <button
            onClick={() => {
              if (songTitleInput.trim())
                onAssign({ kind: "song-title", text: songTitleInput.trim() });
            }}
            disabled={!songTitleInput.trim()}
            className="px-2 py-0.5 bg-accent-cyan/20 text-accent-cyan rounded hover:bg-accent-cyan/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Set
          </button>
        </div>
      ) : (
        <>
          <p className="text-muted">
            {isHeader ? "Mark as start of:" : "Assign as dialogue for:"}
          </p>
          <div className="flex flex-wrap gap-1 mb-2">
            {dedupedChars.map((char) => {
              const color = colorMap.get(char.toUpperCase());
              const isSelected = isHeader
                ? currentAssignment?.kind === "header" &&
                  currentAssignment.char === char
                : currentAssignment?.kind === "dialogue" &&
                  currentAssignment.char === char;
              return (
                <button
                  key={char}
                  onClick={() =>
                    onAssign(
                      isHeader
                        ? { kind: "header", char }
                        : { kind: "dialogue", char },
                    )
                  }
                  style={{
                    color: color?.color,
                    backgroundColor: color?.bgColor,
                  }}
                  className={`px-2 py-0.5 rounded font-mono hover:opacity-80 transition-opacity border ${isSelected ? "border-current" : "border-transparent"}`}
                >
                  {char}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1 items-center">
            <input
              type="text"
              value={newCharInput}
              onChange={(e) => setNewCharInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitNew();
              }}
              placeholder="Add character name…"
              className="flex-1 bg-background border border-border rounded px-2 py-0.5 text-light placeholder-muted focus:outline-none focus:border-accent-cyan"
            />
            <select
              value={dropdownValue}
              onChange={(e) => setDropdownValue(e.target.value)}
              className="bg-background border border-border rounded px-2 py-0.5 text-light"
            >
              <option value="">All project characters…</option>
              {dedupedAllChars
                .filter((c) => !charSet.has(c))
                .map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>
            <button
              onClick={commitNew}
              disabled={!newCharInput.trim() && !dropdownValue}
              className="px-2 py-0.5 bg-accent-cyan/20 text-accent-cyan rounded hover:bg-accent-cyan/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </>
      )}
      <div className="flex gap-2 pt-1 border-t border-border">
        <button
          onClick={() => onAssign({ kind: "group" })}
          style={
            currentAssignment?.kind === "group"
              ? {
                  color: GROUP_COLOR.color,
                  backgroundColor: GROUP_COLOR.bgColor,
                  borderColor: GROUP_COLOR.color,
                }
              : undefined
          }
          className={`px-2 py-0.5 rounded border transition-colors hover:text-light ${currentAssignment?.kind === "group" ? "border-current" : "border-border text-muted"}`}
        >
          Group
        </button>
        <button
          onClick={() => onAssign({ kind: "stage-direction" })}
          className={`px-2 py-0.5 rounded border transition-colors hover:text-light ${currentAssignment?.kind === "stage-direction" ? "border-current text-light" : "border-border text-muted"}`}
        >
          Stage Direction
        </button>
        <button
          onClick={onReset}
          className="px-2 py-0.5 rounded border border-border text-muted hover:text-light transition-colors"
        >
          Auto-detect
        </button>
        <button
          onClick={onClose}
          className="ml-auto px-2 py-0.5 text-muted hover:text-light transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

interface HighlightedContentProps {
  content: string;
  characters: string[];
  colorMap: Map<string, CharColor>;
  overrides?: Map<number, LineOverride>;
  onAssign?: (lineIdx: number, assignment: LineOverride | undefined) => void;
  maxHeight?: string;
  assignPanelProps?: {
    sceneCharacters: string[];
    allCharacters: string[];
  };
}

export function HighlightedContent({
  content,
  characters,
  colorMap,
  overrides = new Map(),
  onAssign,
  maxHeight = "max-h-80",
  assignPanelProps,
}: HighlightedContentProps) {
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const charSet = new Set(characters.map((c) => c.toUpperCase()));
  const lines = content.split("\n");
  let currentChar: string | null = null;
  let currentIsGroup = false;
  let currentMultiChars: string[] = [];

  const parenStageLines = new Set<number>();
  {
    let inParen = false;
    for (let j = 0; j < lines.length; j++) {
      const t = lines[j].trim();
      if (!inParen && t.startsWith("(")) inParen = true;
      if (inParen) {
        parenStageLines.add(j);
        if (t.includes(")")) inParen = false;
      }
    }
  }

  const editIcon = onAssign ? (
    <span className="opacity-0 group-hover:opacity-50 text-muted transition-opacity select-none flex-shrink-0">
      ✎
    </span>
  ) : null;

  const makePanel = (i: number, override: LineOverride | undefined) =>
    onAssign ? (
      <LineAssignPanel
        characters={assignPanelProps?.sceneCharacters ?? characters}
        allCharacters={assignPanelProps?.allCharacters ?? []}
        colorMap={colorMap}
        currentAssignment={override}
        lineText={lines[i]?.trim() ?? ""}
        onAssign={(ov) => {
          onAssign(i, ov);
          setActiveLine(null);
        }}
        onReset={() => {
          onAssign(i, undefined);
          setActiveLine(null);
        }}
        onClose={() => setActiveLine(null)}
      />
    ) : null;

  return (
    <div
      className={`font-mono text-xs ${maxHeight} overflow-y-auto rounded border border-border p-3 bg-background/50 leading-relaxed`}
    >
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) {
          currentChar = null;
          currentIsGroup = false;
          currentMultiChars = [];
          return <div key={i} className="h-2" />;
        }

        const isActive = activeLine === i;
        const hasOverride = overrides.has(i);
        const override = overrides.get(i);
        const toggle = () => onAssign && setActiveLine(isActive ? null : i);
        const clickClass = onAssign ? "cursor-pointer" : "";

        if (hasOverride && override) {
          if (override.kind === "song-title") {
            currentChar = null;
            currentIsGroup = false;
            currentMultiChars = [];
            return (
              <div key={i}>
                <div
                  style={{
                    color: SONG_TITLE_COLOR.color,
                    backgroundColor: SONG_TITLE_COLOR.bgColor,
                  }}
                  className={`font-bold px-1 rounded-sm flex items-center gap-1 group ${clickClass}`}
                  onClick={toggle}
                >
                  <span className="flex-shrink-0 opacity-70">♪</span>
                  <span className="flex-1">{override.text || trimmed}</span>
                  {editIcon}
                </div>
                {isActive && makePanel(i, override)}
              </div>
            );
          }
          if (override.kind === "group") {
            currentChar = null;
            currentIsGroup = true;
            currentMultiChars = [];
            const { header, dialogue } = splitAtColon("", trimmed);
            return (
              <div key={i}>
                <div
                  style={{
                    color: GROUP_COLOR.color,
                    backgroundColor: GROUP_COLOR.bgColor,
                  }}
                  className={`font-bold px-1 rounded-sm flex items-center gap-1 group ${clickClass}`}
                  onClick={toggle}
                >
                  <span className="flex-1">{header}</span>
                  {editIcon}
                </div>
                {dialogue && (
                  <div
                    style={{ color: GROUP_COLOR.color, opacity: 0.8 }}
                    className="pl-3"
                  >
                    {dialogue}
                  </div>
                )}
                {isActive && makePanel(i, override)}
              </div>
            );
          }
          if (override.kind === "header") {
            currentIsGroup = false;
            currentChar = override.char.toUpperCase();
            currentMultiChars = [];
            const color = colorMap.get(override.char.toUpperCase());
            const { header, dialogue } = splitAtColon(override.char, trimmed);
            return (
              <div key={i}>
                <div
                  style={{
                    color: color?.color,
                    backgroundColor: color?.bgColor,
                  }}
                  className={`font-bold px-1 rounded-sm flex items-center gap-1 group ${clickClass}`}
                  onClick={toggle}
                >
                  <span className="flex-1">{header}</span>
                  {editIcon}
                </div>
                {dialogue && (
                  <div
                    style={{ color: color?.color, opacity: 0.8 }}
                    className="pl-3"
                  >
                    {dialogue}
                  </div>
                )}
                {isActive && makePanel(i, override)}
              </div>
            );
          }
          if (override.kind === "dialogue") {
            const color = colorMap.get(override.char.toUpperCase());
            return (
              <div key={i}>
                <div
                  style={{ color: color?.color, opacity: 0.8 }}
                  className={`pl-3 flex items-center gap-1 group ${clickClass}`}
                  onClick={toggle}
                >
                  <span className="flex-1">{line}</span>
                  {editIcon}
                </div>
                {isActive && makePanel(i, override)}
              </div>
            );
          }
          return (
            <div key={i}>
              <div
                className={`text-muted italic flex items-center gap-1 group ${clickClass}`}
                onClick={toggle}
              >
                <span className="flex-1">{line}</span>
                {editIcon}
              </div>
              {isActive && makePanel(i, override)}
            </div>
          );
        }

        if (parenStageLines.has(i)) {
          return (
            <div key={i}>
              <div
                className={`text-muted italic flex items-center gap-1 group ${clickClass}`}
                onClick={toggle}
              >
                <span className="flex-1">{line}</span>
                {editIcon}
              </div>
              {isActive && makePanel(i, undefined)}
            </div>
          );
        }

        const multiMatchResult = matchMultiCharInLine(line, charSet);
        if (multiMatchResult) {
          const { chars, rawPrefix, dialogue } = multiMatchResult;
          currentChar = null;
          currentIsGroup = false;
          currentMultiChars = chars;
          // Tokenize header: find each char name in the original text and
          // colour it; render separators (" & ", " AND ", etc.) in muted text.
          const upperPrefix = rawPrefix.toUpperCase();
          const segs: { text: string; color?: CharColor }[] = [];
          let pos = 0;
          for (const char of chars) {
            const idx = upperPrefix.indexOf(char, pos);
            if (idx === -1) continue;
            if (idx > pos) segs.push({ text: rawPrefix.slice(pos, idx) });
            segs.push({
              text: rawPrefix.slice(idx, idx + char.length),
              color: colorMap.get(char),
            });
            pos = idx + char.length;
          }
          if (pos < rawPrefix.length) segs.push({ text: rawPrefix.slice(pos) });
          return (
            <div key={i}>
              <div
                className={`font-bold px-1 rounded-sm flex items-center gap-1 group ${clickClass}`}
                onClick={toggle}
              >
                <span className="flex-1">
                  {segs.map((seg, si) =>
                    seg.color ? (
                      <span
                        key={si}
                        style={{
                          color: seg.color.color,
                          backgroundColor: seg.color.bgColor,
                        }}
                        className="rounded-sm px-0.5"
                      >
                        {seg.text}
                      </span>
                    ) : (
                      <span key={si} className="opacity-50">
                        {seg.text}
                      </span>
                    ),
                  )}
                  <span className="opacity-50">:</span>
                </span>
                {editIcon}
              </div>
              {dialogue && (
                <div
                  style={{ color: GROUP_COLOR.color, opacity: 0.85 }}
                  className="pl-3"
                >
                  {dialogue}
                </div>
              )}
              {isActive && makePanel(i, undefined)}
            </div>
          );
        }

        const matchResult = matchCharInLine(line, charSet);
        if (matchResult) {
          const { char: matched, prefix } = matchResult;
          currentIsGroup = false;
          currentChar = matched;
          currentMultiChars = [];
          const color = colorMap.get(matched);
          const { header, dialogue } = splitAtColon(prefix, trimmed);
          return (
            <div key={i}>
              <div
                style={{ color: color?.color, backgroundColor: color?.bgColor }}
                className={`font-bold px-1 rounded-sm flex items-center gap-1 group ${clickClass}`}
                onClick={toggle}
              >
                <span className="flex-1">{header}</span>
                {editIcon}
              </div>
              {dialogue && (
                <div
                  style={{ color: color?.color, opacity: 0.8 }}
                  className="pl-3"
                >
                  {dialogue}
                </div>
              )}
              {isActive && makePanel(i, undefined)}
            </div>
          );
        }

        if (currentIsGroup || currentMultiChars.length > 0) {
          return (
            <div key={i}>
              <div
                style={{ color: GROUP_COLOR.color, opacity: 0.8 }}
                className={`pl-3 flex items-center gap-1 group ${clickClass}`}
                onClick={toggle}
              >
                <span className="flex-1">{line}</span>
                {editIcon}
              </div>
              {isActive && makePanel(i, undefined)}
            </div>
          );
        }

        if (currentChar) {
          const color = colorMap.get(currentChar);
          return (
            <div key={i}>
              <div
                style={{ color: color?.color, opacity: 0.8 }}
                className={`pl-3 flex items-center gap-1 group ${clickClass}`}
                onClick={toggle}
              >
                <span className="flex-1">{line}</span>
                {editIcon}
              </div>
              {isActive && makePanel(i, undefined)}
            </div>
          );
        }

        return (
          <div key={i}>
            <div
              className={`text-muted italic flex items-center gap-1 group ${clickClass}`}
              onClick={toggle}
            >
              <span className="flex-1">{line}</span>
              {editIcon}
            </div>
            {isActive && makePanel(i, undefined)}
          </div>
        );
      })}
    </div>
  );
}
