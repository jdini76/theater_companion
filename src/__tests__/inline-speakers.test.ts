import { describe, expect, it } from "vitest";
import { parseDialogueLines } from "@/lib/rehearsal";
import { buildSceneDisplayContent, createScene, extractSceneCharacters, normalizeSceneContent } from "@/lib/scenes";
import type { LineOverride } from "@/types/line-override";

const block = `(The entire cast leaps offstage, splitting off in every direction; left alone, in a spotlight center stage, are MO and LAG…) MO: (to the audience) Woah! Did you see that? Everybody singing and dancing. LAG: That looked fun! MO: And how about that bright orange stuff at the end of that stick? We call that: MO & LAG: fire. MO: Now I know what you’re thinking, “Fire. So what!? We got that!” Well, guess what, you privileged dorks! There was a time in history where no one had seen the fricking thing before! That’s what this story is all about. How humanity discovered fire, and how, for better or worse, it changed the world. LAG: Short version: good for us, absolutely devastating for everything else on earth. MO: But to tell the long version, we gotta take you back. Way back. Back to a time when…)`;

describe("speaker turns sharing a physical line", () => {
  for (const cast of [undefined, ["MO", "LAG"]]) {
    it("separates the complete musical excerpt, with cast=" + !!cast, () => {
      const lines = parseDialogueLines(block, "mixed", cast);
      const spoken = lines.filter(l => !l.isStageDirection);
      expect(spoken.map(l => l.character)).toEqual(["MO", "LAG", "MO", "MO & LAG", "MO", "LAG", "MO"]);
      expect(lines.filter(l => l.isStageDirection).map(l => l.dialogue)).toEqual([
        "(The entire cast leaps offstage, splitting off in every direction; left alone, in a spotlight center stage, are MO and LAG…)",
        "(to the audience)",
      ]);
      expect(spoken[3].dialogue).toBe("fire.");
      expect(spoken[4].dialogue).toContain("before! That’s what this story is all about.");
      expect(spoken[4].dialogue).toMatch(/it changed the world\.$/);
      expect(spoken[5].dialogue).toMatch(/^Short version: good for us/);
      expect(spoken[6].dialogue).toMatch(/when…\)$/);
      expect(lines.map(l => l.lineNumber)).toEqual(lines.map((_, i) => i));
    });
  }

  it("preserves turns through scene creation and script display", () => {
    const scene = createScene("project", "Scene 1", block);
    expect(extractSceneCharacters(scene.content)).toEqual(["LAG", "MO"]);
    const display = buildSceneDisplayContent(scene.content, scene.lines);
    expect(display).toContain("LAG\nThat looked fun!");
    expect(display).toContain("MO & LAG\nfire.");
    expect(scene.lines?.filter(l => !l.isStageDirection)).toHaveLength(7);
  });

  it("keeps explicit labels separate when reflowing wrapped text", () => {
    const text = "MO: We call that:\nLAG: fire.\nMO: It changed the world.";
    expect(normalizeSceneContent(text)).toBe(text);
  });

  it("does not split labels in quotes or parentheticals, or ordinary colons", () => {
    const text = 'MO: She said “LAG: hello.” (The sign says LAG: leave.) Short version: good. LAG: Right.';
    const lines = parseDialogueLines(text, "mixed", ["MO", "LAG"]);
    expect(lines.filter(l => !l.isStageDirection).map(l => l.character)).toEqual(["MO", "LAG"]);
    expect(lines[0].dialogue).toContain("“LAG: hello.”");
    const quoted = parseDialogueLines('MO: Read "LAG: hello" aloud. LAG: Okay.', "mixed");
    expect(quoted.map(l => l.character)).toEqual(["MO", "LAG"]);
  });

  it("recognizes multiword and combined names", () => {
    expect(parseDialogueLines("MRS. LANCASTER: Hello. FRED & DEBBIE: Hi!").map(l => l.character))
      .toEqual(["MRS. LANCASTER", "FRED & DEBBIE"]);
  });

  it("preserves original source indices for manual overrides after a split", () => {
    const map: Record<number, LineOverride> = {};
    const lines = parseDialogueLines("MO: Hello. LAG: Hi!\nThis is an action.", "mixed", undefined,
      { 1: { kind: "stage-direction" } }, map);
    expect(lines.map(l => l.character)).toEqual(["MO", "LAG", "[Stage Direction]"]);
    expect(map[1]).toEqual({ kind: "stage-direction" });
    expect(map[2]).toBeUndefined();
  });

  it("keeps a deliberate override on a collapsed source line authoritative", () => {
    const lines = parseDialogueLines("MO: Hello. LAG: Hi!", "mixed", undefined,
      { 0: { kind: "stage-direction" } });
    expect(lines).toHaveLength(1);
    expect(lines[0].isStageDirection).toBe(true);
  });

  it("retains wrapped spoken sentences beginning with That", () => {
    const lines = parseDialogueLines("MO: Nobody had seen it\nbefore! That’s what this story is all about, for better\nor worse, it changed the world.", "mixed");
    expect(lines).toHaveLength(1);
    expect(lines[0].character).toBe("MO");
    expect(lines[0].dialogue).toContain("before! That’s what");
  });
});
