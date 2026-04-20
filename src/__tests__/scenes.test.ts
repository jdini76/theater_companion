import { describe, it, expect, beforeEach } from "vitest";
import {
  parseScenes,
  createScene,
  updateScene,
  validateSceneTitle,
  validateSceneContent,
  sortScenesByOrder,
  reorderScenes,
  createScenesFromInput,
  generateSceneId,
  detectSceneCount,
  detectSceneBreaks,
  extractSceneCharacters,
  parseTOC,
  findSongsForScene,
  stripTocSection,
  parseCastList,
  extractCastNames,
} from "@/lib/scenes";
import { Scene, ParsedScene, ParsedToc } from "@/types/scene";

describe("Scene Management", () => {
  describe("Scene ID Generation", () => {
    it("should generate unique scene IDs", () => {
      const id1 = generateSceneId();
      const id2 = generateSceneId();
      expect(id1).toMatch(/^scene_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^scene_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe("Scene Parsing - Single Scene", () => {
    it("should parse plain text as single scene", () => {
      const text = "This is a simple scene.\nWith multiple lines.\nOf content.";
      const scenes = parseScenes(text);
      expect(scenes).toHaveLength(1);
      expect(scenes[0].title).toBe("Scene 1");
      expect(scenes[0].content).toBe(text);
    });

    it("should handle empty text", () => {
      const scenes = parseScenes("");
      expect(scenes).toHaveLength(0);
    });

    it("should handle whitespace only", () => {
      const scenes = parseScenes("   \n\n  \t  ");
      expect(scenes).toHaveLength(0);
    });
  });

  describe("Scene Parsing - Format 1 (Scene Headers)", () => {
    it("should parse SCENE X: format", () => {
      const text = `SCENE 1: Opening
Content of scene one.

SCENE 2: Development
Content of scene two.`;
      const scenes = parseScenes(text);
      expect(scenes).toHaveLength(2);
      expect(scenes[0].title).toContain("Opening");
      expect(scenes[1].title).toContain("Development");
    });

    it("should handle lowercase 'scene'", () => {
      const text = `scene 1: lowercase
Content one.

scene 2: also lowercase
Content two.`;
      const scenes = parseScenes(text);
      expect(scenes).toHaveLength(2);
    });

    it("should handle mixed case", () => {
      const text = `Scene 1: Title
Content.

SCENE 2: Another
More content.`;
      const scenes = parseScenes(text);
      expect(scenes).toHaveLength(2);
    });

    it("should handle Scene without colon", () => {
      const text = `SCENE 1 Opening
Content here.

SCENE 2 Closing
More content.`;
      const scenes = parseScenes(text);
      expect(scenes).toHaveLength(2);
    });

    it("should handle roman numerals", () => {
      const text = `SCENE I: First
Content.

SCENE II: Second
More content.

SCENE III: Third
Even more.`;
      const scenes = parseScenes(text);
      expect(scenes).toHaveLength(3);
    });
  });

  describe("Scene Parsing - Format 2 (Act/Scene)", () => {
    it("should parse ACT X, SCENE Y format", () => {
      const text = `ACT 1, SCENE 1: Meeting
Content of first scene.

ACT 1, SCENE 2: Conflict
Content of second scene.`;
      const scenes = parseScenes(text);
      expect(scenes).toHaveLength(2);
    });

    it("should handle lowercase act/scene", () => {
      const text = `act 1, scene 1: lowercase
Content.

act 2, scene 1: also lowercase
More content.`;
      const scenes = parseScenes(text);
      expect(scenes).toHaveLength(2);
    });
  });

  describe("Scene Parsing - Format 3 (Scene Number Heading)", () => {
    it("should parse #N - Title with hyphen", () => {
      const text = `#1 - TV Studio
PHIL: Hello.
DIRECTOR: Cut!

#2 - Gobbler's Knob
PHIL: We're here.`;
      const scenes = parseScenes(text);
      expect(scenes).toHaveLength(2);
      expect(scenes[0].content).toContain("PHIL: Hello");
      expect(scenes[1].content).toContain("We're here");
    });

    it("should parse #N – Title with en-dash", () => {
      const text = `#4 \u2013 B&B Parlor
MRS. LANCASTER: Good morning!

#5 - The Town
PHIL: Let's go.`;
      const scenes = parseScenes(text);
      expect(scenes).toHaveLength(2);
      expect(scenes[0].title).toContain("B&B Parlor");
      expect(scenes[1].title).toContain("The Town");
    });

    it("should extract scene title from heading", () => {
      const text = `#1 - TV Studio
Content here.`;
      const scenes = parseScenes(text, { mode: "multiple" });
      expect(scenes[0].title).toContain("TV Studio");
    });

    it("should handle multiple scenes with #N format", () => {
      const text = `#1 - Opening
Content one.

#2 - Middle
Content two.

#3 - Closing
Content three.`;
      const scenes = parseScenes(text);
      expect(scenes).toHaveLength(3);
    });
  });

  describe("Scene Creation", () => {
    it("should create a scene with all fields", () => {
      const scene = createScene(
        "project_123",
        "Test Scene",
        "Scene content here",
        "Description",
        0,
      );
      expect(scene.projectId).toBe("project_123");
      expect(scene.title).toBe("Test Scene");
      expect(scene.content).toBe("Scene content here");
      expect(scene.description).toBe("Description");
      expect(scene.order).toBe(0);
      expect(scene.id).toMatch(/^scene_/);
      expect(scene.createdAt).toBeDefined();
      expect(scene.updatedAt).toBeDefined();
    });

    it("should create scene without description", () => {
      const scene = createScene("project_123", "Title", "Content");
      expect(scene.description).toBeUndefined();
    });
  });

  describe("Scene Updates", () => {
    let scene: Scene;

    beforeEach(() => {
      scene = createScene("project_123", "Original", "Original content");
    });

    it("should update scene title", () => {
      const updated = updateScene(scene, { title: "Updated Title" });
      expect(updated.title).toBe("Updated Title");
      expect(updated.content).toBe(scene.content);
      expect(updated.updatedAt).not.toBe(scene.updatedAt);
    });

    it("should update scene content", () => {
      const updated = updateScene(scene, { content: "New content" });
      expect(updated.content).toBe("New content");
      expect(updated.title).toBe(scene.title);
    });

    it("should update multiple fields", () => {
      const updated = updateScene(scene, {
        title: "New Title",
        content: "New content",
        description: "New description",
      });
      expect(updated.title).toBe("New Title");
      expect(updated.content).toBe("New content");
      expect(updated.description).toBe("New description");
    });

    it("should preserve id and projectId", () => {
      const updated = updateScene(scene, { title: "Updated" });
      expect(updated.id).toBe(scene.id);
      expect(updated.projectId).toBe(scene.projectId);
      expect(updated.createdAt).toBe(scene.createdAt);
    });
  });

  describe("Validation", () => {
    describe("Title Validation", () => {
      it("should validate non-empty titles", () => {
        const result = validateSceneTitle("Valid Title");
        expect(result.valid).toBe(true);
      });

      it("should reject empty titles", () => {
        const result = validateSceneTitle("");
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should reject whitespace-only titles", () => {
        const result = validateSceneTitle("   ");
        expect(result.valid).toBe(false);
      });

      it("should reject titles over 200 characters", () => {
        const longTitle = "a".repeat(201);
        const result = validateSceneTitle(longTitle);
        expect(result.valid).toBe(false);
      });

      it("should accept titles with exactly 200 characters", () => {
        const maxTitle = "a".repeat(200);
        const result = validateSceneTitle(maxTitle);
        expect(result.valid).toBe(true);
      });
    });

    describe("Content Validation", () => {
      it("should validate non-empty content", () => {
        const result = validateSceneContent("Valid content");
        expect(result.valid).toBe(true);
      });

      it("should reject empty content", () => {
        const result = validateSceneContent("");
        expect(result.valid).toBe(false);
      });

      it("should reject whitespace-only content", () => {
        const result = validateSceneContent("   \n\n  ");
        expect(result.valid).toBe(false);
      });

      it("should allow long content", () => {
        const longContent = "a".repeat(10000);
        const result = validateSceneContent(longContent);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe("Scene Sorting & Reordering", () => {
    let scenes: Scene[];

    beforeEach(() => {
      scenes = [
        createScene("proj", "Scene 1", "Content 1", undefined, 2),
        createScene("proj", "Scene 2", "Content 2", undefined, 0),
        createScene("proj", "Scene 3", "Content 3", undefined, 1),
      ];
    });

    it("should sort scenes by order", () => {
      const sorted = sortScenesByOrder(scenes);
      expect(sorted[0].order).toBe(0);
      expect(sorted[1].order).toBe(1);
      expect(sorted[2].order).toBe(2);
    });

    it("should not mutate original array", () => {
      const original = [...scenes];
      sortScenesByOrder(scenes);
      expect(scenes).toEqual(original);
    });

    it("should reorder scenes by id list", () => {
      const ids = [scenes[1].id, scenes[2].id, scenes[0].id];
      const reordered = reorderScenes(scenes, ids);
      expect(reordered[0].order).toBe(0);
      expect(reordered[1].order).toBe(1);
      expect(reordered[2].order).toBe(2);
    });
  });

  describe("Create Scenes From Input", () => {
    it("should create multiple scenes from parsed input", () => {
      const text = `SCENE 1: First
Content one.

SCENE 2: Second
Content two.`;
      const scenes = createScenesFromInput("project_123", text);
      expect(scenes).toHaveLength(2);
      expect(scenes[0].projectId).toBe("project_123");
      expect(scenes[0].order).toBe(0);
      expect(scenes[1].order).toBe(1);
    });

    it("should create single scene from plain text", () => {
      const text = "Just some content";
      const scenes = createScenesFromInput("project_123", text);
      expect(scenes).toHaveLength(1);
      expect(scenes[0].title).toBe("Scene 1");
    });

    it("should set correct order for all scenes", () => {
      const text = `SCENE 1
Content

SCENE 2
Content

SCENE 3
Content`;
      const scenes = createScenesFromInput("project_123", text);
      expect(scenes.map((s: Scene) => s.order)).toEqual([0, 1, 2]);
    });
  });

  describe("Real-World Scenarios", () => {
    it("should handle a typical play script", () => {
      const script = `ACT 1, SCENE 1: The Castle
KING: Welcome to my castle!
KNIGHT: Thank you, Your Majesty.

ACT 1, SCENE 2: The Courtyard
KING: Show me the knights!
KNIGHT: Right away, sire!

ACT 2, SCENE 1: The Battlefield
KNIGHT: For glory!
SOLDIER: Charge!`;
      const scenes = parseScenes(script);
      expect(scenes.length).toBeGreaterThan(1);
      scenes.forEach((scene: ParsedScene) => {
        expect(scene.content.length).toBeGreaterThan(0);
      });
    });

    it("should handle a screenplay with multiple formats mixed", () => {
      const screenplay = `SCENE 1: Interior
Character A talks.

---

Scene Two: Exterior
Character B responds.

===

SCENE III: FINAL
Both characters together.`;
      const scenes = parseScenes(screenplay);
      expect(scenes.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Input Mode Selection", () => {
    const singleContent = `ROMEO: O Romeo wherefore art thou?
JULIET: 'Tis but thy name that is my enemy.`;

    const multiContent = `SCENE 1: The Garden
ROMEO: O Romeo wherefore art thou?

SCENE 2: The Balcony
JULIET: 'Tis but thy name that is my enemy.`;

    describe("Single Mode", () => {
      it("should treat entire input as one scene in single mode", () => {
        const scenes = parseScenes(multiContent, { mode: "single" });
        expect(scenes).toHaveLength(1);
        expect(scenes[0].title).toBe("Scene 1");
        expect(scenes[0].content).toContain("SCENE 1:");
        expect(scenes[0].content).toContain("SCENE 2:");
      });

      it("should preserve all content including headers in single mode", () => {
        const scenes = parseScenes(multiContent, { mode: "single" });
        expect(scenes[0].content).toContain("The Garden");
        expect(scenes[0].content).toContain("The Balcony");
      });
    });

    describe("Multiple Mode", () => {
      it("should detect and split multiple scenes in multiple mode", () => {
        const scenes = parseScenes(multiContent, { mode: "multiple" });
        expect(scenes.length).toBeGreaterThanOrEqual(2);
        expect(scenes[0].title).toContain("Scene 1");
        expect(scenes[1].title).toContain("Scene 2");
      });

      it("should strip headers from scene content in multiple mode", () => {
        const scenes = parseScenes(multiContent, { mode: "multiple" });
        expect(scenes[0].content).not.toContain("SCENE 1:");
        expect(scenes[1].content).not.toContain("SCENE 2:");
      });

      it("should return single scene if no breaks found in multiple mode", () => {
        const scenes = parseScenes(singleContent, { mode: "multiple" });
        expect(scenes).toHaveLength(1);
      });
    });

    describe("Auto Mode", () => {
      it("should return single scene if no breaks detected in auto mode", () => {
        const scenes = parseScenes(singleContent, { mode: "auto" });
        expect(scenes).toHaveLength(1);
      });

      it("should detect multiple scenes in auto mode", () => {
        const scenes = parseScenes(multiContent, { mode: "auto" });
        expect(scenes.length).toBeGreaterThanOrEqual(2);
      });

      it("should be used as default when mode is not specified", () => {
        const defaultScenes = parseScenes(multiContent);
        const autoScenes = parseScenes(multiContent, { mode: "auto" });
        expect(defaultScenes).toEqual(autoScenes);
      });
    });
  });

  describe("Scene Detection - Enhanced Patterns", () => {
    it("should detect bracketed scene headers", () => {
      const text = `[SCENE 1: The Garden]
ROMEO: Content

[SCENE 2: The Balcony]
JULIET: More content`;

      const scenes = parseScenes(text, { mode: "multiple" });
      expect(scenes.length).toBeGreaterThanOrEqual(2);
    });

    it("should detect lowercase bracketed headers", () => {
      const text = `[scene 1]
Content one

[scene 2]
Content two`;

      const scenes = parseScenes(text, { mode: "multiple" });
      expect(scenes.length).toBeGreaterThanOrEqual(2);
    });

    it("should detect multiple separator styles in same document", () => {
      const text = `Scene one
---
Scene two
===
Scene three
***
Scene four`;

      const scenes = parseScenes(text, { mode: "multiple" });
      expect(scenes.length).toBeGreaterThanOrEqual(3);
    });

    it("should preserve scene titles from all patterns", () => {
      const breaks = detectSceneBreaks(`SCENE 1: The Beginning\nContent`);
      expect(breaks.length).toBeGreaterThan(0);
      expect(breaks[0].title).toContain("1");
    });

    it("should handle scene headers with detailed titles", () => {
      const text = `SCENE 1: The Bedroom - A dark, cold morning
ROMEO: Where art thou?`;

      const scenes = parseScenes(text, { mode: "multiple" });
      expect(scenes.length).toBeGreaterThan(0);
      expect(scenes[0].title).toContain("dark");
    });
  });

  describe("Multiline Dialogue in Multiple Scenes", () => {
    it("should preserve multiline dialogue across multiple scenes", () => {
      const text = `SCENE 1: First
ROMEO: O Romeo wherefore art thou?
  Why must thou be Romeo?
  Deny thy father!

SCENE 2: Second
JULIET: What's in a name?
  That which we call a rose
  By any other name would smell as sweet.`;

      const scenes = parseScenes(text, { mode: "multiple" });
      expect(scenes.length).toBeGreaterThanOrEqual(2);
      // Content should preserve multiline structure
      expect(scenes[0].content).toContain("wherefore");
      expect(scenes[1].content).toContain("rose");
    });

    it("should handle indented multiline dialogue after headers", () => {
      const text = `SCENE 1
ROMEO: First line
  Second line
  Third line`;

      const scenes = parseScenes(text, { mode: "single" });
      expect(scenes[0].content).toContain("First line");
      expect(scenes[0].content).toContain("Second line");
    });

    it("should handle stage directions between multiline dialogue", () => {
      const text = `SCENE 1
ROMEO: O Romeo!
  Wherefore art thou?
[pauses]
  Actually, never mind.`;

      const scenes = parseScenes(text, { mode: "single" });
      expect(scenes[0].content).toContain("pauses");
    });
  });

  describe("Error Handling & Edge Cases", () => {
    it("should throw error for empty input in createScenesFromInput", () => {
      expect(() => createScenesFromInput("proj_1", "")).toThrow();
    });

    it("should throw error for whitespace-only input in createScenesFromInput", () => {
      expect(() => createScenesFromInput("proj_1", "   \n\n  ")).toThrow();
    });

    it("should handle malformed headers gracefully", () => {
      const text = `Scene: Missing number
ROMEO: Content here`;

      // Should not crash
      const scenes = parseScenes(text, { mode: "single" });
      expect(scenes).toBeDefined();
      expect(scenes.length).toBeGreaterThan(0);
    });

    it("should skip empty scenes between breaks", () => {
      const text = `SCENE 1: First
ROMEO: Text

SCENE 2: 

SCENE 3: Third
JULIET: More text`;

      const scenes = parseScenes(text, { mode: "multiple" });

      // Should only have scenes with content
      expect(scenes.every((s) => s.content.trim().length > 0)).toBe(true);
    });

    it("should handle scenes with only stage directions", () => {
      const text = `SCENE 1
[Lights dim]
[Curtain rises]`;

      const scenes = parseScenes(text, { mode: "multiple" });
      expect(scenes.length).toBeGreaterThan(0);
    });

    it("should handle mixed line endings (CRLF and LF)", () => {
      const text = `SCENE 1\r\nROMEO: Text here\n\nSCENE 2\r\nJULIET: More text`;

      const scenes = parseScenes(text, { mode: "multiple" });
      expect(scenes.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle very long scene titles", () => {
      const longTitle = "A".repeat(200);
      const text = `SCENE 1: ${longTitle}
Content`;

      const scenes = parseScenes(text, { mode: "multiple" });
      expect(scenes.length).toBeGreaterThan(0);
    });

    it("should handle scenes with special characters in titles", () => {
      const text = `SCENE 1: Room @ 3 o'clock w/ Romeo & Juliet
ROMEO: Content`;

      const scenes = parseScenes(text, { mode: "multiple" });
      expect(scenes.length).toBeGreaterThan(0);
    });
  });

  describe("detectSceneCount", () => {
    it("should return 1 for content without scene breaks", () => {
      const count = detectSceneCount(`ROMEO: O Romeo
JULIET: What's in a name?`);
      expect(count).toBe(1);
    });

    it("should return 0 for empty input", () => {
      expect(detectSceneCount("")).toBe(0);
    });

    it("should return 0 for whitespace-only input", () => {
      expect(detectSceneCount("   \n\n  \t")).toBe(0);
    });

    it("should detect multiple scenes accurately", () => {
      const text = `SCENE 1: First
Content

SCENE 2: Second
More

SCENE 3: Third
Even more`;

      const count = detectSceneCount(text);
      expect(count).toBeGreaterThanOrEqual(3);
    });

    it("should count separator-based scenes", () => {
      const text = `First\n---\nSecond\n===\nThird`;

      const count = detectSceneCount(text);
      expect(count).toBeGreaterThanOrEqual(2);
    });
  });

  describe("detectSceneBreaks - Detailed Analysis", () => {
    it("should return empty array for no breaks", () => {
      const breaks = detectSceneBreaks(`ROMEO: Just text
JULIET: No headers`);

      expect(breaks).toEqual([]);
    });

    it("should return DetectedScene objects with line ranges", () => {
      const text = `SCENE 1: First
Content here

SCENE 2: Second
More content`;

      const breaks = detectSceneBreaks(text);

      if (breaks.length > 0) {
        expect(breaks[0]).toHaveProperty("title");
        expect(breaks[0]).toHaveProperty("startLine");
        expect(breaks[0]).toHaveProperty("endLine");
      }
    });

    it("should preserve special formatting in titles", () => {
      const text = `SCENE 1: "The Room" - Midnight
Content`;

      const breaks = detectSceneBreaks(text);

      if (breaks.length > 0) {
        expect(breaks[0].title).toContain("Room");
      }
    });
  });

  describe("Integration: FullWorkflow", () => {
    it("should support complete single-to-multi workflow", () => {
      const input = `SCENE 1: Opening
ROMEO: Hello!

SCENE 2: Closing
JULIET: Goodbye!`;

      // Single mode
      const single = parseScenes(input, { mode: "single" });
      expect(single).toHaveLength(1);

      // Multiple mode
      const multi = parseScenes(input, { mode: "multiple" });
      expect(multi.length).toBeGreaterThanOrEqual(2);

      // Auto mode (should match multiple)
      const auto = parseScenes(input, { mode: "auto" });
      expect(auto.length).toBe(multi.length);

      // Create scenes
      const scenes = createScenesFromInput("proj", input, "multiple");
      expect(scenes.length).toBeGreaterThanOrEqual(2);
      expect(scenes[0].order).toBe(0);
      expect(scenes[1].order).toBe(1);
    });

    it("should handle title editing workflow", () => {
      const input = `SCENE 1
Content

SCENE 2
More content`;

      // Parse scenes
      const scenes = createScenesFromInput("proj", input, "multiple");

      // Simulate title editing
      const edited = scenes.map((s, i) => ({
        ...s,
        title: `Custom Scene ${i + 1}`,
      }));

      expect(edited[0].title).toBe("Custom Scene 1");
      expect(edited[1].title).toBe("Custom Scene 2");
    });

    it("should preserve scene integrity through entire pipeline", () => {
      const input = `SCENE 1: Original Title
ROMEO: Line one
  Line continuation
[stage direction]
JULIET: Response`;

      const scenes = createScenesFromInput("proj", input, "single");

      expect(scenes).toHaveLength(1);
      expect(scenes[0].id).toMatch(/^scene_/);
      expect(scenes[0].content).toContain("ROMEO");
      expect(scenes[0].content).toContain("continuation");
    });
  });

  describe("Act Context Tracking", () => {
    it("should prepend act to scene titles when act appears on separate line", () => {
      const text = `ACT 1
Scene 1: The Garden
ROMEO: Hello!

Scene 2: The Balcony
JULIET: Good night!

ACT 2
Scene 1: The Street
MERCUTIO: Fight!

Scene 2: The Tomb
ROMEO: Farewell!`;
      const scenes = parseScenes(text);
      expect(scenes).toHaveLength(4);
      expect(scenes[0].title).toBe("Act 1, Scene 1: The Garden");
      expect(scenes[1].title).toBe("Act 1, Scene 2: The Balcony");
      expect(scenes[2].title).toBe("Act 2, Scene 1: The Street");
      expect(scenes[3].title).toBe("Act 2, Scene 2: The Tomb");
    });

    it("should handle word-form acts (ACT ONE, ACT TWO)", () => {
      const text = `ACT ONE
Scene 1: Opening
Content here.

Scene 2: Middle
More content.

ACT TWO
Scene 1: Climax
Exciting content.`;
      const scenes = parseScenes(text);
      expect(scenes).toHaveLength(3);
      expect(scenes[0].title).toBe("Act 1, Scene 1: Opening");
      expect(scenes[1].title).toBe("Act 1, Scene 2: Middle");
      expect(scenes[2].title).toBe("Act 2, Scene 1: Climax");
    });

    it("should not prepend act when no act context exists", () => {
      const text = `Scene 1: First
Content one.

Scene 2: Second
Content two.`;
      const scenes = parseScenes(text);
      expect(scenes).toHaveLength(2);
      expect(scenes[0].title).toBe("Scene 1: First");
      expect(scenes[1].title).toBe("Scene 2: Second");
    });

    it("should keep combined ACT/SCENE format intact", () => {
      const text = `ACT 1, SCENE 1: Meeting
Content one.

ACT 1, SCENE 2: Conflict
Content two.

ACT 2, SCENE 1: Resolution
Content three.`;
      const scenes = parseScenes(text);
      expect(scenes).toHaveLength(3);
      expect(scenes[0].title).toBe("Act 1, Scene 1: Meeting");
      expect(scenes[1].title).toBe("Act 1, Scene 2: Conflict");
      expect(scenes[2].title).toBe("Act 2, Scene 1: Resolution");
    });

    it("should apply act context to bracketed scenes", () => {
      const text = `ACT 1
[SCENE 1: Palace]
KING: Welcome!

[SCENE 2: Courtyard]
KNIGHT: Ready!

ACT 2
[SCENE 1: Battlefield]
SOLDIER: Charge!`;
      const scenes = parseScenes(text);
      expect(scenes).toHaveLength(3);
      expect(scenes[0].title).toBe("Act 1, Scene 1: Palace");
      expect(scenes[1].title).toBe("Act 1, Scene 2: Courtyard");
      expect(scenes[2].title).toBe("Act 2, Scene 1: Battlefield");
    });

    it("should handle prologue before first act", () => {
      const text = `Prologue: The Beginning
Narrator speaks.

ACT 1
Scene 1: First Scene
Content here.`;
      const scenes = parseScenes(text);
      expect(scenes).toHaveLength(2);
      expect(scenes[0].title).toBe("Prologue: The Beginning");
      expect(scenes[1].title).toBe("Act 1, Scene 1: First Scene");
    });

    it("should carry act context from combined format to standalone scenes", () => {
      const text = `ACT 2, SCENE 1: Opening of Act Two
Content one.

Scene 2: Continuation
Content two.`;
      const scenes = parseScenes(text);
      expect(scenes).toHaveLength(2);
      expect(scenes[0].title).toBe("Act 2, Scene 1: Opening of Act Two");
      expect(scenes[1].title).toBe("Act 2, Scene 2: Continuation");
    });
  });

  describe("extractSceneCharacters", () => {
    it("should extract unique character names from colon-format dialogue", () => {
      const content = `ROMEO: Wherefore art thou?
JULIET: I am here.
ROMEO: My love!`;
      const chars = extractSceneCharacters(content);
      expect(chars).toEqual(["JULIET", "ROMEO"]);
    });

    it("should split ampersand groups into individual characters", () => {
      const content = `FRED & DEBBIE: Let's dance!
FRED: One more time.`;
      const chars = extractSceneCharacters(content);
      expect(chars).toEqual(["DEBBIE", "FRED"]);
    });

    it("should split comma-separated groups into individual characters", () => {
      const content = `MRS. LANCASTER, NED & CHUBBY MAN: Welcome!
NED: Hello!`;
      const chars = extractSceneCharacters(content);
      expect(chars).toEqual(["CHUBBY MAN", "MRS. LANCASTER", "NED"]);
    });

    it("should exclude ALL as a character", () => {
      const content = `ROMEO: Hello.
ALL: Goodbye!
JULIET: Wait.`;
      const chars = extractSceneCharacters(content);
      expect(chars).toEqual(["JULIET", "ROMEO"]);
    });

    it("should exclude EVERYONE and ENSEMBLE", () => {
      const content = `PHIL: Good morning.
EVERYONE: Good morning, Phil!
ENSEMBLE: Welcome to Punxsutawney!`;
      const chars = extractSceneCharacters(content);
      expect(chars).toEqual(["PHIL"]);
    });

    it("should not include stage directions or narrative", () => {
      const content = `ROMEO: Hello.
(They embrace)
[Thunder sounds]
JULIET: My love.`;
      const chars = extractSceneCharacters(content);
      expect(chars).toEqual(["JULIET", "ROMEO"]);
    });

    it("should return empty array for content with no dialogue", () => {
      const content = `(The stage is dark)
[Lights come up slowly]`;
      const chars = extractSceneCharacters(content);
      expect(chars).toEqual([]);
    });

    it("should return sorted unique list", () => {
      const content = `ZARA: First.
ANNA: Second.
MIKE: Third.
ANNA: Fourth.
ZARA: Fifth.`;
      const chars = extractSceneCharacters(content);
      expect(chars).toEqual(["ANNA", "MIKE", "ZARA"]);
    });
  });

  describe("parseScenes with characters", () => {
    it("should include characters in parsed scenes", () => {
      const text = `SCENE 1: The Garden
ROMEO: O Romeo!
JULIET: What's in a name?

SCENE 2: The Balcony
NURSE: My lady!
JULIET: Coming!`;
      const scenes = parseScenes(text);
      expect(scenes).toHaveLength(2);
      expect(scenes[0].characters).toEqual(["JULIET", "ROMEO"]);
      expect(scenes[1].characters).toEqual(["JULIET", "NURSE"]);
    });

    it("should include characters for single scene mode", () => {
      const text = `ROMEO: Hello.
JULIET: Hi.`;
      const scenes = parseScenes(text, { mode: "single" });
      expect(scenes).toHaveLength(1);
      expect(scenes[0].characters).toEqual(["JULIET", "ROMEO"]);
    });
  });

  // ────────────────────────────────────────
  // Scenes & Songs TOC Parser Tests
  // ────────────────────────────────────────

  describe("parseTOC", () => {
    const groundhogTOC = `Groundhog Day - The Musical

Scenes & Songs

ACT ONE

#1 - TV Studio ........... 7
FANFARE FOR THE COMMON GROUNDHOG ........... 7
#2 - Gobbler's Knob ........... 12
THERE WILL BE SUN ........... 15
#3 - The Tip Top Cafe ........... 20
SMALL TOWN USA ........... 22
#4 - Cherry Street Inn ........... 28
#5 - Gobbler's Knob ........... 32
ONE DAY ........... 35
#6 - Around Town ........... 38
PLAYING NANCY ........... 40

ACT TWO

#7 - Gobbler's Knob ........... 45
IF I HAD MY TIME AGAIN ........... 48
#8 - Around Town (Scenes of Kindness) ........... 52
#9 - Cherry Street Inn ........... 58
SEEING YOU ........... 60

Cast of Characters
PHIL CONNORS - a weatherman`;

    it("should parse a full TOC section", () => {
      const result = parseTOC(groundhogTOC);
      expect(result).not.toBeNull();
      expect(result!.entries).toHaveLength(9);
    });

    it("should extract scene numbers and titles", () => {
      const result = parseTOC(groundhogTOC)!;
      expect(result.entries[0].sceneNumber).toBe("1");
      expect(result.entries[0].sceneTitle).toBe("TV Studio");
      expect(result.entries[1].sceneNumber).toBe("2");
      expect(result.entries[1].sceneTitle).toBe("Gobbler's Knob");
    });

    it("should associate songs with their parent scene", () => {
      const result = parseTOC(groundhogTOC)!;
      // Scene #1 has FANFARE
      expect(result.entries[0].songs).toEqual([
        "FANFARE FOR THE COMMON GROUNDHOG",
      ]);
      // Scene #2 has THERE WILL BE SUN
      expect(result.entries[1].songs).toEqual(["THERE WILL BE SUN"]);
      // Scene #4 has no songs
      expect(result.entries[3].songs).toEqual([]);
    });

    it("should track act assignments", () => {
      const result = parseTOC(groundhogTOC)!;
      // First 6 scenes are ACT ONE
      expect(result.entries[0].act).toBe("ACT ONE");
      expect(result.entries[5].act).toBe("ACT ONE");
      // Scenes 7-9 are ACT TWO
      expect(result.entries[6].act).toBe("ACT TWO");
      expect(result.entries[8].act).toBe("ACT TWO");
    });

    it("should extract page numbers", () => {
      const result = parseTOC(groundhogTOC)!;
      expect(result.entries[0].page).toBe(7);
      expect(result.entries[2].page).toBe(20);
      expect(result.entries[8].page).toBe(58);
    });

    it("should stop parsing at Cast of Characters", () => {
      const result = parseTOC(groundhogTOC)!;
      // Should not include "PHIL CONNORS" as a song
      const allSongs = result.entries.flatMap((e) => e.songs);
      expect(allSongs).not.toContain("PHIL CONNORS");
    });

    it("should store raw text and line range", () => {
      const result = parseTOC(groundhogTOC)!;
      expect(result.rawText).toContain("Scenes & Songs");
      expect(result.lineRange[0]).toBeGreaterThanOrEqual(0);
      expect(result.lineRange[1]).toBeGreaterThan(result.lineRange[0]);
    });

    it("should return null for text without a TOC section", () => {
      const text = `SCENE 1: The Garden
ROMEO: O Romeo!
JULIET: What's in a name?`;
      expect(parseTOC(text)).toBeNull();
    });

    it("should return null for empty text", () => {
      expect(parseTOC("")).toBeNull();
      expect(parseTOC("  \n\n  ")).toBeNull();
    });

    it("should handle TOC with 'Scenes and Songs' heading", () => {
      const text = `Scenes and Songs

ACT ONE
#1 - Opening ........... 5
OVERTURE ........... 5`;
      const result = parseTOC(text);
      expect(result).not.toBeNull();
      expect(result!.entries).toHaveLength(1);
      expect(result!.entries[0].songs).toEqual(["OVERTURE"]);
    });

    it("should handle scenes with multiple songs", () => {
      const text = `Scenes & Songs

#1 - The Ballroom ........... 10
WELCOME DANCE ........... 10
MIDNIGHT WALTZ ........... 14
THE FINAL BOW ........... 18`;
      const result = parseTOC(text);
      expect(result).not.toBeNull();
      expect(result!.entries[0].songs).toHaveLength(3);
      expect(result!.entries[0].songs).toEqual([
        "WELCOME DANCE",
        "MIDNIGHT WALTZ",
        "THE FINAL BOW",
      ]);
    });
  });

  describe("findSongsForScene", () => {
    let toc: ParsedToc;

    beforeEach(() => {
      toc = {
        entries: [
          {
            sceneNumber: "1",
            sceneTitle: "TV Studio",
            act: "ACT ONE",
            songs: ["FANFARE FOR THE COMMON GROUNDHOG"],
            page: 7,
          },
          {
            sceneNumber: "2",
            sceneTitle: "Gobbler's Knob",
            act: "ACT ONE",
            songs: ["THERE WILL BE SUN"],
            page: 12,
          },
          {
            sceneNumber: "3",
            sceneTitle: "The Tip Top Cafe",
            act: "ACT ONE",
            songs: ["SMALL TOWN USA"],
            page: 20,
          },
        ],
        rawText: "",
        lineRange: [0, 10],
      };
    });

    it("should find songs by matching scene title", () => {
      expect(findSongsForScene(toc, "TV Studio")).toEqual([
        "FANFARE FOR THE COMMON GROUNDHOG",
      ]);
    });

    it("should find songs with scene number in title", () => {
      expect(findSongsForScene(toc, "#1 - TV Studio")).toEqual([
        "FANFARE FOR THE COMMON GROUNDHOG",
      ]);
    });

    it("should return empty array for non-matching title", () => {
      expect(findSongsForScene(toc, "Unknown Scene")).toEqual([]);
    });

    it("should match case-insensitively", () => {
      expect(findSongsForScene(toc, "tv studio")).toEqual([
        "FANFARE FOR THE COMMON GROUNDHOG",
      ]);
    });
  });

  describe("parseTOC – heading variants", () => {
    it("should detect TOC when show title precedes heading", () => {
      const text = `Groundhog Day Scenes & Songs

ACT ONE
#1 - TV Studio ........... 7
FANFARE ........... 7`;
      const result = parseTOC(text);
      expect(result).not.toBeNull();
      expect(result!.entries).toHaveLength(1);
      expect(result!.entries[0].songs).toEqual(["FANFARE"]);
    });

    it("should detect SCENES AND SONGS (all caps, word 'and')", () => {
      const text = `SCENES AND SONGS

#1 - Opening ........... 5`;
      const result = parseTOC(text);
      expect(result).not.toBeNull();
    });
  });

  describe("stripTocSection", () => {
    it("should blank TOC lines from text", () => {
      const text = `Title Page

Scenes & Songs

ACT ONE
#1 - TV Studio ........... 7
FANFARE ........... 7

Cast of Characters
PHIL - a weatherman

#1 - TV Studio
PHIL: Good morning!`;
      const toc = parseTOC(text);
      expect(toc).not.toBeNull();
      const stripped = stripTocSection(text, toc!);
      // TOC lines should be blanked
      expect(stripped).not.toContain("Scenes & Songs");
      expect(stripped).not.toContain("FANFARE ........... 7");
      // Non-TOC content should remain
      expect(stripped).toContain("Title Page");
      expect(stripped).toContain("Cast of Characters");
      expect(stripped).toContain("PHIL: Good morning!");
    });

    it("should not strip the entire document when TOC has no end heading", () => {
      const text = `Scenes & Songs

#1 - Opening ........... 5
OVERTURE ........... 5

#1 - Opening
PHIL: Hello world.`;
      const toc = parseTOC(text);
      expect(toc).not.toBeNull();
      const stripped = stripTocSection(text, toc!);
      // The actual scene content must survive
      expect(stripped).toContain("PHIL: Hello world.");
    });
  });

  describe("detectSceneBreaks – TOC immunity", () => {
    it("should not treat TOC entries with dot leaders as scene breaks", () => {
      const text = `Scenes & Songs

ACT ONE
#1 - TV Studio ........... 7
FANFARE FOR THE COMMON GROUNDHOG ........... 7
#2 - Gobbler's Knob ........... 12
THERE WILL BE SUN ........... 15

ACT TWO
#7 - Gobbler's Knob ........... 45

Cast of Characters
PHIL - a weatherman

#1 - TV Studio
PHIL: Good morning, Punxsutawney!

#2 - Gobbler's Knob
BUSTER: Six more weeks of winter!`;
      const breaks = detectSceneBreaks(text);
      // Should only detect the real scenes (#1 and #2 without dot leaders),
      // not the TOC entries
      const titles = breaks.map((b) => b.title);
      expect(titles.every((t) => !t.includes("....."))).toBe(true);
      expect(breaks.length).toBe(2);
      expect(titles[0]).toContain("TV Studio");
      expect(titles[1]).toContain("Gobbler's Knob");
    });
  });

  describe("parseCastList – bullet variants", () => {
    const castPage = `Cast of Characters

•Buster
•Larry
•Experts
 o Healer
 o Naturopath
 o Psychiatric Pharmacologist
 o Scientologist
 o AA Person
 o Reverend
• At the Bar
  o Ralph
  o Gus
  o Barflies
•In the Parlor
  o Chubby Man
  o Mrs. Mabel Lancaster`;

    it("should strip bullet points from character names", () => {
      const result = parseCastList(castPage);
      expect(result).not.toBeNull();
      const names = result!.raw;
      // No name should start with a bullet character
      for (const name of names) {
        expect(name, `"${name}" has leading bullet`).not.toMatch(
          /^[•\-\*▪►◦·‣⁃]/,
        );
      }
    });

    it("should identify group headings and not include them as characters", () => {
      const result = parseCastList(castPage);
      expect(result).not.toBeNull();
      const names = result!.raw;
      // Group headings should NOT be in the character list
      expect(names).not.toContain("Experts");
      expect(names).not.toContain("At the Bar");
      expect(names).not.toContain("In the Parlor");
    });

    it("should extract all individual characters", () => {
      const result = parseCastList(castPage);
      expect(result).not.toBeNull();
      const names = result!.raw;
      expect(names).toContain("Buster");
      expect(names).toContain("Larry");
      expect(names).toContain("Healer");
      expect(names).toContain("Naturopath");
      expect(names).toContain("Psychiatric Pharmacologist");
      expect(names).toContain("Scientologist");
      expect(names).toContain("AA Person");
      expect(names).toContain("Reverend");
      expect(names).toContain("Ralph");
      expect(names).toContain("Gus");
      expect(names).toContain("Barflies");
      expect(names).toContain("Chubby Man");
      expect(names).toContain("Mrs. Mabel Lancaster");
    });

    it("should assign groups to sub-items", () => {
      const result = parseCastList(castPage);
      expect(result).not.toBeNull();
      const healer = result!.characters.find((c) => c.name === "Healer");
      expect(healer?.group).toBe("Experts");
      const ralph = result!.characters.find((c) => c.name === "Ralph");
      expect(ralph?.group).toBe("At the Bar");
      const chubby = result!.characters.find((c) => c.name === "Chubby Man");
      expect(chubby?.group).toBe("In the Parlor");
    });

    it("should handle bullet with no space (•Name)", () => {
      const text = `Cast of Characters
•Phil
•Rita`;
      const result = parseCastList(text);
      expect(result).not.toBeNull();
      expect(result!.raw).toEqual(["Phil", "Rita"]);
    });
  });
});
