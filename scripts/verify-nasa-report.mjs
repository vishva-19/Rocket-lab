import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

// Screenshots the NASA mission report on the result panel (finished and failed), the Flight School NASA page
// and the network panel. Output goes to the folder in argv[2].
const out = process.argv[2] ?? '.';
const server = await createServer({ server: { port: 3457 } });
await server.listen();
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', e => console.log('PAGE ERROR:', e.message));

// 1. Menu -> Flight School -> NASA SOURCES
await page.goto('http://localhost:3457/');
await new Promise(r => setTimeout(r, 2500));
const click = async (x, y) => { await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up(); await new Promise(r => setTimeout(r, 400)); };
await click(150, 190 + 2 * 64 + 26); // FLIGHT SCHOOL
await page.screenshot({ path: `${out}/school.png` });
await click(150, 190 + 90 + 9 * 28 + 22); // NASA SOURCES button
await page.screenshot({ path: `${out}/nasa.png` });

// 2. Result panel
await page.goto('http://localhost:3457/?skipMenu');
await page.waitForFunction(() => !!window.__BUILDER_SCENE__);
await page.evaluate(async () => {
  const b = window.__BUILDER_SCENE__;
  const t = b.rocketTree;
  t.attachPart(7, 7, 'NOSE_CONE');
  t.attachPart(7, 9, 'FUEL_TANK');
  t.attachPart(7, 10, 'ENGINE');
  b.renderRocket(); b.refreshEconomy(); b.launchReady = true; b.launchFlight();
  await new Promise(r => setTimeout(r, 800));
});
const shot = async (name, complete) => {
  await page.evaluate(done => {
    const f = window.__FLIGHT_SCENE__;
    f.resultPanel?.destroy(); f.resultPanel = null;
    f.runner.complete = done; f.runner.solved = 2; f.runner.failedProblems = done ? 1 : 2;
    f.sim.stats.maxAltitude = 4300;
    f.earnings = { total: 320 }; f.completedNow = [];
    f.showResultPanel({ outcome: done ? 'SATELLITE_DEPLOYED' : 'FAILED', title: done ? 'SATELLITE DEPLOYED' : 'MISSION FAILED', summary: '', stars: done ? 4 : 0, score: 9400, insights: [] });
  }, complete);
  await new Promise(r => setTimeout(r, 700));
  await page.screenshot({ path: `${out}/${name}.png` });
};
await shot('result-done', true);
await shot('result-failed', false);
await page.evaluate(() => { window.__FLIGHT_SCENE__.runner.payload = 'CREW'; });
await shot('result-crew', true);

// 3. Network panel with the battery hint
await page.evaluate(() => {
  const n = window.__FLIGHT_SCENE__.networkPanel;
  n.update([{ id: 'SAT-1', kind: 'SATELLITE', daysLeft: 12, maxDays: 15 }, { id: 'SAT-2', kind: 'SATELLITE', daysLeft: 2, maxDays: 15 }, { id: 'ROV-1', kind: 'ROVER', daysLeft: 4, maxDays: 5 }], 4, 0.3, true);
  n.toggle('SATELLITE');
  window.__FLIGHT_SCENE__.resultPanel?.destroy();
  window.__FLIGHT_SCENE__.scene.pause();
});
await new Promise(r => setTimeout(r, 300));
await page.screenshot({ path: `${out}/network.png` });

await browser.close();
await server.close();
