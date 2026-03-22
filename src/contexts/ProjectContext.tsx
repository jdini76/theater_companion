"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { Project, ProjectContextType } from "@/types/project";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  createProject as createProjectUtil,
  renameProject as renameProjectUtil,
  findProject,
  validateProjectName,
} from "@/lib/projects";

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useLocalStorage<Project[]>("theater_projects", []);
  const [currentProjectId, setCurrentProjectId] = useLocalStorage<string | null>(
    "theater_current_project_id",
    null
  );

  const createProject = (name: string, description?: string): Project => {
    const validation = validateProjectName(name);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const newProject = createProjectUtil(name, description);
    setProjects([...projects, newProject]);
    
    // Automatically select the newly created project
    if (!currentProjectId) {
      setCurrentProjectId(newProject.id);
    }

    return newProject;
  };

  const renameProject = (id: string, newName: string): void => {
    const validation = validateProjectName(newName);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const project = findProject(projects, id);
    if (!project) {
      throw new Error(`Project with id ${id} not found`);
    }

    const updated = renameProjectUtil(project, newName);
    setProjects(projects.map((p) => (p.id === id ? updated : p)));
  };

  const deleteProject = (id: string): void => {
    const project = findProject(projects, id);
    if (!project) {
      throw new Error(`Project with id ${id} not found`);
    }

    // If deleting the current project, switch to another one
    if (currentProjectId === id) {
      const remaining = projects.filter((p) => p.id !== id);
      setCurrentProjectId(remaining.length > 0 ? remaining[0].id : null);
    }

    setProjects(projects.filter((p) => p.id !== id));
  };

  const selectProject = (id: string): void => {
    const project = findProject(projects, id);
    if (!project) {
      throw new Error(`Project with id ${id} not found`);
    }
    setCurrentProjectId(id);
  };

  const getCurrentProject = (): Project | null => {
    if (!currentProjectId) return null;
    return findProject(projects, currentProjectId);
  };

  const value: ProjectContextType = {
    projects,
    currentProjectId,
    createProject,
    renameProject,
    deleteProject,
    selectProject,
    getCurrentProject,
  };

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

export function useProjects(): ProjectContextType {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProjects must be used within a ProjectProvider");
  }
  return context;
}
