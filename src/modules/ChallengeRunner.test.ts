import { afterEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { createChallenges } from './ChallengeRunner';
import { flyingSim, frame } from './testing';

const C = CONFIG.challenges;

describe('Challenge runner', () => {
  afterEach(() => {
    C.maxQ.enabled = true;
  });

  it('marks every height challenge on the climb, low to high, without overlapping each other', () => {
    const bands = createChallenges().bands;
    expect(bands.map(b => b.label)).toEqual(['max-Q', 'wind', 'rocks', 'radiation', 'TLI']);
    for (let i = 1; i < bands.length; i++) expect(bands[i].from).toBeGreaterThanOrEqual(bands[i - 1].to);
    expect(bands[2]).toMatchObject({ from: CONFIG.rockBelt.bottom, to: CONFIG.rockBelt.top });
  });

  it('runs game time slower only while the rock belt asks for it', () => {
    const sim = flyingSim();
    const r = createChallenges(() => 0.99);
    expect(r.timeScale).toBe(1);
    sim.state.y = CONFIG.rockBelt.bottom + 50;
    for (let i = 0; i < 40; i++) r.update(frame(sim, { earthAltitude: sim.state.y }, 0.1));
    expect(r.timeScale).toBeCloseTo(CONFIG.rockBelt.slowMotion);
  });

  it('counts challenges that ended well or badly, for the mission report', () => {
    const sim = flyingSim();
    const r = createChallenges(() => 0.99);
    expect(r.handled + r.failed).toBe(0);
    // Cross the radiation belt top to bottom: it starts, then ends once the rocket is past it.
    r.update(frame(sim, { earthAltitude: (C.radiationBelt.from + C.radiationBelt.to) / 2 }));
    r.update(frame(sim, { earthAltitude: C.radiationBelt.to + 100 }));
    expect(r.handled + r.failed).toBe(1);
  });

  it('each challenge has its own switch', () => {
    C.maxQ.enabled = false;
    expect(createChallenges().modules.map(m => m.id)).not.toContain('MAX_Q');
  });

  it('collects events, shows the live card and passes the glitch through', () => {
    const sim = flyingSim();
    const r = createChallenges(() => 0.99);
    r.update(frame(sim, { earthAltitude: (C.radiationBelt.from + C.radiationBelt.to) / 2 }));
    expect(r.drainEvents()).toContainEqual(expect.objectContaining({ kind: 'START', id: 'RADIATION_BELT' }));
    expect(r.status?.id).toBe('RADIATION_BELT');
    expect(r.glitch).toBe(true);
  });

  it('a jammed shell takes priority on the card and swallows its key', () => {
    const sim = flyingSim();
    const r = createChallenges(() => 0);
    expect(r.onSeparationKey('B', frame(sim))).toBe(true);
    r.update(frame(sim, { earthAltitude: (C.maxQ.from + C.maxQ.to) / 2 }));
    expect(r.status?.id).toBe('STAGING_FAULT');
  });
});
