import { describe, it, expect } from "vitest";
import { parseCastList, extractCastNames, extractSceneCharacters } from "@/lib/scenes";
import { parseDialogueLines } from "@/lib/rehearsal";

const castPage = `CHARACTERS
●
Jemilla: The charismatic, motherly, and peaceful leader of the tribe
●
Zazzalil: A lazy but brilliant inventor whose experiments lead to the discovery of fire.
●
Mo: An older, experienced member of the tribe.
●
Lag: An older, less noble member of the tribe
Expedition Crew:
●
Ke: A supportive (though slightly ignorant) gatherer and loyal follower of Zazzalil
●
Er: A gatherer. A loyal follower of…anyone.
●
Ri: Another gatherer and follower.
●
Emberly: A member of the tribe who falls for Grunt.
●
Schwoopsie: A member of the tribe who struggles with the dangers of the world.
●
Smelly-Feet: A tribal member known for his questionable hygiene.
●
Ducker: A prominent tribe member and a hunter/thinker.
●
Chorn: The odd, socially awkward member of the tribe who communicates with limited vocabulary.
●
Tiblyn: A supportive member of the tribe.
●
Oogla: Tribe member and soloist
●
Mourk: Tribe member and soloist
●
Sniffs: Tribe member and soloist
●
Grunt: A physically imposing but sensitive outsider
Puppeteers
●
Snarl: A terrifying saber-toothed tiger and apex predator that hunts the tribe
●
Trunkell: A woolly mammoth who shares a bond with Emberly.
●
Duck: the source of tribe worship
Other Tribe
●
Clark
●
Kid 1
●
Kid 2
●
Claire
●
Nicolai
Ducker Disciples
Nut Collectors
Comedy Seekers`;

describe("cast pages with descriptions and flattened bullets", () => {
  it("extracts all 25 named roles and three ensembles without bullets or headings", () => {
    const result = parseCastList(castPage)!;
    expect(result.raw).toEqual([
      "Jemilla", "Zazzalil", "Mo", "Lag", "Ke", "Er", "Ri", "Emberly",
      "Schwoopsie", "Smelly-Feet", "Ducker", "Chorn", "Tiblyn", "Oogla",
      "Mourk", "Sniffs", "Grunt", "Snarl", "Trunkell", "Duck", "Clark",
      "Kid 1", "Kid 2", "Claire", "Nicolai", "Ducker Disciples",
      "Nut Collectors", "Comedy Seekers",
    ]);
    expect(result.characters.find(c => c.name === "Mo")).toEqual({
      name: "Mo", description: "An older, experienced member of the tribe.",
    });
    expect(result.characters.find(c => c.name === "Ke")?.group).toBe("Expedition Crew");
    expect(result.characters.find(c => c.name === "Duck")?.group).toBe("Puppeteers");
    expect(result.characters.find(c => c.name === "Nicolai")?.group).toBe("Other Tribe");
    expect(result.characters.find(c => c.name === "Ducker Disciples")?.group).toBeUndefined();
  });

  it("matches dialogue speakers against the imported master cast", () => {
    const names = extractCastNames(castPage);
    const dialogue = "MO: Hello!\nLAG: Hi!\nMO & LAG: fire.";
    expect(extractSceneCharacters(dialogue, names)).toEqual(["LAG", "MO"]);
    expect(parseDialogueLines(dialogue, "mixed", names).map(l => l.character))
      .toEqual(["MO", "LAG", "MO & LAG"]);
  });

  it("handles inline bullets, wrapped descriptions, colons, and duplicate names", () => {
    const result = parseCastList(`CHARACTERS
●Mo: An older member:
experienced and wise.
● Lag: A friend.
● MO: A repeated entry.
SCENE 1
MO: Hello!`)!;
    expect(result.raw).toEqual(["Mo", "Lag"]);
    expect(result.characters[0].description).toBe("An older member: experienced and wise.");
  });

  it("keeps ellipses in descriptions while skipping table-of-contents entries", () => {
    expect(parseCastList("CHARACTERS\n● Er: A follower of...anyone.\nIndex ...... 4")?.raw)
      .toEqual(["Er"]);
  });

  it("retains indented groups and plain names from existing formats", () => {
    const result = parseCastList("Cast of Characters\n• Experts\n  o Healer\n  o Doctor\nLarry")!;
    expect(result.characters).toEqual([
      { name: "Healer", group: "Experts" },
      { name: "Doctor", group: "Experts" },
      { name: "Larry" },
    ]);
    expect(parseCastList("CHARACTERS\nMo\nLag")?.raw).toEqual(["Mo", "Lag"]);
  });
});
