"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { Scene, SceneContextType } from "@/types/scene";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  createScene as createSceneUtil,
  updateScene as updateSceneUtil,
  validateSceneTitle,
  validateSceneContent,
  reorderScenes as reorderScenesUtil,
} from "@/lib/scenes";

const SceneContext = createContext<SceneContextType | undefined>(undefined);

export function SceneProvider({ children }: { children: ReactNode }) {
  const [scenes, setScenes] = useLocalStorage<Scene[]>("theater_scenes", []);

  const createScene = (
    projectId: string,
    title: string,
    content: string,
    description?: string
  ): Scene => {
    const titleValidation = validateSceneTitle(title);
    if (!titleValidation.valid) {
      throw new Error(titleValidation.error);
    }

    const contentValidation = validateSceneContent(content);
    if (!contentValidation.valid) {
      throw new Error(contentValidation.error);
    }

    // Get the highest order for this project
    const projectScenes = scenes.filter((s) => s.projectId === projectId);
    const maxOrder =
      projectScenes.length > 0
        ? Math.max(...projectScenes.map((s) => s.order))
        : -1;

    const newScene = createSceneUtil(
      projectId,
      title,
      content,
      description,
      maxOrder + 1
    );
    setScenes([...scenes, newScene]);
    return newScene;
  };

  const updateScene = (
    id: string,
    updates: Partial<Omit<Scene, "id" | "projectId" | "createdAt">>
  ): void => {
    const scene = scenes.find((s) => s.id === id);
    if (!scene) {
      throw new Error(`Scene with id ${id} not found`);
    }

    if (updates.title) {
      const validation = validateSceneTitle(updates.title);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
    }

    if (updates.content) {
      const validation = validateSceneContent(updates.content);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
    }

    const updated = updateSceneUtil(scene, updates);
    setScenes(scenes.map((s) => (s.id === id ? updated : s)));
  };

  const deleteScene = (id: string): void => {
    const scene = scenes.find((s) => s.id === id);
    if (!scene) {
      throw new Error(`Scene with id ${id} not found`);
    }

    // Remove scene and update order for remaining scenes in the same project
    const filtered = scenes.filter((s) => s.id !== id);
    const projectScenes = filtered.filter((s) => s.projectId === scene.projectId);
    const otherScenes = filtered.filter((s) => s.projectId !== scene.projectId);

    // Reorder project scenes
    const reordered = projectScenes.map((s, index) => ({
      ...s,
      order: index,
    }));

    setScenes([...reordered, ...otherScenes]);
  };

  const getProjectScenes = (projectId: string): Scene[] => {
    return scenes
      .filter((s) => s.projectId === projectId)
      .sort((a, b) => a.order - b.order);
  };

  const reorderScenes = (projectId: string, sceneIds: string[]): void => {
    const projectScenes = scenes.filter((s) => s.projectId === projectId);
    const otherScenes = scenes.filter((s) => s.projectId !== projectId);

    const reordered = reorderScenesUtil(projectScenes, sceneIds);
    setScenes([...reordered, ...otherScenes]);
  };

  return (
    <SceneContext.Provider
      value={{
        scenes,
        createScene,
        updateScene,
        deleteScene,
        getProjectScenes,
        reorderScenes,
      }}
    >
      {children}
    </SceneContext.Provider>
  );
}

export function useScenes(): SceneContextType {
  const context = useContext(SceneContext);
  if (context === undefined) {
    throw new Error("useScenes must be used within a SceneProvider");
  }
  return context;
}
