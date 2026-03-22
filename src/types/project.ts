export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectContextType {
  projects: Project[];
  currentProjectId: string | null;
  createProject: (name: string, description?: string) => Project;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  selectProject: (id: string) => void;
  getCurrentProject: () => Project | null;
}
