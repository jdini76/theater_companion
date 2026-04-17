export interface Scene {
  id: string;
  projectId: string;
  title: string;
  content: string;
  description?: string;
  characters?: string[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedScene {
  title: string;
  content: string;
  characters?: string[];
  description?: string;
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
