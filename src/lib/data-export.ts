/**
 * Export/Import application data from localStorage.
 * v2: project-selective bundles with conflict-safe import.
 * v1: legacy full-backup format (restore only, no conflict handling).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RawRecord = Record<string, unknown>;

export interface ProjectBundle {
  project: RawRecord;
  scenes: RawRecord[];
  characters: RawRecord[];
  voiceConfigs: RawRecord[];
  projectSettings: RawRecord | null;
  rehearsalHistory: RawRecord[];
  sceneLineOverrides: Record<string, string>; // sceneId → JSON string
  rehearsalSettingsJson: string | null;       // theater_rehearsal_settings_<projectId>
}

export interface ExportDataV2 {
  version: 2;
  exportedAt: string;
  projects: ProjectBundle[];
}

export interface ImportedProject {
  bundle: ProjectBundle;
  /** Name the user will import under (may be edited in the UI). */
  name: string;
  /** True if an existing project already has this name. */
  hasConflict: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return fallback;
}

function getId(obj: RawRecord): string {
  return obj.id as string;
}

// ---------------------------------------------------------------------------
// Build a project bundle from localStorage
// ---------------------------------------------------------------------------

export function buildProjectBundle(projectId: string): ProjectBundle | null {
  const allProjects = readJson<RawRecord[]>("theater_projects", []);
  const project = allProjects.find((p) => getId(p) === projectId);
  if (!project) return null;

  const allScenes = readJson<RawRecord[]>("theater_scenes", []);
  const scenes = allScenes.filter((s) => s.projectId === projectId);

  const allChars = readJson<RawRecord[]>("theater_characters", []);
  const characters = allChars.filter((c) => c.projectId === projectId);

  const usedVoiceConfigIds = new Set(
    characters.map((c) => c.voiceConfigId as string).filter(Boolean),
  );
  const allVoiceConfigs = readJson<RawRecord[]>("theater_voice_configs", []);
  const voiceConfigs = allVoiceConfigs.filter((vc) => usedVoiceConfigIds.has(getId(vc)));

  const allProjectSettings = readJson<Record<string, RawRecord>>("theater_project_settings", {});
  const projectSettings = allProjectSettings[projectId] ?? null;

  const allHistory = readJson<RawRecord[]>("theater_rehearsal_history", []);
  const rehearsalHistory = allHistory.filter((h) => h.projectId === projectId);

  const sceneLineOverrides: Record<string, string> = {};
  for (const scene of scenes) {
    const key = `theater_scene_line_overrides_${getId(scene)}`;
    const val = localStorage.getItem(key);
    if (val) sceneLineOverrides[getId(scene)] = val;
  }

  const rehearsalSettingsJson =
    localStorage.getItem(`theater_rehearsal_settings_${projectId}`) ?? null;

  return {
    project,
    scenes,
    characters,
    voiceConfigs,
    projectSettings,
    rehearsalHistory,
    sceneLineOverrides,
    rehearsalSettingsJson,
  };
}

// ---------------------------------------------------------------------------
// Read all projects from localStorage (for the export UI)
// ---------------------------------------------------------------------------

export function getAllStoredProjects(): RawRecord[] {
  return readJson<RawRecord[]>("theater_projects", []);
}

// ---------------------------------------------------------------------------
// Export selected projects as a v2 JSON file
// ---------------------------------------------------------------------------

export function exportSelectedProjects(projectIds: string[]): void {
  const bundles = projectIds
    .map(buildProjectBundle)
    .filter((b): b is ProjectBundle => b !== null);

  const payload: ExportDataV2 = {
    version: 2,
    exportedAt: new Date().toISOString(),
    projects: bundles,
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const slug = bundles
    .map((b) =>
      (b.project.name as string)
        .replace(/[^a-zA-Z0-9_\- ]/g, "")
        .trim()
        .replace(/\s+/g, "-"),
    )
    .filter(Boolean)
    .join("_");

  const a = document.createElement("a");
  a.href = url;
  a.download = `theater-export${slug ? `-${slug}` : ""}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Parse an import file and return conflict-annotated project list
// ---------------------------------------------------------------------------

export async function parseImportFile(file: File): Promise<ImportedProject[]> {
  const text = await file.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("Could not read file — make sure it is a valid JSON backup.");
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid backup file.");
  }

  const p = payload as { version?: number; projects?: unknown[] };

  if (p.version !== 2 || !Array.isArray(p.projects)) {
    throw new Error(
      "This file is a legacy full backup (v1). Use Restore Legacy Backup to load it.",
    );
  }

  const existing = readJson<RawRecord[]>("theater_projects", []);
  const existingNames = new Set(
    existing.map((proj) => (proj.name as string).toLowerCase()),
  );

  return (p.projects as ProjectBundle[]).map((bundle) => {
    const name = bundle.project.name as string;
    return {
      bundle,
      name,
      hasConflict: existingNames.has(name.toLowerCase()),
    };
  });
}

// ---------------------------------------------------------------------------
// Execute the import — always assigns new IDs, never overwrites
// ---------------------------------------------------------------------------

export function executeImport(importedProjects: ImportedProject[]): number {
  const existingProjects = readJson<RawRecord[]>("theater_projects", []);
  const existingScenes = readJson<RawRecord[]>("theater_scenes", []);
  const existingChars = readJson<RawRecord[]>("theater_characters", []);
  const existingVoiceConfigs = readJson<RawRecord[]>("theater_voice_configs", []);
  const existingProjectSettings = readJson<Record<string, RawRecord>>("theater_project_settings", {});
  const existingHistory = readJson<RawRecord[]>("theater_rehearsal_history", []);

  let importedCount = 0;

  for (const { bundle, name } of importedProjects) {
    const newProjectId = crypto.randomUUID();

    // Build ID remapping tables
    const sceneIdMap = new Map<string, string>();
    for (const scene of bundle.scenes) {
      sceneIdMap.set(getId(scene), crypto.randomUUID());
    }
    const voiceConfigIdMap = new Map<string, string>();
    for (const vc of bundle.voiceConfigs) {
      voiceConfigIdMap.set(getId(vc), crypto.randomUUID());
    }

    // Project
    existingProjects.push({ ...bundle.project, id: newProjectId, name });

    // Scenes
    for (const scene of bundle.scenes) {
      existingScenes.push({
        ...scene,
        id: sceneIdMap.get(getId(scene))!,
        projectId: newProjectId,
      });
    }

    // Voice configs
    for (const vc of bundle.voiceConfigs) {
      existingVoiceConfigs.push({
        ...vc,
        id: voiceConfigIdMap.get(getId(vc))!,
      });
    }

    // Characters
    for (const char of bundle.characters) {
      const oldVcId = char.voiceConfigId as string | undefined;
      existingChars.push({
        ...char,
        id: crypto.randomUUID(),
        projectId: newProjectId,
        voiceConfigId: oldVcId ? (voiceConfigIdMap.get(oldVcId) ?? undefined) : undefined,
      });
    }

    // Project settings
    if (bundle.projectSettings) {
      existingProjectSettings[newProjectId] = {
        ...bundle.projectSettings,
        projectId: newProjectId,
      };
    }

    // Rehearsal history
    for (const entry of bundle.rehearsalHistory) {
      const oldSceneId = entry.sceneId as string | undefined;
      existingHistory.push({
        ...entry,
        id: crypto.randomUUID(),
        projectId: newProjectId,
        sceneId: oldSceneId ? (sceneIdMap.get(oldSceneId) ?? oldSceneId) : undefined,
      });
    }

    // Scene line overrides
    for (const [oldSceneId, value] of Object.entries(bundle.sceneLineOverrides)) {
      const newSceneId = sceneIdMap.get(oldSceneId);
      if (newSceneId) {
        localStorage.setItem(`theater_scene_line_overrides_${newSceneId}`, value);
      }
    }

    // Per-project rehearsal settings
    if (bundle.rehearsalSettingsJson) {
      localStorage.setItem(
        `theater_rehearsal_settings_${newProjectId}`,
        bundle.rehearsalSettingsJson,
      );
    }

    importedCount++;
  }

  localStorage.setItem("theater_projects", JSON.stringify(existingProjects));
  localStorage.setItem("theater_scenes", JSON.stringify(existingScenes));
  localStorage.setItem("theater_characters", JSON.stringify(existingChars));
  localStorage.setItem("theater_voice_configs", JSON.stringify(existingVoiceConfigs));
  localStorage.setItem("theater_project_settings", JSON.stringify(existingProjectSettings));
  localStorage.setItem("theater_rehearsal_history", JSON.stringify(existingHistory));

  return importedCount;
}

// ---------------------------------------------------------------------------
// Legacy v1 restore (full overwrite — kept for backward compat)
// ---------------------------------------------------------------------------

const LEGACY_STATIC_KEYS = [
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

export async function restoreLegacyBackup(
  file: File,
): Promise<{ keysRestored: number; exportedAt: string }> {
  const text = await file.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("Could not read file.");
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    (payload as { version?: number }).version !== 1 ||
    !(payload as { data?: unknown }).data
  ) {
    throw new Error(
      "Not a legacy v1 backup. Use the standard Import for v2 files.",
    );
  }

  const data = (payload as { data: Record<string, string>; exportedAt?: string }).data;
  const exportedAt = (payload as { exportedAt?: string }).exportedAt ?? "unknown";

  for (const key of Object.keys(data)) {
    if (!key.startsWith("theater_")) {
      throw new Error(`Invalid key in backup: "${key}".`);
    }
  }

  let count = 0;
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      localStorage.setItem(key, value);
      count++;
    }
  }

  return { keysRestored: count, exportedAt };
}

// ---------------------------------------------------------------------------
// Storage summary (unchanged)
// ---------------------------------------------------------------------------

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

  return {
    projectCount: readJson<unknown[]>("theater_projects", []).length,
    sceneCount: readJson<unknown[]>("theater_scenes", []).length,
    characterCount: readJson<unknown[]>("theater_characters", []).length,
    totalSizeKB: Math.round((totalSize * 2) / 1024),
  };
}

// Keep old name exported for any remaining callers
export { restoreLegacyBackup as importData };

/** @deprecated — use exportSelectedProjects */
export function exportData(): void {
  const allProjects = getAllStoredProjects();
  exportSelectedProjects(allProjects.map(getId));
}

void LEGACY_STATIC_KEYS; // referenced for documentation only
