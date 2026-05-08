import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  matchMultiCharInLine,
  matchCharInLine,
  matchStandaloneHeaderInLine,
  buildCharColorMap,
  splitAtColon,
  HighlightedContent,
} from "@/components/scenes/SceneHighlight";

// ── matchMultiCharInLine ────────────────────────────────────────────────────

describe("matchMultiCharInLine", () => {
  describe("ampersand separator", () => {
    it("matches two exact-name characters joined by &", () => {
      const charSet = new Set(["FRED", "DEBBIE"]);
      const result = matchMultiCharInLine(
        "FRED & DEBBIE: Wrestlemania!",
        charSet,
      );
      expect(result).not.toBeNull();
      expect(result!.chars).toEqual(["FRED", "DEBBIE"]);
      expect(result!.dialogue).toBe("Wrestlemania!");
    });

    it("returns textParts matching the as-written names (same as canonical when exact)", () => {
      const charSet = new Set(["FRED", "DEBBIE"]);
      const result = matchMultiCharInLine("FRED & DEBBIE: Hello.", charSet);
      expect(result!.textParts).toEqual(["FRED", "DEBBIE"]);
    });

    it("matches abbreviated names that resolve to longer canonicals", () => {
      // Script says "JOHN & JANE:" but project canonicals are "JOHN DOE" / "JANE DOE"
      const charSet = new Set(["JOHN DOE", "JANE DOE"]);
      const result = matchMultiCharInLine("JOHN & JANE: Hello!", charSet);
      expect(result).not.toBeNull();
      expect(result!.chars).toEqual(["JOHN DOE", "JANE DOE"]);
      // textParts must be the abbreviated form so indexOf lookups succeed
      expect(result!.textParts).toEqual(["JOHN", "JANE"]);
      expect(result!.dialogue).toBe("Hello!");
    });

    it("sets dialogue to null when nothing follows the colon", () => {
      const charSet = new Set(["ANNIE", "GRACE"]);
      const result = matchMultiCharInLine("ANNIE & GRACE:", charSet);
      expect(result).not.toBeNull();
      expect(result!.dialogue).toBeNull();
    });
  });

  describe("AND separator", () => {
    it("matches two characters joined by AND", () => {
      const charSet = new Set(["TOM", "JERRY"]);
      const result = matchMultiCharInLine("TOM AND JERRY: Run!", charSet);
      expect(result).not.toBeNull();
      expect(result!.chars).toEqual(["TOM", "JERRY"]);
      expect(result!.dialogue).toBe("Run!");
    });
  });

  describe("slash separator", () => {
    it("matches two characters joined by /", () => {
      const charSet = new Set(["ROMEO", "JULIET"]);
      const result = matchMultiCharInLine("ROMEO/JULIET: Together.", charSet);
      expect(result).not.toBeNull();
      expect(result!.chars).toEqual(["ROMEO", "JULIET"]);
    });
  });

  describe("comma separator", () => {
    it("matches two characters joined by comma when both are known", () => {
      const charSet = new Set(["ALICE", "BOB"]);
      const result = matchMultiCharInLine("ALICE, BOB: Yes!", charSet);
      expect(result).not.toBeNull();
      expect(result!.chars).toEqual(["ALICE", "BOB"]);
    });

    it("does not match a comma line when only one part is a known character", () => {
      const charSet = new Set(["ALICE"]);
      const result = matchMultiCharInLine("ALICE, STRANGER: Yes!", charSet);
      expect(result).toBeNull();
    });
  });

  describe("three-character lines", () => {
    it("matches three characters joined by &", () => {
      const charSet = new Set(["LARRY", "MOE", "CURLY"]);
      const result = matchMultiCharInLine(
        "LARRY & MOE & CURLY: Nyuk!",
        charSet,
      );
      expect(result).not.toBeNull();
      expect(result!.chars).toHaveLength(3);
      expect(result!.chars).toContain("LARRY");
      expect(result!.chars).toContain("MOE");
      expect(result!.chars).toContain("CURLY");
    });
  });

  describe("non-matching lines", () => {
    it("returns null for a single-character colon line", () => {
      const charSet = new Set(["PHIL", "RITA"]);
      const result = matchMultiCharInLine("PHIL: Hello.", charSet);
      expect(result).toBeNull();
    });

    it("returns null when no colon is present", () => {
      const charSet = new Set(["FRED", "DEBBIE"]);
      const result = matchMultiCharInLine("FRED & DEBBIE", charSet);
      expect(result).toBeNull();
    });

    it("returns null when neither part is a known character", () => {
      const charSet = new Set(["PHIL"]);
      const result = matchMultiCharInLine("STRANGER & UNKNOWN: Text.", charSet);
      expect(result).toBeNull();
    });
  });

  describe("textParts → canonical color mapping", () => {
    it("textParts align with chars so indexOf works for each abbreviated name", () => {
      // Simulates the SceneViewer token-render loop that calls
      // upperPrefix.indexOf(textParts[ci], pos) then colorMap.get(chars[ci])
      const charSet = new Set(["JOHN DOE", "JANE DOE"]);
      const result = matchMultiCharInLine("John & Jane: Hi there.", charSet);
      expect(result).not.toBeNull();

      const colorMap = buildCharColorMap(["JOHN DOE", "JANE DOE"]);
      const upperPrefix = result!.rawPrefix.toUpperCase();
      let pos = 0;
      const colorHits: boolean[] = [];

      for (let ci = 0; ci < result!.chars.length; ci++) {
        const part = result!.textParts[ci] ?? result!.chars[ci];
        const idx = upperPrefix.indexOf(part, pos);
        colorHits.push(idx !== -1 && colorMap.has(result!.chars[ci]));
        if (idx !== -1) pos = idx + part.length;
      }

      // Every character must get a color hit
      expect(colorHits).toEqual([true, true]);
    });

    it("exact canonical names also produce valid color hits", () => {
      const charSet = new Set(["FRED", "DEBBIE"]);
      const result = matchMultiCharInLine("FRED & DEBBIE: Yes!", charSet);
      expect(result).not.toBeNull();

      const colorMap = buildCharColorMap(["FRED", "DEBBIE"]);
      const upperPrefix = result!.rawPrefix.toUpperCase();
      let pos = 0;
      const colorHits: boolean[] = [];

      for (let ci = 0; ci < result!.chars.length; ci++) {
        const part = result!.textParts[ci] ?? result!.chars[ci];
        const idx = upperPrefix.indexOf(part, pos);
        colorHits.push(idx !== -1 && colorMap.has(result!.chars[ci]));
        if (idx !== -1) pos = idx + part.length;
      }

      expect(colorHits).toEqual([true, true]);
    });
  });
});

// ── matchCharInLine ─────────────────────────────────────────────────────────

describe("matchCharInLine", () => {
  it("matches an exact canonical name", () => {
    const charSet = new Set(["PHIL", "RITA"]);
    const result = matchCharInLine("PHIL: Hello.", charSet);
    expect(result).not.toBeNull();
    expect(result!.char).toBe("PHIL");
    expect(result!.prefix).toBe("PHIL");
  });

  it("matches a first-name abbreviation to the full canonical", () => {
    const charSet = new Set(["PHIL CONNORS"]);
    const result = matchCharInLine("PHIL: It's cold.", charSet);
    expect(result).not.toBeNull();
    expect(result!.char).toBe("PHIL CONNORS");
    expect(result!.prefix).toBe("PHIL");
  });

  it("does not match mixed-case prose via a first-name abbreviation", () => {
    const charSet = new Set(["THE CAMP"]);
    const result = matchCharInLine(
      "The Kremlin gleams magnificently in the near-distance.",
      charSet,
    );
    expect(result).toBeNull();
  });

  it("returns null for an unrecognised name", () => {
    const charSet = new Set(["PHIL"]);
    const result = matchCharInLine("STRANGER: Hello.", charSet);
    expect(result).toBeNull();
  });
});

// ── matchStandaloneHeaderInLine ─────────────────────────────────────────────

describe("matchStandaloneHeaderInLine", () => {
  it("matches a Fountain speaker cue with @ prefix", () => {
    const charSet = new Set(["PHIL"]);
    const result = matchStandaloneHeaderInLine("@PHIL", charSet);
    expect(result).not.toBeNull();
    expect(result).toEqual({ kind: "single", char: "PHIL", prefix: "@PHIL" });
  });

  it("matches a standalone screenplay speaker line", () => {
    const charSet = new Set(["JOHN", "JANE"]);
    const result = matchStandaloneHeaderInLine("JOHN", charSet);
    expect(result).not.toBeNull();
    expect(result).toEqual({ kind: "single", char: "JOHN", prefix: "JOHN" });
  });

  it("matches a standalone speaker cue with a parenthetical note", () => {
    const charSet = new Set(["JOHN", "JANE"]);
    const result = matchStandaloneHeaderInLine("JOHN (V.O.)", charSet);
    expect(result).not.toBeNull();
    expect(result).toEqual({
      kind: "single",
      char: "JOHN",
      prefix: "JOHN (V.O.)",
    });
  });

  it("matches standalone multi-speaker screenplay headers", () => {
    const charSet = new Set(["NORA", "ELI"]);
    const result = matchStandaloneHeaderInLine("NORA & ELI", charSet);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("multi");
    if (result!.kind === "multi") {
      expect(result.chars).toEqual(["NORA", "ELI"]);
      expect(result.rawPrefix).toBe("NORA & ELI");
    }
  });

  it("ignores screenplay scene headings and transitions", () => {
    const charSet = new Set(["PHIL"]);
    expect(
      matchStandaloneHeaderInLine("INT. HALLWAY - DAY", charSet),
    ).toBeNull();
    expect(matchStandaloneHeaderInLine("CUT TO:", charSet)).toBeNull();
  });

  it("does not classify long action text as a header", () => {
    const charSet = new Set(["PHIL"]);
    expect(
      matchStandaloneHeaderInLine(
        "PHIL WALKS TO THE WINDOW AND STARES OUT.",
        charSet,
      ),
    ).toBeNull();
  });

  it("does not classify a sentence that begins with a known character name", () => {
    const charSet = new Set(["PHIL CONNORS"]);
    expect(
      matchStandaloneHeaderInLine(
        "PHIL WALKS TO THE WINDOW AND STARES OUT.",
        charSet,
      ),
    ).toBeNull();
  });

  it("does not classify mixed-case prose as a header", () => {
    const charSet = new Set(["A", "CAR", "STREET"]);
    expect(
      matchStandaloneHeaderInLine(
        "A brightly-lit street with a rainy sheen. Soviet cars meander in traffic on a wide boulevard. All is quiet until--",
        charSet,
      ),
    ).toBeNull();
    expect(
      matchStandaloneHeaderInLine(
        "A COMPACT RUSSIAN CAR SCREAMS BY. CLIPS a motorbike, SMASHES a wing-mirror. HANDBRAKE TURN at the intersection.",
        charSet,
      ),
    ).toBeNull();
  });
});

// ── splitAtColon ────────────────────────────────────────────────────────────

describe("splitAtColon", () => {
  it("splits a character line into header and dialogue", () => {
    const { header, dialogue } = splitAtColon("PHIL", "PHIL: Hello there.");
    expect(header).toBe("PHIL:");
    expect(dialogue).toBe("Hello there.");
  });

  it("returns the full line as header when no dialogue follows the colon", () => {
    const { header, dialogue } = splitAtColon("PHIL", "PHIL:");
    expect(header).toBe("PHIL:");
    expect(dialogue).toBeNull();
  });

  it("returns null dialogue when prefix does not match", () => {
    const { header, dialogue } = splitAtColon("RITA", "PHIL: Hello.");
    expect(header).toBe("PHIL: Hello.");
    expect(dialogue).toBeNull();
  });
});

// ── buildCharColorMap ───────────────────────────────────────────────────────

describe("buildCharColorMap", () => {
  it("returns a map entry for each name (uppercased)", () => {
    const map = buildCharColorMap(["Phil", "Rita", "Larry"]);
    expect(map.has("PHIL")).toBe(true);
    expect(map.has("RITA")).toBe(true);
    expect(map.has("LARRY")).toBe(true);
  });

  it("assigns distinct colors to different characters", () => {
    const map = buildCharColorMap(["FRED", "DEBBIE", "PHIL", "RITA"]);
    const colors = Array.from(map.values()).map((c) => c.color);
    const unique = new Set(colors);
    expect(unique.size).toBe(colors.length);
  });

  it("returns an empty map for an empty array", () => {
    const map = buildCharColorMap([]);
    expect(map.size).toBe(0);
  });
});

describe("HighlightedContent", () => {
  it("does not carry a previous speaker color into prose after a blank line", () => {
    const content = [
      "DRIVER",
      "Sir, can I ask why I was pulled from deep cover?",
      "",
      "The passenger, GENERAL SANTARELLI (60s), wearing a crisp suit, turns his head slowly.",
    ].join("\n");

    render(
      React.createElement(HighlightedContent, {
        content,
        characters: ["DRIVER", "GENERAL SANTARELLI"],
        colorMap: buildCharColorMap(["DRIVER", "GENERAL SANTARELLI"]),
      }),
    );

    const proseLine = screen.getByText(
      /The passenger, GENERAL SANTARELLI \(60s\), wearing a crisp suit, turns his head slowly\./,
    );
    expect(proseLine.parentElement?.className).toContain("text-muted");
    expect(proseLine.parentElement?.className).toContain("italic");
    expect(proseLine.parentElement?.className).not.toContain("pl-3");
  });

  it("keeps the first two lines after a scene heading uncolored", () => {
    const content = [
      "INT. APARTMENT - NIGHT",
      "PHIL WALKS TO THE WINDOW.",
      "HE STARES OUT AT THE STREET.",
      "JOHN",
      "Hello there.",
    ].join("\n");

    render(
      React.createElement(HighlightedContent, {
        content,
        characters: ["PHIL", "JOHN"],
        colorMap: buildCharColorMap(["PHIL", "JOHN"]),
      }),
    );

    const firstLine = screen.getByText("PHIL WALKS TO THE WINDOW.");
    expect(firstLine.parentElement?.className).toContain("text-muted");
    expect(firstLine.parentElement?.className).toContain("italic");
    expect(firstLine.parentElement?.className).not.toContain("pl-3");

    const secondLine = screen.getByText("HE STARES OUT AT THE STREET.");
    expect(secondLine.parentElement?.className).toContain("text-muted");
    expect(secondLine.parentElement?.className).toContain("italic");
    expect(secondLine.parentElement?.className).not.toContain("pl-3");

    const speakerLine = screen.getByText("JOHN");
    expect(speakerLine.parentElement?.className).toContain("font-bold");
  });

  it("does not use colon-style character matching in Film mode", () => {
    const content = [
      "INT. THE KREMLIN - NIGHT",
      "The Kremlin gleams magnificently in the near-distance.",
      "SUPER: Moscow, 1986",
    ].join("\n");

    render(
      React.createElement(HighlightedContent, {
        content,
        characters: ["THE CAMP"],
        colorMap: buildCharColorMap(["THE CAMP"]),
        allowColonHeaders: false,
      }),
    );

    const proseLine = screen.getByText(
      "The Kremlin gleams magnificently in the near-distance.",
    );
    expect(proseLine.parentElement?.className).toContain("text-muted");
    expect(proseLine.parentElement?.className).toContain("italic");
    expect(proseLine.parentElement?.className).not.toContain("pl-3");
  });
});
