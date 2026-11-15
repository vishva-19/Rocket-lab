/**
 * Flight School's help at the Moon (pure numbers, shared by FlightGuide and its tests).
 * The flight arrives on an easy pass (TransLunarBurnChallenge, guided), Mission Control's autopilot
 * turns the nose backwards, and the pilot brakes with W on the call until LOW and HIGH are green.
 */

/** Fuel (kg) the boosters get at the Moon if they are lower: plenty to brake into orbit, so a retry can always work. */
export const MOON_FUEL = 150;

/**
 * The braking call comes this high above the lowest point of the pass (m). The burn lasts a while, so it
 * must start well before the lowest point: started at +150 m the rocket swings past it and the loop dips
 * into the Moon; +400 to +800 m brakes cleanly into orbit on every easy pass (guide.test.ts).
 */
export const BRAKE_ABOVE_LOW_POINT = 600;

/** Time to call "brake now": the nose points backwards and the rocket is near the lowest point of its pass. */
export function brakeNow(noseBackwards: boolean, moonAltitude: number, lowPoint: number | null): boolean {
  return noseBackwards && lowPoint !== null && moonAltitude <= lowPoint + BRAKE_ABOVE_LOW_POINT;
}
