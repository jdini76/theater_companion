"use client";

import React, { useState, useEffect } from "react";
import { DialogueLine } from "@/types/rehearsal";
import { Button } from "@/components/ui/Button";
import { speakText, stopSpeaking } from "@/lib/voice";
import { VoiceConfig } from "@/types/voice";

interface RehearsalControlsProps {
  currentLine: DialogueLine | null;
  isUserLine: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  voiceConfig: VoiceConfig | null;
  onPause: () => void;
  onResume: () => void;
  onNextLine: () => void;
  onPreviousLine: () => void;
  onEnd: () => void;
  autoPlayNonUserLines?: boolean;
}

export function RehearsalControls({
  currentLine,
  isUserLine,
  isPlaying,
  isPaused,
  voiceConfig,
  onPause,
  onResume,
  onNextLine,
  onPreviousLine,
  onEnd,
  autoPlayNonUserLines = true,
}: RehearsalControlsProps) {
  const [isSpeaking_, setIsSpeaking] = useState(false);

  // Auto-play non-user lines with slight delay if enabled
  useEffect(() => {
    if (
      isPlaying &&
      !isPaused &&
      !isUserLine &&
      !isSpeaking_ &&
      currentLine &&
      autoPlayNonUserLines
    ) {
      const timer = setTimeout(() => {
        playCurrentLine();
      }, 200);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, isPaused, isUserLine, isSpeaking_, currentLine, autoPlayNonUserLines]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const playCurrentLine = async () => {
    if (!currentLine || isSpeaking_) return;

    if (currentLine.isStageDirection) {
      // Don't speak stage directions, just auto-advance
      setTimeout(() => onNextLine(), 500);
      return;
    }

    if (isUserLine) {
      // Highlight for user to read
      setIsSpeaking(true);
      setTimeout(() => {
        setIsSpeaking(false);
      }, 2000);
      return;
    }

    if (!voiceConfig) {
      // No voice config, just advance
      setTimeout(() => onNextLine(), 1000);
      return;
    }

    try {
      setIsSpeaking(true);

      // Speak the line
      await speakText(currentLine.dialogue, voiceConfig);

      // Small delay before auto-advancing
      setTimeout(() => {
        setIsSpeaking(false);
        onNextLine();
      }, 300);
    } catch (error) {
      console.error("Speech error:", error);
      setIsSpeaking(false);
    }
  };

  const stopPlayback = () => {
    stopSpeaking();
    setIsSpeaking(false);
    onPause();
  };

  if (!currentLine) {
    return (
      <div className="flex gap-3">
        <Button onClick={onEnd} className="flex-1 bg-gray-700 hover:bg-gray-600">
          ✓ Close Rehearsal
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Display */}
      <div className="text-center text-sm text-gray-400">
        {isSpeaking_ && !isUserLine && (
          <p className="text-cyan-400">🔊 Playing character line...</p>
        )}
        {isUserLine && (
          <p className="text-amber-400">
            {isSpeaking_
              ? "🎤 Ready for your line..."
              : "🎤 Your line - read when ready"}
          </p>
        )}
        {isPaused && !isUserLine && (
          <p className="text-gray-400">⏸️ Paused</p>
        )}
      </div>

      {/* Main Control Buttons */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {/* Previous Line */}
        <Button
          onClick={onPreviousLine}
          variant="outline"
          className="border-gray-600 hover:bg-gray-800"
          title="Go to previous line"
        >
          ⏮️ Previous
        </Button>

        {/* Play / Pause / Resume */}
        {isPlaying && !isPaused && isSpeaking_ ? (
          <Button
            onClick={stopPlayback}
            className="bg-red-600 hover:bg-red-700"
            title="Stop playback"
          >
            ⏹️ Stop
          </Button>
        ) : isPlaying && !isPaused ? (
          <Button
            onClick={onPause}
            variant="outline"
            className="border-cyan-600 text-cyan-400 hover:bg-cyan-900/30"
            title="Pause rehearsal"
          >
            ⏸️ Pause
          </Button>
        ) : isPaused ? (
          <Button
            onClick={onResume}
            className="bg-green-600 hover:bg-green-700"
            title="Resume rehearsal"
          >
            ▶️ Resume
          </Button>
        ) : (
          <Button
            onClick={playCurrentLine}
            disabled={currentLine.isStageDirection}
            className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
            title={
              currentLine.isStageDirection
                ? "Cannot play stage directions"
                : "Play current line"
            }
          >
            ▶️ Play
          </Button>
        )}

        {/* Replay Current Line */}
        <Button
          onClick={playCurrentLine}
          variant="outline"
          className="border-gray-600 hover:bg-gray-800"
          title="Replay current line"
        >
          🔄 Replay
        </Button>

        {/* Next Line */}
        <Button
          onClick={onNextLine}
          className="bg-cyan-600 hover:bg-cyan-700"
          title="Advance to next line"
        >
          Next ⏭️
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        {/* Skip to End Rehearsal */}
        <Button
          onClick={onEnd}
          variant="outline"
          className="border-gray-600 hover:bg-gray-800 col-span-2"
          title="End rehearsal session"
        >
          ⏹️ End Rehearsal
        </Button>
      </div>

      {/* Tips */}
      <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-gray-700">
        <p>💡 <span className="text-gray-400">Auto-plays non-user character lines</span></p>
        <p>💡 <span className="text-gray-400">Manual pause on your lines - press Next when ready</span></p>
        <p>💡 <span className="text-gray-400">Use Previous to review earlier dialogue</span></p>
      </div>
    </div>
  );
}
