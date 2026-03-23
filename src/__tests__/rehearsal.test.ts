import { describe, it, expect } from "vitest";
import {
  getCueLineIndex,
  parseDialogueLines,
  extractCharacterNames,
  DialogueLine,
} from "@/lib/rehearsal";

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
