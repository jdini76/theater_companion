/**
 * Export/Import all application data from localStorage as a JSON file.
 * This allows users to back up, restore, and transfer data between devices.
 */

/** Static localStorage keys used by the app */
const STATIC_KEYS = [
  "theater_projects",
  "theater_current_project_id",
  "theater_scenes",
  "theater_voice_configs",
  "theater_characters",
  "theater_current_character_id",
  "theater_rehearsal_history",
  "theater_tts_settings",
  "theater_project_settings",
  "theater_rehearsal_settings_default",
];

/** Prefix for dynamic per-project rehearsal settings */
const REHEARSAL_SETTINGS_PREFIX = "theater_rehearsal_settings_";

interface ExportData {
  version: 1;
  exportedAt: string;
  data: Record<string, string>;
}

/**
 * Collect all app-related localStorage entries into a single object.
 */
function collectAllData(): Record<string, string> {
  const data: Record<string, string> = {};

  // Static keys
  for (const key of STATIC_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      data[key] = value;
    }
  }

  // Dynamic per-project rehearsal settings
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key &&
      key.startsWith(REHEARSAL_SETTINGS_PREFIX) &&
      !STATIC_KEYS.includes(key)
    ) {
      const value = localStorage.getItem(key);
      if (value !== null) {
        data[key] = value;
      }
    }
  }

  return data;
}

/**
 * Get the current project name for use in filenames, sanitized for filesystem safety.
 */
function getCurrentProjectName(): string {
  try {
    const rawId = localStorage.getItem("theater_current_project_id");
    const raw = localStorage.getItem("theater_projects");
    if (rawId && raw) {
      const currentId = JSON.parse(rawId);
      const projects = JSON.parse(raw);
      if (Array.isArray(projects)) {
        const project = projects.find(
          (p: { id: string }) => p.id === currentId,
        );
        if (project?.name) {
          return project.name
            .replace(/[^a-zA-Z0-9_\- ]/g, "")
            .trim()
            .replace(/\s+/g, "-");
        }
      }
    }
  } catch {
    /* ignore */
  }
  return "";
}

/**
 * Export all app data as a downloadable JSON file.
 */
export function exportData(): void {
  const payload: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: collectAllData(),
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const projectName = getCurrentProjectName();
  const namePart = projectName ? `-${projectName}` : "";

  const a = document.createElement("a");
  a.href = url;
  a.download = `theater-companion-backup${namePart}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import app data from a JSON file.
 * Returns the number of keys restored.
 */
export function importData(
  file: File,
): Promise<{ keysRestored: number; exportedAt: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const text = reader.result as string;
        const payload = JSON.parse(text);

        // Validate structure
        if (
          !payload ||
          typeof payload !== "object" ||
          payload.version !== 1 ||
          !payload.data
        ) {
          reject(new Error("Invalid backup file format."));
          return;
        }

        const data: Record<string, string> = payload.data;

        // Validate all keys are theater_ prefixed to prevent arbitrary writes
        for (const key of Object.keys(data)) {
          if (!key.startsWith("theater_")) {
            reject(
              new Error(
                `Invalid key in backup: "${key}". Only theater_* keys are allowed.`,
              ),
            );
            return;
          }
        }

        let count = 0;
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === "string") {
            localStorage.setItem(key, value);
            count++;
          }
        }

        resolve({
          keysRestored: count,
          exportedAt: payload.exportedAt || "unknown",
        });
      } catch (err) {
        reject(
          err instanceof Error
            ? err
            : new Error("Failed to parse backup file."),
        );
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsText(file);
  });
}

/**
 * Get a summary of current stored data for display.
 */
export function getStorageSummary(): {
  projectCount: number;
  sceneCount: number;
  characterCount: number;
  totalSizeKB: number;
} {
  let totalSize = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("theater_")) {
      const value = localStorage.getItem(key);
      if (value) totalSize += key.length + value.length;
    }
  }

  const parseCount = (key: string): number => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr.length : 0;
      }
    } catch {
      /* ignore */
    }
    return 0;
  };

  return {
    projectCount: parseCount("theater_projects"),
    sceneCount: parseCount("theater_scenes"),
    characterCount: parseCount("theater_characters"),
    totalSizeKB: Math.round((totalSize * 2) / 1024), // UTF-16 ≈ 2 bytes/char
  };
}
