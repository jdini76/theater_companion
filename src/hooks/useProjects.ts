import { useProjects as useProjectsContext } from "@/contexts/ProjectContext";

export function useProjects() {
  return useProjectsContext();
}
