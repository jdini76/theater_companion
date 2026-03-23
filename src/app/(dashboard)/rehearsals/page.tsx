"use client";

import React, { useState } from "react";
import { VoiceConfig } from "@/types/voice";
import { RehearsalOnboarding } from "@/components/rehearsals/RehearsalOnboarding";
import { Button } from "@/components/ui/Button";
import { useRehearsals } from "@/hooks/useRehearsals";

interface RehearsalSessionConfig {
  sceneContent: string;
  userCharacterName: string;
  voiceConfigs: Record<string, VoiceConfig>;
}

type PageState = "onboarding" | "rehearsal" | "complete";

export default function RehearsalsPage() {
  const [pageState, setPageState] = useState<PageState>("onboarding");
  const [rehearsalConfig, setRehearsalConfig] = useState<RehearsalSessionConfig | null>(null);

  // Handle onboarding completion
  const handleRehearsalReady = (config: RehearsalSessionConfig) => {
    setRehearsalConfig(config);
    setPageState("rehearsal");
  };

  // Handle rehearsal completion
  const handleRehearsalComplete = () => {
    setPageState("complete");
  };

  // Handle returning to onboarding (new rehearsal)
  const handleStartNewRehearsal = () => {
    setRehearsalConfig(null);
    setPageState("onboarding");
  };

  // Onboarding stage
  if (pageState === "onboarding") {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 rounded-lg p-6">
          <h1 className="text-3xl font-bold text-white">🎬 Scene Rehearsal</h1>
          <p className="text-gray-400 mt-2">
            Master your lines with auto-playing co-stars and voice synthesis
          </p>
        </div>

        {/* Onboarding Flow */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <RehearsalOnboarding
            onRehearsalReady={handleRehearsalReady}
            onCancel={() => {
              // Optional: could navigate elsewhere or just reset
            }}
          />
        </div>

        {/* How It Works */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
          <h3 className="text-xl font-bold text-white">🎓 How It Works</h3>
          <div className="space-y-3 text-gray-300 text-sm">
            <div className="flex gap-3">
              <span className="text-cyan-400 font-bold min-w-8">1️⃣</span>
              <div>
                <p className="font-semibold">Paste Your Scene</p>
                <p className="text-gray-400 text-xs">Enter scene text with dialogue in \u201cCHARACTER: line\u201d format</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-cyan-400 font-bold min-w-8">2️⃣</span>
              <div>
                <p className="font-semibold">Choose Your Character</p>
                <p className="text-gray-400 text-xs">System auto-detects all characters from your scene</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-cyan-400 font-bold min-w-8">3️⃣</span>
              <div>
                <p className="font-semibold">Configure Voices</p>
                <p className="text-gray-400 text-xs">Select voices, speed, and pitch for each character</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-cyan-400 font-bold min-w-8">4️⃣</span>
              <div>
                <p className="font-semibold">Start Rehearsing</p>
                <p className="text-gray-400 text-xs">Other characters play automatically. You read your lines.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-cyan-400 font-bold min-w-8">5️⃣</span>
              <div>
                <p className="font-semibold">Master Your Role</p>
                <p className="text-gray-400 text-xs">Rehearse multiple times and celebrate your completion!</p>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
            <div className="text-lg font-bold text-cyan-400">✨ Features</div>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>✓ Paste scenes directly</li>
              <li>✓ Auto-detect characters</li>
              <li>✓ Choose your role</li>
              <li>✓ Configure voices on-the-fly</li>
              <li>✓ Auto-play co-star lines</li>
              <li>✓ Manual pause on your lines</li>
            </ul>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
            <div className="text-lg font-bold text-cyan-400">🎯 Best Practices</div>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>📖 Read your lines aloud</li>
              <li>🔄 Replay challenging sections</li>
              <li>⏸️ Pause to mark emotions</li>
              <li>🎤 Try different voice tones</li>
              <li>📝 Note difficult phrasing</li>
              <li>🎬 Rehearse multiple times</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Rehearsal stage
  if (pageState === "rehearsal" && rehearsalConfig) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-gray-800 border-b border-gray-700 p-6 rounded-t-lg">
          <div>
            <h1 className="text-3xl font-bold text-white">🎬 Rehearsing</h1>
            <p className="text-gray-400 mt-1">
              Playing as: <span className="font-semibold text-cyan-400">{rehearsalConfig.userCharacterName}</span>
            </p>
          </div>
          <Button
            onClick={() => setPageState("onboarding")}
            className="bg-gray-700 hover:bg-gray-600"
          >
            ← Back
          </Button>
        </div>

        <div className="p-6">
          <RehearsalPlayerWrapper
            config={rehearsalConfig}
            onComplete={handleRehearsalComplete}
          />
        </div>
      </div>
    );
  }

  // Complete stage
  if (pageState === "complete") {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-green-900/80 to-cyan-900/80 border border-green-600 rounded-lg p-8 text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <h2 className="text-3xl font-bold text-white">Scene Complete!</h2>
          <p className="text-gray-300 text-lg">
            Great rehearsal! You\u2019ve made progress on your lines.
          </p>
          <div className="flex gap-3 justify-center pt-4">
            <Button
              onClick={handleStartNewRehearsal}
              className="bg-cyan-600 hover:bg-cyan-700 text-lg px-6 py-3"
            >
              🎬 Rehearse Another Scene
            </Button>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
          <h3 className="text-xl font-bold text-white">💡 Tips</h3>
          <ul className="text-gray-300 space-y-2 text-sm">
            <li>• Rehearse the same scene multiple times to build muscle memory</li>
            <li>• Try different voice speeds and pitches for co-star variety</li>
            <li>• Record yourself reading your lines for comparison</li>
            <li>• Focus on difficult passages until they feel natural</li>
          </ul>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Wrapper that manages the active rehearsal session
 */
function RehearsalPlayerWrapper({
  config,
  onComplete,
}: {
  config: RehearsalSessionConfig;
  onComplete: () => void;
}) {
  const {
    currentSession,
    dialogueLines,
    startRehearsalSession,
    endRehearsalSession,
    getCurrentLine,
    getNextLine,
    getPreviousLines,
    advanceToNextLine,
    getCurrentLinePercentage,
    isCurrentLineUserLine,
  } = useRehearsals();

  const [hasStarted, setHasStarted] = React.useState(false);

  // Start session on mount
  React.useEffect(() => {
    if (!hasStarted) {
      startRehearsalSession({
        projectId: "session",
        sceneId: "current",
        sceneContent: config.sceneContent,
        userCharacterId: `char_${config.userCharacterName}`,
        userCharacterName: config.userCharacterName,
        autoPlayNonUserLines: true,
        enableSubtitles: true,
      });
      setHasStarted(true);
    }
  }, [hasStarted, startRehearsalSession, config]);

  const currentLine = getCurrentLine();
  const nextLine = getNextLine();
  const previousLines = getPreviousLines(3);
  const isUserLine = isCurrentLineUserLine();
  const progress = getCurrentLinePercentage();

  if (!currentSession || !hasStarted) {
    return <div className="text-gray-400 p-4">Setting up your rehearsal...</div>;
  }

  const handleEnd = () => {
    endRehearsalSession();
    onComplete();
  };

  return (
    <div className="space-y-6">
      {/* Main Line Display */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 space-y-4">
        {/* Current Line */}
        {currentLine && (
          <div
            className={`p-6 rounded-lg border-2 text-center space-y-2 ${
              isUserLine
                ? "bg-amber-900/30 border-amber-600"
                : "bg-cyan-900/30 border-cyan-600"
            }`}
          >
            <div className="text-sm font-semibold text-gray-400">
              {currentLine.character}
            </div>
            <div className="text-2xl font-bold text-white">
              {currentLine.dialogue}
            </div>
            {isUserLine && (
              <div className="text-sm text-amber-300 font-semibold">
                ➤ Your line - Read aloud!
              </div>
            )}
          </div>
        )}

        {/* Progress Bar */}
        <div>
          <div className="bg-gray-700 rounded h-2">
            <div
              className="bg-cyan-500 h-2 rounded transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Line {(currentSession.currentLineIndex || 0) + 1} of{" "}
            {dialogueLines.length}
          </p>
        </div>

        {/* Previous Lines */}
        {previousLines.length > 0 && (
          <div className="bg-gray-900/50 rounded p-3 space-y-2 max-h-32 overflow-y-auto">
            <div className="text-xs font-semibold text-gray-400">Previous</div>
            {previousLines.map((line, idx) => (
              <div key={idx} className="text-xs text-gray-400">
                <span className="font-semibold text-gray-300">
                  {line.character}:
                </span>{" "}
                {line.dialogue.substring(0, 80)}...
              </div>
            ))}
          </div>
        )}

        {/* Next Line Preview */}
        {nextLine && (
          <div className="bg-gray-900/50 rounded p-3">
            <div className="text-xs font-semibold text-gray-400 mb-1">
              Up Next
            </div>
            <div className="text-sm text-gray-300">
              <span className="font-semibold">{nextLine.character}:</span>{" "}
              {nextLine.dialogue.substring(0, 80)}...
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
        <div className="flex gap-3">
          <Button
            onClick={() => advanceToNextLine()}
            className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-lg py-3"
          >
            ▶️ Next Line
          </Button>
        </div>

        <button
          onClick={handleEnd}
          className="w-full bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold"
        >
          🛑 End Rehearsal
        </button>
      </div>
    </div>
  );
}
