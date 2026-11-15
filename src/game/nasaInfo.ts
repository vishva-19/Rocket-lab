import { PayloadKind } from '../core/types';

/**
 * The NASA material the game is built on, as plain data: the four mission segments, the real mission each
 * payload is like, the satellite battery hints and the credits list. Pure, so it can be tested without the engine.
 */

/** Everything the end-of-flight report reads; all of it already exists once a flight is over. */
export interface ReportInput {
  /** What the rocket cost ($). */
  cost: number;
  /** Highest point reached (m). */
  maxAltitude: number;
  payload: PayloadKind;
  /** The payload's own objective was finished. */
  objectiveDone: boolean;
  problemsSolved: number;
  problemsFailed: number;
  /** What the flight paid ($). */
  earned: number;
}

export type SegmentId = 'LAUNCH' | 'SPACE' | 'GROUND' | 'USER';

export interface SegmentLine {
  id: SegmentId;
  /** NASA's name for the segment, short. */
  label: string;
  /** The number or word for this flight. */
  value: string;
  /** What the segment is, in plain words. */
  caption: string;
}

const PAYLOAD_NAME: Record<PayloadKind, string> = { SATELLITE: 'SATELLITE', ROVER: 'ROVER', CREW: 'CREW' };

/** 450 -> "450 m", 4,300 -> "4.3 km" (the HEIGHT tube reads in km too). */
export function heightText(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`;
}

/**
 * The flight split into NASA's four mission segments (Design and Develop Science Missions):
 * launch (the rocket), space (the spacecraft), ground (mission control) and user (who gets the data).
 * The game has no ground station, so "ground" is the problems the pilot handled, like mission control would.
 */
export function missionReport(input: ReportInput): SegmentLine[] {
  const problems = input.problemsSolved + input.problemsFailed;
  return [
    { id: 'LAUNCH', label: 'LAUNCH', value: heightText(input.maxAltitude), caption: `rocket $${input.cost}` },
    { id: 'SPACE', label: 'SPACE', value: PAYLOAD_NAME[input.payload], caption: input.objectiveDone ? 'objective done' : 'not done' },
    {
      id: 'GROUND',
      label: 'GROUND',
      value: problems === 0 ? 'CALM' : `${input.problemsSolved} OF ${problems}`,
      caption: problems === 0 ? 'mission control' : 'problems fixed'
    },
    { id: 'USER', label: 'USER', value: `+$${Math.max(0, Math.round(input.earned))}`, caption: 'for the data' }
  ];
}

/** One real NASA mission a finished flight is like, and why, in a sentence. */
export interface RealMission {
  /** Shown after "LIKE NASA'S". */
  name: string;
  because: string;
}

const REAL_MISSIONS: Record<PayloadKind, RealMission> = {
  SATELLITE: { name: 'LUNAR RECONNAISSANCE ORBITER', because: 'It also circles the Moon in a steady orbit.' },
  ROVER: { name: 'VIPER ROVER', because: 'A robot NASA planned for the Moon’s south pole.' },
  CREW: { name: 'APOLLO 11', because: 'The first crew to land on the Moon, in 1969.' }
};

/** The real mission your flight matched. Only a finished objective earns one: no claim for a flight that did not get there. */
export function realMissionFor(payload: PayloadKind, objectiveDone: boolean): RealMission | null {
  return objectiveDone ? REAL_MISSIONS[payload] : null;
}

/** Why the deployed assets have days of battery. Shown on the Moon network panel. */
export const BATTERY_HINT: Record<'SATELLITE' | 'ROVER', string> = {
  SATELLITE: 'Satellites run on a battery: one day per launch.',
  ROVER: 'Rovers work hard, so the battery ends sooner.'
};

export interface Credit {
  name: string;
  /** What we took from it, one plain line. */
  took: string;
  url: string;
}

/** Must match the NASA resources listed on the Space Apps submission form. */
export const NASA_CREDITS: readonly Credit[] = [
  {
    name: 'Design and Develop Science Missions',
    took: 'The four mission segments in the report.',
    url: 'https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf'
  },
  {
    name: 'Concept Maturity Levels (JPL)',
    took: 'Design first, then test the idea in flight.',
    url: 'https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299'
  },
  {
    name: 'Mission Design Lab',
    took: 'Trade-offs: every part costs mass and money.',
    url: 'https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/'
  },
  {
    name: 'CubeSat 101',
    took: 'Small satellites run on a battery for a limited time.',
    url: 'https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf'
  },
  {
    name: 'Webb: Build It Yourself',
    took: 'Ending with a real NASA mission like yours.',
    url: 'https://science.nasa.gov/mission/webb/game-build-it-yourself/'
  }
];

/** Must match the other resources listed on the submission form. */
export const OTHER_CREDITS: readonly Credit[] = [
  { name: 'Phaser', took: 'Game engine.', url: 'https://phaser.io' },
  { name: 'Press Start 2P', took: 'Title font.', url: 'https://fonts.google.com/specimen/Press+Start+2P' },
  { name: 'VT323', took: 'Body font.', url: 'https://fonts.google.com/specimen/VT323' },
  { name: 'Piskel', took: 'Pixel art tool.', url: 'https://www.piskelapp.com' }
];
