import { Scene, ParsedScene, TocEntry, ParsedToc } from "@/types/scene";
import { parseDialogueLines } from "@/lib/rehearsal";

/**
 * Input mode for scene parsing
 * - "single": Treat entire input as one scene
 * - "multiple": Detect and split multiple scenes automatically
 * - "auto": Auto-detect based on content
 */
export type SceneInputMode = "single" | "multiple" | "auto";

export interface ParseSceneOptions {
  mode?: SceneInputMode;
}

export interface DetectedScene {
  title: string;
  content: string;
  characters: string[];
  startLine: number;
  endLine: number;
}

/**
 * Extract unique individual character names from scene content.
 * - Splits combined names like "CHAR1 & CHAR2" into individuals
 * - Splits comma-separated groups like "CHAR1, CHAR2 & CHAR3"
 * - Excludes "ALL" as a character
 * - When `knownCast` is provided, uses it as the source of truth:
 *   detected characters are filtered to only those on the cast list,
 *   and raw lines are scanned for cast names the dialogue parser missed
 *   (e.g. group speaker labels embedded mid-song).
 */
export function extractSceneCharacters(
  content: string,
  knownCast?: string[],
): string[] {
  // ── If the content itself is a cast page, return those names ────
  const castPage = parseCastList(content);
  if (castPage && castPage.raw.length > 0) {
    return castPage.raw.sort();
  }

  // Use "mixed" format so all character patterns (colon, standalone, inline)
  // are checked.  For character extraction purposes we want maximum recall.
  const lines = parseDialogueLines(content, "mixed");
  const characters = new Set<string>();

  // ── Build cast lookup tables (if cast list provided) ────────────
  let castUpper: Set<string> | null = null;
  let firstNameMap: Map<string, string> | null = null;

  if (knownCast && knownCast.length > 0) {
    castUpper = new Set(knownCast.map((n) => n.toUpperCase()));
    firstNameMap = new Map<string, string>();
    for (const name of knownCast) {
      const parts = name.trim().split(/\s+/);
      if (parts.length > 1) {
        const first = parts[0].toUpperCase();
        // Only store first-name mapping if unambiguous (no other cast
        // member shares the same first name)
        if (firstNameMap.has(first)) {
          firstNameMap.set(first, ""); // ambiguous → disable
        } else {
          firstNameMap.set(first, name.toUpperCase());
        }
      }
    }
  }

  for (const line of lines) {
    if (
      line.isStageDirection ||
      line.character === "[Narrative]" ||
      line.character === "[Scene Heading]"
    ) {
      continue;
    }

    const raw = line.character.trim();

    // Split on comma, ampersand, or plus: "MRS. LANCASTER, NED & CHUBBY MAN"
    // Also handles "CHARACTER 1 + CHARACTER 2" duet notation
    const parts = raw
      .split(/\s*[,&+]\s*/)
      .map((p) => p.trim())
      .filter(Boolean);

    for (const part of parts) {
      const upper = part.toUpperCase();
      if (upper === "ALL" || upper === "EVERYONE" || upper === "ENSEMBLE") {
        continue;
      }

      // Always keep characters detected by the dialogue parser.
      // When we have a cast list, resolve to the canonical cast name
      // (e.g. "PHIL" → "PHIL CONNORS") to avoid duplicates.
      // Non-cast names are SKIPPED when a cast list is provided — the
      // "mixed" parser picks up too many false positives from song lyrics.
      if (castUpper && firstNameMap) {
        if (castUpper.has(upper)) {
          characters.add(upper);
        } else {
          const fullName = firstNameMap.get(upper);
          if (fullName) {
            characters.add(fullName);
          }
          // Non-cast names are intentionally dropped here.
        }
      } else {
        characters.add(upper);
      }
    }
  }

  // ── Cast-list cross-reference ───────────────────────────────────
  // Scan every raw line of the scene for known character names that the
  // dialogue parser classified as lyrics / narrative.  This catches
  // group speaker labels mid-song like "NANCY, DEPUTY, RALPH, GUS".
  if (castUpper && firstNameMap) {
    for (const rawLine of content.split("\n")) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      // Split the line on comma, ampersand, plus, and colon to extract
      // potential name fragments: "NANCY, DEPUTY, RALPH, GUS:" → 4 names
      const fragments = trimmed
        .split(/\s*[,&+:]\s*/)
        .map((f) => f.trim())
        .filter(Boolean);

      for (const frag of fragments) {
        const upper = frag.toUpperCase();
        if (castUpper.has(upper)) {
          characters.add(upper);
        } else {
          // Check first-name match (e.g. "PHIL" → "PHIL CONNORS")
          const fullName = firstNameMap.get(upper);
          if (fullName) {
            characters.add(fullName);
          }
        }
      }
    }
  }

  return Array.from(characters).sort();
}

// ── Cast list parser ────────────────────────────────────────────────────────

/**
 * Heading patterns that identify the start of a cast list page.
 *   "Cast of Characters", "Characters:", "Dramatis Personae", "Cast:", etc.
 */
const CAST_HEADING_RE =
  /^(?:cast\s+(?:of\s+)?characters|characters?\s*(?:list)?|dramatis\s+personae|cast)\s*:?\s*$/i;

/**
 * Patterns that signal the end of the cast list (start of actual script).
 */
const CAST_END_RE =
  /^(?:#\s*\d+|ACT\s+(?:ONE|TWO|THREE|I{1,3}V?|\d+)\b|(?:SCENE|scene)\s*\d|(?:Prologue|Epilogue)\s*[:\u2014\u2013\-])/i;

export interface CastMember {
  name: string;
  group?: string; // e.g. "Experts", "At the Bar"
}

/**
 * Parse a "Cast of Characters" page from raw script text.
 *
 * Supported formats:
 *   • Main character            (bullet)
 *     o Sub-character           (sub-bullet under a group heading)
 *   - Character name            (dash bullet)
 *   * Character name            (asterisk bullet)
 *   Plain Name On Its Own Line  (no bullet, title-case or ALL-CAPS)
 *
 * Group headings (items with sub-items below them) are NOT included as
 * characters but are recorded as the `group` for their sub-items.
 *
 * Returns null if no cast list section is detected.
 */
export function parseCastList(
  text: string,
): { characters: CastMember[]; raw: string[] } | null {
  const lines = text.split("\n");

  // ── Find the cast heading ───────────────────────────────────────
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (CAST_HEADING_RE.test(lines[i].trim())) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) return null;

  // ── Collect raw entries until a scene/act break or large gap ────
  // Bullet characters (•, -, *) and sub-bullets (o) may appear on their
  // own line with the name on the following line, or inline: "• Name".
  const entries: { text: string; indent: number; lineIdx: number }[] = [];
  let blankRun = 0;
  let pendingIndent: number | null = null; // set when we see a lone bullet

  for (let i = startIdx + 1; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      blankRun++;
      // 3+ consecutive blank lines → end of cast section
      if (blankRun >= 3) break;
      continue;
    }
    blankRun = 0;

    // Stop at scene / act headings
    if (CAST_END_RE.test(trimmed)) break;

    // ── Lone bullet on its own line ───────────────────────────────
    // "•" or "-" or "*" alone → main level, name on next line
    if (/^[•\-\*▪►◦·‣⁃]$/.test(trimmed)) {
      pendingIndent = 0;
      continue;
    }
    // Lone sub-bullet: "o" (possibly indented) alone on a line
    if (/^o$/i.test(trimmed) && /^[\t ]/.test(raw)) {
      pendingIndent = 1;
      continue;
    }

    // ── Name line (may follow a pending bullet) ───────────────────
    let indent = pendingIndent ?? 0;
    let name = trimmed;
    pendingIndent = null;

    // If no pending bullet, check for inline bullet patterns
    if (indent === 0) {
      // Sub-bullet inline: "  o Name" (indented o + space + name)
      // OR "o Name" without indentation (PDF extraction may strip leading spaces)
      const subBullet =
        raw.match(/^[\t ]+o\s+(.+)$/) || trimmed.match(/^o\s+(.+)$/);
      if (subBullet) {
        indent = 1;
        name = subBullet[1].trim();
      } else {
        // Main bullet inline: "•Name", "• Name", "- Name", "* Name"
        // Space after bullet is optional (PDF extraction may omit it)
        const mainBullet = trimmed.match(/^[•\-\*▪►◦·‣⁃]\s*(.+)$/);
        if (mainBullet) {
          name = mainBullet[1].trim();
        }
      }
    }

    // Final cleanup: strip any remaining leading bullet/punctuation artifacts
    name = name.replace(/^[•\-\*▪►◦·‣⁃]\s*/, "").trim();

    // Skip empty after stripping bullet
    if (!name) continue;

    // Skip pure numbers (page numbers leaking from TOC)
    if (/^\d+$/.test(name)) continue;

    entries.push({ text: name, indent, lineIdx: i });
  }

  if (entries.length === 0) return null;

  // ── Identify group headings vs. individual characters ──────────
  // A top-level entry is a group heading if the next entry is indented.
  const characters: CastMember[] = [];
  const rawNames: string[] = [];
  let currentGroup: string | undefined;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const nextEntry = entries[i + 1];

    if (entry.indent === 0 && nextEntry && nextEntry.indent > 0) {
      // This is a group heading
      currentGroup = entry.text;
      continue;
    }

    if (entry.indent > 0) {
      // Sub-item — belongs to currentGroup
      characters.push({ name: entry.text, group: currentGroup });
      rawNames.push(entry.text);
    } else {
      // Top-level character (no sub-items following)
      currentGroup = undefined;
      characters.push({ name: entry.text });
      rawNames.push(entry.text);
    }
  }

  return { characters, raw: rawNames };
}

/**
 * Extract just the unique character names from a cast list.
 * Convenience wrapper around parseCastList().
 */
export function extractCastNames(text: string): string[] {
  const result = parseCastList(text);
  if (!result) return [];
  return result.raw.sort();
}

export function generateSceneId(): string {
  return `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Diagnostic function: Identify all scene markers found in text
 * Useful for debugging why scenes aren't being detected
 */
export function diagnoseSceneMarkers(
  text: string,
): Array<{ lineIndex: number; type: string; title: string; line: string }> {
  const lines = text.split("\n");
  const markers: Array<{
    lineIndex: number;
    type: string;
    title: string;
    line: string;
  }> = [];

  const sceneHeaderPattern =
    /^(?:SCENE|Scene|scene)\s*(\d+[a-z]?|[IVivx]+)\s*:?\s*(.*)$/;
  const actScenePattern =
    /^(?:ACT|Act|act)\s+(\d+|[IVivx]+)(?:\s*,?\s*(?:SCENE|Scene|scene)\s+(\d+|[IVivx]+))?\s*:?\s*(.*)$/;
  const actWordPattern = /^(?:ACT|Act|act)\s+(ONE|TWO|THREE|FOUR|FIVE)\s*$/i;
  const prologuePattern =
    /^(Prologue|Epilogue|Interlude)\s*[:\u2014\u2013\-]?\s*(.*)$/i;
  const bracketedPattern =
    /^\[(?:SCENE|Scene|scene)\s+(\d+|[IVivx]+)\s*:?\s*(.*?)\]$/;
  const numberHeadingPattern = /^#\s*(\d+[a-z]?)\s*[-\u2013\u2014]\s*(.+)$/;
  const screenplayPattern = /^(INT|EXT)\.\s+(.+?)\s*(?:-\s*(.+))?$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    let match;

    match = trimmed.match(numberHeadingPattern);
    if (match) {
      markers.push({
        lineIndex: i,
        type: "Number Heading",
        title: `#${match[1]} - ${match[2]}`,
        line: trimmed,
      });
      continue;
    }

    match = trimmed.match(screenplayPattern);
    if (match) {
      const locType = match[1].toUpperCase();
      const location = match[2];
      const timeOfDay = match[3] || "";
      markers.push({
        lineIndex: i,
        type: "Screenplay",
        title: `${locType}. ${location}${timeOfDay ? ` - ${timeOfDay}` : ""}`,
        line: trimmed,
      });
      continue;
    }

    match = trimmed.match(actWordPattern);
    if (match) {
      markers.push({
        lineIndex: i,
        type: "Act Word",
        title: trimmed,
        line: trimmed,
      });
      continue;
    }

    match = trimmed.match(actScenePattern);
    if (match) {
      const actNum = match[1];
      const sceneNum = match[2];
      const title = sceneNum
        ? `Act ${actNum}, Scene ${sceneNum}`
        : `Act ${actNum}`;
      markers.push({ lineIndex: i, type: "Act/Scene", title, line: trimmed });
      continue;
    }

    match = trimmed.match(sceneHeaderPattern);
    if (match) {
      const sceneNum = match[1];
      const title = `Scene ${sceneNum}${match[2] ? ": " + match[2] : ""}`;
      markers.push({
        lineIndex: i,
        type: "Scene Header",
        title,
        line: trimmed,
      });
      continue;
    }

    match = trimmed.match(prologuePattern);
    if (match) {
      const label = match[1];
      const sectionTitle = match[2] || "";
      markers.push({
        lineIndex: i,
        type: "Prologue/Epilogue",
        title: sectionTitle ? `${label}: ${sectionTitle}` : label,
        line: trimmed,
      });
      continue;
    }

    match = trimmed.match(bracketedPattern);
    if (match) {
      const sceneNum = match[1];
      const title = `Scene ${sceneNum}${match[2] ? ": " + match[2] : ""}`;
      markers.push({ lineIndex: i, type: "Bracketed", title, line: trimmed });
      continue;
    }
  }

  return markers;
}

/**
 * Remove PDF artifacts and page markers from text
 * Removes patterns like "-- 99 of 101 --" or "Page 1 of 10"
 */
export function cleanPdfArtifacts(text: string): string {
  const lines = text.split("\n");
  let cleaned = lines;

  // Scene-related keywords that should NOT be stripped as artifacts
  const sceneKeywordPattern = /^(?:SCENE|PROLOGUE|EPILOGUE|INTERLUDE|ACT)\b/i;

  // Remove header/footer patterns from common sources:
  // - Lines that are all caps single words (often page headers)
  // - Page numbers/markers
  // - Copyright/ISBN info
  // - Very short repeated lines (often page footers)

  // Strip leading blank lines and header garbage
  while (cleaned.length > 0 && !cleaned[0].trim()) {
    cleaned.shift();
  }
  while (
    cleaned.length > 0 &&
    !sceneKeywordPattern.test(cleaned[0].trim()) &&
    (cleaned[0].match(/^[A-Z\s]{1,30}$/) || // All caps header
      cleaned[0].match(/^\(?(?:Page|p\.|pp\.)\s*\d+/i) || // Page numbers
      cleaned[0].match(/^[\d\s]*$/) || // Just numbers/spaces
      cleaned[0].length < 5) // Very short lines (likely page artifacts)
  ) {
    cleaned.shift();
  }

  // Strip trailing blank lines and footer garbage
  while (cleaned.length > 0 && !cleaned[cleaned.length - 1].trim()) {
    cleaned.pop();
  }
  while (
    cleaned.length > 0 &&
    !sceneKeywordPattern.test(cleaned[cleaned.length - 1].trim()) &&
    (cleaned[cleaned.length - 1].match(/^[\d\s]*$/) || // Just numbers
      cleaned[cleaned.length - 1].match(/©|®|™|ISBN|Copyright/i) ||
      cleaned[cleaned.length - 1].length < 5)
  ) {
    cleaned.pop();
  }

  text = cleaned.join("\n");

  // Remove page markers: -- N of M --
  text = text.replace(/\n\s*--\s*\d+\s+of\s+\d+\s*--\s*\n/g, "\n");
  // Remove standalone page number lines
  text = text.replace(/^\s*Page\s+\d+\s+of\s+\d+\s*$/gm, "");
  // Remove lines that are just page numbers
  text = text.replace(/^\s*\d+\s*$/gm, "");

  return text;
}

/**
 * Parse text content into one or more scenes
 * Supports explicit input mode selection
 */
export function parseScenes(
  text: string,
  options?: ParseSceneOptions,
): ParsedScene[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Clean PDF artifacts first
  text = cleanPdfArtifacts(text);

  const mode = options?.mode ?? "auto";

  // Single scene mode: return entire text as one scene
  if (mode === "single") {
    const trimmed = text.trim();
    return [
      {
        title: "Scene 1",
        content: trimmed,
        characters: extractSceneCharacters(trimmed),
      },
    ];
  }

  // Multiple or auto mode: detect scene breaks
  const detectedScenes = detectSceneBreaks(text);

  // In auto mode, if only one scene detected, return as single
  if (mode === "auto" && detectedScenes.length <= 1) {
    const trimmed = text.trim();
    return [
      {
        title: "Scene 1",
        content: trimmed,
        characters: extractSceneCharacters(trimmed),
      },
    ];
  }

  // Return detected scenes
  if (detectedScenes.length > 0) {
    return detectedScenes.map((scene) => ({
      title: scene.title,
      content: scene.content,
      characters: scene.characters,
    }));
  }

  // Fallback if detection failed
  const trimmed = text.trim();
  return [
    {
      title: "Scene 1",
      content: trimmed,
      characters: extractSceneCharacters(trimmed),
    },
  ];
}

/**
 * Detect scene breaks in text using multiple patterns
 * Returns detected scenes with content and line ranges
 */
export function detectSceneBreaks(text: string): DetectedScene[] {
  const scenes: DetectedScene[] = [];
  const lines = text.split("\n");
  const breaks: Array<{
    lineIndex: number;
    title: string;
    isSeparator?: boolean;
  }> = [];

  // Pattern 1: Scene headers (SCENE 1:, Scene 2, Scene1, Scene 4b:, etc.)
  // \s* allows no space between "Scene" and the number (Annie: "Scene1")
  const sceneHeaderPattern =
    /^(?:SCENE|Scene|scene)\s*(\d+[a-z]?|[IVivx]+)\s*:?\s*(.*)$/;

  // Pattern 2: Act and Scene (ACT 1, SCENE 1 or ACT I SCENE I, etc.)
  const actScenePattern =
    /^(?:ACT|Act|act)\s+(\d+|[IVivx]+)(?:\s*,?\s*(?:SCENE|Scene|scene)\s+(\d+|[IVivx]+))?\s*:?\s*(.*)$/;

  // Pattern 2b: Word-form act labels (ACT ONE, ACT TWO — no numeric)
  const actWordPattern = /^(?:ACT|Act|act)\s+(ONE|TWO|THREE|FOUR|FIVE)\s*$/i;

  // Pattern 2c: Prologue / Epilogue / Interlude with optional title
  const prologuePattern = /^(Prologue|Epilogue|Interlude)\s*[:—–\-]?\s*(.*)$/i;

  // Pattern 3: Bracketed scene headers [SCENE 1] or [Scene I]
  const bracketedPattern =
    /^\[(?:SCENE|Scene|scene)\s+(\d+|[IVivx]+)\s*:?\s*(.*?)\]$/;

  // Pattern 4: #N - Title  (e.g. "#1 - TV Studio", "# 1 — Overture", "#4 – B&B Parlor")
  // \s* allows an optional space between # and the digit (Annie format)
  const numberHeadingPattern = /^#\s*(\d+[a-z]?)\s*[-\u2013\u2014]\s*(.+)$/;

  // Pattern 5: Separator lines (---, ===, ***)
  const separatorPattern = /^(?:---+|===+|\*{3,})\s*(.*)$/;

  // Pattern 6: Screenplay format (INT. LOCATION - TIME or EXT. LOCATION - TIME)
  const screenplayPattern = /^(INT|EXT)\.\s+(.+?)\s*(?:-\s*(.+))?$/i;

  // Word-form act numbers → digits
  const actWordToNum: Record<string, string> = {
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
    ten: "10",
  };

  // Track the current act so SCENE lines inherit act context
  let currentAct: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    let title = "";

    // Skip lines that look like TOC entries (contain dot/ellipsis leaders
    // followed by a page number, e.g. "#1 - TV Studio ........... 7")
    if (/[.…·]{2,}\s*\d+\s*$/.test(trimmed)) {
      continue;
    }

    // Try pattern 4: #N - Title (before SCENE header so it takes priority)
    let match = trimmed.match(numberHeadingPattern);
    if (match) {
      const sceneNum = match[1];
      const sceneTitle = match[2].trim();
      title = `${sceneNum} - ${sceneTitle}`;
      breaks.push({ lineIndex: i, title });
      continue;
    }

    // Try pattern 6: INT./EXT. screenplay format
    match = trimmed.match(screenplayPattern);
    if (match) {
      const locType = match[1].toUpperCase();
      const location = match[2].trim();
      const timeOfDay = match[3] ? match[3].trim() : "";
      title = `${locType}. ${location}${timeOfDay ? ` - ${timeOfDay}` : ""}`;
      breaks.push({ lineIndex: i, title });
      continue;
    }

    // Try pattern 2c: Prologue / Epilogue / Interlude
    match = trimmed.match(prologuePattern);
    if (match) {
      const label =
        match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      const sectionTitle = match[2].trim();
      title = sectionTitle ? `${label}: ${sectionTitle}` : label;
      breaks.push({ lineIndex: i, title });
      continue;
    }

    // Try pattern 1: SCENE N (including alphanumeric like 4b)
    match = trimmed.match(sceneHeaderPattern);
    if (match) {
      const sceneNum = match[1];
      const sceneTitle = match[2].trim();
      if (currentAct) {
        title = `Act ${currentAct}, Scene ${sceneNum}${sceneTitle ? ": " + sceneTitle : ""}`;
      } else {
        title = `Scene ${sceneNum}${sceneTitle ? ": " + sceneTitle : ""}`;
      }
      breaks.push({ lineIndex: i, title });
      continue;
    }

    // Try pattern 2: ACT N [, SCENE M]
    match = trimmed.match(actScenePattern);
    if (match) {
      const actNum = match[1];
      const sceneNum = match[2];
      const sceneTitle = match[3] ? match[3].trim() : "";

      // Always update current act context
      currentAct = actNum;

      if (sceneNum) {
        title = `Act ${actNum}, Scene ${sceneNum}${sceneTitle ? ": " + sceneTitle : ""}`;
      } else {
        title = `Act ${actNum}${sceneTitle ? ": " + sceneTitle : ""}`;
      }
      breaks.push({ lineIndex: i, title });
      continue;
    }

    // Try pattern 2b: ACT ONE / ACT TWO word-form
    match = trimmed.match(actWordPattern);
    if (match) {
      // Update current act context (convert word → number)
      currentAct = actWordToNum[match[1].toLowerCase()] || match[1];

      // Skip break if immediately followed by a scene number (to avoid double-breaking)
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : "";
      if (
        !nextLine.match(numberHeadingPattern) &&
        !nextLine.match(sceneHeaderPattern) &&
        !nextLine.match(bracketedPattern)
      ) {
        title = `Act ${currentAct}`;
        breaks.push({ lineIndex: i, title });
        continue;
      }
      continue; // skip break but act context is still set
    }

    // Try pattern 3: [SCENE N]
    match = trimmed.match(bracketedPattern);
    if (match) {
      const sceneNum = match[1];
      const sceneTitle = match[2].trim();
      if (currentAct) {
        title = `Act ${currentAct}, Scene ${sceneNum}${sceneTitle ? ": " + sceneTitle : ""}`;
      } else {
        title = `Scene ${sceneNum}${sceneTitle ? ": " + sceneTitle : ""}`;
      }
      breaks.push({ lineIndex: i, title });
      continue;
    }

    // Try pattern 5: Separator (---)
    // Content before the separator becomes the current scene;
    // use next non-empty line as a hint for the upcoming scene title.
    match = trimmed.match(separatorPattern);
    if (match) {
      // Capture content BEFORE this separator as a scene break
      breaks.push({
        lineIndex: i,
        title: `Scene ${breaks.length + 1}`,
        isSeparator: true,
      });
      continue;
    }
  }

  // If no breaks detected, return empty array
  if (breaks.length === 0) {
    return [];
  }

  // If the first break is a separator and there is content before it,
  // prepend a virtual break at line 0 to capture that leading content.
  if (breaks.length > 0 && breaks[0].isSeparator && breaks[0].lineIndex > 0) {
    breaks.unshift({ lineIndex: -1, title: `Scene 1`, isSeparator: true });
  }

  // Build scenes from detected breaks
  for (let i = 0; i < breaks.length; i++) {
    const currentBreak = breaks[i];
    const nextBreak = breaks[i + 1];

    // For separator breaks the "header" IS the separator line, so content
    // starts from the line after.
    // For virtual leading breaks (lineIndex === -1), content starts at 0.
    let contentStartLine =
      currentBreak.lineIndex < 0 ? 0 : currentBreak.lineIndex + 1;
    while (contentStartLine < lines.length && !lines[contentStartLine].trim()) {
      contentStartLine++;
    }

    // Find content end (at next break or end of text)
    let contentEndLine = nextBreak ? nextBreak.lineIndex : lines.length;

    // Trim trailing blank lines
    while (
      contentEndLine > contentStartLine &&
      !lines[contentEndLine - 1].trim()
    ) {
      contentEndLine--;
    }

    // Extract content
    const sceneContent = lines
      .slice(contentStartLine, contentEndLine)
      .join("\n")
      .trim();

    if (sceneContent) {
      scenes.push({
        title: currentBreak.title,
        content: sceneContent,
        characters: extractSceneCharacters(sceneContent),
        startLine: currentBreak.lineIndex,
        endLine: contentEndLine,
      });
    }
  }

  return scenes;
}

/**
 * Create a Scene object from ParsedScene
 */
export function createScene(
  projectId: string,
  title: string,
  content: string,
  description?: string,
  order: number = 0,
): Scene {
  const now = new Date().toISOString();
  return {
    id: generateSceneId(),
    projectId,
    title: title || "Untitled Scene",
    content,
    description,
    order,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Parse text input and create Scene objects with explicit mode support
 */
export function createScenesFromInput(
  projectId: string,
  text: string,
  mode?: SceneInputMode,
): Scene[] {
  if (!text || text.trim().length === 0) {
    throw new Error("Scene content cannot be empty");
  }

  const parsedScenes = parseScenes(text, { mode });

  if (parsedScenes.length === 0) {
    throw new Error("Failed to parse scene content");
  }

  // Log detected scenes for debugging
  console.log(
    `[Scenes Parser] Detected ${parsedScenes.length} scenes:`,
    parsedScenes.map((s) => ({
      title: s.title,
      contentLength: s.content.length,
      contentPreview: s.content.substring(0, 50),
    })),
  );

  return parsedScenes.map((scene, index) =>
    createScene(
      projectId,
      scene.title,
      scene.content,
      scene.description,
      index,
    ),
  );
}

/**
 * Detect the number of scenes in text without parsing full content
 * Useful for deciding which mode UI to show
 */
export function detectSceneCount(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }

  text = cleanPdfArtifacts(text);
  const detected = detectSceneBreaks(text);
  return detected.length > 0 ? detected.length : 1;
}

/**
 * Update a scene with new values
 */
export function updateScene(
  scene: Scene,
  updates: Partial<Omit<Scene, "id" | "projectId" | "createdAt">>,
): Scene {
  const newTimestamp = new Date().toISOString();
  // Guarantee updatedAt always advances even sub-millisecond in tests
  const updatedAt =
    newTimestamp > scene.updatedAt ? newTimestamp : scene.updatedAt + "1";
  return {
    ...scene,
    ...updates,
    updatedAt,
  };
}

/**
 * Validate scene title
 */
export function validateSceneTitle(title: string): {
  valid: boolean;
  error?: string;
} {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: "Scene title cannot be empty" };
  }
  if (title.length > 200) {
    return {
      valid: false,
      error: "Scene title must be less than 200 characters",
    };
  }
  return { valid: true };
}

/**
 * Validate scene content
 */
export function validateSceneContent(content: string): {
  valid: boolean;
  error?: string;
} {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: "Scene content cannot be empty" };
  }
  return { valid: true };
}

/**
 * Sort scenes by order
 */
export function sortScenesByOrder(scenes: Scene[]): Scene[] {
  return [...scenes].sort((a, b) => a.order - b.order);
}

// ────────────────────────────────────────
// Scenes & Songs TOC Parser
// ────────────────────────────────────────

/** Regex for detecting the TOC heading line — matches "Scenes & Songs" anywhere in the line */
const TOC_HEADING_RE = /Scenes?\s*(?:&|and)\s*Songs?/i;

/** Regex for scene entries: #N - Title ...... page */
const TOC_SCENE_RE = /^[\s]*#(\d+)\s*[-–—]\s*(.+?)[\s.…·]+(\d+)\s*$/;

/** Regex for act markers: ACT ONE ...... page */
const TOC_ACT_RE =
  /^[\s]*ACT\s+(ONE|TWO|THREE|FOUR|FIVE|[IVX]+|\d+)[\s.…·]*(\d+)?\s*$/i;

/** Regex for song entries: ALL CAPS TITLE ...... page */
const TOC_SONG_RE = /^[\s]*([A-Z][A-Z\s/'()\-,!?.&]+?)[\s.…·]+(\d+)\s*$/;

/**
 * Headings that signal the end of the TOC section.
 * Case-insensitive match at start of line.
 */
const TOC_END_HEADINGS = [
  /^[\s]*cast\s+(of\s+)?characters/i,
  /^[\s]*musical\s+numbers/i,
  /^[\s]*production\s+notes/i,
  /^[\s]*setting/i,
  /^[\s]*synopsis/i,
  /^[\s]*characters?\s*$/i,
];

/**
 * Check if a line is a plausible ALL-CAPS song title.
 * Must be predominantly uppercase letters (allow punctuation/spaces).
 * Filters out short lines and pure number lines.
 */
function isSongTitle(text: string): boolean {
  const stripped = text.replace(/[\s.…·\d]+$/, "").trim();
  if (stripped.length < 3) return false;
  const letters = stripped.replace(/[^a-zA-Z]/g, "");
  if (letters.length === 0) return false;
  const upperLetters = stripped.replace(/[^A-Z]/g, "");
  // At least 80% uppercase letters
  return upperLetters.length / letters.length >= 0.8;
}

/**
 * Parse a "Scenes & Songs" table of contents from script text.
 *
 * Looks for a heading like "Scenes & Songs" or "Scenes and Songs",
 * then parses scene entries (#N - Title), act markers (ACT ONE),
 * and song titles (ALL CAPS lines) until the section ends.
 *
 * @returns ParsedToc with entries, or null if no TOC found
 */
export function parseTOC(text: string): ParsedToc | null {
  if (!text || text.trim().length === 0) return null;

  const lines = text.split(/\r?\n/);

  // ── Find the TOC heading ──
  let tocStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (TOC_HEADING_RE.test(lines[i])) {
      tocStart = i;
      break;
    }
  }
  if (tocStart === -1) return null;

  // ── Parse entries until an end heading or large gap ──
  const entries: TocEntry[] = [];
  let currentAct = "";
  let currentEntry: TocEntry | null = null;
  let lastMatchedLine = tocStart; // track last line that matched a TOC pattern
  let emptyLineCount = 0;

  for (let i = tocStart + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for end of TOC
    if (TOC_END_HEADINGS.some((re) => re.test(line))) {
      lastMatchedLine = i - 1;
      break;
    }

    // Skip blank lines (but track them to detect section end)
    if (trimmed === "") {
      emptyLineCount++;
      // More than 3 consecutive blank lines suggests a page break / section end
      if (emptyLineCount > 3) {
        break;
      }
      continue;
    }
    emptyLineCount = 0;

    // Act marker
    const actMatch = TOC_ACT_RE.exec(line);
    if (actMatch) {
      // Save any pending entry
      if (currentEntry) entries.push(currentEntry);
      currentEntry = null;
      currentAct = `ACT ${actMatch[1].toUpperCase()}`;
      lastMatchedLine = i;
      continue;
    }

    // Scene entry: #N - Title
    const sceneMatch = TOC_SCENE_RE.exec(line);
    if (sceneMatch) {
      // Save any pending entry
      if (currentEntry) entries.push(currentEntry);
      currentEntry = {
        sceneNumber: sceneMatch[1],
        sceneTitle: sceneMatch[2].trim(),
        act: currentAct,
        songs: [],
        page: parseInt(sceneMatch[3], 10),
      };
      lastMatchedLine = i;
      continue;
    }

    // Song entry: ALL CAPS line with page number
    const songMatch = TOC_SONG_RE.exec(line);
    if (songMatch && isSongTitle(line)) {
      const songTitle = songMatch[1].trim();
      // Associate with the current scene, or create a standalone entry
      if (currentEntry) {
        currentEntry.songs.push(songTitle);
      } else {
        // Orphan song (before any scene listed), attach to a placeholder
        entries.push({
          sceneNumber: "0",
          sceneTitle: "Pre-scene",
          act: currentAct,
          songs: [songTitle],
        });
      }
      lastMatchedLine = i;
      continue;
    }

    // Non-blank line that doesn't match any TOC pattern → end of TOC
    break;
  }

  // Push last pending entry
  if (currentEntry) entries.push(currentEntry);

  // If we found no entries, the heading was likely a false positive
  if (entries.length === 0) return null;

  // Build raw text for reference
  const rawLines = lines.slice(tocStart, lastMatchedLine + 1);

  return {
    entries,
    rawText: rawLines.join("\n"),
    lineRange: [tocStart, lastMatchedLine],
  };
}

/**
 * Remove the TOC section from script text so it doesn't appear as a scene.
 * Returns the text with the TOC lines replaced by blank lines (preserving
 * line numbering for downstream parsers).
 */
export function stripTocSection(text: string, toc: ParsedToc): string {
  const lines = text.split(/\r?\n/);
  const [start, end] = toc.lineRange;
  for (let i = start; i <= end && i < lines.length; i++) {
    lines[i] = "";
  }
  return lines.join("\n");
}

/**
 * Given a parsed TOC and a scene title, find the matching TOC entry
 * and return the list of songs in that scene.
 */
export function findSongsForScene(
  toc: ParsedToc,
  sceneTitle: string,
): string[] {
  const normalized = sceneTitle.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const entry of toc.entries) {
    const entryNorm = entry.sceneTitle.toLowerCase().replace(/[^a-z0-9]/g, "");
    const entryWithNum = `${entry.sceneNumber}${entryNorm}`;
    // Match by title content or scene number in title
    if (
      normalized.includes(entryNorm) ||
      entryNorm.includes(normalized) ||
      normalized.includes(entryWithNum) ||
      normalized.includes(entry.sceneNumber)
    ) {
      return entry.songs;
    }
  }
  return [];
}

/**
 * Reorder scenes – returns a new array sorted according to sceneIds.
 */
export function reorderScenes(scenes: Scene[], sceneIds: string[]): Scene[] {
  return scenes
    .map((scene) => {
      const newOrder = sceneIds.indexOf(scene.id);
      return newOrder !== -1 ? { ...scene, order: newOrder } : scene;
    })
    .sort((a, b) => a.order - b.order);
}
