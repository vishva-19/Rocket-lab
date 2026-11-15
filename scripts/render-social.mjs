// Renders social/banner.html to frames, a static PNG and an animated GIF.
// Usage: node scripts/render-social.mjs [still]   (needs chromium + ffmpeg)
import puppeteer from 'puppeteer-core';
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'social/out');
const FRAMES = 140, FPS = 20, STILL_T = 0.8; // 7 s loop
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630 });
page.on('console', m => console.log('page:', m.text())); page.on('pageerror', e => console.log('page error:', e.message)); page.on('requestfailed', r => console.log('failed:', r.url()));
await page.goto('file://' + resolve(root, 'social/banner.html'));
await page.waitForFunction('window.ready === true', { timeout: 8000 });
const shot = async (t, file) => { await page.evaluate((t) => window.renderFrame(t), t); await page.screenshot({ path: file }); };

await shot(STILL_T, resolve(out, 'still.png'));
if (process.argv[2] !== 'still') {
  for (let i = 0; i < FRAMES; i++) await shot(i / FRAMES, resolve(out, `f${String(i).padStart(3, '0')}.png`));
  const pal = resolve(out, 'palette.png');
  const f = `${out}/f%03d.png`;
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', FPS, '-i', f, '-vf', 'scale=800:-1:flags=neighbor,palettegen=max_colors=64:stats_mode=full', pal]);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', FPS, '-i', f, '-i', pal, '-lavfi', 'scale=800:-1:flags=neighbor [x]; [x][1:v] paletteuse=dither=none', '-loop', '0', resolve(out, 'rocket-lab-banner.gif')]);
}
await browser.close();
