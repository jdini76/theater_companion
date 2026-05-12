import { DialogueLine } from "@/types/rehearsal";

const DEBUG_PARSE_LOGS = process.env.NODE_ENV !== "production";

function debugParseLog(
  path: string,
  details: Record<string, unknown> = {},
): void {
  if (!DEBUG_PARSE_LOGS) return;
  console.log("[parseDialogueLines]", path, details);
}

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
  /^(?:#\s*\d+\s*[-\u2013\u2014]\s*\S|ACT\s+(?:ONE|TWO|THREE|I{1,3}V?|\d+)\b|(?:SCENE|scene)\s*\d+[a-z]?\b|(?:Prologue|Epilogue|Interlude)\s*:|(?:(?:INT|EXT)(?:\.?\/EXT)?|I\/E)\.)/i;

/**
 * Scene-end and production-end markers (AACT / standard play format).
 * These appear on their own line to signal the end of a scene or the play
 * and should be treated as stage directions, not character names.
 *
 * Examples:
 *   CURTAIN   BLACKOUT   LIGHTS OUT   FADE OUT   FADE TO BLACK
 *   INTERMISSION   THE END   END OF PLAY   END OF ACT I   END.
 */
const SCENE_END_MARKER_RE =
  /^(?:CURTAIN|BLACKOUT|LIGHTS?\s+OUT|FADE\s*(?:OUT|TO\s+(?:BLACK|DARK))|FADEOUT|INTERMISSION|(?:THE\s+)?END(?:\s+OF\s+(?:ACT|PLAY|SCENE)(?:\s+[IVX\d]+)?|\.)?|BLACKOUT\s+AND\s+END(?:\s+OF\s+(?:ACT|PLAY))?)\s*$/i;

/**
 * Non-parenthetical scene-setting headers found in published play scripts.
 * These appear at the left margin and introduce a scene's location/time.
 *
 * Examples:
 *   SETTING: A kitchen in Brooklyn, 1977.
 *   AT RISE: JOHN is seated at the table reading a newspaper.
 *   AT CURTAIN: The stage is empty.
 *   TIME: The present.
 *   PLACE: A small town in Pennsylvania.
 */
const PROSE_STAGE_DIR_RE =
  /^(?:SETTING|AT\s+RISE|AT\s+CURTAIN|TIME|PLACE)\s*:/i;

/**
 * Screenplay transition lines — appear alone before a slug line.
 *
 * Examples:
 *   CUT TO:   DISSOLVE TO:   SMASH CUT TO:   MATCH CUT TO:
 *   FADE IN:  WIPE TO:       IRIS IN:        IRIS OUT:
 */
const SCREENPLAY_TRANSITION_RE =
  /^(?:CUT\s+TO|DISSOLVE\s+TO|SMASH\s+CUT(?:\s+TO)?|MATCH\s+CUT(?:\s+TO)?|FADE\s+IN|WIPE\s+TO|IRIS\s+(?:IN|OUT))\s*:?\s*$/i;

/**
 * Classical theatrical movement directions (not enclosed in parentheses).
 * These are the full line (or open a line) in standard play format.
 *
 * Examples:
 *   Enter JOHN from stage right.
 *   Exit MARY, weeping.
 *   Exeunt all but HAMLET.
 */
const STAGE_ENTRY_EXIT_RE = /^(?:Enter|Exit|Exeunt)\b/i;

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
 * Stage direction patterns that OPEN a song block.
 * Only tested against lines already confirmed as standalone stage directions
 * (wrapped in ( ) or [ ]), so they won't collide with dialogue.
 *
 * Captures an optional song title after a colon:
 *   Group 1 – title from the `(...)` form
 *   Group 2 – title from the `[...]` form
 *
 * Examples matched:
 *   (Singing)  (Sung)  (Sings)  (Song)
 *   (Song: "Tomorrow")  (Song begins)  (Song begins: "Title")
 *   (Music begins)  (Music up)  (Music starts)
 *   (Underscore)  (Underscore: "Title")
 *   (Number: "My Favorite Things")  (Musical number)
 *   (Reprise: "Tomorrow")
 *   [SONG]  [Song: Tomorrow]  [Music]  [Singing]
 */
const SONG_CUE_START_RE =
  /^\((?:sing(?:s|ing)?|sung|song(?:\s+begins?)?|music\s+(?:begins?|starts?|up)|underscore|(?:musical\s+)?number|reprise)(?:\s*:\s*["']?([^"')]+?)["']?)?\)$|^\[(?:song|singing|sung|music|underscore)(?:\s*:\s*([^\]]+))?\]$/i;

/**
 * Stage direction patterns that CLOSE a song block and return to speech.
 *
 * Examples matched:
 *   (Spoken)  (Spoke)  (Speaking)  (Dialogue resumes)
 *   (End of song)  (Song ends)  (Music ends)  (Music out)  (Music stops)
 *   [Spoken]  [End of song]  [Music out]
 */
const SONG_CUE_END_RE =
  /^\((?:spoke(?:n)?|speaking|dialogue\s+resumes?|end\s+of\s+song|song\s+ends?|music\s+(?:ends?|out|stops?))\)$|^\[(?:spoke(?:n)?|end\s+of\s+song|music\s+(?:ends?|out))\]$/i;

/**
 * Modern-format song cues found in published librettos (e.g. Applause-style).
 * These use a pronoun before the verb or a fuller phrasing, and may include
 * a trailing period — patterns not covered by SONG_CUE_START_RE:
 *
 *   (She sings.)   (He sings)   (They sing.)   (We sing.)
 *   (sings the following)   (She sings the following)
 *   (singing the following)   (She sings along)
 */
const MODERN_SONG_CUE_RE =
  /^\((?:(?:she|he|they|we|i|all)\s+)?sing(?:s|ing)?(?:\s+(?:the\s+following|along|and\s+danc(?:es?|ing)))?\s*\.?\)$/i;

/**
 * Matches a line that is entirely uppercase — used by the post-parse pass
 * to identify song lyric lines that were not caught by active state.
 * Allows letters, digits, whitespace, and common lyric punctuation.
 */
const ALL_CAPS_LYRIC_RE = /^[A-Z0-9\s\-',.!?;:()\[\]…*]+$/;

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
 * Fountain character cue: optional leading @ and optional trailing ^ for
 * dual dialogue.
 */
const FOUNTAIN_CHAR_RE = /^@?([A-Z][A-Z0-9\s\-'.&,+]+?)(?:\^)?\s*$/;

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
  "FX",
  "SFZ",
  "SPX",
  "VFX",
  "SOUND",
  "NOTE",
  "NOTES",
  "INT",
  "EXT",
  "CUT",
  "ANGLE",
  "CAMERA",
  "DOLLY",
  "INSERT",
  "MONTAGE",
  "SONG",
  "MUSIC",
  "PAN",
  "PUSH",
  "SHOT",
  "SUPER",
  "TITLE",
  "TRACK",
  "TRANSITION",
  "ZOOM",
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
  // AACT / standard play format: scene description headers and end markers
  // that can appear in ALL CAPS but are never character names
  "SETTING",
  "PLACE",
  "CURTAIN",
  "BLACKOUT",
  "FADEOUT",
  "INTERMISSION",
  // Front-matter / document structure headings (table of contents, cast page, etc.)
  // "SCENE X" is already caught by SCENE_HEADING_RE before reaching this check,
  // so adding SCENE here only blocks non-numbered variants like "SCENE LISTING".
  "TABLE", // TABLE OF CONTENTS
  "CHARACTERS", // CHARACTERS (cast list page header)
  "CAST", // CAST OF CHARACTERS, CAST LIST
  "SCENE", // SCENE LISTING (numbered scenes caught earlier by SCENE_HEADING_RE)
  "CONTENTS", // defensive: CONTENTS page
]);

// ── Inline parenthetical helpers ─────────────────────────────────────────────

/**
 * Regex matching an inline parenthetical or bracketed stage direction
 * embedded within dialogue text, e.g. "(whispering)" or "[exits]".
 */
const INLINE_PARENTHETICAL_RE = /(\([^)]*\)|\[[^\]]*\])/g;

function isLikelyInlineStageDirection(segment: string): boolean {
  const trimmed = segment.trim();
  if (!trimmed) return false;

  // Bracketed annotations are always treated as stage directions.
  if (trimmed.startsWith("[")) return true;
  if (!trimmed.startsWith("(") || !trimmed.endsWith(")")) return false;

  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return false;

  // Descriptive parentheticals such as ages or appositive notes should stay
  // inside the spoken line instead of being split out as stage directions.
  if (/^\d/.test(inner)) return false;

  // Cue-like parentheticals are usually lowercase performance notes or a
  // short stage cue phrase.
  if (/^[a-z]/.test(inner)) return true;
  if (
    /^(?:to\s+camera|off(?:\s+camera)?|on\s+camera|overlapping|aside|whispering|speaking|spoken|sings?|singing|sung|laughing|crying|shouting|pause|beat|continu(?:e|ed|ing)|music|song|song\s+ends?|music\s+(?:ends?|out|stops?))\b/i.test(
      inner,
    )
  ) {
    return true;
  }

  return false;
}

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
    const parenthetical = match[0];
    if (isLikelyInlineStageDirection(parenthetical)) {
      segments.push({ text: parenthetical, isParenthetical: true });
    } else {
      segments.push({ text: parenthetical, isParenthetical: false });
    }
    lastIndex = re.lastIndex;
  }

  const remaining = dialogue.slice(lastIndex).trim();
  if (remaining) {
    segments.push({ text: remaining, isParenthetical: false });
  }

  return segments;
}

function looksLikeNarrativeProseLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const actionProse = looksLikeActionProseLine(trimmed);

  // Narrative prose should not be forced through the dialogue continuation
  // path just because it appears after a speaker.
  if (!/[a-z]/.test(trimmed)) return false;
  if (
    !actionProse &&
    !/^['"“”]*(?:the|a|an|this|that|these|those|he|she|they|we|i|his|her|their|its|our|my)\b/i.test(
      trimmed,
    )
  ) {
    return false;
  }

  if (!/[.!?…]["')\]]*\s*$/.test(trimmed)) return false;

  // Prose lines usually read like descriptive sentences rather than speech.
  // Keep the heuristic broad enough to catch screenplay action paragraphs,
  // but narrow enough to avoid routine dialogue continuations.
  return (
    /,\s*[A-Z0-9(]/.test(trimmed) ||
    /\([^)]+\)/.test(trimmed) ||
    trimmed.split(/\s+/).length >= 8 ||
    actionProse
  );
}

function splitDialogueFromNarrativeProse(
  text: string,
): { dialogue: string; narrative: string } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const boundaryMatch = trimmed.match(
    /^(.*?[.!?…]["')\]]*)\s+(?=(?:the|a|an|this|that|these|those)\b)/i,
  );
  if (!boundaryMatch) return null;

  const dialogue = boundaryMatch[1].trim();
  const narrative = trimmed.slice(dialogue.length).trim();
  if (!dialogue || !narrative) return null;

  return { dialogue, narrative };
}

const ACTION_PROSE_VERBS =
  /\b(?:enters?|exits?|crosses|walks?|runs?|turns?|looks?|smiles?|nods?|sits?|stands?|moves?|returns?|follows?|joins?|passes|arrives?|leaves?|pulls|pushes|reaches|holds?|takes|grabs|opens?|closes?|drops?|raises|lowers?|picks|sets|starts?|stops?|watches|studies|checks|clutches|heads)\b/i;

const ACTION_PROSE_START_RE =
  /^(?:['"“”]*(?:the|a|an|this|that|these|those)\b|['"“”]*[A-Z][A-Za-z0-9'.&,+-]*(?:\s+[A-Z][A-Za-z0-9'.&,+-]*)*(?:\s|,))/;

function looksLikeActionProseLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (!/[a-z]/.test(trimmed)) return false;
  if (!ACTION_PROSE_START_RE.test(trimmed)) {
    return false;
  }

  return (
    ACTION_PROSE_VERBS.test(trimmed) ||
    /,\s*[A-Z0-9(]/.test(trimmed) ||
    trimmed.split(/\s+/).length >= 8
  );
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
    // scene headings, or song lyrics (songs preserve their own parentheticals
    // as vocal/performance directions, not inline stage directions).
    if (
      line.isStageDirection ||
      line.character === "[Narrative]" ||
      line.character === "[Scene Heading]" ||
      line.character === "[Song]" ||
      line.isSong
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
export type ScriptFormat =
  | "colon"
  | "standalone"
  | "screenplay"
  | "inline"
  | "mixed";

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

    // Fountain format: @CHARACTER or CHARACTER^ cue line followed by prose.
    const fountainMatch = FOUNTAIN_CHAR_RE.exec(t);
    if (fountainMatch) {
      const fountainName = fountainMatch[1].trim();
      if (isValidCharacterName(fountainName) && next && /[a-z]/.test(next)) {
        standaloneScore++;
      }
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

  // Reject single character names containing apostrophes — these are almost
  // always contraction fragments from lyrics (AIN'T, BETCHA', ROUND) rather
  // than real character names.  Multi-character labels (NORA & ELI) are
  // exempt since the joiner is checked separately.
  const hasJoiner = /[,&+]/.test(name);
  if (!hasJoiner && name.includes("'")) return false;
  const words = name.trim().split(/\s+/);
  if (!hasJoiner && words.length > 4) return false;

  // Reject known production-direction prefixes.
  // Exception: "THE" used as a definite article before a proper noun
  // ("THE NARRATOR", "THE GHOST") is a valid character-name pattern.
  // Let "THE <something>" fall through to the allCommon check below,
  // which will reject it only if all words are common English words.
  const firstWord = words[0].toUpperCase();
  if (
    NON_CHARACTER_WORDS.has(firstWord) &&
    !(firstWord === "THE" && words.length > 1)
  )
    return false;

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

// ── Song detection helpers ───────────────────────────────────────────────────

/**
 * Returns true when `name` (ALL CAPS) appears in the known cast set, either
 * as a full match or as a word within a multi-word name.
 *
 *   isKnownCharacter("HANNIGAN", {"MISS HANNIGAN"}) → true
 *   isKnownCharacter("PHIL", {"PHIL CONNORS"})      → true
 *   isKnownCharacter("CHORUS", {"MISS HANNIGAN"})   → false
 */
function isKnownCharacter(name: string, knownCharSet: Set<string>): boolean {
  const upper = name.toUpperCase();
  if (knownCharSet.has(upper)) return true;

  // Single-word partial match: "PHIL" → true when "PHIL CONNORS" is known
  for (const known of knownCharSet) {
    const parts = known.split(/\s+/);
    if (parts.length > 1 && parts.includes(upper)) return true;
  }

  // Multi-character label: "NORA & ELI", "NORA, ELI, AND MARA"
  // True when every individual name in the group is known.
  if (/[,&]/.test(upper)) {
    const parts = upper
      .split(/\s*[,&]\s*/)
      .map((p) => p.replace(/^\bAND\b\s*/i, "").trim())
      .filter((p) => p && !/^\bAND\b$/i.test(p));
    if (
      parts.length > 1 &&
      parts.every((p) => isKnownCharacter(p, knownCharSet))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Post-parse pass: find runs of 2+ consecutive [Narrative] lines whose text
 * is entirely uppercase (likely song lyrics that slipped past active detection)
 * and re-tag them as `[Song]` lines with `isSong: true`.
 *
 * A single isolated ALL-CAPS narrative line is NOT re-tagged to avoid
 * false-positives from things like scene headings that weren't caught.
 */
function tagConsecutiveLyrics(
  lines: DialogueLine[],
  enableSongParsing: boolean,
): DialogueLine[] {
  if (!enableSongParsing) return lines;

  const isCandidate = lines.map(
    (l) =>
      l.character === "[Narrative]" &&
      !l.isSong &&
      ALL_CAPS_LYRIC_RE.test(l.dialogue.trim()),
  );

  for (let i = 0; i < lines.length; ) {
    if (!isCandidate[i]) {
      i++;
      continue;
    }
    // Find end of this run
    let j = i;
    while (j < lines.length && isCandidate[j]) j++;
    if (j - i >= 2) {
      for (let k = i; k < j; k++) {
        lines[k] = { ...lines[k], character: "[Song]", isSong: true };
      }
    }
    i = j;
  }

  return lines;
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
  knownCharacters?: string[],
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

  // ── Song detection state ────────────────────────────────────────
  // True while inside a song block (set by cue markers, cast comparison,
  // or heuristic detection; cleared by end-of-song cues or scene headings).
  let inSongBlock = false;
  // Song title extracted from an explicit cue marker like (Song: "Tomorrow").
  let currentSongTitle: string | null = null;
  // Uppercased known cast for Approach C (cast-comparison) detection.
  const knownCharSet: Set<string> =
    knownCharacters && knownCharacters.length > 0
      ? new Set(knownCharacters.map((n) => n.toUpperCase()))
      : new Set();

  const fmt = formatHint ?? detectScriptFormat(sceneContent);
  const useColon = fmt === "colon" || fmt === "standalone" || fmt === "mixed";
  const useStandalone =
    fmt === "standalone" || fmt === "screenplay" || fmt === "mixed";
  const useInline = fmt === "inline" || fmt === "mixed";
  const enableSongParsing = fmt !== "screenplay";

  const allLines = sceneContent.split("\n");
  for (let i = 0; i < allLines.length; i++) {
    const trimmed = allLines[i].trim();
    const debugParse = (
      path: string,
      details: Record<string, unknown> = {},
    ): void => {
      debugParseLog(path, { lineIndex: i, lineNumber, trimmed, ...details });
    };

    // ── Blank line ──────────────────────────────────────────────────
    if (!trimmed) {
      // Always mark that we're at the start of a new paragraph. This is
      // needed so standalone character names can be detected after scene
      // headings (which reset lastCharacter to null).
      afterBlank = true;
      // Do NOT clear pendingStandaloneChar: a stage direction or blank can
      // separate a standalone name line from its dialogue in some scripts.
      debugParse("blank line");
      continue;
    }

    // ── TOC / dot-leader lines ───────────────────────────────────────
    // Lines like "Scene 1: The Locked Stage .............. 6" are table-of-
    // contents entries; they should never be treated as characters or dialogue.
    if (/\.{6,}\s*\d+\s*$/.test(trimmed)) {
      debugParse("table of contents / dot leader", { text: trimmed });
      output.push({
        lineNumber: lineNumber++,
        character: "[Narrative]",
        dialogue: trimmed,
      });
      lastDialogueIdx = -1;
      afterBlank = false;
      continue;
    }

    // ── Scene heading ───────────────────────────────────────────────
    if (SCENE_HEADING_RE.test(trimmed)) {
      debugParse("scene heading", { text: trimmed });
      output.push({
        lineNumber: lineNumber++,
        character: "[Scene Heading]",
        dialogue: trimmed,
        isStageDirection: true,
      });
      lastCharacter = null;
      lastDialogueIdx = -1;
      afterBlank = true;
      pendingStandaloneChar = null;
      // Scene headings always end any active song block.
      inSongBlock = false;
      currentSongTitle = null;
      continue;
    }

    // ── Scene-end / production-end marker (AACT format) ────────────
    // CURTAIN, BLACKOUT, FADE OUT, INTERMISSION, THE END, etc. appear on
    // their own line to close a scene. Emit as a stage direction rather
    // than accidentally treating them as character names.
    if (SCENE_END_MARKER_RE.test(trimmed)) {
      debugParse("scene end marker", { text: trimmed });
      output.push({
        lineNumber: lineNumber++,
        character: "[Stage Direction]",
        dialogue: trimmed,
        isStageDirection: true,
      });
      lastCharacter = null;
      lastDialogueIdx = -1;
      pendingStandaloneChar = null;
      afterBlank = false;
      inSongBlock = false;
      currentSongTitle = null;
      continue;
    }

    // ── Non-parenthetical play / screenplay stage direction ─────────
    // SETTING:, AT RISE:, TIME:, PLACE:  — scene-setting front-matter
    // CUT TO:, DISSOLVE TO:, FADE IN:    — screenplay transitions
    // Enter / Exit / Exeunt              — classical theatrical movement
    if (
      PROSE_STAGE_DIR_RE.test(trimmed) ||
      SCREENPLAY_TRANSITION_RE.test(trimmed) ||
      /^>\s*\S/.test(trimmed) ||
      STAGE_ENTRY_EXIT_RE.test(trimmed)
    ) {
      debugParse("stage direction", { text: trimmed });
      output.push({
        lineNumber: lineNumber++,
        character: "[Stage Direction]",
        dialogue: trimmed,
        isStageDirection: true,
      });
      // These directions don't change speaker context or song state —
      // a playwright may write "Enter JOHN." between two of MARY's lines.
      afterBlank = false;
      continue;
    }

    // ── Standalone stage direction ──────────────────────────────────
    if (STANDALONE_STAGE_DIR_RE.test(trimmed)) {
      debugParse("standalone stage direction", { text: trimmed });
      output.push({
        lineNumber: lineNumber++,
        character: "[Stage Direction]",
        dialogue: trimmed,
        isStageDirection: true,
      });

      // ── Approach A: song cue detection ──────────────────────────
      // Check whether this stage direction opens or closes a song block.
      const songStartMatch = SONG_CUE_START_RE.exec(trimmed);
      if (enableSongParsing && songStartMatch) {
        inSongBlock = true;
        currentSongTitle =
          (songStartMatch[1] ?? songStartMatch[2] ?? "").trim() || null;
      } else if (enableSongParsing && MODERN_SONG_CUE_RE.test(trimmed)) {
        // Modern-format cue: (She sings.)  (He sings)  (They sing.)  etc.
        inSongBlock = true;
      } else if (enableSongParsing && SONG_CUE_END_RE.test(trimmed)) {
        inSongBlock = false;
        currentSongTitle = null;
      }

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
    // Only active in colon/mixed modes; Film forces standalone parsing.
    if (useColon) {
      const charMatch = CHAR_LINE_RE.exec(trimmed);
      if (charMatch) {
        const character = charMatch[1].trim();
        const dialogue = charMatch[2].trim();

        if (isValidCharacterName(character)) {
          debugParse("colon character line", {
            character,
            dialogue,
            inSongBlock,
          });
          pendingStandaloneChar = null;
          // When the character starts speaking with lowercase dialogue, exit song mode.
          if (
            enableSongParsing &&
            inSongBlock &&
            dialogue &&
            /[a-z]/.test(dialogue)
          ) {
            inSongBlock = false;
            currentSongTitle = null;
          }
          if (dialogue) {
            const idx = output.length;
            const entry: DialogueLine = {
              lineNumber: lineNumber++,
              character,
              dialogue,
            };
            if (enableSongParsing && inSongBlock) {
              entry.isSong = true;
              if (currentSongTitle) entry.songTitle = currentSongTitle;
            }
            output.push(entry);
            lastCharacter = character;
            lastDialogueIdx = idx;
          } else {
            // Song/verse mode: CHARACTER: with no inline text.
            // The empty cue header signals that lyrics follow.
            lastCharacter = character;
            lastDialogueIdx = -1;
            if (enableSongParsing) inSongBlock = true;
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
          debugParse("colon all-caps continuation", {
            lastCharacter,
            inSongBlock,
          });
          if (lastDialogueIdx >= 0) {
            // Append to existing entry (hard-wrapped continuation)
            if (!afterBlank) {
              output[lastDialogueIdx].dialogue += " " + trimmed;
              if (inSongBlock) output[lastDialogueIdx].isSong = true;
            } else {
              const idx = output.length;
              const entry: DialogueLine = {
                lineNumber: lineNumber++,
                character: lastCharacter,
                dialogue: trimmed,
              };
              if (inSongBlock) {
                entry.isSong = true;
                if (currentSongTitle) entry.songTitle = currentSongTitle;
              }
              output.push(entry);
              lastDialogueIdx = idx;
            }
          } else {
            // Song mode: first lyric line
            const idx = output.length;
            const entry: DialogueLine = {
              lineNumber: lineNumber++,
              character: lastCharacter,
              dialogue: trimmed,
            };
            if (inSongBlock) {
              entry.isSong = true;
              if (currentSongTitle) entry.songTitle = currentSongTitle;
            }
            output.push(entry);
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
        debugParse("colon fallback narrative", { text: trimmed });
        lastCharacter = null;
        lastDialogueIdx = -1;
        pendingStandaloneChar = null;
        afterBlank = false;
        continue;
      }
    }

    // ── Modern format: indented ALL-CAPS lyrics ──────────────────────
    // In modern musical librettos (e.g. Applause-style), song lyrics are
    // indented with ≥ 4 leading spaces while character names and dialogue
    // sit at the left margin. When we are already in a song block, any such
    // indented all-caps line is treated as a lyric line — not a new speaker.
    if (inSongBlock) {
      const leadingSpaces = allLines[i].length - allLines[i].trimStart().length;
      if (leadingSpaces >= 4 && ALL_CAPS_LYRIC_RE.test(trimmed)) {
        debugParse("indented all-caps lyric", { leadingSpaces });
        const idx = output.length;
        const entry: DialogueLine = {
          lineNumber: lineNumber++,
          character: lastCharacter ?? "[Song]",
          dialogue: trimmed,
          isSong: true,
        };
        if (currentSongTitle) entry.songTitle = currentSongTitle;
        output.push(entry);
        lastDialogueIdx = idx;
        afterBlank = false;
        continue;
      }
    }

    // ── Standalone character name (screenplay / CMIYC format) ───────
    // Accept when `afterBlank` is true OR when we just saw prose dialogue
    // (lastDialogueIdx >= 0) and the next non-empty line contains lowercase
    // (confirming this ALL-CAPS line is a speaker label, not a song lyric).
    // The lastDialogueIdx >= 0 guard prevents mid-song lyric lines from
    // being mistaken for character names after a bare "CHARACTER:" header.
    if (useStandalone) {
      const sm = STANDALONE_CHAR_NAME_RE.exec(trimmed);
      const fountainMatch = FOUNTAIN_CHAR_RE.exec(trimmed);
      const fountainName = fountainMatch ? fountainMatch[1].trim() : null;
      if (
        (sm && isValidCharacterName(sm[1].trim())) ||
        (fountainName && isValidCharacterName(fountainName))
      ) {
        const nameCandidate = sm ? sm[1].trim() : fountainName!;
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

        if (
          !acceptAsCharacter &&
          lastCharacter === null &&
          lastDialogueIdx === -1 &&
          fmt === "screenplay"
        ) {
          // Screenplay action lines often introduce the next speaker without a
          // blank line. If the next meaningful line starts with lowercase, treat
          // this all-caps line as the cue.
          for (let j = i + 1; j < allLines.length; j++) {
            const peek = allLines[j].trim();
            if (!peek || STANDALONE_STAGE_DIR_RE.test(peek)) continue;
            acceptAsCharacter = /[a-z]/.test(peek);
            break;
          }
        }

        // ── Approach C: cast-aware lyric detection ──────────────────
        // If we have a known cast list and this name isn't in it, the line
        // is almost certainly a song lyric (e.g. "TOMORROW, TOMORROW…")
        // rather than a new speaker label. Enter song mode.
        if (
          acceptAsCharacter &&
          knownCharSet.size > 0 &&
          !isKnownCharacter(nameCandidate, knownCharSet)
        ) {
          debugParse("standalone candidate treated as song", {
            nameCandidate,
          });
          inSongBlock = true;
          const idx = output.length;
          const entry: DialogueLine = {
            lineNumber: lineNumber++,
            character: "[Song]",
            dialogue: trimmed,
            isSong: true,
          };
          if (currentSongTitle) entry.songTitle = currentSongTitle;
          output.push(entry);
          lastDialogueIdx = idx;
          lastCharacter = null;
          afterBlank = false;
          continue;
        }

        if (acceptAsCharacter) {
          debugParse("standalone character accepted", {
            nameCandidate,
            trailingNote: sm?.[2]?.trim() ?? null,
          });
          pendingStandaloneChar = nameCandidate;
          // Emit trailing parenthetical as stage direction:
          //   DOLLAR (overlapping) → stage direction "(overlapping)"
          const trailingNote = sm?.[2]?.trim();
          if (
            trailingNote &&
            !/^\(\s*(?:v\.o\.|o\.s\.|o\.c\.|off(?:\s+camera)?|on\s+camera|cont['’]?d|continued)\s*\)$/i.test(
              trailingNote,
            )
          ) {
            output.push({
              lineNumber: lineNumber++,
              character: "[Stage Direction]",
              dialogue: trailingNote,
              isStageDirection: true,
            });
          }
          // Entering character speech: exit song mode if active.
          inSongBlock = false;
          currentSongTitle = null;
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
        debugParse("inline character + dialogue", {
          character: im[1].trim(),
        });
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
      debugParse("pending standalone character consumed", {
        pendingStandaloneChar,
      });

      lastCharacter = pendingStandaloneChar;
      pendingStandaloneChar = null;

      const mixedProseSplit = splitDialogueFromNarrativeProse(trimmed);
      if (mixedProseSplit) {
        const dialogueIdx = output.length;
        output.push({
          lineNumber: lineNumber++,
          character: lastCharacter,
          dialogue: mixedProseSplit.dialogue,
        });
        output.push({
          lineNumber: lineNumber++,
          character: "[Narrative]",
          dialogue: mixedProseSplit.narrative,
        });
        lastDialogueIdx = dialogueIdx;
        lastCharacter = null;
        afterBlank = false;
        continue;
      }

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
      const mixedProseSplit = splitDialogueFromNarrativeProse(trimmed);
      if (mixedProseSplit) {
        debugParse("mixed prose split", {
          currentCharacter: lastCharacter,
          dialogue: mixedProseSplit.dialogue,
          narrative: mixedProseSplit.narrative,
        });
        if (lastDialogueIdx >= 0) {
          output[lastDialogueIdx].dialogue += " " + mixedProseSplit.dialogue;
        } else {
          const idx = output.length;
          const entry: DialogueLine = {
            lineNumber: lineNumber++,
            character: lastCharacter,
            dialogue: mixedProseSplit.dialogue,
          };
          if (enableSongParsing && inSongBlock) {
            entry.isSong = true;
            if (currentSongTitle) entry.songTitle = currentSongTitle;
          }
          output.push(entry);
          lastDialogueIdx = idx;
        }
        output.push({
          lineNumber: lineNumber++,
          character: "[Narrative]",
          dialogue: mixedProseSplit.narrative,
        });
        lastCharacter = null;
        lastDialogueIdx = -1;
        pendingStandaloneChar = null;
        afterBlank = false;
        continue;
      }

      if (looksLikeNarrativeProseLine(trimmed)) {
        debugParse("narrative prose override", {
          currentCharacter: lastCharacter,
          text: trimmed,
        });
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

      let standaloneCharLooksLikeSpeaker = false;
      if (useStandalone) {
        const previewMatch = STANDALONE_CHAR_NAME_RE.exec(trimmed);
        if (previewMatch && isValidCharacterName(previewMatch[1].trim())) {
          standaloneCharLooksLikeSpeaker = afterBlank;
          if (!standaloneCharLooksLikeSpeaker && lastDialogueIdx >= 0) {
            // Look ahead to see whether this ALL-CAPS line is likely a
            // speaker label. If the next meaningful line starts lowercase,
            // treat the current line as a speaker; otherwise let it continue
            // as lyric/dialogue text.
            for (let j = i + 1; j < allLines.length; j++) {
              const peek = allLines[j].trim();
              if (!peek || STANDALONE_STAGE_DIR_RE.test(peek)) continue;
              standaloneCharLooksLikeSpeaker = /[a-z]/.test(peek);
              break;
            }
          }
        }
      }

      if (
        !standaloneCharLooksLikeSpeaker &&
        !afterBlank &&
        lastDialogueIdx >= 0
      ) {
        // Hard-wrapped continuation: append so TTS reads as one speech.
        debugParse("hard-wrapped continuation", {
          currentCharacter: lastCharacter,
          text: trimmed,
        });
        output[lastDialogueIdx].dialogue += " " + trimmed;
        if (enableSongParsing && inSongBlock)
          output[lastDialogueIdx].isSong = true;
      } else if (
        !standaloneCharLooksLikeSpeaker &&
        (fmt === "screenplay" || fmt === "mixed") &&
        afterBlank
      ) {
        // In screenplay/mixed mode, a blank line is a boundary. Treat the next
        // line as scene description unless it is an explicit speaker cue.
        debugParse("blank-separated screenplay narrative", {
          currentCharacter: lastCharacter,
          text: trimmed,
        });
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
      } else if (!standaloneCharLooksLikeSpeaker) {
        // Verse break (blank-separated) or first lyric after CHARACTER:
        debugParse("new continuation line", {
          currentCharacter: lastCharacter,
          inSongBlock,
          text: trimmed,
        });
        const idx = output.length;
        const entry: DialogueLine = {
          lineNumber: lineNumber++,
          character: lastCharacter,
          dialogue: trimmed,
        };
        if (enableSongParsing && inSongBlock) {
          entry.isSong = true;
          if (currentSongTitle) entry.songTitle = currentSongTitle;
        }
        output.push(entry);
        lastDialogueIdx = idx;
      }
      afterBlank = false;
      continue;
    }

    // ── Narrative / unclassified ────────────────────────────────────
    // When inside a song block, tag as [Song] instead of [Narrative].
    {
      debugParse("narrative fallback", { text: trimmed, inSongBlock });
      const entry: DialogueLine = {
        lineNumber: lineNumber++,
        character: inSongBlock ? "[Song]" : "[Narrative]",
        dialogue: trimmed,
      };
      if (enableSongParsing && inSongBlock) {
        entry.isSong = true;
        if (currentSongTitle) entry.songTitle = currentSongTitle;
      }
      output.push(entry);
    }
    lastDialogueIdx = -1;
    afterBlank = false;
  }

  // Approach B: tag any remaining runs of 2+ consecutive ALL-CAPS [Narrative]
  // lines that weren't caught by active state (no cues, no cast list).
  tagConsecutiveLyrics(output, enableSongParsing);

  return expandInlineParentheticals(output);
}

/**
 * Extract unique character names from dialogue lines
 */
export function extractCharacterNames(lines: DialogueLine[]): string[] {
  const characters = new Set<string>();

  for (const line of lines) {
    if (!line.isStageDirection && !line.character.startsWith("[")) {
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
 * Return only the non-song lines from a parsed dialogue array.
 * Use this to strip song lyrics from a line list before passing it to the
 * rehearsal engine or TTS — songs are handled by a separate tab.
 */
export function filterSongLines(lines: DialogueLine[]): DialogueLine[] {
  return lines.filter((l) => !l.isSong);
}

/**
 * Get lines for a user to practice (all non-user character lines, excluding songs)
 */
export function getNonUserLines(
  lines: DialogueLine[],
  userCharacterName: string,
): DialogueLine[] {
  return lines.filter(
    (line) =>
      line.character !== userCharacterName &&
      line.character !== "[Narrative]" &&
      !line.isStageDirection &&
      !line.isSong,
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
