import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { chromium, type Page } from 'playwright';
import { overlays } from './cursor-overlay.ts';

type Action = { at: number; op: string; target: string; value?: string };
type Step = { seconds: number; say: string; label: string; browser: 'main' | 'fresh'; zoom: number; actions: Action[] };
type Definition = { url: string; project: string; title: string; steps: Step[] };
const definition = JSON.parse(await readFile(process.argv[2] ?? 'intro.json', 'utf8')) as Definition;
const folder = path.resolve(process.argv[3] ?? 'out/intro-capture');
await mkdir(folder, { recursive: true });
const viewport = { width: 1920, height: 1080 };
const url = process.env.TUTORIAL_URL || definition.url;

function locator(page: Page, target: string) {
  const [kind, part, ...rest] = target.split(':');
  if (kind === 'text') return page.getByText([part, ...rest].join(':'), { exact: true });
  if (kind === 'css') return page.locator([part, ...rest].join(':'));
  if (kind === 'role') return page.getByRole(part as Parameters<Page['getByRole']>[0], { name: rest.join(':'), exact: true });
  throw new Error('Unknown locator ' + target);
}

async function act(page: Page, action: Action) {
  const target = locator(page, action.target);
  await target.waitFor({ state: 'visible' });
  if (action.op === 'visible') return;
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error('No visible control for ' + action.target);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
  await pause(160);
  switch (action.op) {
    case 'point': return;
    case 'click': await target.click(); return;
    case 'check': await target.check(); return;
    case 'select': await target.selectOption({ label: action.value }); return;
    case 'type': await target.click(); await target.pressSequentially(action.value!, { delay: 52 }); return;
    case 'fill': await target.click(); await target.fill(action.value!); return;
    default: throw new Error('Unknown action ' + action.op);
  }
}

const main = await chromium.launch();
const fresh = await chromium.launch({ channel: 'msedge' });
const footage: Record<string, { file: string; origin: number; page: Page }> = {};
try {
  for (const [key, browser] of Object.entries({ main, fresh })) {
    const context = await browser.newContext({
      viewport, deviceScaleFactor: 1, colorScheme: 'dark', locale: 'en-US',
      recordVideo: { dir: folder, size: viewport }
    });
    await context.addInitScript(overlays);
    const page = await context.newPage();
    const origin = performance.now();
    page.setDefaultTimeout(7000);
    await page.goto(key === 'main' ? url : new URL('/projects', url).href, { waitUntil: 'networkidle' });
    const start = page.getByRole('button', { name: "Let's get started" });
    if (await start.isVisible()) {
      await page.getByRole('checkbox', { name: /Don't show this again/ }).check();
      await start.click();
    }
    const file = await page.video()!.path();
    footage[key] = { file, origin, page };
  }
  const cuts = [];
  for (const [index, step] of definition.steps.entries()) {
    const { page, file, origin } = footage[step.browser];
    await page.bringToFront();
    const start = performance.now();
    await page.evaluate(({ title, label, zoom }) => {
      document.body.style.zoom = String(zoom);
      document.getElementById('tutorial-badge')?.remove();
      const badge = document.createElement('div');
      badge.id = 'tutorial-badge';
      badge.style.cssText = 'position:fixed;left:32px;bottom:34px;z-index:2147483645;pointer-events:none;background:#152031;color:#fff;border-left:4px solid #eab35b;padding:14px 20px;border-radius:6px;font:600 19px system-ui;box-shadow:0 4px 20px #0005';
      const brand = document.createElement('div'); brand.textContent = 'RehearseLines  /  ' + title;
      const chapter = document.createElement('div'); chapter.textContent = label;
      chapter.style.cssText = 'color:#eab35b;margin-top:4px;font-size:16px';
      badge.append(brand, chapter);
      document.documentElement.append(badge);
      badge.animate([{opacity:.25,transform:'translateY(5px)'},{opacity:1,transform:'none'}],{duration:240,easing:'ease-out'});
    }, { title: definition.title, label: step.label, zoom: step.zoom });
    for (const action of step.actions) {
      await pause(Math.max(0, start + action.at * 1000 - performance.now()));
      try { await act(page, action); }
      catch (error) { throw new Error('Step ' + (index + 1) + ' — ' + action.target, { cause: error }); }
    }
    const duration = Math.max(step.seconds, (performance.now() - start) / 1000 + .35);
    await pause(Math.max(0, start + duration * 1000 - performance.now()));
    cuts.push({ file: path.basename(file), start: (start - origin) / 1000, duration, say: step.say });
    console.log('Captured ' + (index + 1) + ': ' + step.label);
  }
  await writeFile(path.join(folder, 'cuts.json'), JSON.stringify(cuts, null, 2));
} finally {
  for (const { page } of Object.values(footage)) await page.context().close();
  await Promise.all([main.close(), fresh.close()]);
}

