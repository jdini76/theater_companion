export interface Scene {
  id: string;
  projectId: string;
  title: string;
  content: string;
  description?: string;
  characters?: string[];
  songs?: string[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedScene {
  title: string;
  content: string;
  characters?: string[];
  description?: string;
  songs?: string[];
}

/** A single entry in a Scenes & Songs table of contents */
export interface TocEntry {
  /** Scene number from the heading, e.g. "1", "2", "18" */
  sceneNumber: string;
  /** Scene location/title, e.g. "TV Studio", "Gobbler's Knob" */
  sceneTitle: string;
  /** Act this scene belongs to, e.g. "ACT ONE", "ACT TWO" */
  act: string;
  /** Song titles that appear within this scene */
  songs: string[];
  /** Page number from the TOC (if available) */
  page?: number;
}

/** Parsed result of a Scenes & Songs table of contents */
export interface ParsedToc {
  /** All scene entries with their associated songs */
  entries: TocEntry[];
  /** The raw text of the TOC section (for reference/debugging) */
  rawText: string;
  /** Lines range in the original text [startLine, endLine] */
  lineRange: [number, number];
}

export interface SceneContextType {
  scenes: Scene[];
  createScene: (
    projectId: string,
    title: string,
    content: string,
    description?: string,
  ) => Scene;
  createScenes: (
    projectId: string,
    scenesData: Array<{
      title: string;
      content: string;
      description?: string;
      characters?: string[];
      songs?: string[];
    }>,
  ) => Scene[];
  updateScene: (
    id: string,
    updates: Partial<Omit<Scene, "id" | "projectId" | "createdAt">>,
  ) => void;
  deleteScene: (id: string) => void;
  deleteScenes: (ids: string[]) => void;
  getProjectScenes: (projectId: string) => Scene[];
  reorderScenes: (projectId: string, sceneIds: string[]) => void;
}
