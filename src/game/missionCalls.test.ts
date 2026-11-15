import { describe, expect, it } from 'vitest';
import { LOSE_CALLS, missionCall, WIN_CALLS } from './missionCalls';

describe('end-of-flight radio calls', () => {
  it('has five different calls for each ending', () => {
    expect(new Set(WIN_CALLS).size).toBe(5);
    expect(new Set(LOSE_CALLS).size).toBe(5);
  });

  it('can pick every call, and only from the right list', () => {
    const picks = (won: boolean) => [0, 0.2, 0.4, 0.6, 0.8, 0.999].map(r => missionCall(won, () => r));
    expect(new Set(picks(true))).toEqual(new Set(WIN_CALLS));
    expect(new Set(picks(false))).toEqual(new Set(LOSE_CALLS));
  });
});
