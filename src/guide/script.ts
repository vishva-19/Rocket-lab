import { CONFIG } from '../config';
import { TimeOfDay } from '../game/timeOfDay';
import { REFERENCE_ROCKET, RefPart } from './referenceRocket';

/**
 * Everything Mission Control says. The main line is short and plain (two sentences at most);
 * "TELL ME MORE" opens the deeper version: the real word, the numbers and a real-world example.
 */
export interface Line {
  text: string;
  more?: { title: string; text: string };
}

/** Things in the lab the spotlight can point at (BuilderScene.guideRect turns them into rectangles). */
export type LabTarget =
  | 'grid'
  | 'root'
  | 'parts'
  | 'telemetry'
  | 'lift'
  | 'launch'
  | 'bank'
  | 'mission'
  | 'picture'
  | 'rocket'
  | 'flyout'
  | 'slot:COCKPIT'
  | 'slot:STRUCTURAL'
  | 'slot:NOSE_CONE'
  | 'slot:ENGINE'
  | 'slot:FUEL_TANK'
  | 'slot:FIN';

/** Things on the flight screen the spotlight can point at. */
export type FlightTarget = 'sky' | 'launch' | 'instruments' | 'challenge' | 'orbit' | 'goal' | 'result' | 'height';

const P = CONFIG.parts;
const F = CONFIG.fuelTypes;

// ---------------------------------------------------------------------------
// Rocket Lab guide: a tour, one card per stop
// ---------------------------------------------------------------------------

export interface TourStop {
  targets: LabTarget[];
  /** Open this slot's fan of cards while the stop is up. */
  flyout?: 'ENGINE' | 'FUEL_TANK' | 'COCKPIT';
  line: Line;
}

export const LAB_TOUR: TourStop[] = [
  {
    targets: [],
    line: {
      text: 'Welcome to the Rocket Lab, pilot! This is where every rocket gets built before it flies.',
      more: { title: 'REAL ROCKET LABS', text: 'NASA puts its rockets together inside the Vehicle Assembly Building in Florida. It is so tall that clouds can form inside it!' }
    }
  },
  {
    targets: ['grid'],
    line: {
      text: 'This is your build bay. Every part snaps onto the piece in the middle, your payload.',
      more: { title: 'PAYLOAD', text: 'The payload is what the rocket carries: a satellite, a rover or astronauts. Every other part is there to carry it.' }
    }
  },
  {
    targets: ['grid', 'parts'],
    line: { text: 'Pick a part on the right, then click a glowing spot to add it. Right-click a part to take it off.' }
  },
  {
    targets: ['slot:COCKPIT'],
    flyout: 'COCKPIT',
    line: {
      text: 'This slot picks your payload. Each payload has its own mission to finish.',
      more: {
        title: 'THREE MISSIONS',
        text: `SATELLITE: orbit the Moon, then let it go. ROVER: drop it in the green zone. CREW: land softly. Heavier payloads need bigger rockets: crew ${CONFIG.payloads.CREW.mass} kg, rover ${CONFIG.payloads.ROVER.mass} kg, satellite ${CONFIG.payloads.SATELLITE.mass} kg.`
      }
    }
  },
  {
    targets: ['slot:STRUCTURAL'],
    line: {
      text: 'A block is a cheap, strong piece for joining parts. It adds weight but no push.',
      more: { title: 'WEIGHT', text: `A block weighs ${P.STRUCTURAL.mass} kg and costs $${P.STRUCTURAL.cost}. Every kilo you add makes the rocket harder to lift, so only use what you need.` }
    }
  },
  {
    targets: ['slot:NOSE_CONE'],
    line: {
      text: 'The nose cone goes on top. Its pointy shape slices through the air.',
      more: { title: 'DRAG', text: 'Air pushes back on anything moving through it. That push is called drag. Pointy shapes have less drag, which is why rockets and planes have pointed noses.' }
    }
  },
  {
    targets: ['slot:ENGINE', 'flyout'],
    flyout: 'ENGINE',
    line: {
      text: 'A booster blasts hot gas down, and that pushes the rocket up. It burns kerosene or hydrogen.',
      more: {
        title: 'THRUST',
        text: `Push gas one way and you move the other way: that is Newton’s third law. Each booster gives ${P.ENGINE.thrust} thrust. Boosters can’t steer in space.`
      }
    }
  },
  {
    targets: ['slot:ENGINE', 'flyout'],
    flyout: 'ENGINE',
    line: {
      text: 'The TWIN LEG is an RCS thruster. It hides in a shell, then steers in space with puffs of cold gas.',
      more: {
        title: 'RCS',
        text: 'Space has no air for fins to push on, so real spacecraft turn with tiny gas jets called RCS (reaction control system). When a shell opens, everything hanging below it drops off. Press its key in flight (B unless you change it).'
      }
    }
  },
  {
    targets: ['slot:FUEL_TANK', 'flyout'],
    flyout: 'FUEL_TANK',
    line: {
      text: 'Tanks hold fuel. Kerosene is the starter fuel, hydrogen goes further, and cold gas feeds the RCS.',
      more: {
        title: 'FUEL',
        text: `A tank holds ${P.FUEL_TANK.fuelLiters} litres. Hydrogen weighs about half as much as kerosene, so the same rocket goes further: NASA’s Space Shuttle burned it. Unlock hydrogen once for $${F.HYDROGEN.unlockCost} and keep it.`
      }
    }
  },
  {
    targets: ['slot:FIN'],
    line: {
      text: 'Fins keep the rocket pointing straight while it flies through the air. Use at least two, one on each side.',
      more: { title: 'STABILITY', text: 'Fins work like the feathers on an arrow: if the rocket tips, the air pushes on the fins and turns it back. In space there is no air, so fins stop helping.' }
    }
  },
  {
    targets: ['telemetry'],
    line: {
      text: 'This panel adds up your rocket: how heavy it is (mass), how hard it pushes (thrust) and its fuel.',
      more: { title: 'TELEMETRY', text: 'Telemetry means measurements sent from a rocket. Real engineers watch these numbers on big screens before and during every launch.' }
    }
  },
  {
    targets: ['lift'],
    line: {
      text: 'LIFT is push divided by weight. Above 1 the rocket rises; below 1 it says TOO HEAVY.',
      more: { title: 'THRUST-TO-WEIGHT', text: 'Engineers call it the thrust-to-weight ratio (TWR). The Saturn V that carried astronauts to the Moon had about 1.2 at liftoff. Fuel weighs a lot, so more tanks lower your LIFT.' }
    }
  },
  {
    targets: ['launch'],
    line: {
      text: 'LAUNCH lights up when the rocket is ready. When it is grey, it tells you what is missing.',
      more: { title: 'READY CHECK', text: 'Every rocket needs a payload, a booster and fuel for it. An RCS also needs a cold gas tank, and you must be able to pay for the rocket.' }
    }
  },
  {
    targets: ['bank'],
    line: {
      text: 'BANK is your money and ROCKET is what this one costs. Finish missions to earn more.',
      more: { title: 'BUDGET', text: 'Real space agencies have a budget too. A cheap rocket that gets the job done earns you a bonus.' }
    }
  },
  {
    targets: ['mission'],
    line: { text: 'The mission card says what to do and what it pays. It changes when you change the payload.' }
  },
  {
    targets: [],
    line: { text: 'That’s the whole lab! To fly a mission step by step, try the GAME GUIDE in Flight School.' }
  }
];

// ---------------------------------------------------------------------------
// Game guide, part 1: build the reference rocket
// ---------------------------------------------------------------------------

export interface BuildStep {
  /** OK to go on, place the listed cells, or press LAUNCH. */
  kind: 'ok' | 'place' | 'launch';
  targets: LabTarget[];
  cells?: RefPart[];
  line: Line;
}

const cells = (...xy: Array<[number, number]>): RefPart[] => xy.map(([x, y]) => REFERENCE_ROCKET.find(p => p.x === x && p.y === y)!);

export const BUILD_STEPS: BuildStep[] = [
  {
    kind: 'ok',
    targets: [],
    line: { text: 'Mission Control here! Today we’ll build a rocket together and fly it to the Moon.' }
  },
  {
    kind: 'ok',
    targets: ['picture', 'root'],
    line: {
      text: 'This picture shows the rocket we’ll build around your satellite. The glowing part is next.',
      more: { title: 'THE MISSION', text: 'The satellite is the payload. Our job: fly it to the Moon, circle the Moon in a steady orbit, then let the satellite go.' }
    }
  },
  {
    kind: 'place',
    targets: ['picture', 'parts', 'rocket'],
    cells: cells([7, 7]),
    line: {
      text: 'Pick FUEL TANK, choose COLD GAS, and click the spot above the satellite.',
      more: { title: 'COLD GAS', text: 'Cold gas is not burned: it just squirts out. It is the fuel for the steering thrusters we add next.' }
    }
  },
  {
    kind: 'place',
    targets: ['picture', 'parts', 'rocket'],
    cells: cells([7, 6]),
    line: { text: 'Now a NOSE CONE on the very top. Its point cuts through the air.' }
  },
  {
    kind: 'place',
    targets: ['picture', 'parts', 'rocket'],
    cells: cells([6, 8], [8, 8]),
    line: {
      text: 'Pick BOOSTER, choose TWIN LEG, and bolt one on each side of the satellite. They steer in space.',
      more: { title: 'SHELLS', text: 'Each twin leg starts inside a shell. The parts we hang below it drop away when the shell opens in space.' }
    }
  },
  {
    kind: 'place',
    targets: ['picture', 'parts', 'rocket'],
    cells: cells([7, 9], [6, 9], [8, 9]),
    line: { text: 'Three KEROSENE tanks go under the satellite and the twin legs. That’s the fuel for the climb.' }
  },
  {
    kind: 'place',
    targets: ['picture', 'parts', 'rocket'],
    cells: cells([7, 10], [6, 10], [8, 10]),
    line: { text: 'Put a BOOSTER under each tank. Three boosters means lots of push!' }
  },
  {
    kind: 'place',
    targets: ['picture', 'parts', 'rocket'],
    cells: cells([5, 9], [9, 9]),
    line: { text: 'Last parts: a FIN on each outside tank. Fins keep you flying straight.' }
  },
  {
    kind: 'ok',
    targets: ['lift'],
    line: {
      text: 'Look at LIFT: it’s above 1, so the push beats the weight. This rocket can fly!',
      more: { title: 'THRUST-TO-WEIGHT', text: 'LIFT is thrust divided by weight. Just above 1 means a slow, gentle climb. The side tanks drop off in space, so the rocket gets much lighter later.' }
    }
  },
  {
    kind: 'launch',
    targets: ['launch'],
    line: { text: 'Rocket ready! Press LAUNCH to roll it out to the launch pad.' }
  }
];

/** Index of the first flight-side step: a guide saved past the build resumes on the pad. */
export const LAUNCH_STEP = BUILD_STEPS.findIndex(s => s.kind === 'launch');

export const WRONG_SPOT: Line = { text: 'Check the picture: that part goes in the glowing spot.' };
export const WRONG_SPOT_ARROW: Line = { text: 'Almost! Put it where the gold corners are blinking.' };
export const wrongPart = (slot: string, card: string): Line => ({
  text: slot === card ? `That’s not the part we need yet. Pick ${slot} on the right.` : `That’s not the part we need yet. Pick ${slot} and choose ${card}.`
});
export const ROCKET_DONE: Line = { text: 'The rocket is done! Press LAUNCH to fly it.' };
export const NO_REMOVE: Line = { text: 'Let’s keep this one! We need every part to reach the Moon.' };
export const PAYLOAD_LOCKED: Line = { text: 'Today we fly the satellite. You can pick other payloads after the guide.' };

// ---------------------------------------------------------------------------
// The first-play question and the end of the guide
// ---------------------------------------------------------------------------

export const OFFER: Line = { text: 'First flight, pilot? Want me to guide you from building to the Moon?' };
export const AFTER_GUIDE: Line = { text: 'The lab is all yours now: build your own rocket and fly your own missions. Good luck, pilot!' };
export const SKIP_ASK = 'Skip the whole guide?';

// ---------------------------------------------------------------------------
// Game guide, part 2: the guided flight
// ---------------------------------------------------------------------------

export type MomentId = 'PAD' | 'LAUNCH' | 'LIFTOFF' | 'MAX_Q' | 'WIND_SHEAR' | 'SPACE' | 'JAM' | 'RCS' | 'ROCKS' | 'RADIATION' | 'TLI' | 'MOON' | 'MOON_BURN' | 'MOON_GREEN' | 'DEPLOY' | 'DONE' | 'REWIND';

export interface Moment {
  targets: FlightTarget[];
  /** ok: the game holds until OK. key: it holds until this key is pressed. go: no hold, the player just does it. */
  kind: 'ok' | 'key' | 'go';
  key?: string;
  line: Line;
}

export const MOMENTS: Record<MomentId, Moment> = {
  PAD: {
    kind: 'ok',
    targets: ['sky'],
    line: {
      text: 'We fly at DAWN today: calm air and few rocks. Click the other skies to peek at them!',
      more: { title: 'LAUNCH WINDOWS', text: 'Later in the day pays more but brings stronger wind and more rocks. Real launches wait for good weather, and some only have a few minutes to go.' }
    }
  },
  LAUNCH: { kind: 'go', targets: ['launch'], line: { text: 'All systems go! Press LAUNCH or SPACE to start the countdown.' } },
  LIFTOFF: {
    kind: 'ok',
    targets: ['instruments'],
    line: {
      text: 'Liftoff! W gives more push, S gives less, and the HEALTH bar shows how your rocket is doing.',
      more: { title: 'YOUR INSTRUMENTS', text: 'This column shows each fuel tank, your LIFT, how far you lean and your health. If health reaches zero, the rocket breaks apart.' }
    }
  },
  MAX_Q: {
    kind: 'ok',
    targets: ['challenge'],
    line: {
      text: 'MAX-Q: the air pushes hardest here. If the bar turns red, press S to slow down a little.',
      more: { title: 'MAX-Q', text: 'Max-Q means maximum dynamic pressure: speed and thick air together squeeze the rocket the most. Real rockets throttle down here for a few seconds.' }
    }
  },
  WIND_SHEAR: {
    kind: 'ok',
    targets: ['challenge'],
    line: {
      text: 'Wind shear: gusts will shove you sideways! Tap A and D to keep the rocket pointing up.',
      more: { title: 'WIND SHEAR', text: 'Wind shear is wind that changes direction or speed suddenly. Launch teams check the high-up winds with weather balloons before every launch.' }
    }
  },
  SPACE: {
    kind: 'key',
    key: 'B',
    targets: ['instruments'],
    line: {
      text: 'You’re in space, where boosters can’t steer! Press B to open the shells and drop the side tanks.',
      more: { title: 'STAGING', text: 'Dropping parts you no longer need is called staging. A lighter rocket goes much further on the fuel it has left.' }
    }
  },
  JAM: {
    kind: 'ok',
    targets: ['challenge'],
    line: {
      text: 'Uh-oh, a shell is stuck! After OK, tap B three times quickly to free it.',
      more: { title: 'STUCK STAGES', text: 'Real rockets let go of a stage with small exploding bolts. Engineers always plan what to do if one doesn’t fire.' }
    }
  },
  RCS: {
    kind: 'ok',
    targets: ['instruments'],
    line: {
      text: 'Shells open: now A and D steer with puffs of cold gas! The green tank shows how much is left.',
      more: { title: 'ACTION AND REACTION', text: 'Each puff of gas pushes one way, and the rocket turns the other way. Astronauts use the same trick to turn spacecraft.' }
    }
  },
  ROCKS: {
    kind: 'ok',
    targets: ['height'],
    line: {
      text: 'Rock belt: red arrows show rocks coming! Slide left and right with A and D to dodge them.',
      more: { title: 'SPACE ROCKS', text: 'Space has rocks of every size, from dust to mountains. Close passes with no hit build a combo for bonus points.' }
    }
  },
  RADIATION: {
    kind: 'ok',
    targets: ['challenge'],
    line: {
      text: 'Radiation belt: invisible particles hurt the rocket! Fly straight through as fast as you can.',
      more: { title: 'VAN ALLEN BELTS', text: 'Earth is circled by real belts of radiation called the Van Allen belts. Spacecraft cross them quickly so they get a smaller dose.' }
    }
  },
  TLI: {
    kind: 'ok',
    targets: ['challenge'],
    line: {
      text: 'Aim for the Moon! Turn with A and D, then burn with W, to put the needle in the green.',
      more: { title: 'TRANS-LUNAR INJECTION', text: 'One well-aimed push sends a spacecraft coasting to the Moon. You aim to pass beside the Moon, not at it, so you can swing around it.' }
    }
  },
  MOON: {
    kind: 'ok',
    targets: ['orbit', 'goal'],
    line: {
      text: 'You reached the Moon, but you’re too fast to stay! I’ll turn your nose backwards, then you brake on my call.',
      more: { title: 'ORBIT', text: 'An orbit is falling around something forever. You move sideways so fast that you keep missing the Moon as you fall. LOW and HIGH are the closest and farthest points of your circle.' }
    }
  },
  MOON_BURN: {
    kind: 'key',
    key: 'W',
    targets: ['orbit'],
    line: {
      text: 'NOW! Hold W to fire the engine and slow down, until LOW and HIGH both turn green.',
      more: { title: 'BRAKING', text: 'Firing the engine against your motion slows you down. Slow enough, and the Moon’s pull bends your path into a loop around it: an orbit!' }
    }
  },
  MOON_GREEN: {
    kind: 'ok',
    targets: ['orbit'],
    line: {
      text: 'Both green, you’re in orbit! I stopped the engine for you; on your own, X stops it.',
      more: { title: 'LOW AND HIGH', text: 'LOW is the closest your loop comes to the Moon, HIGH the farthest. Too low and you hit the Moon; too high and it can’t hold you.' }
    }
  },
  DEPLOY: {
    kind: 'ok',
    targets: ['goal'],
    line: {
      text: 'Steady orbit! After OK, press SPACE to let the satellite go.',
      more: { title: 'DEPLOYMENT', text: 'Satellites are let go once they are on the right orbit, then they unfold their solar panels and get to work.' }
    }
  },
  DONE: {
    kind: 'ok',
    targets: ['result'],
    line: { text: 'Mission complete, you’re a real pilot now! This screen shows your stars and the money you earned.' }
  },
  REWIND: { kind: 'ok', targets: [], line: { text: 'Ouch, that’s OK: every pilot crashes sometimes! Let’s try that part again.' } }
};

/** What finishing pays, added to the DONE line. */
export const doneLine = (bonus: number): Line =>
  bonus > 0 ? { text: `Mission complete, you’re a real pilot now! Here’s $${bonus} for finishing Flight School.` } : MOMENTS.DONE.line;

/** Peeking at a later launch time on the pad (it can be flown after the guide). */
export function skyPeek(time: TimeOfDay): Line {
  const t = CONFIG.timeOfDay[time];
  if (time === 'DAWN') return MOMENTS.PAD.line;
  return { text: `${time}: pays ×${t.reward}, wind ×${t.wind}, rocks level ${t.rockDifficulty}. You can fly it after the guide!` };
}
