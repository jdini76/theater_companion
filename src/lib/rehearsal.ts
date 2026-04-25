import { DialogueLine } from "@/types/rehearsal";

// ── Module-level regex constants ────────────────────────────────────────────

/**
 * Scene heading patterns covering Groundhog Day, CMIYC, and Annie formats:
 *   #1 - TV Studio  |  # 1 — Overture  (Groundhog Day / Annie libretto)
 *   ACT ONE  |  ACT TWO                (all scripts)
 *   Scene 1:  |  Scene 4b:  |  Scene1  (CMIYC / screenplay / Annie)
 *   Prologue:  |  Epilogue:            (CMIYC)
 *
 * Notes:
 *   #\s*\d+ allows a space between # and the digit (Annie: "# 1 — Overture")
 *   \s*\d+   allows no space between Scene and the digit (Annie: "Scene1")
 */
const SCENE_HEADING_RE =
  /^(?:#\s*\d+\s*[-\u2013\u2014]\s*\S|ACT\s+(?:ONE|TWO|THREE|I{1,3}V?|\d+)\b|(?:SCENE|scene)\s*\d+[a-z]?\b|(?:Prologue|Epilogue|Interlude)\s*:)/i;

/**
 * ALL-CAPS character name on its own line (no colon) — screenplay / CMIYC style.
 * Handles optional trailing stage note: "DOLLAR (overlapping)", "PAULA (exits.)"
 */
const STANDALONE_CHAR_NAME_RE =
  /^([A-Z][A-Z0-9\s\-'.&,+]+?)(\s*\([^)]*\))?\s*$/;

/**
 * Standalone stage direction: an entire trimmed line wrapped in ( ) or [ ].
 * Does NOT match inline parentheticals like "PHIL: (whispering) text" because
 * those lines start with a letter, not a bracket.
 */
const STANDALONE_STAGE_DIR_RE = /^\([\s\S]*\)$|^\[[\s\S]*\]$/;

/**
 * Character speech line:  NAME: dialogue
 *
 * Name character set covers:
 *   plain names              ROMEO, JULIET
 *   numbered names           DJ 1, DJ 2, DJ 1 & DJ 2
 *   titles with periods      MRS. LANCASTER, DR. ROSS
 *   ampersand groups         FRED & DEBBIE
 *   ensemble lines           MRS. LANCASTER, NED & CHUBBY MAN
 *
 * The non-greedy `*?` expands only as far as necessary to find the first `:`
 * so a colon inside the dialogue body is captured intact in group 2.
 */
const CHAR_LINE_RE = /^([A-Z][A-Z0-9\s\-'.&,+]*?)\s*:\s*(.*)$/;

/**
 * Inline character+dialogue line (no colon): ALL-CAPS name followed by
 * mixed-case dialogue on the same line.
 *
 *   PAULA Frankie! You remember your father's friend?
 *   YOUNG FRANK JUNIOR Mom, Dad I met this girl –
 *   JACK BARNES Frank. Good to see you.
 *
 * The name is one or more ALL-CAPS words (each ≥2 letters, ruling out "I" / "A").
 * Periods for titles (MRS. DR.) and digits (DJ 1) are allowed.
 * The dialogue must start with a word containing a lowercase letter, or an
 * opening parenthetical.
 */
const INLINE_CHAR_RE =
  /^((?:[A-Z][A-Z0-9\-'.&,+]+)(?:\s+(?:[A-Z][A-Z0-9\-'.&,+]+))*)\s+(I\s.+|(?=[A-Z]*[a-z])\S.+|\(.+)$/;

/**
 * Words that are never the first word of a character name.
 * Covers production cues (SFX, VFX, …) and common English function words /
 * pronouns that frequently start song lyric lines and would otherwise be
 * mis-detected as standalone character names (e.g. "MAYBE FAR AWAY," or
 * "OR MAYBE REAL NEARBY" in Annie / Groundhog Day songs).
 */
const NON_CHARACTER_WORDS = new Set([
  // Production / technical cues
  "SFX",
  "SFZ",
  "SPX",
  "VFX",
  "NOTE",
  "NOTES",
  "INT",
  "EXT",
  "CUT",
  "SONG",
  "MUSIC",
  // Personal pronouns (common lyric starters)
  "HE",
  "SHE",
  "WE",
  "THEY",
  "IT",
  "ME",
  "MY",
  "YOUR",
  "HIS",
  "HER",
  "OUR",
  "THEIR",
  // Conjunctions / prepositions / articles (common lyric starters)
  "OR",
  "AND",
  "BUT",
  "NOT",
  "NO",
  "SO",
  "YET",
  "NOR",
  "THE",
  "AN",
  "AS",
  "AT",
  "BY",
  "IN",
  "OF",
  "ON",
  "TO",
  "UP",
  // Other frequent lyric starters that are not plausible character names
  "MAYBE",
  "PERHAPS",
  "AGAIN",
  "ALSO",
  "OKAY",
  "WELL",
  "YES",
  "YEAH",
  "SURE",
  "UNLESS",
  "APART",
  "AVOID",
  "SOME",
  "THAT",
  "THIS",
  "THESE",
  // Interrogatives / relatives
  "WHEN",
  "WHAT",
  "WHERE",
  "WHO",
  "HOW",
  "WHY",
  // Common lyric / prose starters
  "CAUSE",
  "JUST",
  "LIKE",
  "EVERY",
  "NEVER",
  "ALWAYS",
  "HERE",
  "THERE",
  "THEN",
  "THROUGH",
  "IF",
  "FOR",
  "FROM",
  "WITH",
  "INTO",
  "OH",
  "TILL",
  "UNTIL",
  "THOSE",
  "GOT",
  "GONNA",
  "DID",
  "DO",
  "DONE",
  "THINK",
  "NEGLECTED",
  "SWEAR",
  "TOAST",
  // Informal pronouns / filler words common in song lyrics (Annie, etc.)
  "YA",
  "YO",
  "AIN'T",
  "BETCHA",
  "BETCHA'",
  "STEADA",
  "HARK",
]);

// ── Inline parenthetical helpers ─────────────────────────────────────────────

/**
 * Regex matching an inline parenthetical or bracketed stage direction
 * embedded within dialogue text, e.g. "(whispering)" or "[exits]".
 */
const INLINE_PARENTHETICAL_RE = /(\([^)]*\)|\[[^\]]*\])/g;

/**
 * Split a dialogue string into alternating text and parenthetical segments.
 * Returns an array of `{ text, isParenthetical }` objects.
 *
 *   splitParentheticals("(whispering) Hello there (pause) friend")
 *   → [
 *       { text: "(whispering)",   isParenthetical: true  },
 *       { text: "Hello there",    isParenthetical: false },
 *       { text: "(pause)",        isParenthetical: true  },
 *       { text: "friend",         isParenthetical: false },
 *     ]
 */
function splitParentheticals(
  dialogue: string,
): Array<{ text: string; isParenthetical: boolean }> {
  const segments: Array<{ text: string; isParenthetical: boolean }> = [];
  let lastIndex = 0;
  const re = new RegExp(INLINE_PARENTHETICAL_RE.source, "g");
  let match: RegExpExecArray | null;

  while ((match = re.exec(dialogue)) !== null) {
    const before = dialogue.slice(lastIndex, match.index).trim();
    if (before) {
      segments.push({ text: before, isParenthetical: false });
    }
    segments.push({ text: match[0], isParenthetical: true });
    lastIndex = re.lastIndex;
  }

  const remaining = dialogue.slice(lastIndex).trim();
  if (remaining) {
    segments.push({ text: remaining, isParenthetical: false });
  }

  return segments;
}

/**
 * Post-process parsed dialogue lines to extract inline parentheticals
 * from dialogue and emit them as separate stage direction entries.
 *
 * A line like `PHIL: (whispering) I need to tell you something.` becomes:
 *   1. [Stage Direction]: (whispering)
 *   2. PHIL: I need to tell you something.
 */
function expandInlineParentheticals(lines: DialogueLine[]): DialogueLine[] {
  const result: DialogueLine[] = [];
  let lineNumber = 0;

  for (const line of lines) {
    // Don't touch lines already classified as stage directions, narrative,
    // or scene headings.
    if (
      line.isStageDirection ||
      line.character === "[Narrative]" ||
      line.character === "[Scene Heading]"
    ) {
      result.push({ ...line, lineNumber: lineNumber++ });
      continue;
    }

    const segments = splitParentheticals(line.dialogue);

    // No parentheticals found — keep original line
    if (segments.every((s) => !s.isParenthetical)) {
      result.push({ ...line, lineNumber: lineNumber++ });
      continue;
    }

    // Emit each segment as its own entry
    for (const seg of segments) {
      if (seg.isParenthetical) {
        result.push({
          lineNumber: lineNumber++,
          character: "[Stage Direction]",
          dialogue: seg.text,
          isStageDirection: true,
        });
      } else {
        result.push({
          lineNumber: lineNumber++,
          character: line.character,
          dialogue: seg.text,
        });
      }
    }
  }

  return result;
}

// ── Script format detection ─────────────────────────────────────────────────

/**
 * Dialogue format used by a pasted script.
 *
 *   colon      – CHARACTER: dialogue on the same line (Groundhog Day / libretto)
 *   standalone – CHARACTER NAME on its own line, dialogue on the next line
 *                (Catch Me If You Can / screenplay style)
 *   mixed      – both patterns found in the same script
 */
export type ScriptFormat = "colon" | "standalone" | "inline" | "mixed";

/**
 * Heuristically detect the dominant dialogue format of a pasted script by
 * scanning the first 100 lines for evidence of each style.
 *
 * Evidence for **colon**:     a line matching `NAME: non-empty text`
 * Evidence for **standalone**: an ALL-CAPS-only line immediately followed by a
 *                              line containing lowercase letters (clearly prose),
 *                              confirming the ALL-CAPS line is a speaker label.
 */
export function detectScriptFormat(content: string): ScriptFormat {
  const sample = content.split("\n").slice(0, 100);
  let colonScore = 0;
  let standaloneScore = 0;
  let inlineScore = 0;

  for (let i = 0; i < sample.length; i++) {
    const t = sample[i].trim();
    const next = i < sample.length - 1 ? (sample[i + 1] ?? "").trim() : "";

    // Colon format: NAME: non-empty dialogue
    const cm = CHAR_LINE_RE.exec(t);
    if (cm && isValidCharacterName(cm[1].trim()) && cm[2].trim()) {
      colonScore++;
    }

    // Standalone format: ALL-CAPS-only name line followed by mixed-case prose.
    // The lowercase test on `next` filters out song lyrics (which are also
    // ALL-CAPS) and catches only genuine prose dialogue.
    if (
      !CHAR_LINE_RE.test(t) &&
      !STANDALONE_STAGE_DIR_RE.test(t) &&
      !SCENE_HEADING_RE.test(t) &&
      STANDALONE_CHAR_NAME_RE.test(t)
    ) {
      const sm = STANDALONE_CHAR_NAME_RE.exec(t)!;
      if (isValidCharacterName(sm[1].trim()) && next && /[a-z]/.test(next)) {
        standaloneScore++;
      }
    }

    // Inline format: ALLCAPS_NAME lowercase dialogue on same line, no colon
    if (!cm) {
      const im = INLINE_CHAR_RE.exec(t);
      if (im && isValidCharacterName(im[1].trim())) {
        inlineScore++;
      }
    }
  }

  if (
    colonScore >= 3 &&
    colonScore >= standaloneScore * 2 &&
    colonScore >= inlineScore * 2
  )
    return "colon";
  if (
    standaloneScore >= 3 &&
    standaloneScore >= colonScore * 2 &&
    standaloneScore >= inlineScore * 2
  )
    return "standalone";
  if (
    inlineScore >= 3 &&
    inlineScore >= colonScore * 2 &&
    inlineScore >= standaloneScore * 2
  )
    return "inline";
  // Unambiguous format: some evidence, zero counter-evidence from other formats.
  if (standaloneScore >= 1 && colonScore === 0 && inlineScore === 0)
    return "standalone";
  if (inlineScore >= 1 && colonScore === 0 && standaloneScore === 0)
    return "inline";
  if (colonScore >= 1 && standaloneScore === 0 && inlineScore === 0)
    return "colon";
  if (colonScore >= 2 || standaloneScore >= 2 || inlineScore >= 2)
    return "mixed";
  return "colon"; // safe default
}

// ── Character-name validator ─────────────────────────────────────────────────

/**
 * Returns true when `name` plausibly identifies a character rather than a
 * production cue, song lyric fragment, or mis-parsed line.
 */
function isValidCharacterName(name: string): boolean {
  if (!name || name.length < 2 || name.length > 60) return false;

  // Reject pure numbers or numeric words (e.g. "7", "123")
  if (/^\d+$/.test(name.trim())) return false;

  // Reject number words commonly found in song lyrics
  const NUMBER_WORDS = new Set([
    "ONE",
    "TWO",
    "THREE",
    "FOUR",
    "FIVE",
    "SIX",
    "SEVEN",
    "EIGHT",
    "NINE",
    "TEN",
    "ELEVEN",
    "TWELVE",
  ]);
  if (NUMBER_WORDS.has(name.trim().toUpperCase())) return false;

  // Reject URLs, email addresses, file paths
  if (name.includes("/") || name.includes("@") || name.includes(".com"))
    return false;

  // Reject names containing ellipsis-style punctuation (lyric fragments
  // like "YA DAH DAH..." are not character names)
  if (/\.{2,}/.test(name)) return false;

  // Character names rarely exceed 4 words; longer ALL-CAPS lines are almost
  // certainly song lyrics (e.g. "CAUSE THE PINSTRIPES ARE ALL THAT THEY SEE").
  // Group names joined by &, comma, or + (e.g. "DJ 1 & DJ 2") are exempt.
  const hasJoiner = /[,&+]/.test(name);
  const words = name.trim().split(/\s+/);
  if (!hasJoiner && words.length > 4) return false;

  // Reject known production-direction prefixes
  const firstWord = words[0].toUpperCase();
  if (NON_CHARACTER_WORDS.has(firstWord)) return false;

  // Reject if ALL words are common English words (likely a lyric phrase)
  // but allow if it's a single word ≥ 3 chars (could be a name like "FRED")
  if (words.length >= 2) {
    const COMMON_WORDS = new Set([
      "A",
      "AN",
      "THE",
      "IS",
      "WAS",
      "ARE",
      "WERE",
      "BE",
      "BEEN",
      "BEING",
      "HAVE",
      "HAS",
      "HAD",
      "DO",
      "DOES",
      "DID",
      "WILL",
      "WOULD",
      "SHALL",
      "SHOULD",
      "MAY",
      "MIGHT",
      "MUST",
      "CAN",
      "COULD",
      "NEED",
      "I",
      "YOU",
      "HE",
      "SHE",
      "IT",
      "WE",
      "THEY",
      "ME",
      "HIM",
      "US",
      "THEM",
      "MY",
      "YOUR",
      "HIS",
      "HER",
      "ITS",
      "OUR",
      "THEIR",
      "THAT",
      "THIS",
      "THESE",
      "THOSE",
      "WHAT",
      "WHICH",
      "WHO",
      "WHOM",
      "AND",
      "OR",
      "BUT",
      "NOT",
      "NO",
      "NOR",
      "SO",
      "YET",
      "FOR",
      "IN",
      "ON",
      "AT",
      "BY",
      "TO",
      "UP",
      "OF",
      "OFF",
      "OUT",
      "FROM",
      "WITH",
      "ABOUT",
      "ABOVE",
      "AFTER",
      "AGAIN",
      "ALL",
      "ALSO",
      "AM",
      "ANY",
      "BACK",
      "BECAUSE",
      "BEFORE",
      "BEHIND",
      "BETWEEN",
      "BOTH",
      "COME",
      "COMES",
      "CRAP",
      "DAY",
      "DAYS",
      "DOWN",
      "EACH",
      "EVER",
      "EVERY",
      "EVERYTHING",
      "FAR",
      "FIND",
      "FIRST",
      "FLASH",
      "FLASHBACK",
      "GET",
      "GIVE",
      "GO",
      "GOES",
      "GOING",
      "GONE",
      "GOOD",
      "GOT",
      "HERE",
      "HOW",
      "JUST",
      "KEEP",
      "KNOW",
      "LAST",
      "LET",
      "LIFE",
      "LONG",
      "LOOK",
      "LOOKED",
      "LUCKY",
      "MAKE",
      "MANY",
      "MORE",
      "MOST",
      "MUCH",
      "NEVER",
      "NEW",
      "NEXT",
      "NOBODY",
      "NOTHING",
      "NOW",
      "ONLY",
      "OTHER",
      "OVER",
      "PART",
      "SECOND",
      "SEE",
      "SOME",
      "STILL",
      "SURE",
      "TAKE",
      "TELL",
      "THAN",
      "THEN",
      "THERE",
      "THING",
      "THROUGH",
      "TIME",
      "TOO",
      "VERY",
      "WANT",
      "WAY",
      "WELL",
      "WERE",
      "WHEN",
      "WHERE",
      "WHILE",
      "WHY",
      "WILL",
      "WOULD",
      "EYES",
      "LAUGHTER",
      "BRIGHT",
      "CARES",
      "APART",
      "AVOID",
      "UNLESS",
      "NEGLECTED",
      "SWEAR",
      "TOAST",
    ]);
    const allCommon = words.every((w) => COMMON_WORDS.has(w.toUpperCase()));
    if (allCommon) return false;
  }

  // Must be ≥80 % uppercase letters / allowed symbols
  const validCount = (name.match(/[A-Z0-9\s\-'.&,+]/g) ?? []).length;
  return validCount / name.length >= 0.8;
}

// ── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parse dialogue lines from pasted theater-script content.
 *
 * Handles two dominant script formats automatically:
 *
 *   **Colon format** (Groundhog Day / libretto):
 *     CHARACTER: dialogue text
 *     CHARACTER: (whispering) inline aside kept in dialogue
 *     CHARACTER:              (empty → song/verse mode, lyrics follow)
 *
 *   **Standalone format** (Catch Me If You Can / screenplay):
 *     CHARACTER NAME
 *     Dialogue on the next line.
 *     CHARACTER NAME (overlapping)
 *     More dialogue.
 *
 *   Both formats support:
 *     (Stage direction on its own line)  or  [Sound cue]
 *     Continuation / hard-wrap across pasted lines (no blank between)
 *     Verse break (blank-line-separated blocks → new DialogueLine per block)
 *     Scene headings reset speaker context
 *
 * An optional `formatHint` skips auto-detection when the caller already knows
 * the format (e.g. from a parsing wizard step).
 */
export function parseDialogueLines(
  sceneContent: string,
  formatHint?: ScriptFormat,
): DialogueLine[] {
  const output: DialogueLine[] = [];
  let lineNumber = 0;

  // Most recently confirmed speaker (persists across blanks for song verses)
  let lastCharacter: string | null = null;

  // Index of the last writable dialogue entry for `lastCharacter`
  // (-1 = in song/standalone mode, waiting for first lyric line)
  let lastDialogueIdx = -1;

  // Set after a blank when a character is active; causes the next lyric/
  // continuation to open a new entry rather than append to the current one.
  let afterBlank = true; // true at document start so first line can be detected

  // Standalone format: character name seen on its own line, waiting for the
  // first dialogue line below it.
  let pendingStandaloneChar: string | null = null;

  const fmt = formatHint ?? detectScriptFormat(sceneContent);
  const useStandalone = fmt === "standalone" || fmt === "mixed";
  const useInline = fmt === "inline" || fmt === "mixed";

  const allLines = sceneContent.split("\n");
  for (let i = 0; i < allLines.length; i++) {
    const trimmed = allLines[i].trim();

    // ── Blank line ──────────────────────────────────────────────────
    if (!trimmed) {
      // Always mark that we're at the start of a new paragraph. This is
      // needed so standalone character names can be detected after scene
      // headings (which reset lastCharacter to null).
      afterBlank = true;
      // Do NOT clear pendingStandaloneChar: a stage direction or blank can
      // separate a standalone name line from its dialogue in some scripts.
      continue;
    }

    // ── Scene heading ───────────────────────────────────────────────
    if (SCENE_HEADING_RE.test(trimmed)) {
      output.push({
        lineNumber: lineNumber++,
        character: "[Scene Heading]",
        dialogue: trimmed,
        isStageDirection: true,
      });
      lastCharacter = null;
      lastDialogueIdx = -1;
      afterBlank = false;
      pendingStandaloneChar = null;
      continue;
    }

    // ── Standalone stage direction ──────────────────────────────────
    if (STANDALONE_STAGE_DIR_RE.test(trimmed)) {
      output.push({
        lineNumber: lineNumber++,
        character: "[Stage Direction]",
        dialogue: trimmed,
        isStageDirection: true,
      });
      // Preserve lastCharacter and pendingStandaloneChar: a stage direction
      // between a speaker label and their dialogue (CMIYC) or mid-song
      // (Groundhog Day) does not end the current speaker.
      //
      // In standalone mode, if there is NO active speaker AND no pending
      // character label (e.g. a stage direction at document start, or right
      // after a scene heading), flip afterBlank so the standalone-detection
      // check fires on the next line.
      //
      // If a speaker IS active, or we already have a pendingStandaloneChar
      // (e.g. "ANNIE" then "(Sings)" then lyrics), keep afterBlank false so
      // that lyric lines are not mistaken for new character name labels.
      afterBlank =
        useStandalone &&
        lastCharacter === null &&
        pendingStandaloneChar === null;
      continue;
    }

    // ── Colon format character line ─────────────────────────────────
    // Always checked first; colon format takes precedence over standalone.
    const charMatch = CHAR_LINE_RE.exec(trimmed);
    if (charMatch) {
      const character = charMatch[1].trim();
      const dialogue = charMatch[2].trim();

      if (isValidCharacterName(character)) {
        pendingStandaloneChar = null;
        if (dialogue) {
          const idx = output.length;
          output.push({ lineNumber: lineNumber++, character, dialogue });
          lastCharacter = character;
          lastDialogueIdx = idx;
        } else {
          // Song/verse mode: CHARACTER: with no inline text.
          lastCharacter = character;
          lastDialogueIdx = -1;
        }
        afterBlank = false;
        continue;
      }

      // Name matched the regex but failed validation.
      // If we have an active speaker AND the line is ALL-CAPS (no lowercase),
      // this is almost certainly a song lyric that happens to contain a colon,
      // e.g. "THAT FOLKS 'ROUND HERE ALWAYS SAY:".
      // Treat as continuation rather than breaking the current speaker.
      // If the line has lowercase (e.g. "SFX: Hat squeak"), it's a production
      // cue or prose — fall through to narrative.
      const lineIsAllCaps = !/[a-z]/.test(trimmed);
      if (lastCharacter !== null && lineIsAllCaps) {
        if (lastDialogueIdx >= 0) {
          // Append to existing entry (hard-wrapped continuation)
          if (!afterBlank) {
            output[lastDialogueIdx].dialogue += " " + trimmed;
          } else {
            const idx = output.length;
            output.push({
              lineNumber: lineNumber++,
              character: lastCharacter,
              dialogue: trimmed,
            });
            lastDialogueIdx = idx;
          }
        } else {
          // Song mode: first lyric line
          const idx = output.length;
          output.push({
            lineNumber: lineNumber++,
            character: lastCharacter,
            dialogue: trimmed,
          });
          lastDialogueIdx = idx;
        }
        afterBlank = false;
        continue;
      }

      // No active speaker: treat as narrative and break speaker context.
      output.push({
        lineNumber: lineNumber++,
        character: "[Narrative]",
        dialogue: trimmed,
      });
      lastCharacter = null;
      lastDialogueIdx = -1;
      pendingStandaloneChar = null;
      afterBlank = false;
      continue;
    }

    // ── Standalone character name (screenplay / CMIYC format) ───────
    // Accept when `afterBlank` is true OR when we just saw prose dialogue
    // (lastDialogueIdx >= 0) and the next non-empty line contains lowercase
    // (confirming this ALL-CAPS line is a speaker label, not a song lyric).
    // The lastDialogueIdx >= 0 guard prevents mid-song lyric lines from
    // being mistaken for character names after a bare "CHARACTER:" header.
    if (useStandalone) {
      const sm = STANDALONE_CHAR_NAME_RE.exec(trimmed);
      if (sm && isValidCharacterName(sm[1].trim())) {
        let acceptAsCharacter = afterBlank;
        if (!acceptAsCharacter && lastDialogueIdx >= 0) {
          // Lookahead: find the next non-empty, non-stage-direction line.
          // If it contains lowercase → this ALL-CAPS line is a speaker label.
          // Skip standalone stage directions so "(He exits.)" between a
          // lyric and the next speaker doesn't fool the check.
          for (let j = i + 1; j < allLines.length; j++) {
            const peek = allLines[j].trim();
            if (!peek || STANDALONE_STAGE_DIR_RE.test(peek)) continue;
            acceptAsCharacter = /[a-z]/.test(peek);
            break;
          }
        }
        if (acceptAsCharacter) {
          pendingStandaloneChar = sm[1].trim();
          // Emit trailing parenthetical as stage direction:
          //   DOLLAR (overlapping) → stage direction "(overlapping)"
          if (sm[2]) {
            output.push({
              lineNumber: lineNumber++,
              character: "[Stage Direction]",
              dialogue: sm[2].trim(),
              isStageDirection: true,
            });
          }
          lastDialogueIdx = -1;
          afterBlank = false;
          continue;
        }
      }
    }

    // ── Inline character + dialogue (no colon, same line) ───────────
    // ALLCAPS_NAME mixed-case dialogue text
    if (useInline) {
      const im = INLINE_CHAR_RE.exec(trimmed);
      if (im && isValidCharacterName(im[1].trim())) {
        const character = im[1].trim();
        const dialogue = im[2].trim();
        pendingStandaloneChar = null;
        const idx = output.length;
        output.push({ lineNumber: lineNumber++, character, dialogue });
        lastCharacter = character;
        lastDialogueIdx = idx;
        afterBlank = false;
        continue;
      }
    }

    // ── Consume pending standalone character ────────────────────────
    // This line is the first dialogue line for the speaker named above.
    if (pendingStandaloneChar !== null) {
      lastCharacter = pendingStandaloneChar;
      pendingStandaloneChar = null;
      const idx = output.length;
      output.push({
        lineNumber: lineNumber++,
        character: lastCharacter,
        dialogue: trimmed,
      });
      lastDialogueIdx = idx;
      afterBlank = false;
      continue;
    }

    // ── Continuation / lyric line ───────────────────────────────────
    if (lastCharacter !== null) {
      if (!afterBlank && lastDialogueIdx >= 0) {
        // Hard-wrapped continuation: append so TTS reads as one speech.
        output[lastDialogueIdx].dialogue += " " + trimmed;
      } else {
        // Verse break (blank-separated) or first lyric after CHARACTER:
        const idx = output.length;
        output.push({
          lineNumber: lineNumber++,
          character: lastCharacter,
          dialogue: trimmed,
        });
        lastDialogueIdx = idx;
      }
      afterBlank = false;
      continue;
    }

    // ── Narrative / unclassified ────────────────────────────────────
    output.push({
      lineNumber: lineNumber++,
      character: "[Narrative]",
      dialogue: trimmed,
    });
    lastDialogueIdx = -1;
    afterBlank = false;
  }

  return expandInlineParentheticals(output);
}

/**
 * Extract unique character names from dialogue lines
 */
export function extractCharacterNames(lines: DialogueLine[]): string[] {
  const characters = new Set<string>();

  for (const line of lines) {
    if (!line.isStageDirection && line.character !== "[Narrative]") {
      characters.add(line.character);
    }
  }

  return Array.from(characters).sort();
}

/**
 * Filter dialogue lines by character
 */
export function getLinesByCharacter(
  lines: DialogueLine[],
  characterName: string,
): DialogueLine[] {
  return lines.filter((line) => line.character === characterName);
}

/**
 * Get lines for a user to practice (all non-user character lines)
 */
export function getNonUserLines(
  lines: DialogueLine[],
  userCharacterName: string,
): DialogueLine[] {
  return lines.filter(
    (line) =>
      line.character !== userCharacterName &&
      line.character !== "[Narrative]" &&
      !line.isStageDirection,
  );
}

/**
 * Calculate statistics about a scene
 */
export interface SceneStatistics {
  totalLines: number;
  dialogueLines: number;
  stageDirections: number;
  uniqueCharacters: number;
  characterLineCount: { [character: string]: number };
}

export function getSceneStatistics(lines: DialogueLine[]): SceneStatistics {
  const characterLineCount: { [character: string]: number } = {};
  let dialogueLines = 0;
  let stageDirections = 0;

  for (const line of lines) {
    if (line.isStageDirection) {
      stageDirections++;
    } else if (line.character !== "[Narrative]") {
      dialogueLines++;
      characterLineCount[line.character] =
        (characterLineCount[line.character] || 0) + 1;
    }
  }

  return {
    totalLines: lines.length,
    dialogueLines,
    stageDirections,
    uniqueCharacters: Object.keys(characterLineCount).length,
    characterLineCount,
  };
}

/**
 * Get a summary of the scene for UI display
 */
export interface SceneSummary {
  characters: string[];
  dialogueLineCount: number;
  stageDirectionCount: number;
  narrativeLineCount: number;
  characterLineBreakdown: { [character: string]: number };
}

export function getSceneSummary(sceneContent: string): SceneSummary {
  const lines = parseDialogueLines(sceneContent);
  const stats = getSceneStatistics(lines);

  let narrativeLineCount = 0;
  for (const line of lines) {
    if (line.character === "[Narrative]") {
      narrativeLineCount++;
    }
  }

  return {
    characters: extractCharacterNames(lines),
    dialogueLineCount: stats.dialogueLines,
    stageDirectionCount: stats.stageDirections,
    narrativeLineCount,
    characterLineBreakdown: stats.characterLineCount,
  };
}

/**
 * Generate a rehearsal ID
 */
export function generateRehearsalId(): string {
  return `rehearsal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get next dialogue line from a character perspective
 * Useful for finding the next line where a character speaks
 */
export function findNextCharacterLine(
  lines: DialogueLine[],
  currentIndex: number,
  characterName: string,
): DialogueLine | null {
  for (let i = currentIndex + 1; i < lines.length; i++) {
    if (lines[i].character === characterName) {
      return lines[i];
    }
  }
  return null;
}

/**
 * Get context around a line (previous and next lines)
 */
export interface LineContext {
  previous: DialogueLine | null;
  current: DialogueLine;
  next: DialogueLine | null;
}

export function getLineContext(
  lines: DialogueLine[],
  lineIndex: number,
): LineContext | null {
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return null;
  }

  return {
    previous: lineIndex > 0 ? lines[lineIndex - 1] : null,
    current: lines[lineIndex],
    next: lineIndex < lines.length - 1 ? lines[lineIndex + 1] : null,
  };
}

/**
 * Cue Only mode helper: given a position in the line list, return the index
 * of the single line that should be spoken as the "cue" — i.e. the line
 * immediately before the next occurrence of the user's character.
 *
 * Returns null when there are no more user lines after fromIndex (meaning
 * the rest of the scene can play out normally) or when the user's very
 * first line is line 0 (no preceding cue exists).
 */
export function getCueLineIndex(
  lines: Array<{ speaker: string }>,
  fromIndex: number,
  userCharacter: string,
): number | null {
  const nextUserIdx = lines.findIndex(
    (l, i) => i > fromIndex && l.speaker === userCharacter,
  );
  if (nextUserIdx === -1) return null; // no more user lines
  if (nextUserIdx === 0) return null; // user line is first; no cue before it
  return nextUserIdx - 1;
}
