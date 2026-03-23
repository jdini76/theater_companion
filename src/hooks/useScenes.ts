import { useScenes as useSceneContext } from "@/contexts/SceneContext";

export function useScenes() {
  return useSceneContext();
}
