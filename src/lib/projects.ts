import { Project } from "@/types/project";

export function generateProjectId(): string {
  return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createProject(
  name: string,
  description?: string
): Project {
  const now = new Date().toISOString();
  return {
    id: generateProjectId(),
    name,
    description,
    createdAt: now,
    updatedAt: now,
  };
}

export function renameProject(project: Project, newName: string): Project {
  return {
    ...project,
    name: newName,
    updatedAt: new Date().toISOString(),
  };
}

export function validateProjectName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: "Project name cannot be empty" };
  }
  if (name.length > 100) {
    return { valid: false, error: "Project name must be less than 100 characters" };
  }
  return { valid: true };
}

export function findProject(projects: Project[], id: string): Project | null {
  return projects.find((p) => p.id === id) || null;
}

export function sortProjectsByUpdated(projects: Project[]): Project[] {
  return [...projects].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
