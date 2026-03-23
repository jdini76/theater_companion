"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjects } from "@/hooks/useProjects";
import { useScenes } from "@/hooks/useScenes";
import { useVoice } from "@/hooks/useVoice";
import { CharacterRole } from "@/types/voice";
import { RehearsalPlayer } from "@/components/rehearsals/RehearsalPlayer";
import { Button } from "@/components/ui/Button";

export default function RehearsalsPage() {
  const router = useRouter();
  const { currentProjectId, getCurrentProject } = useProjects();
  const { getProjectScenes } = useScenes();
  const { getProjectCharacters } = useVoice();
  const [showRehearsal, setShowRehearsal] = useState(false);

  // Redirect if no project selected
  if (!currentProjectId) {
    return (
      <div className="p-8 space-y-4">
        <h1 className="text-2xl font-bold text-white">🎬 Scene Rehearsal</h1>
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 text-yellow-300">
          Please select a project first to access rehearsals.
        </div>
        <Button onClick={() => router.push("/projects")} className="bg-cyan-600 hover:bg-cyan-700">
          Go to Projects
        </Button>
      </div>
    );
  }

  const project = getCurrentProject();
  const scenes = getProjectScenes(currentProjectId);
  const characters = getProjectCharacters(currentProjectId);

  if (!project) {
    return (
      <div className="p-8">
        <p className="text-gray-400">Project not found</p>
      </div>
    );
  }

  if (showRehearsal) {
    return (
      <div className="p-6">
        <RehearsalPlayer
          projectId={currentProjectId}
          scenes={scenes}
          characters={characters}
          onClose={() => setShowRehearsal(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 rounded-lg p-6">
        <h1 className="text-3xl font-bold text-white">🎬 Scene Rehearsal</h1>
        <p className="text-gray-400 mt-2">
          Project: <span className="font-semibold text-cyan-400">{project.name}</span>
        </p>
      </div>

      {/* Check Requirements */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Scenes Status */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
          <div className="text-2xl font-bold text-white">{scenes.length}</div>
          <div className="text-gray-400">📽️ Scenes imported</div>
          {scenes.length === 0 && (
            <p className="text-xs text-yellow-400">
              👉 Import scenes in the Scenes tab first
            </p>
          )}
        </div>

        {/* Characters Status */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
          <div className="text-2xl font-bold text-white">{characters.length}</div>
          <div className="text-gray-400">🎭 Characters created</div>
          {characters.length === 0 && (
            <p className="text-xs text-yellow-400">
              👉 Create characters in the Cast tab first
            </p>
          )}
        </div>

        {/* Voice Configs Status */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
          <div className="text-2xl font-bold text-white">
            {characters.filter((c: CharacterRole) => c.voiceConfigId).length}/{characters.length}
          </div>
          <div className="text-gray-400">🎙️ Voices configured</div>
          {characters.length > 0 &&
            characters.filter((c: CharacterRole) => c.voiceConfigId).length < characters.length && (
              <p className="text-xs text-yellow-400">
                👉 Configure voices for all characters in Cast tab
              </p>
            )}
        </div>
      </div>

      {/* Start Rehearsal Button */}
      <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-600 rounded-lg p-8 text-center space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Ready to Rehearse?</h2>
          <p className="text-gray-300">
            Load a scene and pick a character to start practicing with automated voice feedback.
          </p>
        </div>

        <div className="space-y-2">
          {scenes.length === 0 ? (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">
              {"❌ You need to import at least one scene to start rehearsing. "}
              <button
                onClick={() => router.push("/scenes")}
                className="underline font-semibold hover:text-red-200"
              >
                Go to Scenes
              </button>
            </div>
          ) : characters.length === 0 ? (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">
              {"❌ You need to create at least one character to start rehearsing. "}
              <button
                onClick={() => router.push("/cast")}
                className="underline font-semibold hover:text-red-200"
              >
                Go to Cast
              </button>
            </div>
          ) : (
            <Button
              onClick={() => setShowRehearsal(true)}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-lg py-4"
            >
              🎬 Start Full Scene Rehearsal
            </Button>
          )}
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
        <h3 className="text-xl font-bold text-white">🎓 How It Works</h3>
        <div className="space-y-3 text-gray-300 text-sm">
          <div className="flex gap-3">
            <span className="text-cyan-400 font-bold min-w-8">1️⃣</span>
            <div>
              <p className="font-semibold">Select Your Scene</p>
              <p className="text-gray-400 text-xs">Choose which scene you want to rehearse</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-cyan-400 font-bold min-w-8">2️⃣</span>
            <div>
              <p className="font-semibold">Pick Your Character</p>
              <p className="text-gray-400 text-xs">
                Select the character you&apos;ll be playing
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-cyan-400 font-bold min-w-8">3️⃣</span>
            <div>
              <p className="font-semibold">Auto-Play &amp; Pause on Your Lines</p>
              <p className="text-gray-400 text-xs">
                Other characters&apos; lines play automatically. System pauses when it&apos;s your turn.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-cyan-400 font-bold min-w-8">4️⃣</span>
            <div>
              <p className="font-semibold">Read &amp; Advance</p>
              <p className="text-gray-400 text-xs">
                Read your line aloud, then click &quot;Next Line&quot; to continue
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-cyan-400 font-bold min-w-8">5️⃣</span>
            <div>
              <p className="font-semibold">Full Scene Playthrough</p>
              <p className="text-gray-400 text-xs">
                Continue through the entire scene and celebrate your completion!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
          <div className="text-lg font-bold text-cyan-400">✨ Features</div>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>✓ Full scene mode with all characters</li>
            <li>✓ Manual pause on your lines</li>
            <li>✓ Auto-play non-user character lines</li>
            <li>✓ Voice synthesis with configured voices</li>
            <li>✓ Progress tracking</li>
            <li>✓ Playback controls (play, pause, skip, replay)</li>
          </ul>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
          <div className="text-lg font-bold text-cyan-400">🎯 Best Practices</div>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>📖 Read your lines aloud (don&apos;t just listen)</li>
            <li>🔄 Replay challenging sections multiple times</li>
            <li>⏸️ Use pause to mark character emotions</li>
            <li>🎤 Test different voice tones</li>
            <li>📝 Note difficult phrasing for review</li>
            <li>🎬 Rehearse multiple times for mastery</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
