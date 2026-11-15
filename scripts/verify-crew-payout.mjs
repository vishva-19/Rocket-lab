import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

// Finishes a crew flight at night through the real finishMission path and prints what it paid.
const out = process.argv[2] ?? '.';
const server = await createServer({ server: { port: 3458 } });
await server.listen();
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
await page.goto('http://localhost:3458/?skipMenu');
await page.waitForFunction(() => !!window.__BUILDER_SCENE__);
const info = await page.evaluate(async () => {
  const b = window.__BUILDER_SCENE__;
  const t = b.rocketTree;
  t.attachPart(7, 7, 'NOSE_CONE'); t.attachPart(7, 9, 'FUEL_TANK'); t.attachPart(7, 10, 'ENGINE');
  b.renderRocket(); b.refreshEconomy(); b.launchReady = true; b.launchFlight();
  await new Promise(r => setTimeout(r, 800));
  const f = window.__FLIGHT_SCENE__;
  f.timeOfDay = 'NIGHT';
  const bank0 = f.progress.money;
  // Pay the two phases like the game does, then end the flight as a landed crew.
  f.handlePhaseEvents([{ kind: 'PHASE_DONE', phase: 'ORBIT' }, { kind: 'PHASE_DONE', phase: 'LANDING' }]);
  f.runner.phasesDone = 3; f.runner.complete = true;
  f.sim.stats.maxAltitude = 5000; f.sim.stats.reachedSpace = true;
  f.finishMission();
  f.showResultPanel(f.result);
  return { cost: f.cost, phasePaid: f.phasePaid, earnings: f.earnings, gained: f.progress.money - bank0, done: f.completedNow.map(m => [m.id, m.reward]), outcome: f.result.outcome };
});
console.log(JSON.stringify(info));
await new Promise(r => setTimeout(r, 700));
await page.screenshot({ path: `${out}/crew-payout.png` });
await browser.close();
await server.close();
