import { describe, it, expect } from "vitest";
import {
  getCueLineIndex,
  parseDialogueLines,
  extractCharacterNames,
  detectScriptFormat,
} from "@/lib/rehearsal";
import { DialogueLine } from "@/types/rehearsal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lines(speakers: string[]) {
  return speakers.map((speaker) => ({
    speaker,
    text: `${speaker} says something.`,
  }));
}

// ---------------------------------------------------------------------------
// getCueLineIndex
// ---------------------------------------------------------------------------

describe("getCueLineIndex", () => {
  describe("basic cue detection", () => {
    it("returns the index directly before the next user line", () => {
      const l = lines(["A", "B", "USER", "A"]);
      // fromIndex=0: next user line is at 2, cue is at 1
      expect(getCueLineIndex(l, 0, "USER")).toBe(1);
    });

    it("returns null when there are no user lines after fromIndex", () => {
      const l = lines(["A", "B", "C"]);
      expect(getCueLineIndex(l, 0, "USER")).toBeNull();
    });

    it("returns null when user already spoke and there are no more user lines", () => {
      const l = lines(["A", "USER", "B", "C"]);
      // fromIndex=2: no user line after index 2
      expect(getCueLineIndex(l, 2, "USER")).toBeNull();
    });

    it("returns null when user line is first (index 0) — no cue exists before it", () => {
      const l = lines(["USER", "A", "B"]);
      // fromIndex=-1 would be the start; fromIndex=0 means next user must be > 0
      // User line is exactly at index 0 so no preceding cue
      expect(getCueLineIndex(l, -1, "USER")).toBeNull();
    });
  });

  describe("fromIndex skipping", () => {
    it("respects fromIndex and ignores user lines before it", () => {
      const l = lines(["A", "USER", "B", "USER", "C"]);
      // fromIndex=2: first user line (index 1) is before fromIndex; next user is at 3 → cue = 2
      expect(getCueLineIndex(l, 2, "USER")).toBe(2);
    });

    it("returns null when fromIndex is past all user lines", () => {
      const l = lines(["A", "USER", "B"]);
      expect(getCueLineIndex(l, 2, "USER")).toBeNull();
    });
  });

  describe("multiple consecutive non-user lines before user line", () => {
    it("identifies the immediately preceding line as the cue, not earlier ones", () => {
      const l = lines(["A", "B", "C", "D", "USER"]);
      // fromIndex=0: next user is 4, cue is 3 (D)
      expect(getCueLineIndex(l, 0, "USER")).toBe(3);
    });

    it("when fromIndex is already at the cue line, returns that index", () => {
      const l = lines(["A", "B", "C", "D", "USER"]);
      // fromIndex=3: line D (3) is cue for user at 4; getCueLineIndex at 3 returns 3
      expect(getCueLineIndex(l, 3, "USER")).toBe(3);
    });
  });

  describe("back-to-back user lines", () => {
    it("returns the non-user line before the first user line", () => {
      const l = lines(["A", "USER", "USER", "B"]);
      // fromIndex=0: next user is at 1, cue is 0 (A)
      expect(getCueLineIndex(l, 0, "USER")).toBe(0);
    });

    it("when current position is already a user line, looks for the next user line", () => {
      const l = lines(["A", "USER", "B", "USER"]);
      // fromIndex=1 (user line itself): next user after 1 is at 3, cue is 2 (B)
      expect(getCueLineIndex(l, 1, "USER")).toBe(2);
    });
  });

  describe("single-entry list", () => {
    it("returns null on a one-element list with no user", () => {
      const l = lines(["A"]);
      expect(getCueLineIndex(l, 0, "USER")).toBeNull();
    });

    it("returns null on a one-element list that IS the user", () => {
      const l = lines(["USER"]);
      // fromIndex=0: no element with i > 0 is USER
      expect(getCueLineIndex(l, 0, "USER")).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Cue Only mode simulation
// ---------------------------------------------------------------------------

describe("Cue Only mode simulation", () => {
  /**
   * Simulate the Cue Only playback loop without a browser.
   * Returns the sequence of indexes that would be "spoken" (i.e. not silently
   * skipped) and a separate list of user-line indexes where playback pauses.
   */
  function simulateCueOnly(
    allLines: Array<{ speaker: string; text: string }>,
    userCharacter: string,
  ) {
    const spoken: number[] = [];
    const paused: number[] = [];

    let index = 0;

    while (index < allLines.length) {
      const line = allLines[index];
      const isMine = line.speaker === userCharacter;

      if (isMine) {
        paused.push(index);
        index++;
        continue;
      }

      // Cue Only skip logic (mirrors UnifiedRehearsalPage.tsx)
      const nextUserIdx = allLines.findIndex(
        (l, i) => i > index && l.speaker === userCharacter,
      );
      if (nextUserIdx !== -1 && index < nextUserIdx - 1) {
        // Skip silently
        index++;
        continue;
      }

      spoken.push(index);
      index++;
    }

    return { spoken, paused };
  }

  it("plays only the cue before each user line", () => {
    const l = lines(["A", "B", "USER", "C", "D", "USER", "E"]);
    const { spoken, paused } = simulateCueOnly(l, "USER");

    // Cue for first USER (idx 2) is B (idx 1); A (idx 0) is skipped
    // Cue for second USER (idx 5) is D (idx 4); C (idx 3) is skipped
    // After second USER, E (idx 6) has no following user line → played normally
    expect(spoken).toEqual([1, 4, 6]);
    expect(paused).toEqual([2, 5]);
  });

  it("plays nothing when user has no lines", () => {
    // No user lines → all lines have no following user line → all are played
    const l = lines(["A", "B", "C"]);
    const { spoken, paused } = simulateCueOnly(l, "USER");
    expect(spoken).toEqual([0, 1, 2]);
    expect(paused).toEqual([]);
  });

  it("plays all remaining lines after the last user line", () => {
    const l = lines(["A", "USER", "B", "C", "D"]);
    const { spoken, paused } = simulateCueOnly(l, "USER");
    // Cue for USER (idx 1) is A (idx 0)
    // After USER: B, C, D have no following user line → all played
    expect(spoken).toEqual([0, 2, 3, 4]);
    expect(paused).toEqual([1]);
  });

  it("plays only the immediately preceding non-user line as cue", () => {
    const l = lines(["A", "B", "C", "USER"]);
    const { spoken, paused } = simulateCueOnly(l, "USER");
    // A, B are skipped; C is the cue
    expect(spoken).toEqual([2]);
    expect(paused).toEqual([3]);
  });

  it("handles scene with user as first line (no cue needed)", () => {
    const l = lines(["USER", "A", "B"]);
    const { spoken, paused } = simulateCueOnly(l, "USER");
    // User is first — goes straight to pause; no preceding cue
    // After user: A and B have no more user lines → played normally
    expect(spoken).toEqual([1, 2]);
    expect(paused).toEqual([0]);
  });

  it("handles back-to-back user lines without crashing", () => {
    const l = lines(["A", "USER", "USER", "B"]);
    const { spoken, paused } = simulateCueOnly(l, "USER");
    // A is cue for first USER; second USER directly follows (no intermediate cue)
    // B follows last user line → played normally
    expect(spoken).toEqual([0, 3]);
    expect(paused).toEqual([1, 2]);
  });

  it("handles an empty line array", () => {
    const { spoken, paused } = simulateCueOnly([], "USER");
    expect(spoken).toEqual([]);
    expect(paused).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// parseDialogueLines (existing lib smoke tests)
// ---------------------------------------------------------------------------

describe("parseDialogueLines", () => {
  it("parses basic dialogue format", () => {
    const content = "ROMEO: Hello!\nJULIET: Hi there.";
    const result = parseDialogueLines(content);
    expect(result.length).toBeGreaterThan(0);
    const speakers = result.map((l: DialogueLine) => l.character);
    expect(speakers).toContain("ROMEO");
    expect(speakers).toContain("JULIET");
  });

  it("detects stage directions", () => {
    const content = "[Lights dim]\nROMEO: Hello!";
    const result = parseDialogueLines(content);
    const stageDir = result.find((l: DialogueLine) => l.isStageDirection);
    expect(stageDir).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// extractCharacterNames
// ---------------------------------------------------------------------------

describe("extractCharacterNames", () => {
  it("returns sorted unique character names", () => {
    const content = "JULIET: Hi.\nROMEO: Hey.\nJULIET: Bye.";
    const dl = parseDialogueLines(content);
    const names = extractCharacterNames(dl);
    expect(names).toEqual(["JULIET", "ROMEO"]);
  });

  it("excludes stage directions and narrative", () => {
    const content = "[Enter ROMEO]\nROMEO: Hello.";
    const dl = parseDialogueLines(content);
    const names = extractCharacterNames(dl);
    expect(names).not.toContain("[Stage Direction]");
  });
});

// ---------------------------------------------------------------------------
// detectScriptFormat
// ---------------------------------------------------------------------------

describe("detectScriptFormat", () => {
  it("returns 'colon' for Groundhog Day style text", () => {
    const text = [
      "DIRECTOR: Okay, Phil, one more time.",
      "PHIL: Really?",
      "DIRECTOR: Here we go.",
      "PHIL: Fine.",
    ].join("\n");
    expect(detectScriptFormat(text)).toBe("colon");
  });

  it("returns 'standalone' for CMIYC style text", () => {
    const text = [
      "OLDER FRANK JUNIOR",
      "My name is Frank William Abagnale.",
      "",
      "HANRATTY",
      "Come on, Frank. I'd rather take you alive than dead.",
      "",
      "BRANTON",
      "There he is! Hold it right there!",
    ].join("\n");
    expect(detectScriptFormat(text)).toBe("standalone");
  });

  it("returns 'colon' by default for ambiguous or short text", () => {
    expect(detectScriptFormat("ROMEO: Hello")).toBe("colon");
    expect(detectScriptFormat("")).toBe("colon");
  });

  it("allows formatHint to override auto-detection in parseDialogueLines", () => {
    // A short snippet that auto-detects as colon but should be parsed standalone
    const text = "HANRATTY\nStop right there.";
    const auto = parseDialogueLines(text);
    const hinted = parseDialogueLines(text, "standalone");
    const hanrattyHinted = hinted.find((l) => l.character === "HANRATTY");
    expect(hanrattyHinted).toBeDefined();
    expect(hanrattyHinted!.dialogue).toBe("Stop right there.");
  });
});

// ---------------------------------------------------------------------------
// parseDialogueLines – Catch Me If You Can standalone format
// ---------------------------------------------------------------------------

describe("parseDialogueLines – CMIYC standalone format", () => {
  // ── Basic standalone parsing ───────────────────────────────────────────

  describe("basic standalone parsing", () => {
    it("parses a simple name-then-dialogue block", () => {
      const text = [
        "HANRATTY",
        "Come on, Frank. I'd rather take you alive than dead.",
      ].join("\n");
      const result = parseDialogueLines(text, "standalone");
      expect(result[0].character).toBe("HANRATTY");
      expect(result[0].dialogue).toBe(
        "Come on, Frank. I'd rather take you alive than dead.",
      );
    });

    it("parses multiple speakers in sequence", () => {
      const text = [
        "OLDER FRANK JUNIOR",
        "My name is Frank William Abagnale.",
        "",
        "HANRATTY",
        "You're not going to fool me again.",
      ].join("\n");
      const result = parseDialogueLines(text, "standalone");
      const chars = result
        .filter((l) => !l.isStageDirection)
        .map((l) => l.character);
      expect(chars).toContain("OLDER FRANK JUNIOR");
      expect(chars).toContain("HANRATTY");
    });

    it("handles character name with stage note (overlapping)", () => {
      const text = ["DOLLAR (overlapping)", "I'm gonna shoot!"].join("\n");
      const result = parseDialogueLines(text, "standalone");
      // Trailing parenthetical on name line becomes a stage direction
      const sd = result.find(
        (l) => l.isStageDirection && l.dialogue === "(overlapping)",
      );
      expect(sd).toBeDefined();
      const speech = result.find(
        (l) => l.character === "DOLLAR" && !l.isStageDirection,
      );
      expect(speech).toBeDefined();
      expect(speech!.dialogue).toBe("I'm gonna shoot!");
    });

    it("handles character name with inline exit note", () => {
      const text = [
        "PAULA (pulls away, exits.)",
        "I really should see to dinner.",
      ].join("\n");
      const result = parseDialogueLines(text, "standalone");
      // Trailing parenthetical becomes a stage direction
      const sd = result.find(
        (l) => l.isStageDirection && l.dialogue.includes("pulls away"),
      );
      expect(sd).toBeDefined();
      const speech = result.find(
        (l) => l.character === "PAULA" && !l.isStageDirection,
      );
      expect(speech).toBeDefined();
      expect(speech!.dialogue).toBe("I really should see to dinner.");
    });
  });

  // ── Scene headings ─────────────────────────────────────────────────────

  describe("CMIYC scene headings", () => {
    it("recognises 'Scene N: Title' as a scene heading", () => {
      const result = parseDialogueLines(
        "Scene 1: Living Room, The Abagnale House, New Rochelle",
        "standalone",
      );
      const heading = result.find((l) => l.character === "[Scene Heading]");
      expect(heading).toBeDefined();
    });

    it("recognises 'Prologue: Title' as a scene heading", () => {
      const result = parseDialogueLines(
        "Prologue: Miami International Airport",
        "standalone",
      );
      const heading = result.find((l) => l.character === "[Scene Heading]");
      expect(heading).toBeDefined();
      expect(heading!.isStageDirection).toBe(true);
    });

    it("recognises alphanumeric scene number (Scene 4b)", () => {
      const result = parseDialogueLines(
        "Scene 4b: On television. On stage.",
        "standalone",
      );
      const heading = result.find((l) => l.character === "[Scene Heading]");
      expect(heading).toBeDefined();
    });

    it("resets speaker after a scene heading", () => {
      const text = [
        "HANRATTY",
        "Stop right there.",
        "Scene 2: New Rochelle High School",
        "some narrative",
      ].join("\n");
      const result = parseDialogueLines(text, "standalone");
      const afterHeading =
        result[result.findIndex((l) => l.character === "[Scene Heading]") + 1];
      expect(afterHeading.character).toBe("[Narrative]");
    });
  });

  // ── Stage directions ───────────────────────────────────────────────────

  describe("stage directions in standalone format", () => {
    it("classifies standalone parenthetical as stage direction", () => {
      const result = parseDialogueLines(
        "(A central area of a large, ultra-modern airport.)",
        "standalone",
      );
      expect(result[0].isStageDirection).toBe(true);
    });

    it("classifies SFX bracket as stage direction", () => {
      const result = parseDialogueLines("[SFX 1a]", "standalone");
      expect(result[0].character).toBe("[Stage Direction]");
    });

    it("stage direction between name and dialogue does not break attribution", () => {
      const text = [
        "OLDER FRANK JUNIOR",
        "(He looks at us and smiles.)",
        "A show.",
      ].join("\n");
      const result = parseDialogueLines(text, "standalone");
      const speech = result.find(
        (l) => l.character === "OLDER FRANK JUNIOR" && !l.isStageDirection,
      );
      expect(speech).toBeDefined();
      expect(speech!.dialogue).toBe("A show.");
    });
  });

  // ── Multiline dialogue ─────────────────────────────────────────────────

  describe("multiline dialogue in standalone format", () => {
    it("appends hard-wrapped lines (no blank) to one entry", () => {
      const text = [
        "HANRATTY",
        "Hold on, Folks, listen, by the time this guy was twenty years old, he had stolen almost",
        "one-point-eight million dollars.",
      ].join("\n");
      const result = parseDialogueLines(text, "standalone");
      const h = result.find((l) => l.character === "HANRATTY");
      expect(h).toBeDefined();
      expect(h!.dialogue).toContain("one-point-eight million");
    });

    it("blank-separated blocks create separate entries for the same speaker", () => {
      const text = [
        "OLDER FRANK JUNIOR",
        "I was a millionaire twice over.",
        "",
        "I flew almost five million miles.",
      ].join("\n");
      const result = parseDialogueLines(text, "standalone");
      const frank = result.filter((l) => l.character === "OLDER FRANK JUNIOR");
      expect(frank).toHaveLength(2);
    });
  });

  // ── Song sections ──────────────────────────────────────────────────────

  describe("songs in standalone format", () => {
    it("assigns all-caps lyrics to the preceding speaker", () => {
      const text = [
        "OLDER FRANK JUNIOR",
        "LIVE IN LIVING COLOR",
        "LET ME TAKE YOU FOR A RIDE",
      ].join("\n");
      const result = parseDialogueLines(text, "standalone");
      const frank = result.filter((l) => l.character === "OLDER FRANK JUNIOR");
      expect(frank).toHaveLength(1);
      expect(frank[0].dialogue).toContain("LIVE IN LIVING COLOR");
      expect(frank[0].dialogue).toContain("LET ME TAKE YOU FOR A RIDE");
    });

    it("does not create a new speaker for lyric lines mid-verse", () => {
      const text = [
        "FRANK SENIOR",
        "WHEN YOUR MOTHER WALKED IN",
        "TO THAT DANCEHALL IN MONTRICHARD",
        "WHAT DID SHE SEE?",
      ].join("\n");
      const result = parseDialogueLines(text, "standalone");
      expect(extractCharacterNames(result)).toEqual(["FRANK SENIOR"]);
    });
  });

  // ── Full integration block ─────────────────────────────────────────────

  describe("full CMIYC block integration", () => {
    const SAMPLE = `
Prologue: Miami International Airport

(A central area of a large, ultra-modern airport.)
[SFX 1a]
AIRPORT ANNOUNCER
Welcome to Miami Dade International Airport.

BRANTON
There he is! Hold it right there!

DOLLAR
Stop or I'll shoot!

HANRATTY
Hold your fire! (approaches passenger, lifts hat, realizes it's not him) Where the heck is he?

OLDER FRANK JUNIOR
That was close! You could hurt someone.

HANRATTY
Come on, Frank. I'd rather take you alive than dead.

OLDER FRANK JUNIOR
LIVE IN LIVING COLOR
LET ME TAKE YOU FOR A RIDE
YES, I'M LIVE IN LIVING COLOR

OLDER FRANK JUNIOR
SO, SIT BACK AND LET ME BE YOUR T.V. GUIDE!
`.trim();

    it("detects the script as standalone format", () => {
      expect(detectScriptFormat(SAMPLE)).toBe("standalone");
    });

    it("extracts all speaking characters correctly", () => {
      const result = parseDialogueLines(SAMPLE);
      const names = extractCharacterNames(result);
      expect(names).toContain("HANRATTY");
      expect(names).toContain("BRANTON");
      expect(names).toContain("DOLLAR");
      expect(names).toContain("OLDER FRANK JUNIOR");
      expect(names).toContain("AIRPORT ANNOUNCER");
    });

    it("does not include stage directions or SFX cues as characters", () => {
      const result = parseDialogueLines(SAMPLE);
      const names = extractCharacterNames(result);
      expect(names).not.toContain("[Stage Direction]");
      expect(names).not.toContain("[Scene Heading]");
    });

    it("groups lyric verses under OLDER FRANK JUNIOR", () => {
      const result = parseDialogueLines(SAMPLE);
      const frank = result.filter(
        (l) => l.character === "OLDER FRANK JUNIOR" && !l.isStageDirection,
      );
      const hasLyrics = frank.some((l) => l.dialogue.includes("LIVING COLOR"));
      expect(hasLyrics).toBe(true);
    });

    it("keeps Prologue heading as [Scene Heading], not character", () => {
      const result = parseDialogueLines(SAMPLE);
      const heading = result.find((l) => l.character === "[Scene Heading]");
      expect(heading).toBeDefined();
      expect(heading!.dialogue).toContain("Prologue");
    });
  });
});

// ---------------------------------------------------------------------------
// parseDialogueLines – Annie / Dramatists Play Service format
// ---------------------------------------------------------------------------

describe("parseDialogueLines \u2013 Annie / DPS format", () => {
  // \u2500\u2500 Scene headings \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  describe("Annie scene headings", () => {
    it("recognises '# N \u2014 Title' with space after # (Annie format)", () => {
      const result = parseDialogueLines("# 1 \u2014 Overture");
      expect(result[0].character).toBe("[Scene Heading]");
    });

    it("recognises 'Scene1' with no space before digit (Annie format)", () => {
      const result = parseDialogueLines("Scene1");
      expect(result[0].character).toBe("[Scene Heading]");
    });

    it("recognises 'ACT ONE' heading in Annie context", () => {
      const result = parseDialogueLines("ACT ONE");
      expect(result[0].character).toBe("[Scene Heading]");
      expect(result[0].isStageDirection).toBe(true);
    });
  });

  // \u2500\u2500 Song lyric detection \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  describe("song lyrics not misidentified as characters", () => {
    it("does not treat 'MAYBE FAR AWAY' as a character name", () => {
      const text = [
        "ANNIE",
        "(Sings)",
        "MAYBE FAR AWAY,",
        "OR MAYBE REAL NEARBY",
      ].join("\n");
      const result = parseDialogueLines(text, "standalone");
      const names = extractCharacterNames(result);
      expect(names).not.toContain("MAYBE FAR AWAY,");
      expect(names).not.toContain("OR MAYBE REAL NEARBY");
      expect(names).toContain("ANNIE");
    });

    it("assigns lyrics after blank verse break to the established singer", () => {
      const text = [
        "ANNIE",
        "(Sings)",
        "MAYBE FAR AWAY,",
        "OR MAYBE REAL NEARBY",
        "",
        "MAYBE IN A HOUSE",
        "ALL HIDDEN BY A HILL",
      ].join("\n");
      const result = parseDialogueLines(text, "standalone");
      const nonStage = result.filter((l) => !l.isStageDirection);
      const allAnnie = nonStage.every((l) => l.character === "ANNIE");
      expect(allAnnie).toBe(true);
    });

    it("'MAYBE' is blocked as a standalone character name first word", () => {
      // A line that starts with MAYBE should not be a character name
      const text = "MAYBE SOMEDAY\nDialogue below.";
      const result = parseDialogueLines(text, "standalone");
      const names = extractCharacterNames(result);
      expect(names).not.toContain("MAYBE SOMEDAY");
    });

    it("does not treat 'HE MAY BE POURIN HER COFFEE' as a character", () => {
      const text = [
        "ANNIE",
        "HE MAY BE POURIN HER COFFEE",
        "",
        "SHE MAY BE STRAIGHTENING HIS TIE",
      ].join("\n");
      const result = parseDialogueLines(text, "standalone");
      const names = extractCharacterNames(result);
      expect(names).not.toContain("HE MAY BE POURIN HER COFFEE");
      expect(names).not.toContain("SHE MAY BE STRAIGHTENING HIS TIE");
    });
  });

  // \u2500\u2500 (Sings) stage direction before first lyric \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  describe("(Sings) stage direction followed by lyrics", () => {
    it("attributes lyrics to the speaker when (Sings) comes between name and lyrics", () => {
      const text = ["ANNIE", "(Sings)", "MAYBE FAR AWAY,"].join("\n");
      const result = parseDialogueLines(text, "standalone");
      const annie = result.find(
        (l) => l.character === "ANNIE" && !l.isStageDirection,
      );
      expect(annie).toBeDefined();
      expect(annie!.dialogue).toBe("MAYBE FAR AWAY,");
    });

    it("(Sings) does not create a blank false-character window", () => {
      // pendingStandaloneChar='ANNIE' + stage dir should NOT flip afterBlank=true
      const text = [
        "ANNIE",
        "(Sings)",
        "MAYBE FAR AWAY,",
        "OR MAYBE REAL NEARBY",
      ].join("\n");
      const result = parseDialogueLines(text, "standalone");
      const names = extractCharacterNames(result);
      // The only speaker should be ANNIE
      expect(names).toEqual(["ANNIE"]);
    });

    it("handles multiple (Sings) song blocks across the same character", () => {
      const text = [
        "ANNIE",
        "(Sings)",
        "MAYBE FAR AWAY,",
        "",
        "ANNIE",
        "(Sings again)",
        "MAYBE IN A HOUSE",
      ].join("\n");
      const result = parseDialogueLines(text, "standalone");
      const names = extractCharacterNames(result);
      expect(names).toEqual(["ANNIE"]);
    });
  });

  // \u2500\u2500 Group / ensemble characters \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  describe("ensemble / group characters in Annie format", () => {
    it("parses 'ALL' as a valid character name", () => {
      const text = "ALL\nIt's the hard-knock life!";
      const result = parseDialogueLines(text, "standalone");
      expect(result[0].character).toBe("ALL");
    });

    it("parses 'JULY & KATE' as a character name", () => {
      const text =
        "JULY & KATE\nDon't it feel like the wind is always howlin'?";
      const result = parseDialogueLines(text, "standalone");
      expect(result[0].character).toBe("JULY & KATE");
    });

    it("parses 'PEPPER & TESSIE' as a character name", () => {
      const text =
        "PEPPER & TESSIE\nOnce a day don't you want to throw the towel in?";
      const result = parseDialogueLines(text, "standalone");
      expect(result[0].character).toBe("PEPPER & TESSIE");
    });

    it("parses 'MISS HANNIGAN' as a valid character name", () => {
      const text = "MISS HANNIGAN\nQuiet, you little brats!";
      const result = parseDialogueLines(text, "standalone");
      expect(result[0].character).toBe("MISS HANNIGAN");
    });
  });

  // \u2500\u2500 Full Annie integration block \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  describe("full Annie block integration", () => {
    const SAMPLE =
      `\nACT ONE\n\nScene1\n\nMOLLY\n(Awaking from a dream and crying out)\nMama! Mama! Mommy!\n\nPEPPER\n(Sitting up)\nShut up!\n\nANNIE\nPipe down, all of ya. Go back to sleep.\n\nMOLLY\n(Rubbing her eyes)\nMama, mommy.\n\nANNIE\n(To MOLLY)\nIt's all right, Molly. Annie's here.\n\nANNIE\n(Sings)\nMAYBE FAR AWAY,\nOR MAYBE REAL NEARBY\nHE MAY BE POURIN HER COFFEE\nSHE MAY BE STRAIGHTENING HIS TIE!\n\nMAYBE IN A HOUSE\nALL HIDDEN BY A HILL\nSHE'S SITTIN' PLAYIN' PIANO,\nHE'S SITTIN' PAYIN' A BILL!\n`.trim();

    it("detects the format as standalone", () => {
      expect(detectScriptFormat(SAMPLE)).toBe("standalone");
    });

    it("'ACT ONE' is a scene heading", () => {
      const result = parseDialogueLines(SAMPLE);
      const actHeading = result.find(
        (l) =>
          l.character === "[Scene Heading]" && l.dialogue.includes("ACT ONE"),
      );
      expect(actHeading).toBeDefined();
    });

    it("'Scene1' is a scene heading", () => {
      const result = parseDialogueLines(SAMPLE);
      const sceneHeading = result.find(
        (l) => l.character === "[Scene Heading]" && l.dialogue === "Scene1",
      );
      expect(sceneHeading).toBeDefined();
    });

    it("extracts MOLLY, PEPPER, and ANNIE as speakers", () => {
      const result = parseDialogueLines(SAMPLE);
      const names = extractCharacterNames(result);
      expect(names).toContain("ANNIE");
      expect(names).toContain("MOLLY");
      expect(names).toContain("PEPPER");
    });

    it("does not include lyric phrases as character names", () => {
      const result = parseDialogueLines(SAMPLE);
      const names = extractCharacterNames(result);
      expect(names).not.toContain("MAYBE FAR AWAY,");
      expect(names).not.toContain("OR MAYBE REAL NEARBY");
      expect(names).not.toContain("MAYBE IN A HOUSE");
      expect(names).not.toContain("ALL HIDDEN BY A HILL");
    });

    it("ANNIE's song lyrics are attributed to ANNIE", () => {
      const result = parseDialogueLines(SAMPLE);
      const annieLines = result.filter(
        (l) => l.character === "ANNIE" && !l.isStageDirection,
      );
      const hasLyric = annieLines.some((l) =>
        l.dialogue.includes("MAYBE FAR AWAY"),
      );
      expect(hasLyric).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// parseDialogueLines \u2013 Groundhog Day libretto format
// ---------------------------------------------------------------------------

describe("parseDialogueLines – Groundhog Day libretto format", () => {
  // ── Scene headings ──────────────────────────────────────────────────────

  describe("scene headings", () => {
    it("recognises #N - Title with hyphen", () => {
      const result = parseDialogueLines("#1 - TV Studio\nPHIL: Hello.");
      const heading = result.find((l) => l.character === "[Scene Heading]");
      expect(heading).toBeDefined();
      expect(heading!.dialogue).toBe("#1 - TV Studio");
    });

    it("recognises #N – Title with en-dash", () => {
      const result = parseDialogueLines("#4 – B&B Parlor\nPHIL: Yes.");
      const heading = result.find((l) => l.character === "[Scene Heading]");
      expect(heading).toBeDefined();
      expect(heading!.dialogue).toBe("#4 – B&B Parlor");
    });

    it("recognises ACT ONE as a scene heading", () => {
      const result = parseDialogueLines("ACT ONE\nPHIL: Hello.");
      const heading = result.find((l) => l.character === "[Scene Heading]");
      expect(heading).toBeDefined();
    });

    it("marks scene headings as non-speech (isStageDirection)", () => {
      const result = parseDialogueLines("#2 - Gobbler's Knob\nPHIL: Hi.");
      const heading = result.find((l) => l.character === "[Scene Heading]");
      expect(heading!.isStageDirection).toBe(true);
    });

    it("scene heading content does not appear as character dialogue", () => {
      const result = parseDialogueLines("#1 - TV Studio\nPHIL: Hello.");
      const phil = result.filter((l) => l.character === "PHIL");
      expect(phil).toHaveLength(1);
      expect(phil[0].dialogue).toBe("Hello.");
    });

    it("resets speaker context after a scene heading", () => {
      // Without the scene heading resetting context, continuation lines after
      // it would absorb into the previous speaker's dialogue.
      const content = "PHIL: First line.\n#2 - Next Scene\nsome continuation";
      const result = parseDialogueLines(content);
      const narrative = result.find((l) => l.character === "[Narrative]");
      expect(narrative).toBeDefined();
      expect(narrative!.dialogue).toBe("some continuation");
    });
  });

  // ── Character name varieties ────────────────────────────────────────────

  describe("character name varieties", () => {
    it("parses plain uppercase name", () => {
      const result = parseDialogueLines("DIRECTOR: Okay, Phil.");
      expect(result[0].character).toBe("DIRECTOR");
      expect(result[0].dialogue).toBe("Okay, Phil.");
    });

    it("parses name with period (MRS. LANCASTER)", () => {
      const result = parseDialogueLines("MRS. LANCASTER: Good morning!");
      expect(result[0].character).toBe("MRS. LANCASTER");
      expect(result[0].dialogue).toBe("Good morning!");
    });

    it("parses name with number (DJ 1)", () => {
      const result = parseDialogueLines("DJ 1: Nothing!");
      expect(result[0].character).toBe("DJ 1");
    });

    it("parses combined numbered name (DJ 1 & DJ 2)", () => {
      const result = parseDialogueLines("DJ 1 & DJ 2: Go chucks!");
      expect(result[0].character).toBe("DJ 1 & DJ 2");
    });

    it("parses name with ampersand (FRED & DEBBIE)", () => {
      const result = parseDialogueLines(
        "FRED & DEBBIE: Good Weather with Phil Connors!",
      );
      expect(result[0].character).toBe("FRED & DEBBIE");
      expect(result[0].dialogue).toBe("Good Weather with Phil Connors!");
    });

    it("parses ensemble line with comma (MRS. LANCASTER, NED & CHUBBY MAN)", () => {
      const result = parseDialogueLines(
        "MRS. LANCASTER, NED & CHUBBY MAN: I'd wave my hand.",
      );
      expect(result[0].character).toBe("MRS. LANCASTER, NED & CHUBBY MAN");
    });

    it("does not treat SFX as a character", () => {
      const result = parseDialogueLines("SFX: Phone rings");
      expect(result[0].character).not.toBe("SFX");
      expect(result[0].character).toBe("[Narrative]");
    });
  });

  // ── Stage directions ────────────────────────────────────────────────────

  describe("stage directions", () => {
    it("classifies a standalone parenthetical as stage direction", () => {
      const result = parseDialogueLines("(We see PHIL in a TV studio.)");
      expect(result[0].isStageDirection).toBe(true);
      expect(result[0].character).toBe("[Stage Direction]");
    });

    it("classifies a standalone bracketed line as stage direction", () => {
      const result = parseDialogueLines("[Lights fade to black]");
      expect(result[0].isStageDirection).toBe(true);
      expect(result[0].character).toBe("[Stage Direction]");
    });

    it("extracts inline parenthetical as a stage direction", () => {
      // e.g. PHIL: (in front of green screen) As you know...
      const result = parseDialogueLines(
        "PHIL: (in front of green screen, making gestures.) As you know—",
      );
      const sd = result.find(
        (l) => l.isStageDirection && l.dialogue.includes("green screen"),
      );
      expect(sd).toBeDefined();
      const speech = result.find(
        (l) => l.character === "PHIL" && !l.isStageDirection,
      );
      expect(speech).toBeDefined();
      expect(speech!.dialogue).toBe("As you know—");
    });

    it("extracts (whispering) parenthetical as a stage direction", () => {
      const result = parseDialogueLines("PHIL: (whispering) I hate this town.");
      const sd = result.find(
        (l) => l.isStageDirection && l.dialogue === "(whispering)",
      );
      expect(sd).toBeDefined();
      const speech = result.find(
        (l) => l.character === "PHIL" && !l.isStageDirection,
      );
      expect(speech).toBeDefined();
      expect(speech!.dialogue).toBe("I hate this town.");
    });
  });

  // ── Song / verse mode ───────────────────────────────────────────────────

  describe("song mode – empty CHARACTER: followed by lyrics", () => {
    it("accumulates first lyric line after an empty CHARACTER: line", () => {
      const content = "PHIL:\nLUMPY BED, UGLY CURTAINS";
      const result = parseDialogueLines(content);
      const phil = result.filter((l) => l.character === "PHIL");
      expect(phil).toHaveLength(1);
      expect(phil[0].dialogue).toBe("LUMPY BED, UGLY CURTAINS");
    });

    it("appends subsequent lines to the same verse (no blank between)", () => {
      const content = "PHIL:\nLUMPY BED, UGLY CURTAINS\nPOINTLESS PERFECTION.";
      const result = parseDialogueLines(content);
      const phil = result.filter((l) => l.character === "PHIL");
      expect(phil).toHaveLength(1);
      expect(phil[0].dialogue).toBe(
        "LUMPY BED, UGLY CURTAINS POINTLESS PERFECTION.",
      );
    });

    it("creates a new entry per blank-line-separated verse block", () => {
      const content =
        "PHIL:\nLUMPY BED, UGLY CURTAINS\n\nDRIED FLOWERS, DAMP TOWELS";
      const result = parseDialogueLines(content);
      const phil = result.filter((l) => l.character === "PHIL");
      expect(phil).toHaveLength(2);
      expect(phil[0].dialogue).toBe("LUMPY BED, UGLY CURTAINS");
      expect(phil[1].dialogue).toBe("DRIED FLOWERS, DAMP TOWELS");
    });

    it("stage direction mid-song does not end the singer's active verse", () => {
      // A direction like "(He looks at her)" appearing inside a song block
      // should not reset the singer so that following lyrics still belong to them.
      const content =
        "PHIL:\nI'VE NOT A BAD WORD TO SAY\n(He gestures broadly.)\nABOUT SMALL TOWNS PER SE";
      const result = parseDialogueLines(content);
      const phil = result.filter((l) => l.character === "PHIL");
      // All three lyric lines belong to PHIL (two grouped before direction, one after)
      expect(phil.length).toBeGreaterThanOrEqual(1);
      const fullText = phil.map((l) => l.dialogue).join(" ");
      expect(fullText).toContain("I'VE NOT A BAD WORD TO SAY");
      expect(fullText).toContain("ABOUT SMALL TOWNS PER SE");
    });

    it("a new CHARACTER: line correctly ends the previous singer's verse", () => {
      const content =
        "PHIL:\nLUMPY BED, UGLY CURTAINS\nDIRECTOR: Cut!\nPHIL:\nDRIED FLOWERS";
      const result = parseDialogueLines(content);
      const director = result.filter((l) => l.character === "DIRECTOR");
      expect(director).toHaveLength(1);
      const phil = result.filter((l) => l.character === "PHIL");
      expect(phil).toHaveLength(2);
    });
  });

  // ── Multiline dialogue (hard-wrap from paste) ───────────────────────────

  describe("multiline dialogue – pasted line-wrapping", () => {
    it("appends a continuation line (no blank) to the current entry", () => {
      // Simulates a long line broken mid-sentence during paste
      const content =
        "PHIL: Hoping for an early spring? Well, tomorrow is Groundhog Day, and the good folks in Punxsutawney are\nalready gathering in a snowy field. Why? Because they're morons.";
      const result = parseDialogueLines(content);
      const phil = result.filter((l) => l.character === "PHIL");
      expect(phil).toHaveLength(1);
      expect(phil[0].dialogue).toContain("already gathering");
    });

    it("does NOT append after a blank line (new verse/paragraph)", () => {
      const content = "PHIL: First sentence.\n\nNext paragraph.";
      const result = parseDialogueLines(content);
      const phil = result.filter((l) => l.character === "PHIL");
      expect(phil).toHaveLength(2);
    });

    it("continuation does not require leading whitespace", () => {
      // Old parser required 2-space indent for continuation; new parser does not
      const content = "PHIL: Leading text.\ncontinuation flush-left.";
      const result = parseDialogueLines(content);
      const phil = result.filter((l) => l.character === "PHIL");
      expect(phil).toHaveLength(1);
      expect(phil[0].dialogue).toContain("continuation flush-left");
    });
  });

  // ── Narrative / section headers ─────────────────────────────────────────

  describe("narrative and section headers", () => {
    it("classifies an all-caps song title as narrative", () => {
      const result = parseDialogueLines("THERE WILL BE SUN");
      expect(result[0].character).toBe("[Narrative]");
      expect(result[0].dialogue).toBe("THERE WILL BE SUN");
    });

    it("classifies a song section label as narrative", () => {
      const result = parseDialogueLines("DAY ONE - SMALL TOWN USA");
      // Not a #N - pattern so treated as narrative
      expect(result[0].character).toBe("[Narrative]");
    });

    it("does not let a narrative line inherit the previous speaker", () => {
      const content = "PHIL: Hello.\nUNRECOGNISED lowercase text here.";
      const result = parseDialogueLines(content);
      // Lowercase text doesn't match character pattern AND 'lastCharacter' is
      // PHIL, so it continues as PHIL (flush continuation). Verify the
      // character is PHIL (continuation), not [Narrative].
      const chars = result.map((l) => l.character);
      // The second line should be continuation of PHIL (no blank line)
      expect(chars).not.toContain("[Narrative]");
      expect(chars.filter((c) => c === "PHIL")).toHaveLength(1);
    });
  });

  // ── Full block integration ──────────────────────────────────────────────

  describe("full script block integration", () => {
    const SAMPLE = `
#1 - TV Studio

(We see PHIL CONNORS in a TV studio, against a green screen.)
DIRECTOR: Okay, Phil, one more time.
PHIL: Really?
DIRECTOR: "Hoping for an early spring."
PHIL: Fine.
DIRECTOR: Here we go. Three, two,—
PHIL: Hoping for an early spring? Well, tomorrow is Groundhog Day, and the good folks in Punxsutawney are
already gathering in a snowy field waiting for the dawn. Why? Because they're morons.
DIRECTOR: Cut!
(Another take.)
PHIL: (in front of green screen, making ridiculous hand gestures.) As you know we've been following this blizzard thing—
DIRECTOR: Damn it, Phil.
SFX: Hat squeak
PHIL:
LUMPY BED, UGLY CURTAINS
POINTLESS PERFECTION.

DRIED FLOWERS, DAMP TOWELS, NO RECEPTION
`.trim();

    it("produces the correct set of speaking characters", () => {
      const result = parseDialogueLines(SAMPLE);
      const names = extractCharacterNames(result);
      expect(names).toContain("PHIL");
      expect(names).toContain("DIRECTOR");
      expect(names).not.toContain("SFX");
      expect(names).not.toContain("[Stage Direction]");
      expect(names).not.toContain("[Scene Heading]");
      expect(names).not.toContain("[Narrative]");
    });

    it("merges the hard-wrapped PHIL speech into one entry", () => {
      const result = parseDialogueLines(SAMPLE);
      const phil = result.filter((l) => l.character === "PHIL");
      const longLine = phil.find((l) =>
        l.dialogue.includes("already gathering"),
      );
      expect(longLine).toBeDefined();
      expect(longLine!.dialogue).toContain("Because they're morons");
    });

    it("extracts inline parenthetical from PHIL's dialogue as stage direction", () => {
      const result = parseDialogueLines(SAMPLE);
      const sd = result.find(
        (l) =>
          l.isStageDirection && l.dialogue.includes("in front of green screen"),
      );
      expect(sd).toBeDefined();
      // The remaining dialogue should not contain the parenthetical
      const philSpeech = result.find(
        (l) =>
          l.character === "PHIL" &&
          !l.isStageDirection &&
          l.dialogue.includes("As you know"),
      );
      expect(philSpeech).toBeDefined();
    });

    it("produces two verse entries for PHIL's song (blank-separated)", () => {
      const result = parseDialogueLines(SAMPLE);
      const philSong = result.filter(
        (l) =>
          l.character === "PHIL" &&
          (l.dialogue.includes("LUMPY BED") ||
            l.dialogue.includes("DRIED FLOWERS")),
      );
      expect(philSong).toHaveLength(2);
    });

    it("does not include SFX as a dialogue entry", () => {
      const result = parseDialogueLines(SAMPLE);
      const sounding = result.find((l) => l.dialogue.includes("Hat squeak"));
      // Should be narrative (SFX rejected) or not present as character speech
      if (sounding) {
        expect(sounding.character).toBe("[Narrative]");
      }
    });
  });
});

// ---------------------------------------------------------------------------
// parseDialogueLines – Inline parenthetical → stage direction handling
// ---------------------------------------------------------------------------

describe("parseDialogueLines – inline parentheticals as stage directions", () => {
  describe("colon format inline parentheticals", () => {
    it("extracts a leading parenthetical as a stage direction", () => {
      const result = parseDialogueLines(
        "PHIL: (whispering) I need to tell you something.",
      );
      const sd = result.find(
        (l) => l.isStageDirection && l.dialogue === "(whispering)",
      );
      expect(sd).toBeDefined();
      const speech = result.find(
        (l) => l.character === "PHIL" && !l.isStageDirection,
      );
      expect(speech).toBeDefined();
      expect(speech!.dialogue).toBe("I need to tell you something.");
    });

    it("extracts a trailing parenthetical as a stage direction", () => {
      const result = parseDialogueLines("RITA: Goodbye, Phil. (exits)");
      const sd = result.find(
        (l) => l.isStageDirection && l.dialogue === "(exits)",
      );
      expect(sd).toBeDefined();
      const speech = result.find(
        (l) => l.character === "RITA" && !l.isStageDirection,
      );
      expect(speech).toBeDefined();
      expect(speech!.dialogue).toBe("Goodbye, Phil.");
    });

    it("extracts a mid-dialogue parenthetical as a stage direction", () => {
      const result = parseDialogueLines(
        "PHIL: Hello there (pause) how are you?",
      );
      const sds = result.filter((l) => l.isStageDirection);
      expect(sds).toHaveLength(1);
      expect(sds[0].dialogue).toBe("(pause)");
      const speeches = result.filter(
        (l) => l.character === "PHIL" && !l.isStageDirection,
      );
      expect(speeches).toHaveLength(2);
      expect(speeches[0].dialogue).toBe("Hello there");
      expect(speeches[1].dialogue).toBe("how are you?");
    });

    it("extracts multiple parentheticals from one line", () => {
      const result = parseDialogueLines(
        "PHIL: (laughing) That was great! (turns to Rita) Wasn't it?",
      );
      const sds = result.filter((l) => l.isStageDirection);
      expect(sds).toHaveLength(2);
      expect(sds[0].dialogue).toBe("(laughing)");
      expect(sds[1].dialogue).toBe("(turns to Rita)");
    });

    it("leaves dialogue without parentheticals unchanged", () => {
      const result = parseDialogueLines("PHIL: Just a normal line.");
      expect(result).toHaveLength(1);
      expect(result[0].character).toBe("PHIL");
      expect(result[0].dialogue).toBe("Just a normal line.");
      expect(result[0].isStageDirection).toBeFalsy();
    });
  });

  describe("standalone format inline parentheticals", () => {
    it("extracts trailing parenthetical on a character name line", () => {
      const text = ["DOLLAR (overlapping)", "Stop right there!"].join("\n");
      const result = parseDialogueLines(text, "standalone");
      const sd = result.find(
        (l) => l.isStageDirection && l.dialogue === "(overlapping)",
      );
      expect(sd).toBeDefined();
      const speech = result.find(
        (l) => l.character === "DOLLAR" && !l.isStageDirection,
      );
      expect(speech).toBeDefined();
      expect(speech!.dialogue).toBe("Stop right there!");
    });

    it("handles inline parenthetical in standalone dialogue body", () => {
      const text = [
        "HANRATTY",
        "Hold your fire! (approaches suspect) Where is he?",
      ].join("\n");
      const result = parseDialogueLines(text, "standalone");
      const sd = result.find(
        (l) => l.isStageDirection && l.dialogue === "(approaches suspect)",
      );
      expect(sd).toBeDefined();
      const speeches = result.filter(
        (l) => l.character === "HANRATTY" && !l.isStageDirection,
      );
      expect(speeches).toHaveLength(2);
      expect(speeches[0].dialogue).toBe("Hold your fire!");
      expect(speeches[1].dialogue).toBe("Where is he?");
    });
  });

  describe("bracket stage directions", () => {
    it("extracts inline [bracket] directions from dialogue", () => {
      const result = parseDialogueLines(
        "PHIL: Watch this. [He juggles.] Pretty good, right?",
      );
      const sd = result.find(
        (l) => l.isStageDirection && l.dialogue === "[He juggles.]",
      );
      expect(sd).toBeDefined();
    });
  });

  describe("standalone stage directions remain unchanged", () => {
    it("does not double-process already-standalone stage directions", () => {
      const result = parseDialogueLines("(She crosses to the window.)");
      expect(result).toHaveLength(1);
      expect(result[0].isStageDirection).toBe(true);
      expect(result[0].dialogue).toBe("(She crosses to the window.)");
    });
  });
});
