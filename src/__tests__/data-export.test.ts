import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/idb", () => ({
  idbGet: vi.fn(async () => []),
  idbSet: vi.fn(async () => undefined),
}));

import { executeImport, type ImportedProject } from "@/lib/data-export";
import { idbGet, idbSet } from "@/lib/idb";

describe("data export/import", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(idbGet).mockResolvedValue([]);
    vi.mocked(idbSet).mockClear();
  });

  it("remaps per-song IDs when importing hidden and URL song metadata", async () => {
    const importedProjects: ImportedProject[] = [
      {
        name: "Imported Project",
        hasConflict: false,
        bundle: {
          project: {
            id: "old-project-id",
            name: "Original Project",
            productionType: "Musical",
            createdAt: "2026-07-05T00:00:00.000Z",
            updatedAt: "2026-07-05T00:00:00.000Z",
          },
          scenes: [
            {
              id: "old-scene-id",
              projectId: "old-project-id",
              title: "Scene 1",
              content: "",
              order: 1,
            },
          ],
          characters: [],
          voiceConfigs: [],
          projectSettings: null,
          rehearsalHistory: [],
          sceneLineOverrides: {},
          rehearsalSettingsJson: null,
          songsHiddenJson: JSON.stringify([
            "old-scene-id_song_1",
            "old-scene-id_songs",
            "untouched-entry",
          ]),
          songsUrlsJson: JSON.stringify({
            old_scene_legacy: "https://example.com/legacy",
            "old-scene-id_song_1": "https://example.com/song-1",
            "old-scene-id_songs": "https://example.com/scene-legacy",
          }),
        },
      },
    ];

    const importedCount = await executeImport(importedProjects);

    expect(importedCount).toBe(1);
    expect(vi.mocked(idbSet)).toHaveBeenCalledTimes(1);

    const writtenScenes = vi.mocked(idbSet).mock.calls[0][1] as Array<{
      id: string;
    }>;
    const newSceneId = writtenScenes[0].id;

    const savedProjects = JSON.parse(
      localStorage.getItem("theater_projects") ?? "[]",
    ) as Array<{ id: string }>;
    const newProjectId = savedProjects[0].id;

    const hidden = JSON.parse(
      localStorage.getItem(`theater_songs_hidden_${newProjectId}`) ?? "[]",
    ) as string[];
    expect(hidden).toContain(`${newSceneId}_song_1`);
    expect(hidden).toContain(`${newSceneId}_songs`);
    expect(hidden).toContain("untouched-entry");

    const urls = JSON.parse(
      localStorage.getItem(`theater_songs_urls_${newProjectId}`) ?? "{}",
    ) as Record<string, string>;
    expect(urls[`${newSceneId}_song_1`]).toBe("https://example.com/song-1");
    expect(urls[`${newSceneId}_songs`]).toBe(
      "https://example.com/scene-legacy",
    );
    expect(urls.old_scene_legacy).toBe("https://example.com/legacy");
  });
});
