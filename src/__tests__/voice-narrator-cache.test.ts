import { describe, it, expect } from "vitest";
import { isNarratorPlaybackLine } from "@/lib/voice";

describe("isNarratorPlaybackLine", () => {
  it("treats explicit narrator cues as narrator playback lines", () => {
    expect(
      isNarratorPlaybackLine({ character: "[Narrative]", isNarratorCue: true }),
    ).toBe(true);
  });

  it("treats plain narrative lines as narrator playback lines", () => {
    expect(isNarratorPlaybackLine({ character: "[Narrative]" })).toBe(true);
  });

  it("does not treat normal dialogue as narrator playback", () => {
    expect(isNarratorPlaybackLine({ character: "NORA" })).toBe(false);
  });
});
