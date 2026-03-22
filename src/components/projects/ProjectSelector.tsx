"use client";

import React, { useState } from "react";
import { useProjects } from "@/contexts/ProjectContext";

export function ProjectSelector({
  onProjectSelected,
}: {
  onProjectSelected?: () => void;
}) {
  const { projects, currentProjectId, selectProject } = useProjects();
  const [isOpen, setIsOpen] = useState(false);

  const currentProject = projects.find((p) => p.id === currentProjectId);

  const handleSelect = (projectId: string) => {
    selectProject(projectId);
    setIsOpen(false);
    onProjectSelected?.();
  };

  if (projects.length === 0) {
    return (
      <div className="text-sm text-muted">
        No projects yet
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 bg-dark-input border border-dark rounded-lg hover:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-accent-cyan flex items-center gap-2 min-w-max text-light font-medium transition-colors"
      >
        <span className="truncate">
          {currentProject?.name || "Select a project"}
        </span>
        <span className="text-muted text-xs">▼</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-dark-input border border-dark rounded-lg shadow-2xl z-50 min-w-max max-w-sm">
          <div className="max-h-80 overflow-y-auto">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleSelect(project.id)}
                className={`w-full text-left px-4 py-2 hover:bg-dark-panel transition-colors ${
                  currentProjectId === project.id 
                    ? "bg-dark-panel text-accent-cyan font-semibold border-l-2 border-accent-cyan" 
                    : "text-light"
                }`}
              >
                {project.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
