"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjects } from "@/contexts/ProjectContext";
import { Project } from "@/types/project";
import { Button } from "@/components/ui/Button";

export function ProjectListItem({
  project,
  isSelected,
  onSelect,
  onRename,
  onDelete,
}: {
  project: Project;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(project.name);
  const [error, setError] = useState("");

  const handleSave = () => {
    try {
      if (!editedName.trim()) {
        setError("Project name cannot be empty");
        return;
      }
      onRename(project.id, editedName);
      setIsEditing(false);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to rename project"
      );
    }
  };

  const handleDelete = () => {
    if (
      window.confirm(
        `Are you sure you want to delete "${project.name}"? This action cannot be undone.`
      )
    ) {
      onDelete(project.id);
    }
  };

  const createdDate = new Date(project.createdAt).toLocaleDateString();

  return (
    <div
      className={`p-4 border rounded-xl cursor-pointer transition-all ${
        isSelected
          ? "bg-dark-panel-2 border-accent-cyan shadow-lg shadow-accent-cyan/20"
          : "bg-dark-input border-dark hover:border-accent-cyan hover:bg-dark-panel"
      }`}
      onClick={() => {
        console.log("Project clicked:", project.id, project.name);
        if (!isEditing) {
          console.log("Calling onSelect with:", project.id);
          onSelect(project.id);
          // Redirect to home page after selection
          router.push("/");
        }
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-2">
              <input
                autoFocus
                type="text"
                value={editedName}
                onChange={(e) => {
                  setEditedName(e.target.value);
                  setError("");
                }}
                className="w-full px-3 py-2 border border-accent-cyan bg-dark-input text-light rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-cyan"
              />
              {error && (
                <p className="text-sm text-warn-amber">{error}</p>
              )}
            </div>
          ) : (
            <div>
              <h3 className="font-semibold text-light text-lg">{project.name}</h3>
              {project.description && (
                <p className="text-sm text-muted mt-1">
                  {project.description}
                </p>
              )}
              <p className="text-xs text-muted/60 mt-2">Created: {createdDate}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 ml-4">
          {isEditing ? (
            <>
              <Button
                size="sm"
                variant="success"
                onClick={handleSave}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setEditedName(project.name);
                  setError("");
                }}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
              >
                Rename
              </Button>
              <Button
                size="sm"
                variant="warn"
                onClick={handleDelete}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProjectList() {
  const { projects, currentProjectId, selectProject, renameProject, deleteProject } =
    useProjects();

  if (projects.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted">No projects yet. Create one to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {projects.map((project) => (
        <ProjectListItem
          key={project.id}
          project={project}
          isSelected={currentProjectId === project.id}
          onSelect={selectProject}
          onRename={renameProject}
          onDelete={deleteProject}
        />
      ))}
    </div>
  );
}
