"use client";

import { createContext, useContext } from "react";

interface RehearsalNavContextType {
  /** Navigate to the Cast tab and select a character by their ID. */
  navigateToCharacter: (characterId: string) => void;
  /** Navigate to the Scenes tab and open a specific scene by its ID. */
  navigateToScene: (sceneId: string) => void;
}

const RehearsalNavContext = createContext<RehearsalNavContextType>({
  navigateToCharacter: () => {},
  navigateToScene: () => {},
});

export function useRehearsalNav() {
  return useContext(RehearsalNavContext);
}

export { RehearsalNavContext };
