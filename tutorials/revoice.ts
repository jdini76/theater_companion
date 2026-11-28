import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { KokoroTTS } from 'kokoro-js';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';

const [first, second, third] = process.argv.slice(2);
const timeline = first === '--timeline' ? second : undefined;
if (first === '--timeline' && !timeline) throw new Error('Supply a narration timeline JSON file.');
const source = (timeline ? third : first) ?? 'out/rehearselines-tutorial.mp4';
const definition = second ?? 'clockwork.json';
const voice = process.env.TUTORIAL_VOICE ?? 'af_heart';
const output = source.replace(/\.mp4$/i, timeline ? '-conversational.mp4' : '-neural.mp4');
if (output === source) throw new Error('Source must be an MP4 file.');

function timecode(seconds: number) {
  return new Date(Math.round(seconds * 1000)).toISOString().slice(11, 23).replace('.', ',');
}

function seconds(time: string) {
  const [hours, minutes, second] = time.replace(',', '.').split(':').map(Number);
  return hours * 3600 + minutes * 60 + second;
}

function run(executable: string, args: string[]) {
  return execFileSync(executable, args, { encoding: 'utf8', windowsHide: true }).trim();
}

type Caption = { start: number; end: number; lines: string[] };
type Beat = { say: string; start: number; end: number; speed?: number };

function wrap(beat: Beat): Caption[] {
  const words = beat.say.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (line && line.length + word.length + 1 > 42) {
      lines.push(line);
      line = '';
    }
    line += (line ? ' ' : '') + word;
  }
  if (line) lines.push(line);
  const captions: Caption[] = [];
  let start = beat.start;
  for (let index = 0; index < lines.length; index += 2) {
    const pair = lines.slice(index, index + 2);
    const end = start + (beat.end - beat.start) * pair.join(' ').split(/\s+/).length / words.length;
    captions.push({ start, end, lines: pair });
    start = end;
  }
  return captions;
}

async function originalCues() {
  const { steps } = JSON.parse(await readFile(definition, 'utf8')) as { steps: { say: string }[] };
  const sourceCaptions = (await readFile(source.replace(/\.mp4$/i, '.srt'), 'utf8'))
    .trim().split(/\r?\n\s*\r?\n/).map(block => {
      const [, range, ...lines] = block.split(/\r?\n/);
      const [start, end] = range.split(' --> ').map(seconds);
      return { start, end, lines };
    });

  let cursor = 0;
  const cues = steps.map(({ say }) => {
    const parts: typeof sourceCaptions = [];
    const read = () => parts.flatMap(part => part.lines).join(' ');
    while (read().length < say.length && cursor < sourceCaptions.length) {
      parts.push(sourceCaptions[cursor++]);
    }
    if (read() !== say || parts.length === 0) throw new Error('Captions must match the tutorial definition.');
    return { say, parts, start: parts[0].start, end: parts.at(-1)!.end, speed: .92 };
  });
  if (cursor !== sourceCaptions.length) throw new Error('Unexpected captions after the final step.');
  return cues;
}

const encoder = process.env.FFMPEG ?? ffmpeg ?? 'ffmpeg';
const probe = process.env.FFPROBE ?? ffprobe.path;
const length = Number(run(probe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
  'stream=duration', '-of', 'default=nw=1:nk=1', source]));
if (!(length > 0)) throw new Error('Could not determine the source video duration.');
const beats: Beat[] | undefined = timeline ? JSON.parse(await readFile(timeline, 'utf8')) : undefined;
if (beats && (!Array.isArray(beats) || !beats.length || beats.some((beat, index) =>
  typeof beat.say !== 'string' || !beat.say.trim() ||
  !Number.isFinite(beat.start) || !Number.isFinite(beat.end) ||
  beat.start < (beats[index - 1]?.end ?? 0) || beat.end <= beat.start || beat.end > length ||
  (beat.speed !== undefined && (!Number.isFinite(beat.speed) || beat.speed <= 0))))) {
  throw new Error('Narration beats must be ordered, nonoverlapping, and within the video duration.');
}
const cues = beats?.map(beat => ({ ...beat, parts: wrap(beat) })) ?? await originalCues();
const folder = path.dirname(path.resolve(output));
await mkdir(folder, { recursive: true });
const scratch = await mkdtemp(path.join(folder, '.voice-'));
try {
  const model = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
    dtype: 'q8', device: 'cpu'
  });
  if (!Object.hasOwn(model.voices, voice)) throw new Error('Unknown Kokoro voice: ' + voice);
  const tracks: string[] = [];
  const filters: string[] = [];
  const captions: string[] = [];
  for (const [index, cue] of cues.entries()) {
    const wav = path.join(scratch, 'cue-' + index + '.wav');
    const text = cue.say.replaceAll('RehearseLines', 'Rehearse Lines');
    const audio = await model.generate(text, { voice: voice as keyof typeof model.voices, speed: cue.speed ?? .95 });
    await audio.save(wav);
    tracks.push(wav);
    const duration = Number(run(probe, ['-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=nw=1:nk=1', wav]));
    if (!(duration > 0)) throw new Error('Empty narration at step ' + (index + 1));
    const slot = cue.end - cue.start;
    const tempo = Math.max(1, duration / slot);
    filters.push('[' + (index + 1) + ':a]atempo=' + tempo.toFixed(6) + ',adelay=' +
      Math.round(cue.start * 1000) + ':all=1[a' + index + ']');
    for (const part of cue.parts) {
      const scale = duration / tempo / slot;
      const start = cue.start + (part.start - cue.start) * scale;
      const end = cue.start + (part.end - cue.start) * scale;
      captions.push((captions.length + 1) + '\n' + timecode(start) + ' --> ' + timecode(end) +
        '\n' + part.lines.join('\n') + '\n');
    }
    console.log('Synthesized step ' + (index + 1) + ' (' + duration.toFixed(2) + 's).');
  }
  filters.push(tracks.map((_, index) => '[a' + index + ']').join('') +
    'amix=inputs=' + tracks.length + ':normalize=0,loudnorm=I=-17:LRA=7:TP=-1.5,apad[audio]');
  const subtitle = output.replace(/\.mp4$/i, '.srt');
  await writeFile(subtitle, captions.join('\n'));
  run(encoder, ['-y', '-hide_banner', '-loglevel', 'error', '-i', source,
    ...tracks.flatMap(track => ['-i', track]), '-i', subtitle,
    '-filter_complex', filters.join(';'), '-map', '0:v:0', '-map', '[audio]',
    '-map', (tracks.length + 1) + ':s:0', '-t', String(length), '-c:v', 'copy',
    '-c:a', 'aac', '-ar', '48000', '-b:a', '128k', '-c:s', 'mov_text',
    '-metadata:s:a:0', 'language=eng', '-metadata:s:s:0', 'language=eng',
    '-disposition:s:0', 'default', '-movflags', '+faststart', output]);
  console.log('Wrote ' + output + ' and ' + subtitle);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
