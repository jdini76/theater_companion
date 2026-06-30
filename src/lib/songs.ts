import { Scene } from "@/types/scene";
import { parseDialogueLines, isSongCueStart, isSongCueEnd } from "@/lib/rehearsal";
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
  song: { title: string; id: string; lines: SongLine[] },
): SongEntry {
  const characters = Array.from(
    new Set(
      song.lines
        .map((l) => l.character)
        .filter((c) => c && !c.startsWith("[")),
    ),
  ).sort();
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
 * Uses the same inSongBlock + looksLikeLyric logic as the SceneHighlight
 * renderer so the Songs page always mirrors what the scene viewer shows.
 * Prefers scene.lines (pre-parsed) over re-parsing from content.
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
          ? parseDialogueLines(scene.content, undefined, knownCast)
          : [];

    if (!lines.length) continue;

    let inSongBlock = false;
    let currentSong: { title: string; id: string; lines: SongLine[] } | null =
      null;
    let songCounter = 0;

    for (const line of lines) {
      // Song-title line → flush current song and start a new named block
      if (line.songTitle) {
        if (currentSong?.lines.length) results.push(buildEntry(scene, currentSong));
        songCounter++;
        currentSong = {
          title: line.songTitle,
          id: `${scene.id}_song_${songCounter}`,
          lines: [],
        };
        inSongBlock = true;
        continue;
      }

      // Scene heading → close everything
      if (line.character === "[Scene Heading]") {
        if (currentSong?.lines.length) results.push(buildEntry(scene, currentSong));
        inSongBlock = false;
        currentSong = null;
        continue;
      }

      // Stage directions update block state but are never lyrics
      if (line.isStageDirection) {
        const t = (line.dialogue ?? "").trim();
        if (isSongCueStart(t)) {
          if (!currentSong) {
            songCounter++;
            currentSong = {
              title: scene.title,
              id: `${scene.id}_song_${songCounter}`,
              lines: [],
            };
          }
          inSongBlock = true;
        } else if (isSongCueEnd(t)) {
          if (currentSong?.lines.length) results.push(buildEntry(scene, currentSong));
          inSongBlock = false;
          currentSong = null;
        }
        continue;
      }

      // Collect lyric lines: must be in a song block AND all-caps (no lowercase)
      if (
        inSongBlock &&
        currentSong &&
        line.dialogue &&
        !/[a-z]/.test(line.dialogue)
      ) {
        currentSong.lines.push({
          character: line.character,
          text: line.dialogue,
        });
      }
    }

    // Flush the last song in the scene
    if (currentSong?.lines.length) results.push(buildEntry(scene, currentSong));
  }

  return results;
}
