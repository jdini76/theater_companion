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

    const sceneOverrides = sceneLineOverrides?.get(scene.id);

    // ── Override-based extraction ──────────────────────────────────────────
    // If the user has explicitly marked song-title lines in the scene viewer,
    // each override defines a discrete song.  We extract the raw content lines
    // that follow each song-title line as the lyrics (stopping at the next
    // blank line or another song-title).  This takes priority over auto-
    // detection so that what the user marked is always reflected here.
    if (sceneOverrides) {
      const songTitleEntries: Array<[number, string]> = [];
      for (const [lineIdx, ov] of sceneOverrides) {
        if (ov.kind === "song-title") songTitleEntries.push([lineIdx, ov.text]);
      }

      if (songTitleEntries.length > 0) {
        songTitleEntries.sort(([a], [b]) => a - b);
        const rawLines = scene.content.split("\n");

        for (let si = 0; si < songTitleEntries.length; si++) {
          const [lineIdx, title] = songTitleEntries[si];
          const nextTitleIdx = songTitleEntries[si + 1]?.[0] ?? rawLines.length;

          const songContent: SongLine[] = [];
          for (
            let j = lineIdx + 1;
            j < nextTitleIdx && j < rawLines.length;
            j++
          ) {
            const rawLine = rawLines[j].trim();
            if (!rawLine) {
              // A blank line ends the lyric block if we already have content.
              if (songContent.length > 0) break;
              continue;
            }
            // Stage-direction overrides are not lyrics.
            const lineOv = sceneOverrides.get(j);
            if (lineOv?.kind === "stage-direction") continue;

            songContent.push({ character: "[Song]", text: rawLine });
          }

          results.push({
            id: `${scene.id}_song_${lineIdx}`,
            sceneId: scene.id,
            sceneTitle: scene.title,
            title,
            lines: songContent,
            characters: [],
          });
        }
        continue; // override-based extraction done; skip auto-detection
      }
    }

    // ── Auto-detection fallback ────────────────────────────────────────────
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
    // Priority for title: (1) explicit cue marker, (2) scene title.
    const allLines: SongLine[] = blocks.flatMap((block) =>
      block.map((l) => ({ character: l.character, text: l.dialogue })),
    );

    const explicitTitle =
      blocks.flatMap((b) => b).find((l) => l.songTitle)?.songTitle ?? null;
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
