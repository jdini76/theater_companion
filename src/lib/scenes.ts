import { Scene, ParsedScene } from "@/types/scene";

export function generateSceneId(): string {
  return `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse text content into one or more scenes
 * Detects common scene delimiters and formats
 */
export function parseScenes(text: string): ParsedScene[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Try to detect if this is multi-scene or single scene
  const sceneMatches = detectSceneBreaks(text);

  if (sceneMatches.length > 1) {
    return parseMultipleScenes(text, sceneMatches);
  } else {
    // Single scene - use entire text
    return [
      {
        title: "Scene 1",
        content: text.trim(),
      },
    ];
  }
}

/**
 * Detect scene breaks in text
 */
interface SceneBreak {
  index: number;
  title: string;
  line: number;
}

function detectSceneBreaks(text: string): SceneBreak[] {
  const breaks: SceneBreak[] = [];
  const lines = text.split("\n");

  // Regex patterns for scene headers
  const sceneHeaderPattern =
    /^(?:SCENE|Scene|scene)\s+(?:\d+|[IVivx]+)\s*:?\s*(.*)$/;
  const actScenePattern =
    /^(?:ACT|Act|act)\s+(?:\d+|[IVivx]+)\s*,?\s*(?:SCENE|Scene|scene)\s+(?:\d+|[IVivx]+)\s*:?\s*(.*)$/;
  const separatorPattern = /^(?:---+|===+|\*{3,})\s*(.*)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match = null;
    let title = "";

    if ((match = line.match(sceneHeaderPattern))) {
      title = match[1].trim() || `Scene at line ${i + 1}`;
      breaks.push({ index: text.indexOf(line), title, line: i });
    } else if ((match = line.match(actScenePattern))) {
      title = match[3].trim() || `Act/Scene at line ${i + 1}`;
      breaks.push({ index: text.indexOf(line), title, line: i });
    } else if ((match = line.match(separatorPattern))) {
      // For separators, use the next line as title if available
      if (i + 1 < lines.length && lines[i + 1].trim()) {
        title = lines[i + 1].trim().substring(0, 100);
      } else {
        title = `Scene ${breaks.length + 1}`;
      }
      breaks.push({ index: text.indexOf(line), title, line: i });
    }
  }

  return breaks;
}

/**
 * Parse multiple scenes from text
 */
function parseMultipleScenes(text: string, breaks: SceneBreak[]): ParsedScene[] {
  const scenes: ParsedScene[] = [];

  for (let i = 0; i < breaks.length; i++) {
    const currentBreak = breaks[i];
    const nextBreak = breaks[i + 1];

    // Find the start of content (after the header line)
    const headerLineEnd = text.indexOf("\n", currentBreak.index);
    const contentStart =
      headerLineEnd !== -1 ? headerLineEnd + 1 : currentBreak.index;

    // Find the end (either next break or end of text)
    const contentEnd = nextBreak ? nextBreak.index : text.length;

    const content = text
      .substring(contentStart, contentEnd)
      .trim();

    if (content) {
      scenes.push({
        title: currentBreak.title,
        content,
      });
    }
  }

  return scenes;
}

/**
 * Create a Scene object from ParsedScene
 */
export function createScene(
  projectId: string,
  title: string,
  content: string,
  description?: string,
  order: number = 0
): Scene {
  const now = new Date().toISOString();
  return {
    id: generateSceneId(),
    projectId,
    title: title || "Untitled Scene",
    content,
    description,
    order,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Parse text input and create Scene objects
 */
export function createScenesFromInput(
  projectId: string,
  text: string
): Scene[] {
  const parsedScenes = parseScenes(text);
  return parsedScenes.map((scene, index) =>
    createScene(
      projectId,
      scene.title,
      scene.content,
      scene.description,
      index
    )
  );
}

/**
 * Update a scene with new values
 */
export function updateScene(
  scene: Scene,
  updates: Partial<Omit<Scene, "id" | "projectId" | "createdAt">>
): Scene {
  return {
    ...scene,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Validate scene title
 */
export function validateSceneTitle(title: string): {
  valid: boolean;
  error?: string;
} {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: "Scene title cannot be empty" };
  }
  if (title.length > 200) {
    return { valid: false, error: "Scene title must be less than 200 characters" };
  }
  return { valid: true };
}

/**
 * Validate scene content
 */
export function validateSceneContent(content: string): {
  valid: boolean;
  error?: string;
} {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: "Scene content cannot be empty" };
  }
  return { valid: true };
}

/**
 * Sort scenes by order
 */
export function sortScenesByOrder(scenes: Scene[]): Scene[] {
  return [...scenes].sort((a, b) => a.order - b.order);
}

/**
 * Reorder scenes
 */
export function reorderScenes(
  scenes: Scene[],
  sceneIds: string[]
): Scene[] {
  return scenes.map((scene) => {
    const newOrder = sceneIds.indexOf(scene.id);
    return newOrder !== -1 ? { ...scene, order: newOrder } : scene;
  });
}
