import { describe, expect, it } from "vitest";
import { normalizePdfExtractedText } from "@/lib/pdf-client";

describe("normalizePdfExtractedText", () => {
  it("removes soft hyphens and preserves screenplay-style line breaks", () => {
    const input = [
      "INT. AIRPORT - DAY",
      "",
      "The passeng-",
      "er crosses the terminal.",
      "",
      "JOHN",
      "I am here.",
    ].join("\n");

    const output = normalizePdfExtractedText(input);

    expect(output).toContain("The passenger crosses the terminal.");
    expect(output).toContain("JOHN\nI am here.");
    expect(output).not.toContain("passeng-");
  });

  it("normalizes non-breaking spaces and trims trailing whitespace", () => {
    const output = normalizePdfExtractedText("SCENE\u00a01\nLINE   \n");
    expect(output).toBe("SCENE 1\nLINE");
  });
});
