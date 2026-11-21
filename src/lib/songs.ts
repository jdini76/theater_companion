import { Scene } from "@/types/scene";
import { getDialogueSpeakers, getExplicitSongEnds, parseDialogueLines, isSongCueStart, isSongCueEnd } from "@/lib/rehearsal";
import type { DialogueLine } from "@/types/rehearsal";

export interface SongLine {
  character: string;
  text: string;
}

export interface SongEntry {
  /** Unique ID: `${sceneId}_song_${index}` */
  id: string;
  sceneId: string;
  sceneTitle: string;
  /**
   * Song title from an explicit song-title line or a generated fallback.
   */
  title: string;
  /** Ordered lyric lines */
  lines: SongLine[];
  /** Unique character names that sing in this song */
  characters: string[];
}

function buildEntry(
  scene: Scene,
  song: { title: string; id: string; lines: SongLine[]; singers: Set<string> },
): SongEntry {
  const characters = Array.from(song.singers).sort();
  return {
    id: song.id,
    sceneId: scene.id,
    sceneTitle: scene.title,
    title: song.title,
    lines: song.lines,
    characters,
  };
}

/**
 * Extract all song blocks from a list of scenes.
 *
 * Explicitly bounded songs include dialogue of any casing. Songs without
 * an End Song marker use the existing cue and lyric detection.
 */
export function extractSongsFromScenes(
  scenes: Scene[],
  knownCast?: string[],
): SongEntry[] {
  const results: SongEntry[] = [];

  for (const scene of scenes) {
    const lines: DialogueLine[] =
      scene.lines && scene.lines.length > 0
        ? scene.lines
        : scene.content?.trim()
          ? parseDialogueLines(scene.content, undefined, knownCast, scene.lineOverrides)
          : [];

    if (!lines.length) continue;

    const explicitEnds = getExplicitSongEnds(lines);
    let explicitEnd: number | undefined;
    let currentSong: {
      title: string;
      id: string;
      lines: SongLine[];
      hasExplicitTitle: boolean;
      singers: Set<string>;
    } | null = null;

    const finishSong = () => {
      if (currentSong && (currentSong.hasExplicitTitle || currentSong.lines.length > 0)) {
        results.push(buildEntry(scene, currentSong));
      }
      currentSong = null;
      explicitEnd = undefined;
    };
    let songCounter = 0;

    for (const [index, line] of lines.entries()) {
      // Song-title line → flush current song and start a new named block
      if (line.songTitle) {
        finishSong();
        songCounter++;
        currentSong = {
          title: line.songTitle,
          hasExplicitTitle: true,
          singers: new Set(),
          id: `${scene.id}_song_${songCounter}`,
          lines: [],
        };
        explicitEnd = explicitEnds.get(index);
        continue;
      }

      // Scene heading → close everything
      if (line.character === "[Scene Heading]") {
        finishSong();
        continue;
      }

      // Stage directions update block state but are never lyrics
      if (line.isStageDirection) {
        if (explicitEnd !== undefined) continue;
        const t = (line.dialogue ?? "").trim();
        if (isSongCueStart(t)) {
          if (!currentSong) {
            songCounter++;
            currentSong = {
              title: scene.title,
              hasExplicitTitle: false,
              singers: new Set(),
              id: `${scene.id}_song_${songCounter}`,
              lines: [],
            };
          }
        } else if (isSongCueEnd(t)) {
          finishSong();
        }
        continue;
      }

      if (currentSong && line.dialogue &&
          (explicitEnd !== undefined || !/[a-z]/.test(line.dialogue))) {
        for (const speaker of getDialogueSpeakers(line)) {
          currentSong.singers.add(speaker);
        }
        currentSong.lines.push({
          character: line.character,
          text: line.dialogue,
        });
      }
      if (line.isSongEnd) finishSong();
    }

    // Flush the last song in the scene
    finishSong();
  }

  return results;
}
