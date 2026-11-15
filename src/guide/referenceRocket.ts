import { FuelKind, PartType } from '../core/types';

/** One part of the guide's rocket: its cell in the lab grid, its type and (for tanks) its fuel. */
export interface RefPart {
  x: number;
  y: number;
  type: PartType;
  fuel?: FuelKind;
}

/**
 * The game guide's rocket, built around the satellite at column 7, row 8. It is the rocket the
 * full-mission tests fly (game/phases.test.ts): three kerosene tanks and three boosters lift it,
 * two twin legs (RCS) on the satellite's sides hold the side stack and steer in space on the cold
 * gas above the satellite. It reaches the Moon with fuel to spare even when the shells drop at
 * the edge of space.
 */
export const REFERENCE_ROCKET: RefPart[] = [
  { x: 7, y: 7, type: 'FUEL_TANK', fuel: 'COLD_GAS' },
  { x: 7, y: 6, type: 'NOSE_CONE' },
  { x: 6, y: 8, type: 'RCS' },
  { x: 8, y: 8, type: 'RCS' },
  { x: 7, y: 9, type: 'FUEL_TANK', fuel: 'KEROSENE' },
  { x: 6, y: 9, type: 'FUEL_TANK', fuel: 'KEROSENE' },
  { x: 8, y: 9, type: 'FUEL_TANK', fuel: 'KEROSENE' },
  { x: 7, y: 10, type: 'ENGINE' },
  { x: 6, y: 10, type: 'ENGINE' },
  { x: 8, y: 10, type: 'ENGINE' },
  { x: 5, y: 9, type: 'FIN' },
  { x: 9, y: 9, type: 'FIN' }
];

/** The satellite's own cell (the lab's root slot). */
export const ROOT_CELL = { x: 7, y: 8 };

/** What the player must pick in the parts panel to place a part: the slot, and the card in its fan. */
export function pickFor(part: RefPart): { slot: 'FUEL TANK' | 'NOSE CONE' | 'BOOSTER' | 'FIN' | 'BLOCK'; card: string } {
  switch (part.type) {
    case 'FUEL_TANK':
      return { slot: 'FUEL TANK', card: part.fuel === 'COLD_GAS' ? 'COLD GAS' : part.fuel === 'HYDROGEN' ? 'HYDROGEN' : 'KEROSENE' };
    case 'RCS':
      return { slot: 'BOOSTER', card: 'TWIN LEG' };
    case 'ENGINE':
      return { slot: 'BOOSTER', card: 'BOOSTER' };
    case 'NOSE_CONE':
      return { slot: 'NOSE CONE', card: 'NOSE CONE' };
    case 'FIN':
      return { slot: 'FIN', card: 'FIN' };
    default:
      return { slot: 'BLOCK', card: 'BLOCK' };
  }
}

/** A placed part as the lab reports it. */
export interface PlacedPart {
  gridX: number;
  gridY: number;
  type: PartType;
  fuelKind?: FuelKind;
}

const matches = (want: RefPart, type: PartType, fuel: FuelKind | undefined): boolean =>
  want.type === type && (want.type !== 'FUEL_TANK' || (want.fuel ?? 'KEROSENE') === (fuel ?? 'KEROSENE'));

export type PlaceVerdict = 'OK' | 'WRONG_SPOT' | 'WRONG_PART';

/**
 * May this part go here during a build step? Only into one of the step's own empty cells, and only
 * the part that cell wants. A part that belongs to the step but sits in the wrong cell is a wrong
 * spot; any other part is the wrong part.
 */
export function checkPlacement(step: readonly RefPart[], placed: readonly PlacedPart[], x: number, y: number, type: PartType, fuel?: FuelKind): PlaceVerdict {
  const open = step.filter(p => !placed.some(q => q.gridX === p.x && q.gridY === p.y));
  const here = open.find(p => p.x === x && p.y === y);
  if (here) return matches(here, type, fuel) ? 'OK' : 'WRONG_PART';
  return open.some(p => matches(p, type, fuel)) ? 'WRONG_SPOT' : 'WRONG_PART';
}

/** Every cell of the step holds its part. */
export const stepComplete = (step: readonly RefPart[], placed: readonly PlacedPart[]): boolean =>
  step.every(p => placed.some(q => q.gridX === p.x && q.gridY === p.y && matches(p, q.type, q.fuelKind)));

/** The step's parts still missing. */
export const stepOpen = (step: readonly RefPart[], placed: readonly PlacedPart[]): RefPart[] =>
  step.filter(p => !placed.some(q => q.gridX === p.x && q.gridY === p.y && matches(p, q.type, q.fuelKind)));
