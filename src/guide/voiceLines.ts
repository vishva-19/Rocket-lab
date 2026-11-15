import { CONFIG } from '../config';
import { LOSE_CALLS, WIN_CALLS } from '../game/missionCalls';
import { REFERENCE_ROCKET, pickFor } from './referenceRocket';
import {
  AFTER_GUIDE,
  BUILD_STEPS,
  doneLine,
  LAB_TOUR,
  Line,
  MOMENTS,
  NO_REMOVE,
  OFFER,
  PAYLOAD_LOCKED,
  ROCKET_DONE,
  skyPeek,
  WRONG_SPOT,
  WRONG_SPOT_ARROW,
  wrongPart
} from './script';

/** Every sentence control station can say, TELL ME MORE cards and end-of-flight calls included: what `npm run voice` records. */
export function allVoiceLines(): string[] {
  const lines: Line[] = [
    ...LAB_TOUR.map(s => s.line),
    ...BUILD_STEPS.map(s => s.line),
    ...Object.values(MOMENTS).map(m => m.line),
    WRONG_SPOT,
    WRONG_SPOT_ARROW,
    NO_REMOVE,
    PAYLOAD_LOCKED,
    ROCKET_DONE,
    OFFER,
    AFTER_GUIDE,
    doneLine(CONFIG.economy.guideBonus),
    ...(['DAWN', 'NOON', 'DUSK', 'NIGHT'] as const).map(skyPeek),
    ...REFERENCE_ROCKET.map(part => {
      const pick = pickFor(part);
      return wrongPart(pick.slot, pick.card);
    })
  ];
  return [...new Set([...lines.flatMap(l => (l.more ? [l.text, l.more.text] : [l.text])), ...WIN_CALLS, ...LOSE_CALLS])];
}
