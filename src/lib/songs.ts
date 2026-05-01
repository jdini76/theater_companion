import { Scene } from "@/types/scene";
import { parseDialogueLines } from "@/lib/rehearsal";
import { type LineOverride } from "@/components/scenes/SceneHighlight";

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
 *
 * @param sceneLineOverrides - Optional map of sceneId → (lineIndex → LineOverride).
 *   Lines marked with `{ kind: "song-title" }` will be used as the song title.
 */
export function extractSongsFromScenes(
  scenes: Scene[],
  knownCast?: string[],
  sceneLineOverrides?: Map<string, Map<number, LineOverride>>,
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

    // Merge all blocks in this scene into a single song entry.
    // Priority for title: (1) song-title line override, (2) explicit cue marker, (3) scene title.
    const allLines: SongLine[] = blocks.flatMap((block) =>
      block.map((l) => ({ character: l.character, text: l.dialogue })),
    );

    // Check for a song-title override on any line in this scene
    const overrideTitle = (() => {
      const overrides = sceneLineOverrides?.get(scene.id);
      if (!overrides) return null;
      for (const [, ov] of overrides) {
        if (ov.kind === "song-title") return ov.text;
      }
      return null;
    })();

    const explicitTitle =
      overrideTitle ??
      blocks.flatMap((b) => b).find((l) => l.songTitle)?.songTitle ??
      null;
    const title = explicitTitle ?? scene.title;

    const characters = Array.from(
      new Set(allLines.map((l) => l.character).filter((c) => c !== "[Song]")),
    ).sort();

    results.push({
      id: `${scene.id}_songs`,
      sceneId: scene.id,
      sceneTitle: scene.title,
      title,
      lines: allLines,
      characters,
    });
  }

  return results;
}
