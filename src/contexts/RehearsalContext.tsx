"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  RehearsalSession,
  RehearsalConfig,
  DialogueLine,
  RehearsalContextType,
} from "@/types/rehearsal";
import {
  parseDialogueLines,
  generateRehearsalId,
  getLinesByCharacter,
} from "@/lib/rehearsal";

const RehearsalContext = createContext<RehearsalContextType | undefined>(
  undefined
);

export function RehearsalProvider({ children }: { children: React.ReactNode }) {
  const [currentSession, setCurrentSession] = useState<RehearsalSession | null>(
    null
  );
  const [dialogueLines, setDialogueLines] = useState<DialogueLine[]>([]);
  const [sceneHistory, saveSceneHistory] = useLocalStorage<RehearsalSession[]>(
    "theater_rehearsal_history",
    []
  );

  const startRehearsalSession = useCallback((config: RehearsalConfig) => {
    // Parse dialogue lines from scene content
    const lines = parseDialogueLines(config.sceneContent);
    setDialogueLines(lines);

    // Create new session
    const session: RehearsalSession = {
      id: generateRehearsalId(),
      projectId: config.projectId,
      sceneId: config.sceneId,
      userCharacterId: config.userCharacterId,
      userCharacterName: config.userCharacterName,
      startedAt: new Date().toISOString(),
      currentLineIndex: 0,
      isPlaying: false,
      isPaused: false,
    };

    setCurrentSession(session);

    // Save to history
    saveSceneHistory([
      ...sceneHistory,
      {
        ...session,
        isPlaying: false,
        isPaused: false,
      },
    ]);

    return session;
  }, [sceneHistory, saveSceneHistory]);

  const pauseRehearsalSession = useCallback(() => {
    if (currentSession) {
      setCurrentSession({
        ...currentSession,
        isPaused: true,
        isPlaying: false,
        pausedAt: new Date().toISOString(),
      });
    }
  }, [currentSession]);

  const resumeRehearsalSession = useCallback(() => {
    if (currentSession) {
      setCurrentSession({
        ...currentSession,
        isPaused: false,
        isPlaying: true,
        pausedAt: undefined,
      });
    }
  }, [currentSession]);

  const endRehearsalSession = useCallback(() => {
    if (currentSession) {
      const completedSession = {
        ...currentSession,
        completedAt: new Date().toISOString(),
        isPlaying: false,
        isPaused: false,
      };

      // Update history with completed session
      saveSceneHistory(
        sceneHistory.map((s) =>
          s.id === currentSession.id ? completedSession : s
        )
      );
    }

    setCurrentSession(null);
    setDialogueLines([]);
  }, [currentSession, sceneHistory, saveSceneHistory]);

  const getCurrentLine = useCallback((): DialogueLine | null => {
    if (!currentSession || currentSession.currentLineIndex >= dialogueLines.length) {
      return null;
    }
    const line = dialogueLines[currentSession.currentLineIndex];
    return {
      ...line,
      isUserLine: line.character === currentSession.userCharacterName,
    };
  }, [currentSession, dialogueLines]);

  const getNextLine = useCallback((): DialogueLine | null => {
    if (!currentSession || currentSession.currentLineIndex + 1 >= dialogueLines.length) {
      return null;
    }
    const line = dialogueLines[currentSession.currentLineIndex + 1];
    return {
      ...line,
      isUserLine: line.character === currentSession.userCharacterName,
    };
  }, [currentSession, dialogueLines]);

  const getPreviousLines = useCallback(
    (count: number): DialogueLine[] => {
      if (!currentSession) return [];

      const startIndex = Math.max(0, currentSession.currentLineIndex - count);
      return dialogueLines
        .slice(startIndex, currentSession.currentLineIndex)
        .map((line) => ({
          ...line,
          isUserLine: line.character === currentSession.userCharacterName,
        }));
    },
    [currentSession, dialogueLines]
  );

  const advanceToNextLine = useCallback(() => {
    if (!currentSession || currentSession.currentLineIndex >= dialogueLines.length - 1) {
      // End of scene
      endRehearsalSession();
      return;
    }

    const nextLineIndex = currentSession.currentLineIndex + 1;
    const nextLine = dialogueLines[nextLineIndex];

    setCurrentSession({
      ...currentSession,
      currentLineIndex: nextLineIndex,
      isPlaying: true,
      isPaused: nextLine.character === currentSession.userCharacterName,
    });
  }, [currentSession, dialogueLines, endRehearsalSession]);

  const jumpToLine = useCallback(
    (lineIndex: number) => {
      if (!currentSession || lineIndex < 0 || lineIndex >= dialogueLines.length) {
        return;
      }

      const line = dialogueLines[lineIndex];
      setCurrentSession({
        ...currentSession,
        currentLineIndex: lineIndex,
        isPlaying: true,
        isPaused: line.character === currentSession.userCharacterName,
      });
    },
    [currentSession, dialogueLines]
  );

  const replayCurrentLine = useCallback(() => {
    if (!currentSession) return;

    const currentLine = dialogueLines[currentSession.currentLineIndex];
    if (!currentLine) return;

    setCurrentSession({
      ...currentSession,
      isPlaying: true,
      isPaused: currentLine.character === currentSession.userCharacterName,
    });
  }, [currentSession, dialogueLines]);

  const getCurrentLinePercentage = useCallback((): number => {
    if (!currentSession || dialogueLines.length === 0) return 0;
    return (currentSession.currentLineIndex / dialogueLines.length) * 100;
  }, [currentSession, dialogueLines]);

  const isCurrentLineUserLine = useCallback((): boolean => {
    const current = getCurrentLine();
    return current?.isUserLine || false;
  }, [getCurrentLine]);

  const getUserCharacterLines = useCallback((): DialogueLine[] => {
    if (!currentSession) return [];
    return getLinesByCharacter(dialogueLines, currentSession.userCharacterName).map(
      (line) => ({
        ...line,
        isUserLine: true,
      })
    );
  }, [currentSession, dialogueLines]);

  const getLinesByCharacterName = useCallback(
    (characterName: string): DialogueLine[] => {
      return getLinesByCharacter(dialogueLines, characterName).map((line) => ({
        ...line,
        isUserLine: line.character === characterName,
      }));
    },
    [dialogueLines]
  );

  return (
    <RehearsalContext.Provider
      value={{
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
        replayCurrentLine,
        getCurrentLinePercentage,
        isCurrentLineUserLine,
        getUserCharacterLines,
        getLinesByCharacter: getLinesByCharacterName,
      }}
    >
      {children}
    </RehearsalContext.Provider>
  );
}

export function useRehearsalContext() {
  const context = useContext(RehearsalContext);
  if (!context) {
    throw new Error(
      "useRehearsalContext must be used within RehearsalProvider"
    );
  }
  return context;
}
