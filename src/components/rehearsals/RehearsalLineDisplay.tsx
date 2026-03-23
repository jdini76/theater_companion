"use client";

import React from "react";
import { DialogueLine } from "@/types/rehearsal";

interface RehearsalLineDisplayProps {
  currentLine: DialogueLine | null;
  nextLine: DialogueLine | null;
  previousLines: DialogueLine[];
  userCharacterName: string;
  currentLinePercentage: number;
}

export function RehearsalLineDisplay({
  currentLine,
  nextLine,
  previousLines,
  userCharacterName,
  currentLinePercentage,
}: RehearsalLineDisplayProps) {
  if (!currentLine) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-lg">Scene completed! Great rehearsal!</p>
      </div>
    );
  }

  const isUserTurn = currentLine.character === userCharacterName;

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-gray-400">
          <span>Scene Progress</span>
          <span>{Math.round(currentLinePercentage)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${currentLinePercentage}%` }}
          />
        </div>
      </div>

      {/* Previous Lines Context */}
      {previousLines.length > 0 && (
        <div className="space-y-2 max-h-32 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Recent Lines
          </p>
          <div className="space-y-1">
            {previousLines.map((line, idx) => {
              const isPreviousUser = line.character === userCharacterName;
              return (
                <div
                  key={idx}
                  className={`text-xs px-3 py-2 rounded-lg ${
                    isPreviousUser
                      ? "bg-cyan-900/40 text-cyan-300"
                      : "bg-gray-800 text-gray-400"
                  }`}
                >
                  <span className="font-semibold">{line.character}:</span>{" "}
                  {line.dialogue}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Current Line - Large Centered Display */}
      <div
        className={`rounded-xl p-8 space-y-4 backdrop-blur-sm border-2 transition-all duration-300 ${
          isUserTurn
            ? "bg-amber-900/30 border-amber-500/50 shadow-lg shadow-amber-500/20"
            : "bg-cyan-900/20 border-cyan-500/30 shadow-lg shadow-cyan-500/10"
        }`}
      >
        {/* Speaker Badge */}
        <div className="flex items-center justify-between">
          <div className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
            isUserTurn
              ? "bg-amber-500/30 text-amber-300"
              : "bg-cyan-500/30 text-cyan-300"
          }`}>
            {isUserTurn ? "🎤 Your Turn" : "🎭 " + currentLine.character}
          </div>
          {currentLine.isStageDirection && (
            <span className="text-xs font-semibold text-purple-400">
              [Stage Direction]
            </span>
          )}
        </div>

        {/* Line Number */}
        <div className="text-xs text-gray-500">Line {currentLine.lineNumber + 1}</div>

        {/* Character Name */}
        <div className="text-2xl font-bold text-white">
          {currentLine.character}
        </div>

        {/* Dialogue */}
        <div className={`text-3xl font-semibold leading-relaxed ${
          isUserTurn ? "text-amber-100" : "text-cyan-100"
        }`}>
          {`“${currentLine.dialogue}”`}
        </div>

        {/* Stage Directions or Character Context */}
        {isUserTurn && (
          <div className="text-sm text-amber-300/70 italic pt-4 border-t border-amber-500/20">
            Prepare to deliver your line. When ready, click &quot;Next Line&quot; to advance.
          </div>
        )}
      </div>

      {/* Next Line Preview */}
      {nextLine && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Up Next
          </p>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-sm">
            <div className="font-semibold text-cyan-400">{nextLine.character}</div>
            <div className="text-gray-300 mt-2">{`“${nextLine.dialogue}”`}</div>
          </div>
        </div>
      )}
    </div>
  );
}
