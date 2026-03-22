export interface Scene {
  id: string;
  projectId: string;
  title: string;
  content: string;
  description?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedScene {
  title: string;
  content: string;
  description?: string;
}

export interface SceneContextType {
  scenes: Scene[];
  createScene: (projectId: string, title: string, content: string, description?: string) => Scene;
  updateScene: (id: string, updates: Partial<Omit<Scene, 'id' | 'projectId' | 'createdAt'>>) => void;
  deleteScene: (id: string) => void;
  getProjectScenes: (projectId: string) => Scene[];
  reorderScenes: (projectId: string, sceneIds: string[]) => void;
}
