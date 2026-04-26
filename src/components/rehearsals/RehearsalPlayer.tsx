"use client";

import React, { useState, useEffect } from "react";
import { Scene } from "@/types/scene";
import { VoiceConfig } from "@/types/voice";
import { useRehearsals } from "@/hooks/useRehearsals";
import { useVoice } from "@/hooks/useVoice";
import { Button } from "@/components/ui/Button";
import { RehearsalSetup } from "./RehearsalSetup";
import { RehearsalLineDisplay } from "./RehearsalLineDisplay";
import { RehearsalControls } from "./RehearsalControls";

interface RehearsalPlayerProps {
  projectId: string;
  scenes: Scene[];
  onClose: () => void;
}

type RehearsalState = "setup" | "active" | "complete";

export function RehearsalPlayer({
  projectId,
  scenes,
  onClose,
}: RehearsalPlayerProps) {
  const [state, setState] = useState<RehearsalState>("setup");
  const {
    currentSession,
    dialogueLines,
    startRehearsalSession,
    pauseRehearsalSession,
    resumeRehearsalSession,
    endRehearsalSession,
    getCurrentLine,
    getNextLine,
    getPreviousLines,
    advanceToNextLine,
    jumpToLine,
    getCurrentLinePercentage,
    isCurrentLineUserLine,
  } = useRehearsals();

  const { getVoiceConfigByCharacter } = useVoice();

  const currentLine = getCurrentLine();
  const nextLine = getNextLine();
  const previousLines = getPreviousLines(3);
  const currentPercentage = getCurrentLinePercentage();
  const isUserLine = isCurrentLineUserLine();

  // Get voice config for the character speaking (if not user)
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig | null>(null);
  useEffect(() => {
    if (currentLine && !isUserLine) {
      setVoiceConfig(getVoiceConfigByCharacter(currentLine.character));
    } else {
      setVoiceConfig(null);
    }
  }, [currentLine, isUserLine, getVoiceConfigByCharacter]);

  // Voice config for the next line (used for pre-generation)
  const nextVoiceConfig = nextLine && !nextLine.isStageDirection
    ? getVoiceConfigByCharacter(nextLine.character)
    : null;

  const handleStartRehearsalSession = (
    sceneId: string,
    characterName: string
  ) => {
    try {
      // Find the scene to get its content
      const scene = scenes.find((s) => s.id === sceneId);
      if (!scene) {
        console.error("Scene not found");
        return;
      }

      startRehearsalSession({
        projectId,
        sceneId,
        sceneContent: scene.content,
        userCharacterId: `char_${characterName}`,
        userCharacterName: characterName,
        autoPlayNonUserLines: true,
        enableSubtitles: true,
      });
      setState("active");
    } catch (error) {
      console.error("Error starting rehearsal:", error);
    }
  };

  const handleEndRehearsalSession = () => {
    endRehearsalSession();
    setState("complete");
  };

  const handleBackToSetup = () => {
    setState("setup");
  };

  const handleClose = () => {
    if (currentSession) {
      endRehearsalSession();
    }
    onClose();
  };

  // Header Info
  const scene = scenes.find((s) => s.id === currentSession?.sceneId);

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 rounded-lg p-4 space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-white">🎬 Full Scene Rehearsal</h2>
            {scene && currentSession && (
              <div className="text-sm text-gray-400 space-y-1 mt-2">
                <p>
                  <span className="font-semibold">Scene:</span> {scene.title}
                </p>
                <p>
                  <span className="font-semibold">Playing:</span>{" "}
                  {currentSession.userCharacterName}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl"
            title="Close rehearsal"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {state === "setup" && (
          <div className="bg-gray-900 rounded-lg p-8">
            <h3 className="text-xl font-semibold text-white mb-6">
              Select Scene & Character
            </h3>
            <RehearsalSetup
              scenes={scenes}
              onStart={handleStartRehearsalSession}
              onCancel={handleClose}
            />
          </div>
        )}

        {state === "active" && currentSession && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Dialogue Display (2/3) */}
            <div className="lg:col-span-2 bg-gray-900 rounded-lg p-8">
              <RehearsalLineDisplay
                currentLine={currentLine}
                nextLine={nextLine}
                previousLines={previousLines}
                userCharacterName={currentSession.userCharacterName}
                currentLinePercentage={currentPercentage}
              />
            </div>

            {/* Right: Controls (1/3) */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-4">
              <h3 className="font-bold text-white mb-4">🎮 Controls</h3>
              <RehearsalControls
                currentLine={currentLine}
                isUserLine={isUserLine}
                isPlaying={currentSession.isPlaying}
                isPaused={currentSession.isPaused}
                voiceConfig={voiceConfig}
                nextLine={nextLine}
                nextVoiceConfig={nextVoiceConfig}
                onPause={pauseRehearsalSession}
                onResume={resumeRehearsalSession}
                onNextLine={advanceToNextLine}
                onPreviousLine={() => {
                  const currentIndex = currentSession.currentLineIndex;
                  if (currentIndex > 0) {
                    jumpToLine(currentIndex - 1);
                  }
                }}
                onEnd={handleEndRehearsalSession}
                autoPlayNonUserLines={true}
              />
            </div>
          </div>
        )}

        {state === "complete" && (
          <div className="bg-gray-900 rounded-lg p-12 text-center space-y-6">
            <div className="text-6xl">🎉</div>
            <div>
              <h3 className="text-3xl font-bold text-white mb-2">
                Great Work!
              </h3>
              <p className="text-gray-400">
                {`You've completed the scene rehearsal. Way to go! 🌟`}
              </p>
            </div>

            {currentSession && (
              <div className="bg-gray-800 rounded-lg p-6 space-y-2 text-left max-w-md mx-auto">
                <div className="text-sm text-gray-400">
                  <p>
                    <span className="font-semibold text-white">Scene:</span>{" "}
                    {scene?.title}
                  </p>
                  <p>
                    <span className="font-semibold text-white">Character:</span>{" "}
                    {currentSession.userCharacterName}
                  </p>
                  <p>
                    <span className="font-semibold text-white">Lines completed:</span>{" "}
                    {dialogueLines.length}
                  </p>
                  <p>
                    <span className="font-semibold text-white">Duration:</span>{" "}
                    {new Date(currentSession.completedAt || new Date().toISOString()).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <Button
                onClick={handleBackToSetup}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                🔄 Rehearse Another Scene
              </Button>
              <Button
                onClick={handleClose}
                variant="outline"
                className="border-gray-600 hover:bg-gray-800"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
