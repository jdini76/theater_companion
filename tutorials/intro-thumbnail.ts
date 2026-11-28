import { execFileSync } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import ffmpeg from 'ffmpeg-static';

const [video = 'out/tutorial-01-introduction.mp4', time = '78',
  output = 'out/tutorial-01-thumbnail.png'] = process.argv.slice(2);
const scratch = await mkdtemp(path.join(path.dirname(path.resolve(output)), '.thumbnail-'));
try {
  const shot = path.join(scratch, 'app.png');
  execFileSync(process.env.FFMPEG ?? ffmpeg ?? 'ffmpeg', ['-v', 'error', '-ss', time, '-i',
    video, '-frames:v', '1', shot], { windowsHide: true });
  const image = (await readFile(shot)).toString('base64');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 85% 50%,#254355 0,#132336 42%,#0b1424 78%);height:720px;color:#f8fafc;font-family:Segoe UI,Arial,sans-serif;overflow:hidden}
.copy{position:absolute;left:64px;top:112px;width:530px;z-index:2}
.brand{font-weight:650;font-size:34px;color:#83d6ed;letter-spacing:-.6px}
h1{font-size:88px;line-height:.99;letter-spacing:-4.4px;margin:42px 0 28px;font-weight:750}
.rule{width:92px;height:6px;background:#eab35b;border-radius:4px}
p{font-size:25px;color:#b5c7d9;margin-top:27px}
.screen{position:absolute;left:553px;top:160px;width:690px;border-radius:16px;overflow:hidden;border:2px solid #58748c;box-shadow:0 35px 80px #060b16}
.bar{height:33px;background:#203348;display:flex;gap:6px;align-items:center;padding-left:13px}
.bar i{width:7px;height:7px;border-radius:9px;background:#8ba7bb}.bar i:first-child{background:#eab35b}
img{display:block;width:100%;height:365px;object-fit:cover;object-position:center top}
</style></head><body><div class="copy"><div class="brand">RehearseLines</div>
<h1>Run lines<br>on your own</h1><div class="rule"></div><p>Tutorial 01 &nbsp;·&nbsp; Introduction</p></div>
<div class="screen"><div class="bar"><i></i><i></i><i></i></div>
<img src="data:image/png;base64,${image}" alt="Real RehearseLines rehearsal screen"></div></body></html>`);
    await page.screenshot({ path: output });
  } finally { await browser.close(); }
} finally { await rm(scratch, { recursive: true, force: true }); }
