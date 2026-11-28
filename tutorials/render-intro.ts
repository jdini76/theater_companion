import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';

type Cut = { file: string; start: number; duration: number; say: string };
type Word = [text: string, start: number, end: number];
const [capture = 'out/intro-capture', narration = 'out/intro-emily.mp3',
  timing = 'out/intro-words.json', stem = 'out/tutorial-01-introduction'] = process.argv.slice(2);
const cuts = JSON.parse(await readFile(path.join(capture, 'cuts.json'), 'utf8')) as Cut[];
const words = JSON.parse(await readFile(timing, 'utf8')) as Word[];
const encode = process.env.FFMPEG ?? ffmpeg ?? 'ffmpeg';
const probe = process.env.FFPROBE ?? ffprobe.path;
const run = (executable: string, args: string[]) =>
  execFileSync(executable, args, { encoding: 'utf8', windowsHide: true }).trim();
const audioDuration = Number(run(probe, ['-v', 'error', '-show_entries', 'format=duration',
  '-of', 'default=nw=1:nk=1', narration]));
let nextWord = 0;
const chapters = cuts.map(cut => {
  const expected = cut.say.split(/\s+/);
  const lines = words.slice(nextWord, nextWord + expected.length);
  if (lines.map(line => line[0]).join(' ') !== expected.join(' ')) {
    throw new Error('Transcript differs from recorded step: ' + cut.say);
  }
  nextWord += expected.length;
  return { ...cut, lines };
});
if (nextWord !== words.length) throw new Error('Unused words in the narration.');
const estimates = [0, ...chapters.slice(1).map((chapter, index) =>
  (chapters[index].lines.at(-1)![2] + chapter.lines[0][1]) / 2), audioDuration];
const detection = spawnSync(encode, ['-hide_banner', '-i', narration, '-af',
  'silencedetect=noise=-38dB:d=0.12', '-f', 'null', '-'], { encoding: 'utf8', windowsHide: true });
if (detection.error || detection.status !== 0) {
  throw new Error('Could not detect quiet narration boundaries.', { cause: detection.error ?? detection.stderr });
}
const quietCenters = [...detection.stderr.matchAll(/silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g)]
  .map(([, end, duration]) => Number(end) - Number(duration) / 2);
const boundaries = estimates.map((estimate, index) => {
  if (index === 0 || index === estimates.length - 1) return estimate;
  const nearest = quietCenters.reduce<number | undefined>((best, center) =>
    best === undefined || Math.abs(center - estimate) < Math.abs(best - estimate) ? center : best, undefined);
  if (nearest === undefined || Math.abs(nearest - estimate) > .45) {
    throw new Error('No quiet edit near narration chapter ' + (index + 1) + ' at ' + estimate.toFixed(2) + 's.');
  }
  return nearest;
});
const folder = path.dirname(path.resolve(stem));
await mkdir(folder, { recursive: true });
const scratch = await mkdtemp(path.join(folder, '.intro-'));
const clock = (seconds: number) =>
  new Date(Math.round(seconds * 1000)).toISOString().slice(11, 23).replace('.', ',');
const clips = [];
const audio: string[] = [];
const captions: string[] = [];
let offset = 0;
try {
  // Encode only picture per shot. The narration is encoded once after assembly.
  for (const [index, chapter] of chapters.entries()) {
    const sourceStart = boundaries[index];
    const sourceLength = boundaries[index + 1] - sourceStart;
    const lead = .23;
    const tail = index === chapters.length - 1 ? 1.25 : .48;
    const minimum = estimates[index + 1] - estimates[index] + lead + tail;
    const seconds = Math.ceil(Math.max(minimum, Math.min(chapter.duration - .12, minimum + .38)) * 30) / 30;
    const clipName = 'shot-' + index + '.mp4';
    const clip = path.join(scratch, clipName);
    const videoFilter = 'fps=30,setsar=1,tpad=stop_mode=clone:stop_duration=2';
    run(encode, ['-v', 'error', '-ss', (chapter.start + .1).toFixed(3),
      '-i', path.join(capture, chapter.file), '-map', '0:v:0', '-an', '-vf', videoFilter,
      '-t', seconds.toFixed(6), '-c:v', 'libx264', '-preset', 'fast', '-crf', '19',
      '-pix_fmt', 'yuv420p', clip]);
    clips.push("file '" + clipName + "'");
    const originalLead = lead + sourceStart - estimates[index];
    const narrationStart = offset + Math.max(0, originalLead);
    const trimStart = sourceStart + Math.max(0, -originalLead);
    audio.push('[1:a]atrim=start=' + trimStart.toFixed(6) + ':end=' + boundaries[index + 1].toFixed(6) +
      ',asetpts=PTS-STARTPTS,adelay=' + Math.round(narrationStart * 1000) + ':all=1[a' + index + ']');
    let group: Word[] = [];
    let firstLine = '';
    let line = '';
    function writeCue() {
      if (!group.length) return;
      const start = narrationStart + Math.max(0, group[0][1] - trimStart);
      const end = narrationStart + Math.min(sourceLength + sourceStart, group.at(-1)![2]) - trimStart;
      captions.push((captions.length + 1) + '\n' + clock(start) + ' --> ' + clock(end) + '\n' +
        (firstLine ? firstLine + '\n' : '') + line + '\n');
      group = [];
      firstLine = '';
      line = '';
    }
    for (const word of chapter.lines) {
      if (line && line.length + 1 + word[0].length > 42) {
        if (firstLine) writeCue();
        else { firstLine = line; line = ''; }
      }
      group.push(word);
      line += (line ? ' ' : '') + word[0];
      if (/[.!?]$/.test(word[0]) && group.length >= 5) writeCue();
    }
    writeCue();
    // The concat demuxer uses each MP4's container duration as its next offset.
    offset += Number(run(probe, ['-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=nw=1:nk=1', clip]));
    console.log('Rendered shot ' + (index + 1));
  }
  const list = path.join(scratch, 'shots.txt');
  const subtitle = stem + '.srt';
  await writeFile(list, clips.join('\n') + '\n');
  await writeFile(subtitle, captions.join('\n'));
  audio.push(chapters.map((_, index) => '[a' + index + ']').join('') +
    'amix=inputs=' + chapters.length + ':normalize=0,loudnorm=I=-17:LRA=7:TP=-1.5,apad[mix]');
  run(encode, ['-n', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-i', narration, '-i', subtitle,
    '-filter_complex', audio.join(';'), '-map', '0:v:0', '-map', '[mix]', '-map', '2:s:0',
    '-t', offset.toFixed(3), '-c:v', 'copy', '-c:a', 'aac', '-ar', '48000', '-b:a', '128k',
    '-c:s', 'mov_text', '-metadata:s:a:0', 'language=eng', '-metadata:s:s:0', 'language=eng',
    '-disposition:s:0', 'default', '-movflags', '+faststart', stem + '.mp4']);
  console.log('Wrote ' + stem + '.mp4 and .srt');
} finally {
  await rm(scratch, { recursive: true, force: true });
}

