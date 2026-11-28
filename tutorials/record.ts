import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, copyFile, mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { chromium, type Page, type Locator } from 'playwright';

import { overlays } from './cursor-overlay.ts';

type Action = { op: 'click' | 'optionalClick' | 'type' | 'visible'; target: string; value?: string };
type Tutorial = {
  url: string; title: string; project: string; ready: string; empty: string;
  steps: { say: string; actions: Action[] }[];
};

const args = process.argv.slice(2);
const inspect = args.includes('--inspect');
const configPath = args.find(arg => !arg.startsWith('--')) ?? 'clockwork.json';
const config = JSON.parse(await readFile(configPath, 'utf8')) as Tutorial;
const resolution = { width: 1920, height: 1080 };

function command(executable: string, args: string[]) {
  const result = spawnSync(executable, args, { encoding: 'utf8', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(executable + ': ' + result.stderr.trim());
  return result.stdout.trim();
}

function locate(page: Page, target: string): Locator {
  const [kind, ...parts] = target.replaceAll('$project', config.project).split(':');
  if (kind === 'css') return page.locator(parts.join(':'));
  if (kind === 'text') return page.getByText(parts.join(':'), { exact: true });
  if (kind === 'role') {
    const [role, ...name] = parts;
    return page.getByRole(role as Parameters<Page['getByRole']>[0], { name: name.join(':'), exact: true });
  }
  throw new Error('Unknown locator: ' + target);
}

async function act(page: Page, action: Action) {
  const element = locate(page, action.target);
  if (action.op === 'optionalClick' && !(await element.isVisible())) return;
  await element.waitFor({ state: 'visible' });
  if (action.op === 'visible') return;
  await element.scrollIntoViewIfNeeded();
  const box = await element.boundingBox();
  if (!box) throw new Error('Control has no position: ' + action.target);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 16 });
  await pause(220);
  await element.click();
  if (action.op === 'type') {
    await element.fill('');
    await element.pressSequentially(action.value!.replaceAll('$project', config.project), { delay: 45 });
  }
  await pause(400);
}

function clock(seconds: number) {
  return new Date(Math.round(seconds * 1000)).toISOString().slice(11, 23).replace('.', ',');
}

function captions(text: string, start: number, duration: number) {
  const words = text.split(/\s+/);
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
  const cues: { start: number; end: number; text: string }[] = [];
  let time = start;
  for (let index = 0; index < lines.length; index += 2) {
    const text = lines.slice(index, index + 2).join('\n');
    const end = time + duration * text.split(/\s+/).length / words.length;
    cues.push({ start: time, end, text });
    time = end;
  }
  return cues;
}

const output = path.resolve('out');
await mkdir(output, { recursive: true });
const work = await mkdtemp(path.join(output, '.capture-'));
const finished = await (async () => {
  try {
    const { default: bundledFFmpeg } = await import('ffmpeg-static');
    const { default: bundledFFprobe } = await import('ffprobe-static');
    const ffmpeg = process.env.FFMPEG ?? bundledFFmpeg ?? 'ffmpeg';
    const ffprobe = process.env.FFPROBE ?? bundledFFprobe.path;
    const cues = config.steps.map(({ say }, index) => ({
      say, file: path.join(work, 'cue-' + index + '.wav'), start: 0, duration: 0
    }));

    if (!inspect) {
      await Promise.all(cues.map(cue => writeFile(cue.file.replace(/\.wav$/, '.txt'), cue.say)));
      command('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'speak.ps1', work]);
      for (const cue of cues) {
        cue.duration = Number(command(ffprobe, ['-v', 'error', '-show_entries', 'format=duration',
          '-of', 'default=nw=1:nk=1', cue.file]));
        if (!(cue.duration > 0)) throw new Error('Invalid narration duration: ' + cue.file);
      }
    }

    const browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL,
      headless: true
    });
    let raw: string | undefined;
    let length = 0;
    try {
      const context = await browser.newContext({
        viewport: resolution, deviceScaleFactor: 1, colorScheme: 'dark', locale: 'en-US',
        recordVideo: inspect ? undefined : { dir: work, size: resolution }
      });
      try {
        context.setDefaultTimeout(7_000);
        if (!inspect) await context.addInitScript(overlays);
        const page = await context.newPage();
        const origin = performance.now();
        const response = await page.goto(process.env.TUTORIAL_URL ?? config.url, {
          waitUntil: 'domcontentloaded', timeout: 20_000
        });
        if (!response?.ok()) throw new Error('App returned HTTP ' + response?.status());
        await locate(page, config.ready).waitFor({ state: 'visible' });
        // The fresh-context check also prevents recording an existing production list.
        await locate(page, config.empty).waitFor({ state: 'attached' });
        if (inspect) {
          console.log('Verified empty dashboard at ' + page.url());
          return false;
        }
        await page.evaluate(({ title }) => {
          const badge = document.createElement('div');
          badge.textContent = 'RehearseLines  /  ' + title;
          badge.style.cssText = 'position:fixed;left:32px;bottom:32px;z-index:2147483645;pointer-events:none;background:#152031;color:#fff;border-left:4px solid #eab35b;padding:14px 20px;border-radius:6px;font:600 22px system-ui;box-shadow:0 4px 20px #0005';
          document.documentElement.append(badge);
        }, { title: config.title });
        for (const [index, step] of config.steps.entries()) {
          const cue = cues[index];
          cue.start = (performance.now() - origin) / 1000;
          // Give the spoken instruction a moment before moving the cursor.
          await pause(index === 0 ? 4_500 : 1_750);
          for (const action of step.actions) await act(page, action);
          const remaining = cue.start * 1000 + (cue.duration + .45) * 1000 - (performance.now() - origin);
          await pause(Math.max(0, remaining));
          console.log('Captured step ' + (index + 1) + ' of ' + cues.length);
        }
        length = Math.max(61, (performance.now() - origin) / 1000 + 1.2);
        await pause(Math.max(0, length * 1000 - (performance.now() - origin)));
        raw = await page.video()?.path();
      } finally {
        await context.close();
      }
    } finally {
      await browser.close();
    }

    if (!raw) throw new Error('Playwright produced no video file.');
    if (length > 90) throw new Error('Capture exceeded 90 seconds. Shorten the narration or retry on a faster connection.');
    const subtitleFile = path.join(work, 'tutorial.srt');
    const subtitleText = cues.flatMap(cue => captions(cue.say, cue.start, cue.duration))
      .map((cue, index) => (index + 1) + '\n' + clock(cue.start) + ' --> ' + clock(cue.end) + '\n' + cue.text + '\n')
      .join('\n');
    await writeFile(subtitleFile, subtitleText);
    const audio = cues.map((cue, index) =>
      '[' + (index + 1) + ':a]adelay=' + Math.round(cue.start * 1000) + ':all=1[a' + index + ']'
    );
    const mix = cues.map((_, index) => '[a' + index + ']').join('') +
      'amix=inputs=' + cues.length + ':normalize=0,apad[audio]';
    const video = path.join(work, 'tutorial.mp4');
    command(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', raw,
      ...cues.flatMap(cue => ['-i', cue.file]), '-i', subtitleFile,
      '-filter_complex', [...audio, mix].join(';'),
      '-map', '0:v:0', '-map', '[audio]', '-map', (cues.length + 1) + ':s:0',
      '-vf', 'fps=30,tpad=stop_mode=clone:stop_duration=1', '-t', length.toFixed(3),
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng',
      '-disposition:s:0', 'default', '-movflags', '+faststart', video]);
    await copyFile(subtitleFile, path.join(output, 'rehearselines-tutorial.srt'));
    await rename(video, path.join(output, 'rehearselines-tutorial.mp4'));
    return true;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
})();
if (finished) console.log('Wrote out/rehearselines-tutorial.mp4 and its captions.');
