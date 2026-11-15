import { describe, expect, it } from 'vitest';
import { PayloadKind } from '../core/types';
import { BATTERY_HINT, heightText, missionReport, NASA_CREDITS, OTHER_CREDITS, realMissionFor, ReportInput } from './nasaInfo';

const PAYLOADS: PayloadKind[] = ['SATELLITE', 'ROVER', 'CREW'];
const flight = (over: Partial<ReportInput> = {}): ReportInput => ({
  cost: 85,
  maxAltitude: 4300,
  payload: 'SATELLITE',
  objectiveDone: true,
  problemsSolved: 2,
  problemsFailed: 1,
  earned: 320,
  ...over
});

describe('the mission report', () => {
  it('has the four NASA segments in order', () => {
    expect(missionReport(flight()).map(s => s.id)).toEqual(['LAUNCH', 'SPACE', 'GROUND', 'USER']);
  });

  it('puts this flight’s numbers in the right segments, with the height changing every flight', () => {
    const [launch, space, ground, user] = missionReport(flight());
    expect(launch.value).toBe('4.3 km');
    expect(launch.caption).toBe('rocket $85');
    expect(missionReport(flight({ maxAltitude: 2000 }))[0].value).toBe('2.0 km');
    expect(space.value).toBe('SATELLITE');
    expect(ground.value).toBe('2 OF 3');
    expect(user.value).toBe('+$320');
  });

  it('says plainly when the objective was not done', () => {
    const space = missionReport(flight({ objectiveDone: false }))[1];
    expect(space.caption).toContain('not done');
  });

  it('a flight with no problems reads calm, not "0 of 0"', () => {
    const ground = missionReport(flight({ problemsSolved: 0, problemsFailed: 0 }))[2];
    expect(ground.value).toBe('CALM');
  });

  it('never shows a negative payout', () => {
    expect(missionReport(flight({ earned: -40 }))[3].value).toBe('+$0');
  });

  it('writes heights like the HEIGHT tube', () => {
    expect(heightText(450)).toBe('450 m');
    expect(heightText(4300)).toBe('4.3 km');
  });
});

describe('the real mission', () => {
  it('every payload has one, with a name and a reason', () => {
    for (const payload of PAYLOADS) {
      const m = realMissionFor(payload, true);
      expect(m?.name.length).toBeGreaterThan(0);
      expect(m?.because.length).toBeGreaterThan(0);
    }
  });

  it('is only claimed once the objective is done', () => {
    for (const payload of PAYLOADS) expect(realMissionFor(payload, false)).toBeNull();
  });

  it('the rover is not matched to a Mars mission: the game lands on the Moon', () => {
    const m = realMissionFor('ROVER', true)!;
    expect(`${m.name} ${m.because}`.toUpperCase()).not.toContain('MARS');
  });
});

describe('credits', () => {
  it('lists exactly the five NASA resources of the submission form', () => {
    expect(NASA_CREDITS).toHaveLength(5);
    expect(NASA_CREDITS.map(c => c.name)).toEqual([
      'Design and Develop Science Missions',
      'Concept Maturity Levels (JPL)',
      'Mission Design Lab',
      'CubeSat 101',
      'Webb: Build It Yourself'
    ]);
  });

  it('lists the other resources of the submission form', () => {
    expect(OTHER_CREDITS.map(c => c.name)).toEqual(['Phaser', 'Press Start 2P', 'VT323', 'Piskel']);
  });

  it('every credit has a full public link and a plain line', () => {
    for (const c of [...NASA_CREDITS, ...OTHER_CREDITS]) {
      expect(c.url).toMatch(/^https:\/\//);
      expect(c.took.length).toBeGreaterThan(0);
    }
  });

  it('has a battery hint for each kind of asset', () => {
    expect(BATTERY_HINT.SATELLITE.length).toBeGreaterThan(0);
    expect(BATTERY_HINT.ROVER.length).toBeGreaterThan(0);
  });
});
