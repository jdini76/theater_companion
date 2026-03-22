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
} from "@/lib/scenes";
import { Scene, ParsedScene } from "@/types/scene";

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

  describe("Scene Parsing - Format 3 (Separators)", () => {
    it("should parse with --- separators", () => {
      const text = `First scene content here.
Line two.

---

Second scene content.
Different location.`;
      const scenes = parseScenes(text);
      expect(scenes).toHaveLength(2);
      expect(scenes[0].content).toContain("First scene");
      expect(scenes[1].content).toContain("Second scene");
    });

    it("should parse with === separators", () => {
      const text = `Content one
===
Content two
===
Content three`;
      const scenes = parseScenes(text);
      expect(scenes).toHaveLength(3);
    });

    it("should parse with *** separators", () => {
      const text = `Scene one
***
Scene two`;
      const scenes = parseScenes(text);
      expect(scenes).toHaveLength(2);
    });

    it("should handle multiple separator styles", () => {
      const text = `First
---
Second
===
Third`;
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
        0
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
});
