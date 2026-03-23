import { DialogueLine } from "@/types/rehearsal";

/**
 * Parse dialogue lines from scene content
 * Detects "CHARACTER NAME: dialogue" format with multiline support
 * Also handles stage directions in [brackets] or (parentheses)
 */
export function parseDialogueLines(sceneContent: string): DialogueLine[] {
  const lines: DialogueLine[] = [];
  const contentLines = sceneContent.split("\n");
  let lineNumber = 0;
  let lastCharacter: string | null = null;

  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      lastCharacter = null; // Reset when encountering blank line
      continue;
    }

    // Check for stage directions (lines in brackets or parentheses)
    const stageDirectionPattern = /^[\[\(].*[\]\)]$/;
    if (stageDirectionPattern.test(trimmed)) {
      lines.push({
        lineNumber: lineNumber++,
        character: "[Stage Direction]",
        dialogue: trimmed,
        isStageDirection: true,
      });
      lastCharacter = null;
      continue;
    }

    // Try to detect character name and dialogue
    const dialogueMatch = trimmed.match(/^([A-Z][A-Z\s\-']*?)\s*:\s*(.+)$/);

    if (dialogueMatch) {
      const character = dialogueMatch[1].trim();
      const dialogue = dialogueMatch[2].trim();

      // Filter out common false positives (URLs, timestamps, etc.)
      if (!isLikelyCharacterName(character)) {
        // Not a character line, treat as narrative
        lines.push({
          lineNumber: lineNumber++,
          character: "[Narrative]",
          dialogue: trimmed,
        });
        lastCharacter = null;
        continue;
      }

      lines.push({
        lineNumber: lineNumber++,
        character,
        dialogue,
      });
      lastCharacter = character;
    } else if (
      lastCharacter &&
      line.startsWith("  ") &&
      !trimmed.startsWith("[") &&
      !trimmed.startsWith("(")
    ) {
      // Multiline dialogue continuation (starts with whitespace)
      // Append to the last dialogue line
      const lastLine = lines[lines.length - 1];
      if (lastLine && lastLine.character === lastCharacter) {
        lastLine.dialogue += " " + trimmed;
      }
    } else {
      // Narrative or continued dialogue
      lines.push({
        lineNumber: lineNumber++,
        character: "[Narrative]",
        dialogue: trimmed,
      });
      lastCharacter = null;
    }
  }

  return lines;
}

/**
 * Heuristic to determine if a string is likely a character name
 */
function isLikelyCharacterName(name: string): boolean {
  // Character names should be mostly letters, spaces, hyphens, apostrophes
  if (!name || name.length > 50) return false;

  // Should not contain URLs, emails, or file paths
  if (name.includes("/") || name.includes("@") || name.includes(".com")) {
    return false;
  }

  // Should be mostly letters
  const letterCount = (name.match(/[A-Z\s\-']/g) || []).length;
  return letterCount / name.length > 0.7;
}

/**
 * Extract unique character names from dialogue lines
 */
export function extractCharacterNames(lines: DialogueLine[]): string[] {
  const characters = new Set<string>();

  for (const line of lines) {
    if (!line.isStageDirection && line.character !== "[Narrative]") {
      characters.add(line.character);
    }
  }

  return Array.from(characters).sort();
}

/**
 * Filter dialogue lines by character
 */
export function getLinesByCharacter(
  lines: DialogueLine[],
  characterName: string,
): DialogueLine[] {
  return lines.filter((line) => line.character === characterName);
}

/**
 * Get lines for a user to practice (all non-user character lines)
 */
export function getNonUserLines(
  lines: DialogueLine[],
  userCharacterName: string,
): DialogueLine[] {
  return lines.filter(
    (line) =>
      line.character !== userCharacterName &&
      line.character !== "[Narrative]" &&
      !line.isStageDirection,
  );
}

/**
 * Calculate statistics about a scene
 */
export interface SceneStatistics {
  totalLines: number;
  dialogueLines: number;
  stageDirections: number;
  uniqueCharacters: number;
  characterLineCount: { [character: string]: number };
}

export function getSceneStatistics(lines: DialogueLine[]): SceneStatistics {
  const characterLineCount: { [character: string]: number } = {};
  let dialogueLines = 0;
  let stageDirections = 0;

  for (const line of lines) {
    if (line.isStageDirection) {
      stageDirections++;
    } else if (line.character !== "[Narrative]") {
      dialogueLines++;
      characterLineCount[line.character] =
        (characterLineCount[line.character] || 0) + 1;
    }
  }

  return {
    totalLines: lines.length,
    dialogueLines,
    stageDirections,
    uniqueCharacters: Object.keys(characterLineCount).length,
    characterLineCount,
  };
}

/**
 * Get a summary of the scene for UI display
 */
export interface SceneSummary {
  characters: string[];
  dialogueLineCount: number;
  stageDirectionCount: number;
  narrativeLineCount: number;
  characterLineBreakdown: { [character: string]: number };
}

export function getSceneSummary(sceneContent: string): SceneSummary {
  const lines = parseDialogueLines(sceneContent);
  const stats = getSceneStatistics(lines);

  let narrativeLineCount = 0;
  for (const line of lines) {
    if (line.character === "[Narrative]") {
      narrativeLineCount++;
    }
  }

  return {
    characters: extractCharacterNames(lines),
    dialogueLineCount: stats.dialogueLines,
    stageDirectionCount: stats.stageDirections,
    narrativeLineCount,
    characterLineBreakdown: stats.characterLineCount,
  };
}

/**
 * Generate a rehearsal ID
 */
export function generateRehearsalId(): string {
  return `rehearsal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get next dialogue line from a character perspective
 * Useful for finding the next line where a character speaks
 */
export function findNextCharacterLine(
  lines: DialogueLine[],
  currentIndex: number,
  characterName: string,
): DialogueLine | null {
  for (let i = currentIndex + 1; i < lines.length; i++) {
    if (lines[i].character === characterName) {
      return lines[i];
    }
  }
  return null;
}

/**
 * Get context around a line (previous and next lines)
 */
export interface LineContext {
  previous: DialogueLine | null;
  current: DialogueLine;
  next: DialogueLine | null;
}

export function getLineContext(
  lines: DialogueLine[],
  lineIndex: number,
): LineContext | null {
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return null;
  }

  return {
    previous: lineIndex > 0 ? lines[lineIndex - 1] : null,
    current: lines[lineIndex],
    next: lineIndex < lines.length - 1 ? lines[lineIndex + 1] : null,
  };
}

/**
 * Cue Only mode helper: given a position in the line list, return the index
 * of the single line that should be spoken as the "cue" — i.e. the line
 * immediately before the next occurrence of the user's character.
 *
 * Returns null when there are no more user lines after fromIndex (meaning
 * the rest of the scene can play out normally) or when the user's very
 * first line is line 0 (no preceding cue exists).
 */
export function getCueLineIndex(
  lines: Array<{ speaker: string }>,
  fromIndex: number,
  userCharacter: string,
): number | null {
  const nextUserIdx = lines.findIndex(
    (l, i) => i > fromIndex && l.speaker === userCharacter,
  );
  if (nextUserIdx === -1) return null; // no more user lines
  if (nextUserIdx === 0) return null; // user line is first; no cue before it
  return nextUserIdx - 1;
}
