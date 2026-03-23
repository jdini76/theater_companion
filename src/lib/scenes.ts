import { Scene, ParsedScene } from "@/types/scene";

/**
 * Input mode for scene parsing
 * - "single": Treat entire input as one scene
 * - "multiple": Detect and split multiple scenes automatically
 * - "auto": Auto-detect based on content
 */
export type SceneInputMode = "single" | "multiple" | "auto";

export interface ParseSceneOptions {
  mode?: SceneInputMode;
}

export interface DetectedScene {
  title: string;
  content: string;
  startLine: number;
  endLine: number;
}

export function generateSceneId(): string {
  return `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse text content into one or more scenes
 * Supports explicit input mode selection
 */
export function parseScenes(
  text: string,
  options?: ParseSceneOptions,
): ParsedScene[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const mode = options?.mode ?? "auto";

  // Single scene mode: return entire text as one scene
  if (mode === "single") {
    return [
      {
        title: "Scene 1",
        content: text.trim(),
      },
    ];
  }

  // Multiple or auto mode: detect scene breaks
  const detectedScenes = detectSceneBreaks(text);

  // In auto mode, if only one scene detected, return as single
  if (mode === "auto" && detectedScenes.length <= 1) {
    return [
      {
        title: "Scene 1",
        content: text.trim(),
      },
    ];
  }

  // Return detected scenes
  if (detectedScenes.length > 0) {
    return detectedScenes.map((scene) => ({
      title: scene.title,
      content: scene.content,
    }));
  }

  // Fallback if detection failed
  return [
    {
      title: "Scene 1",
      content: text.trim(),
    },
  ];
}

/**
 * Detect scene breaks in text using multiple patterns
 * Returns detected scenes with content and line ranges
 */
export function detectSceneBreaks(text: string): DetectedScene[] {
  const scenes: DetectedScene[] = [];
  const lines = text.split("\n");
  const breaks: Array<{ lineIndex: number; title: string }> = [];

  // Pattern 1: Scene headers (SCENE 1:, Scene 2, etc.)
  const sceneHeaderPattern =
    /^(?:SCENE|Scene|scene)\s+(\d+|[IVivx]+)\s*:?\s*(.*)$/;

  // Pattern 2: Act and Scene (ACT 1, SCENE 1 or ACT I SCENE I, etc.)
  const actScenePattern =
    /^(?:ACT|Act|act)\s+(\d+|[IVivx]+)(?:\s*,?\s*(?:SCENE|Scene|scene)\s+(\d+|[IVivx]+))?\s*:?\s*(.*)$/;

  // Pattern 3: Bracketed scene headers [SCENE 1] or [Scene I]
  const bracketedPattern =
    /^\[(?:SCENE|Scene|scene)\s+(\d+|[IVivx]+)\s*:?\s*(.*?)\]$/;

  // Pattern 4: Separator lines (---, ===, ***)
  const separatorPattern = /^(?:---+|===+|\*{3,})\s*(.*)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    let title = "";

    // Try pattern 1: SCENE N
    let match = trimmed.match(sceneHeaderPattern);
    if (match) {
      const sceneNum = match[1];
      const sceneTitle = match[2].trim();
      title = `Scene ${sceneNum}${sceneTitle ? ": " + sceneTitle : ""}`;
      breaks.push({ lineIndex: i, title });
      continue;
    }

    // Try pattern 2: ACT N [, SCENE M]
    match = trimmed.match(actScenePattern);
    if (match) {
      const actNum = match[1];
      const sceneNum = match[2];
      const sceneTitle = match[3] ? match[3].trim() : "";

      if (sceneNum) {
        title = `Act ${actNum}, Scene ${sceneNum}${sceneTitle ? ": " + sceneTitle : ""}`;
      } else {
        title = `Act ${actNum}${sceneTitle ? ": " + sceneTitle : ""}`;
      }
      breaks.push({ lineIndex: i, title });
      continue;
    }

    // Try pattern 3: [SCENE N]
    match = trimmed.match(bracketedPattern);
    if (match) {
      const sceneNum = match[1];
      const sceneTitle = match[2].trim();
      title = `Scene ${sceneNum}${sceneTitle ? ": " + sceneTitle : ""}`;
      breaks.push({ lineIndex: i, title });
      continue;
    }

    // Try pattern 4: Separator (---)
    // Use the next non-empty line as title if available
    match = trimmed.match(separatorPattern);
    if (match) {
      let nextTitle = match[1].trim();
      if (!nextTitle && i + 1 < lines.length) {
        nextTitle = lines[i + 1].trim().substring(0, 100);
      }
      if (!nextTitle) {
        nextTitle = `Scene ${breaks.length + 1}`;
      }
      breaks.push({ lineIndex: i, title: nextTitle });
      continue;
    }
  }

  // If no breaks detected, return empty array
  if (breaks.length === 0) {
    return [];
  }

  // Build scenes from detected breaks
  for (let i = 0; i < breaks.length; i++) {
    const currentBreak = breaks[i];
    const nextBreak = breaks[i + 1];

    // Find content start (skip the header line and blank lines after)
    let contentStartLine = currentBreak.lineIndex + 1;
    while (contentStartLine < lines.length && !lines[contentStartLine].trim()) {
      contentStartLine++;
    }

    // Find content end (at next break or end of text)
    let contentEndLine = nextBreak ? nextBreak.lineIndex : lines.length;

    // Trim trailing blank lines
    while (
      contentEndLine > contentStartLine &&
      !lines[contentEndLine - 1].trim()
    ) {
      contentEndLine--;
    }

    // Extract content
    const sceneContent = lines
      .slice(contentStartLine, contentEndLine)
      .join("\n")
      .trim();

    if (sceneContent) {
      scenes.push({
        title: currentBreak.title,
        content: sceneContent,
        startLine: currentBreak.lineIndex,
        endLine: contentEndLine,
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
  order: number = 0,
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
 * Parse text input and create Scene objects with explicit mode support
 */
export function createScenesFromInput(
  projectId: string,
  text: string,
  mode?: SceneInputMode,
): Scene[] {
  if (!text || text.trim().length === 0) {
    throw new Error("Scene content cannot be empty");
  }

  const parsedScenes = parseScenes(text, { mode });

  if (parsedScenes.length === 0) {
    throw new Error("Failed to parse scene content");
  }

  return parsedScenes.map((scene, index) =>
    createScene(
      projectId,
      scene.title,
      scene.content,
      scene.description,
      index,
    ),
  );
}

/**
 * Detect the number of scenes in text without parsing full content
 * Useful for deciding which mode UI to show
 */
export function detectSceneCount(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }

  const detected = detectSceneBreaks(text);
  return detected.length > 0 ? detected.length : 1;
}

/**
 * Update a scene with new values
 */
export function updateScene(
  scene: Scene,
  updates: Partial<Omit<Scene, "id" | "projectId" | "createdAt">>,
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
    return {
      valid: false,
      error: "Scene title must be less than 200 characters",
    };
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
export function reorderScenes(scenes: Scene[], sceneIds: string[]): Scene[] {
  return scenes.map((scene) => {
    const newOrder = sceneIds.indexOf(scene.id);
    return newOrder !== -1 ? { ...scene, order: newOrder } : scene;
  });
}
