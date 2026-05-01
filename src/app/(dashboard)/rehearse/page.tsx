"use client";
import { useState, useCallback } from "react";
import { SceneManager } from "@/components/scenes/SceneManager";
import { useProjects } from "@/contexts/ProjectContext";
import CastPage from "../cast/page";
import RehearsalPage from "../rehearsals/page";
import SongsPage from "../songs/page";
import { SettingsContent } from "@/components/settings/SettingsContent";
import { RehearsalNavContext } from "@/contexts/RehearsalNavContext";
import { useVoice } from "@/contexts/VoiceContext";

const TABS = [
  { id: "scenes", label: "Scenes" },
  { id: "cast", label: "Cast" },
  { id: "run-lines", label: "Run Lines" },
  { id: "songs", label: "Songs" },
  { id: "settings", label: "Settings" },
];

export default function RehearsePage() {
  const [tab, setTab] = useState("scenes");
  const [pendingSceneId, setPendingSceneId] = useState<string | null>(null);
  const { setCurrentCharacter } = useVoice();
  const { getCurrentProject } = useProjects();
  const currentProject = getCurrentProject();

  const navigateToCharacter = useCallback(
    (characterId: string) => {
      setCurrentCharacter(characterId);
      setTab("cast");
    },
    [setCurrentCharacter],
  );

  const navigateToScene = useCallback((sceneId: string) => {
    setPendingSceneId(sceneId);
    setTab("scenes");
  }, []);

  return (
    <RehearsalNavContext.Provider
      value={{ navigateToCharacter, navigateToScene }}
    >
      <div className="max-w-4xl mx-auto py-8">
        <div className="flex gap-2 mb-6 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`px-4 py-2 font-semibold border-b-2 transition-colors ${
                tab === t.id
                  ? "border-accent-cyan text-accent-cyan"
                  : "border-transparent text-light hover:text-accent-cyan"
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div>
          {tab === "scenes" && currentProject && (
            <SceneManager
              projectId={currentProject.id}
              projectName={currentProject.name}
              initialSceneId={pendingSceneId}
              onSceneNavigated={() => setPendingSceneId(null)}
            />
          )}
          {tab === "scenes" && !currentProject && (
            <div className="card text-center py-12">
              <p className="text-muted">No project selected.</p>
            </div>
          )}
          {tab === "cast" && <CastPage />}
          {tab === "run-lines" && <RehearsalPage />}
          {tab === "songs" && <SongsPage />}
          {tab === "settings" && <SettingsContent />}
        </div>
      </div>
    </RehearsalNavContext.Provider>
  );
}
