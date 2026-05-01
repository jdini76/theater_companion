import { Scene } from "@/types/scene";
import { parseDialogueLines } from "@/lib/rehearsal";

export interface SongLine {
  character: string;
  text: string;
}

export interface SongEntry {
  /** Unique ID: `${sceneId}_song_${songIndex}` */
  id: string;
  sceneId: string;
  sceneTitle: string;
  /**
   * Song title from an explicit cue marker (e.g. `(Song: "Tomorrow")`),
   * or a generated fallback like "Song 2".
   */
  title: string;
  /** Ordered lyric lines */
  lines: SongLine[];
  /** Unique character names that sing in this song */
  characters: string[];
}

/**
 * Extract all song blocks from a list of scenes.
 *
 * For each scene, parses the dialogue lines, groups consecutive `isSong`
 * entries into discrete song blocks, and returns a `SongEntry` per block.
 */
export function extractSongsFromScenes(
  scenes: Scene[],
  knownCast?: string[],
): SongEntry[] {
  const results: SongEntry[] = [];

  for (const scene of scenes) {
    if (!scene.content?.trim()) continue;

    const dialogueLines = parseDialogueLines(
      scene.content,
      undefined,
      knownCast,
    );
    const songLines = dialogueLines.filter((l) => l.isSong);

    if (songLines.length === 0) continue;

    // Group consecutive song lines into blocks.
    // A block breaks when a non-song line appears between two song lines.
    const nonSongLineNumbers = new Set(
      dialogueLines.filter((l) => !l.isSong).map((l) => l.lineNumber),
    );

    const blocks: (typeof songLines)[] = [];
    let current: typeof songLines = [];

    for (let i = 0; i < songLines.length; i++) {
      const line = songLines[i];
      const prev = songLines[i - 1];

      if (prev) {
        let hasGap = false;
        for (let n = prev.lineNumber + 1; n < line.lineNumber; n++) {
          if (nonSongLineNumbers.has(n)) {
            hasGap = true;
            break;
          }
        }
        if (hasGap) {
          if (current.length > 0) blocks.push(current);
          current = [];
        }
      }

      current.push(line);
    }
    if (current.length > 0) blocks.push(current);

    let songIndex = 0;
    for (const block of blocks) {
      songIndex++;

      const explicitTitle = block.find((l) => l.songTitle)?.songTitle ?? null;
      const title = explicitTitle ?? `Song ${songIndex}`;

      const lines: SongLine[] = block.map((l) => ({
        character: l.character,
        text: l.dialogue,
      }));

      const characters = Array.from(
        new Set(block.map((l) => l.character).filter((c) => c !== "[Song]")),
      ).sort();

      results.push({
        id: `${scene.id}_song_${songIndex}`,
        sceneId: scene.id,
        sceneTitle: scene.title,
        title,
        lines,
        characters,
      });
    }
  }

  return results;
}
