import { describe, expect, it } from 'vitest';
import { RocketTree } from '../core/RocketTree';
import { FlightSim } from '../physics/FlightSim';
import { buildFlightVehicle } from '../physics/vehicle';
import { dimRects, insideAny, pickSpot, rect } from './geometry';
import { finishGameGuide, freshGuide, GUIDE_BONUS, loadGuide, saveGuide, shouldOfferGuide, startStep } from './guideProgress';
import { checkPlacement, REFERENCE_ROCKET, ROOT_CELL, stepComplete } from './referenceRocket';
import { BUILD_STEPS, LAB_TOUR, MOMENTS } from './script';
import { brakeNow, MOON_FUEL } from './moonAssist';
import { isStableOrbit } from '../game/phases';
import { MOON_CENTER } from '../physics/constants';
import { aimedVelocity, GUIDED_PASS, predictedPass } from '../modules/transLunarBurn/TransLunarBurnChallenge';

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};

describe('spotlight geometry', () => {
  it('dims everything except the holes, without overlaps', () => {
    const holes = [rect(100, 100, 200, 50), rect(400, 120, 100, 100)];
    const dim = dimRects(holes, 1280, 720);
    const area = dim.reduce((s, r) => s + r.w * r.h, 0);
    expect(area).toBe(1280 * 720 - 200 * 50 - 100 * 100);
    for (const [x, y] of [[150, 120], [450, 200]]) expect(dim.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)).toBe(false);
    expect(insideAny(holes, 150, 120)).toBe(true);
    expect(insideAny(holes, 10, 10)).toBe(false);
  });

  it('with no holes the whole screen is dimmed', () => {
    expect(dimRects([], 1280, 720)).toEqual([rect(0, 0, 1280, 720)]);
  });

  it('puts the bubble where it covers the spotlight least', () => {
    const holes = [rect(0, 500, 400, 220)];
    const spots = [rect(20, 560, 400, 140), rect(860, 560, 400, 140)];
    expect(pickSpot(holes, spots)).toEqual(spots[1]);
  });
});

describe('guide progress', () => {
  it('saves and resumes where it stopped', () => {
    const store = memory();
    const g = freshGuide();
    g.game.step = 4;
    g.lab.step = 7;
    saveGuide(g, store);
    const back = loadGuide(store);
    expect(startStep(back, 'GAME')).toBe(4);
    expect(startStep(back, 'LAB')).toBe(7);
    expect(startStep(back, 'GAME', true)).toBe(0);
  });

  it('asks on a brand-new save only, and only once', () => {
    const progress = { money: 1000, bestHeight: 0, completedMissions: [], flights: 0, unlockedFuels: [], assets: [] };
    expect(shouldOfferGuide(freshGuide(), progress)).toBe(true);
    expect(shouldOfferGuide({ ...freshGuide(), asked: true }, progress)).toBe(false);
    expect(shouldOfferGuide(freshGuide(), { ...progress, flights: 2 })).toBe(false);
  });

  it('pays the bonus the first time only', () => {
    const first = finishGameGuide(freshGuide());
    expect(first.bonus).toBe(GUIDE_BONUS);
    expect(first.guide.game.done).toBe(true);
    expect(finishGameGuide(first.guide).bonus).toBe(0);
    expect(startStep(first.guide, 'GAME')).toBe(0);
  });

  it('survives junk in storage', () => {
    const store = memory();
    store.setItem('nasa2026.guide', '{not json');
    expect(loadGuide(store)).toEqual(freshGuide());
  });
});

describe('reference rocket', () => {
  const place = (tree: RocketTree) =>
    tree.getAllNodes().map(n => ({ gridX: n.gridX, gridY: n.gridY, type: n.type, fuelKind: n.fuelKind }));

  it('builds step by step in the lab, every step placeable in order', () => {
    const tree = new RocketTree(ROOT_CELL.x, ROOT_CELL.y);
    tree.setPayload('SATELLITE');
    for (const step of BUILD_STEPS.filter(s => s.kind === 'place')) {
      for (const p of step.cells!) {
        expect(checkPlacement(step.cells!, place(tree), p.x, p.y, p.type, p.fuel)).toBe('OK');
        expect(tree.attachPart(p.x, p.y, p.type, p.fuel).success).toBe(true);
      }
      expect(stepComplete(step.cells!, place(tree))).toBe(true);
    }
    expect(tree.getAllNodes().length).toBe(REFERENCE_ROCKET.length + 1);
    expect(tree.getTelemetry().valid).toBe(true);
  });

  it('refuses the wrong spot and the wrong part', () => {
    const step = BUILD_STEPS.find(s => s.kind === 'place' && s.cells!.length === 2 && s.cells![0].type === 'RCS')!.cells!;
    expect(checkPlacement(step, [], 6, 7, 'RCS')).toBe('WRONG_SPOT');
    expect(checkPlacement(step, [], 6, 8, 'ENGINE')).toBe('WRONG_PART');
    expect(checkPlacement(step, [], 6, 8, 'RCS')).toBe('OK');
    const tanks = BUILD_STEPS.find(s => s.kind === 'place' && s.cells![0].fuel === 'COLD_GAS')!.cells!;
    expect(checkPlacement(tanks, [], 7, 7, 'FUEL_TANK', 'KEROSENE')).toBe('WRONG_PART');
  });

  it('reaches the Moon even when the shells drop at the edge of space', () => {
    const tree = new RocketTree(ROOT_CELL.x, ROOT_CELL.y);
    tree.setPayload('SATELLITE');
    REFERENCE_ROCKET.forEach(p => tree.attachPart(p.x, p.y, p.type, p.fuel));
    const sim = new FlightSim(buildFlightVehicle(tree.getTelemetry().tree));
    sim.launch();
    let throttle = 1;
    let separated = false;
    for (let i = 0; i < 120 * 300 && !sim.isFinished && !sim.stats.reachedMoonSoi; i++) {
      const t = sim.getTelemetry();
      if (!separated && t.airDensity <= 0) separated = sim.separate('B');
      if (throttle > 0 && i % 24 === 0 && sim.predictApex(true).reachesMoon) throttle = 0;
      const steer = Math.max(-1, Math.min(1, (-0.12 - t.pitchFromVertical) * 4 - sim.state.omega * 2));
      sim.step(1 / 120, { throttle, steer });
    }
    expect(separated).toBe(true);
    expect(sim.stats.reachedMoonSoi).toBe(true);
    expect(sim.boosterFuel).toBeGreaterThan(100);
  });

  /** Fly the reference rocket to the Moon's pull (straight up, shells off at the edge of space, full throttle). */
  function arriveAtMoon(): FlightSim {
    const tree = new RocketTree(ROOT_CELL.x, ROOT_CELL.y);
    tree.setPayload('SATELLITE');
    REFERENCE_ROCKET.forEach(p => tree.attachPart(p.x, p.y, p.type, p.fuel));
    const sim = new FlightSim(buildFlightVehicle(tree.getTelemetry().tree));
    sim.launch();
    let separated = false;
    for (let i = 0; i < 120 * 300 && !sim.isFinished && !sim.stats.reachedMoonSoi; i++) {
      const t = sim.getTelemetry();
      if (!separated && t.airDensity <= 0) separated = sim.separate('B');
      const steer = Math.max(-1, Math.min(1, (0 - t.pitchFromVertical) * 4 - sim.state.omega * 2));
      sim.step(1 / 120, { throttle: 1, steer });
    }
    return sim;
  }

  /**
   * What Flight School does at the Moon: the free course fix, the fuel floor, the autopilot nose hold,
   * the braking call, and the engine cut the moment LOW and HIGH turn green.
   */
  function guidedMoonArrival(sim: FlightSim, pass: { low: number; high: number }, fuel: number) {
    const s = sim.state;
    const v = aimedVelocity({ x: s.x - MOON_CENTER.x, y: s.y - MOON_CENTER.y }, { x: s.vx, y: s.vy }, pass.low, pass.high)!;
    s.vx = v.x;
    s.vy = v.y;
    const tank = sim.vehicle.parts.find(p => sim.tanks.has(p.id) && p.fuelKind !== 'COLD_GAS')!;
    sim.tanks.set(tank.id, sim.tanks.get(tank.id)! + (fuel - sim.boosterFuel));
    let throttle = 0;
    let braking = false;
    let green = false;
    let stableFor = 0;
    for (let i = 0; i < 120 * 120 && !sim.isFinished; i++) {
      const t = sim.getTelemetry();
      if (!green) s.theta = Math.atan2(-s.vy, -s.vx);
      if (!braking && brakeNow(true, t.moonAltitude, t.moonOrbit?.periapsisAltitude ?? null)) braking = true;
      // Holding W: the scene adds 0.9 throttle per real second, and time runs at 1.5 × 0.5 at the Moon.
      if (braking && !green) throttle = Math.min(1, throttle + 0.9 / (1.5 * 0.5) / 120);
      if (!green && isStableOrbit(t)) {
        green = true;
        throttle = 0;
      }
      stableFor = isStableOrbit(t) ? stableFor + 1 / 120 : 0;
      if (stableFor > 10) break;
      sim.step(1 / 120, { throttle, steer: 0 });
    }
    return { green, stableFor, phase: sim.phase, fuelLeft: sim.boosterFuel };
  }

  it('brakes into a Moon orbit with Flight School’s help, on any easy pass and the lowest fuel', () => {
    const arrival = arriveAtMoon().snapshot();
    expect(predictedPass(FlightSim.restore(arrival))).toBeLessThan(GUIDED_PASS.low); // straight up aims at the Moon
    // The low end, the middle and the high end of the easy pass.
    for (const low of [GUIDED_PASS.low, (GUIDED_PASS.low + GUIDED_PASS.high) / 2 - 15, GUIDED_PASS.high - 30]) {
      const r = guidedMoonArrival(FlightSim.restore(arrival), { low, high: low + 30 }, MOON_FUEL);
      expect(r, `pass ${low} m`).toMatchObject({ green: true, phase: 'FLYING' });
      expect(r.stableFor, `pass ${low} m`).toBeGreaterThan(10);
    }
  });
});

describe('free health refill', () => {
  it('brings the hull back to full, snapshots keep it, and a full hull gets nothing', () => {
    const tree = new RocketTree(ROOT_CELL.x, ROOT_CELL.y);
    tree.setPayload('SATELLITE');
    REFERENCE_ROCKET.forEach(p => tree.attachPart(p.x, p.y, p.type, p.fuel));
    const sim = new FlightSim(buildFlightVehicle(tree.getTelemetry().tree));
    sim.launch();
    for (let i = 0; i < 240; i++) sim.step(1 / 120, { throttle: 1, steer: 0 });
    expect(sim.restoreHull()).toBe(0);
    sim.stats.partsLost = 2;
    sim.damage(80);
    expect(sim.hull).toBe(0);
    expect(sim.restoreHull()).toBe(130);
    expect(sim.hull).toBe(100);
    expect(FlightSim.restore(sim.snapshot()).hull).toBe(100);
    sim.damage(30);
    expect(sim.hull).toBe(70);
  });
});

describe('free cold gas refill', () => {
  it('fills the cold gas back to the top and leaves the booster fuel alone', () => {
    const tree = new RocketTree(ROOT_CELL.x, ROOT_CELL.y);
    tree.setPayload('SATELLITE');
    REFERENCE_ROCKET.forEach(p => tree.attachPart(p.x, p.y, p.type, p.fuel));
    const sim = new FlightSim(buildFlightVehicle(tree.getTelemetry().tree));
    const full = sim.coldGas;
    expect(full).toBeGreaterThan(0);
    expect(sim.refillColdGas()).toBe(0);
    for (const id of sim.tanks.keys()) sim.tanks.set(id, 0);
    expect(sim.refillColdGas()).toBeCloseTo(full);
    expect(sim.coldGas).toBeCloseTo(full);
    expect(sim.boosterFuel).toBe(0);
  });
});

describe('script', () => {
  it('keeps Mission Control short: two sentences at most', () => {
    const lines = [...LAB_TOUR.map(s => s.line), ...BUILD_STEPS.map(s => s.line), ...Object.values(MOMENTS).map(m => m.line)];
    for (const l of lines) {
      const sentences = l.text.split(/[.!?](\s|$)/).filter(s => s.trim().length > 1).length;
      expect(sentences, l.text).toBeLessThanOrEqual(2);
      expect(l.text.split(/\s+/).length, l.text).toBeLessThanOrEqual(24);
    }
  });
});
