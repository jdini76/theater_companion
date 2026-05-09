export type ProductionType = "Film" | "Play" | "Musical";

export interface Project {
  id: string;
  name: string;
  description?: string;
  productionType: ProductionType;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectContextType {
  projects: Project[];
  currentProjectId: string | null;
  createProject: (
    name: string,
    description?: string,
    productionType?: ProductionType,
  ) => Project;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  selectProject: (id: string) => void;
  getCurrentProject: () => Project | null;
}
