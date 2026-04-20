import { describe, it, expect } from "vitest";
import { extractSceneCharacters } from "@/lib/scenes";

/**
 * Representative scene from Groundhog Day with many character types:
 * main cast, multi-word names, numbered roles, combined speakers.
 */
const SCENE_TEXT = `BUSTER: Six more weeks of winter!
TOWNSPEOPLE: Awwwww. Yaaaaaaay!
PHIL: (to camera) February 2nd. Punxsutawney. Dawn.
LARRY: Got it.
RITA: Well!
PHIL: Thanks, guys.
SFX: Clock-tower chimes.
PHIL: Uh-I'm not sure I have time.
RITA: No big deal.
PHIL: Good. See you later.
PHIL:
FIVE, FOUR, THREE, TWO...
TOWNSPEOPLE:
ONE 2 3 4 5 6 SE-VEN 8 9 10 11 12
RITA: Hey. There you are.
BARTENDER BILLY: See you, Buster.
STORM CHASER 2: Greetings! Greetings!
STORM CHASER 1: Didn't you get his number?
STORM CHASER 2: No. He just changed the tire and left.
FRED: What's in the envelope?
DEBBIE: I don't know.
BARTENDER BILLY: Hey, Debbie.
DEBBIE: (to Bartender Billy) It's a wedding gift from Forecaster Phil himself!
FRED & DEBBIE: Wrestlemania!
MRS. LANCASTER: Rita? You're Rita? Perfect.
LARRY: Hey, Rita. Check it out.
BARTENDER BILLY: You mean Phil Connors? I think he's already inside.
MRS. LANCASTER: Well, let's get this party started!
DORIS:
GROUNDHOG, GROUNDHOG, GROUNDHOG DAY!
TOWNSPEOPLE:
GROUNDHOG DAY!
RITA: Incredible.`;

const EXPECTED_CHARACTERS = [
  "BARTENDER BILLY",
  "BUSTER",
  "DEBBIE",
  "DORIS",
  "FRED",
  "LARRY",
  "MRS. LANCASTER",
  "PHIL",
  "RITA",
  "STORM CHASER 1",
  "STORM CHASER 2",
  "TOWNSPEOPLE",
];

describe("extractSceneCharacters – comprehensive", () => {
  it("should find all characters without a cast list", () => {
    const chars = extractSceneCharacters(SCENE_TEXT);
    for (const name of EXPECTED_CHARACTERS) {
      expect(chars, `Missing: ${name}`).toContain(name);
    }
  });

  it("should only return cast-list matches when a cast list is provided", () => {
    const partialCast = ["PHIL", "RITA", "LARRY", "BUSTER", "FRED", "DEBBIE"];
    const chars = extractSceneCharacters(SCENE_TEXT, partialCast);
    // Only characters on the cast list (or resolved via first-name) are kept
    for (const name of partialCast) {
      expect(chars, `Missing: ${name}`).toContain(name);
    }
    // Non-cast characters like BARTENDER BILLY should NOT appear
    expect(chars).not.toContain("BARTENDER BILLY");
  });

  it("should resolve first-name abbreviations via cast list", () => {
    const cast = ["PHIL CONNORS", "RITA HANSON"];
    const chars = extractSceneCharacters(SCENE_TEXT, cast);
    // "PHIL" in the script should resolve to "PHIL CONNORS"
    expect(chars).toContain("PHIL CONNORS");
    expect(chars).toContain("RITA HANSON");
  });

  it("should not include SFX as a character", () => {
    const chars = extractSceneCharacters(SCENE_TEXT);
    expect(chars).not.toContain("SFX");
  });
});
