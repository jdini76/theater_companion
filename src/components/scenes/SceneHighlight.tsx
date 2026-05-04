"use client";

import React, { useState } from "react";

export type CharColor = { color: string; bgColor: string };

export type LineOverride =
  | { kind: "dialogue"; char: string }
  | { kind: "header"; char: string }
  | { kind: "multi-header"; chars: string[] }
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
// Also handles standalone format without a colon (e.g. "NORA & ELI" on its own line).
// Returns the canonical (uppercase) char names, the original text parts as they appear
// in the prefix (used for positional tokenization), any inline dialogue after the colon,
// and hasColon so the renderer knows whether to append a ":".
export function matchMultiCharInLine(
  line: string,
  charSet: Set<string>,
): {
  chars: string[];
  textParts: string[];
  rawPrefix: string;
  dialogue: string | null;
  hasColon: boolean;
} | null {
  const trimmed = line.trim();
  const colonIdx = trimmed.indexOf(":");

  // Handle both "NORA & ELI: dialogue" (colon) and "NORA & ELI" (standalone)
  const hasColon = colonIdx !== -1;
  const rawPrefix = hasColon ? trimmed.slice(0, colonIdx) : trimmed;
  const upperPrefix = rawPrefix.toUpperCase();
  const afterColon = hasColon ? trimmed.slice(colonIdx + 1).trim() : null;

  // Primary separators: &  /  AND
  const primaryParts = upperPrefix.split(MULTI_CHAR_SEP);
  if (primaryParts.length >= 2) {
    const matched = tryMatchAllParts(primaryParts, charSet);
    if (matched && matched.length >= 2) {
      return {
        chars: matched,
        textParts: primaryParts.map((p) => p.trim()).filter(Boolean),
        rawPrefix,
        dialogue: afterColon || null,
        hasColon,
      };
    }
  }

  // Comma separator — only treat as multi-char when ALL parts match known characters
  const commaParts = upperPrefix.split(/\s*,\s*/);
  if (commaParts.length >= 2) {
    const matched = tryMatchAllParts(commaParts, charSet);
    if (matched && matched.length >= 2) {
      return {
        chars: matched,
        textParts: commaParts.map((p) => p.trim()).filter(Boolean),
        rawPrefix,
        dialogue: afterColon || null,
        hasColon,
      };
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
  const [mode, setMode] = useState<
    "dialogue" | "header" | "multi-header" | "song-title"
  >(
    currentAssignment?.kind === "header"
      ? "header"
      : currentAssignment?.kind === "multi-header"
        ? "multi-header"
        : currentAssignment?.kind === "song-title"
          ? "song-title"
          : "dialogue",
  );
  const [newCharInput, setNewCharInput] = useState("");
  const [dropdownValue, setDropdownValue] = useState("");
  const [songTitleInput, setSongTitleInput] = useState(
    currentAssignment?.kind === "song-title" ? currentAssignment.text : "",
  );
  // Multi-character selection state — pre-populate from existing override
  const [selectedChars, setSelectedChars] = useState<Set<string>>(
    currentAssignment?.kind === "multi-header"
      ? new Set(currentAssignment.chars.map((c) => c.toUpperCase()))
      : new Set(),
  );

  const isHeader = mode === "header";
  const isSongTitle = mode === "song-title";
  const isMultiHeader = mode === "multi-header";

  const switchMode = (
    newMode: "dialogue" | "header" | "multi-header" | "song-title",
  ) => {
    if (newMode === "song-title" && mode !== "song-title") {
      if (!songTitleInput) setSongTitleInput(lineText);
    }
    setMode(newMode);
  };

  const toggleSelectedChar = (char: string) => {
    setSelectedChars((prev) => {
      const next = new Set(prev);
      if (next.has(char)) next.delete(char);
      else next.add(char);
      return next;
    });
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
          onClick={() => switchMode("multi-header")}
          className={`px-2 py-0.5 rounded transition-colors ${mode === "multi-header" ? "bg-orange-500/20 text-orange-400" : "text-muted hover:text-light"}`}
        >
          Multi-character
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
      ) : isMultiHeader ? (
        <>
          <p className="text-muted">Select all speakers for this line:</p>
          <div className="flex flex-wrap gap-1 mb-1">
            {[
              ...dedupedChars,
              ...dedupedAllChars.filter((c) => !charSet.has(c)),
            ].map((char) => {
              const color = colorMap.get(char.toUpperCase());
              const checked = selectedChars.has(char.toUpperCase());
              return (
                <button
                  key={char}
                  onClick={() => toggleSelectedChar(char.toUpperCase())}
                  style={
                    checked
                      ? { color: color?.color, backgroundColor: color?.bgColor }
                      : undefined
                  }
                  className={`px-2 py-0.5 rounded font-mono border transition-colors ${
                    checked
                      ? "border-current opacity-100"
                      : "border-border text-muted hover:text-light"
                  }`}
                >
                  {char}
                </button>
              );
            })}
          </div>
          {selectedChars.size > 0 && (
            <p className="text-muted">
              Selected:{" "}
              <span className="text-light font-mono">
                {[...selectedChars].join(" & ")}
              </span>
            </p>
          )}
          <button
            onClick={() => {
              if (selectedChars.size >= 2)
                onAssign({
                  kind: "multi-header",
                  chars: [...selectedChars],
                });
            }}
            disabled={selectedChars.size < 2}
            className="px-3 py-0.5 bg-orange-500/20 text-orange-400 rounded hover:bg-orange-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Set multi-character header
          </button>
        </>
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
  textSize?: string;
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
  textSize = "text-xs",
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
      className={`font-mono ${textSize} ${maxHeight} overflow-y-auto rounded border border-border p-3 bg-background/50 leading-relaxed`}
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
          if (override.kind === "multi-header") {
            currentChar = null;
            currentIsGroup = false;
            currentMultiChars = override.chars.map((c) => c.toUpperCase());
            return (
              <div key={i}>
                <div
                  className={`font-bold px-1 rounded-sm flex items-center gap-1 group ${clickClass}`}
                  onClick={toggle}
                >
                  <span className="flex-1">
                    {override.chars.map((char, ci) => {
                      const color = colorMap.get(char.toUpperCase());
                      return (
                        <React.Fragment key={char}>
                          {ci > 0 && (
                            <span className="opacity-50"> &amp; </span>
                          )}
                          <span
                            style={
                              color
                                ? {
                                    color: color.color,
                                    backgroundColor: color.bgColor,
                                  }
                                : undefined
                            }
                            className="rounded-sm px-0.5"
                          >
                            {char}
                          </span>
                        </React.Fragment>
                      );
                    })}
                  </span>
                  {editIcon}
                </div>
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
          const { chars, textParts, rawPrefix, dialogue, hasColon } =
            multiMatchResult;
          currentChar = null;
          currentIsGroup = false;

          // If none of the chars have a color (e.g. "my lines only" is on and
          // none of these characters are the user's role), render as an
          // uncolored header — same style as a non-user single-character line.
          // Use a sentinel currentChar so continuation lines also render
          // uncolored (colorMap.get(sentinel) → undefined → no color/opacity 0.8)
          // rather than falling through to the italic stage-direction style.
          const anyColored = chars.some((c) => colorMap.has(c));
          if (!anyColored) {
            currentMultiChars = [];
            currentChar = "\x00"; // sentinel: truthy, never in colorMap
            return (
              <div key={i}>
                <div
                  className={`font-bold px-1 rounded-sm flex items-center gap-1 group ${clickClass}`}
                  onClick={toggle}
                >
                  <span className="flex-1">{rawPrefix}:</span>
                  {editIcon}
                </div>
                {dialogue && (
                  <div style={{ opacity: 0.8 }} className="pl-3">
                    {dialogue}
                  </div>
                )}
                {isActive && makePanel(i, undefined)}
              </div>
            );
          }

          currentMultiChars = chars;
          // Tokenize header: find each name as it appears in the original text
          // (textParts) and colour it using the canonical name (chars) for the
          // colorMap lookup. This handles abbreviated names like "JOHN" that
          // resolve to a longer canonical "JOHN DOE" — searching for "JOHN DOE"
          // in "JOHN & JANE" would fail, but searching for "JOHN" succeeds.
          const upperPrefix = rawPrefix.toUpperCase();
          const segs: { text: string; color?: CharColor }[] = [];
          let pos = 0;
          for (let ci = 0; ci < chars.length; ci++) {
            const part = textParts[ci] ?? chars[ci];
            const idx = upperPrefix.indexOf(part, pos);
            if (idx === -1) continue;
            if (idx > pos) segs.push({ text: rawPrefix.slice(pos, idx) });
            segs.push({
              text: rawPrefix.slice(idx, idx + part.length),
              color: colorMap.get(chars[ci]),
            });
            pos = idx + part.length;
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
                  {hasColon && <span className="opacity-50">:</span>}
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
