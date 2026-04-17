import { VoiceConfig } from "@/types/voice";

export interface ProjectRehearsalSettings {
  projectId: string;
  projectName: string;
  actorName: string;
  sceneContent: string;
  selectedSceneIndex: number;
  selectedCharacter: string;
  voiceConfigs: Record<string, VoiceConfig>;
  speakNames: boolean;
  readOwnLines: boolean;
  pauseMode: "manual" | "countdown";
  countdownSeconds: number;
  updatedAt: number;
}

export class ProjectPersistence {
  private static STORAGE_KEY = "theater_project_settings";

  /**
   * Load settings for a specific project
   */
  static loadProjectSettings(
    projectId: string,
  ): ProjectRehearsalSettings | null {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return null;
      const settings = JSON.parse(data) as Record<
        string,
        ProjectRehearsalSettings
      >;
      return settings[projectId] || null;
    } catch {
      return null;
    }
  }

  /**
   * Save settings for a specific project
   */
  static saveProjectSettings(settings: ProjectRehearsalSettings): void {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      const allSettings = data
        ? (JSON.parse(data) as Record<string, ProjectRehearsalSettings>)
        : {};
      allSettings[settings.projectId] = {
        ...settings,
        updatedAt: Date.now(),
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allSettings));
    } catch (error) {
      console.error("Failed to save project settings:", error);
    }
  }

  /**
   * Get all saved projects
   */
  static getAllProjects(): ProjectRehearsalSettings[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return [];
      const settings = JSON.parse(data) as Record<
        string,
        ProjectRehearsalSettings
      >;
      return Object.values(settings).sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  }

  /**
   * Delete a project's settings
   */
  static deleteProjectSettings(projectId: string): void {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return;
      const settings = JSON.parse(data) as Record<
        string,
        ProjectRehearsalSettings
      >;
      delete settings[projectId];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to delete project settings:", error);
    }
  }
}
