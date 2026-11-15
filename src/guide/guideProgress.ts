import { CONFIG } from '../config';
import { PlayerProgress, ProgressStorage } from '../game/progress';

/** Which guide runs: the whole game (build, then fly), or the Rocket Lab tour. */
export type GuideId = 'GAME' | 'LAB';

/** Where each guide got to, saved apart from the player's progress so a guide can resume. */
export interface GuideState {
  /** The first-play question was answered (yes or no): it is never asked again. */
  asked: boolean;
  game: { step: number; done: boolean; rewarded: boolean };
  lab: { step: number; done: boolean };
}

const STORAGE_KEY = 'nasa2026.guide';

/** Paid once, the first time the game guide is finished. */
export const GUIDE_BONUS = CONFIG.economy.guideBonus;

export const freshGuide = (): GuideState => ({ asked: false, game: { step: 0, done: false, rewarded: false }, lab: { step: 0, done: false } });

function defaultStorage(): ProgressStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const whole = (n: unknown): number => (Number.isFinite(n) ? Math.max(0, Math.floor(Number(n))) : 0);

export function loadGuide(storage: ProgressStorage | null = defaultStorage()): GuideState {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return freshGuide();
    const p = JSON.parse(raw) as Partial<GuideState>;
    return {
      asked: !!p.asked,
      game: { step: whole(p.game?.step), done: !!p.game?.done, rewarded: !!p.game?.rewarded },
      lab: { step: whole(p.lab?.step), done: !!p.lab?.done }
    };
  } catch {
    return freshGuide();
  }
}

export function saveGuide(state: GuideState, storage: ProgressStorage | null = defaultStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or blocked storage: the guide just starts over next time.
  }
}

/** Ask "Want me to guide you?" only on a brand-new save that has never been asked. */
export const shouldOfferGuide = (guide: GuideState, progress: PlayerProgress): boolean => !guide.asked && progress.flights === 0;

/** Where a guide picks up: a finished guide starts over, an unfinished one resumes. */
export function startStep(guide: GuideState, id: GuideId, restart = false): number {
  const g = id === 'GAME' ? guide.game : guide.lab;
  return restart || g.done ? 0 : g.step;
}

/** Finishing the game guide: the bonus is paid the first time only. Returns the new state and what to pay. */
export function finishGameGuide(guide: GuideState): { guide: GuideState; bonus: number } {
  const bonus = guide.game.rewarded ? 0 : GUIDE_BONUS;
  return { guide: { ...guide, asked: true, game: { step: 0, done: true, rewarded: true } }, bonus };
}
