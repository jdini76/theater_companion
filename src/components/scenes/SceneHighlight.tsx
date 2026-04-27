"use client";

import React, { useState } from "react";

export type CharColor = { color: string; bgColor: string };

export type LineOverride =
  | { kind: "dialogue"; char: string }
  | { kind: "header"; char: string }
  | { kind: "stage-direction" };

export function buildCharColorMap(names: string[]): Map<string, CharColor> {
  const map = new Map<string, CharColor>();
  const goldenAngle = 137.508;
  [...names].sort().forEach((name, i) => {
    const hue = Math.round((i * goldenAngle) % 360);
    map.set(name.toUpperCase(), {
      color: `hsl(${hue}, 70%, 65%)`,
      bgColor: `hsla(${hue}, 70%, 65%, 0.12)`,
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

export function splitAtColon(
  prefix: string,
  trimmedLine: string,
): { header: string; dialogue: string | null } {
  const colonPrefix = prefix.toUpperCase() + ":";
  if (trimmedLine.toUpperCase().startsWith(colonPrefix)) {
    const rest = trimmedLine.slice(colonPrefix.length).trim();
    if (rest) {
      return { header: trimmedLine.slice(0, colonPrefix.length), dialogue: rest };
    }
  }
  return { header: trimmedLine, dialogue: null };
}

export function LineAssignPanel({
  characters,
  colorMap,
  currentAssignment,
  onAssign,
  onReset,
  onClose,
}: {
  characters: string[];
  colorMap: Map<string, CharColor>;
  currentAssignment: LineOverride | undefined;
  onAssign: (override: LineOverride) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"dialogue" | "header">(
    currentAssignment?.kind === "header" ? "header" : "dialogue",
  );
  const [newCharInput, setNewCharInput] = useState("");
  const isHeader = mode === "header";

  const commitNew = () => {
    const name = newCharInput.trim().toUpperCase();
    if (!name) return;
    onAssign(isHeader ? { kind: "header", char: name } : { kind: "dialogue", char: name });
    setNewCharInput("");
  };

  return (
    <div className="my-1 p-2 rounded border border-border bg-background shadow space-y-2 text-xs">
      <div className="flex gap-1">
        <button
          onClick={() => setMode("dialogue")}
          className={`px-2 py-0.5 rounded transition-colors ${!isHeader ? "bg-accent-cyan/20 text-accent-cyan" : "text-muted hover:text-light"}`}
        >
          Dialogue
        </button>
        <button
          onClick={() => setMode("header")}
          className={`px-2 py-0.5 rounded transition-colors ${isHeader ? "bg-accent-cyan/20 text-accent-cyan" : "text-muted hover:text-light"}`}
        >
          Character Header
        </button>
      </div>
      <p className="text-muted">
        {isHeader ? "Mark as start of:" : "Assign as dialogue for:"}
      </p>
      <div className="flex flex-wrap gap-1">
        {characters.map((char) => {
          const color = colorMap.get(char.toUpperCase());
          const isSelected = isHeader
            ? currentAssignment?.kind === "header" && currentAssignment.char === char
            : currentAssignment?.kind === "dialogue" && currentAssignment.char === char;
          return (
            <button
              key={char}
              onClick={() =>
                onAssign(isHeader ? { kind: "header", char } : { kind: "dialogue", char })
              }
              style={{ color: color?.color, backgroundColor: color?.bgColor }}
              className={`px-2 py-0.5 rounded font-mono hover:opacity-80 transition-opacity border ${isSelected ? "border-current" : "border-transparent"}`}
            >
              {char}
            </button>
          );
        })}
      </div>
      <div className="flex gap-1">
        <input
          type="text"
          value={newCharInput}
          onChange={(e) => setNewCharInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commitNew(); }}
          placeholder="Add character name…"
          className="flex-1 bg-background border border-border rounded px-2 py-0.5 text-light placeholder-muted focus:outline-none focus:border-accent-cyan"
        />
        <button
          onClick={commitNew}
          disabled={!newCharInput.trim()}
          className="px-2 py-0.5 bg-accent-cyan/20 text-accent-cyan rounded hover:bg-accent-cyan/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
      <div className="flex gap-2 pt-1 border-t border-border">
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

export function HighlightedContent({
  content,
  characters,
  colorMap,
  overrides = new Map(),
  onAssign,
  maxHeight = "max-h-80",
}: {
  content: string;
  characters: string[];
  colorMap: Map<string, CharColor>;
  overrides?: Map<number, LineOverride>;
  onAssign?: (lineIdx: number, assignment: LineOverride | undefined) => void;
  maxHeight?: string;
}) {
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const charSet = new Set(characters.map((c) => c.toUpperCase()));
  const lines = content.split("\n");
  let currentChar: string | null = null;

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
        characters={characters}
        colorMap={colorMap}
        currentAssignment={override}
        onAssign={(ov) => { onAssign(i, ov); setActiveLine(null); }}
        onReset={() => { onAssign(i, undefined); setActiveLine(null); }}
        onClose={() => setActiveLine(null)}
      />
    ) : null;

  return (
    <div className={`font-mono text-xs ${maxHeight} overflow-y-auto rounded border border-border p-3 bg-background/50 leading-relaxed`}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) {
          currentChar = null;
          return <div key={i} className="h-2" />;
        }

        const isActive = activeLine === i;
        const hasOverride = overrides.has(i);
        const override = overrides.get(i);
        const toggle = () => onAssign && setActiveLine(isActive ? null : i);
        const clickClass = onAssign ? "cursor-pointer" : "";

        if (hasOverride && override) {
          if (override.kind === "header") {
            currentChar = override.char.toUpperCase();
            const color = colorMap.get(override.char.toUpperCase());
            const { header, dialogue } = splitAtColon(override.char, trimmed);
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
                  <div style={{ color: color?.color, opacity: 0.8 }} className="pl-3">{dialogue}</div>
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

        const matchResult = matchCharInLine(line, charSet);
        if (matchResult) {
          const { char: matched, prefix } = matchResult;
          currentChar = matched;
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
                <div style={{ color: color?.color, opacity: 0.8 }} className="pl-3">{dialogue}</div>
              )}
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
