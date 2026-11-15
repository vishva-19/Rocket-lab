/** Control station's radio calls at the end of a flight (recorded by `npm run voice`, see guide/voiceLines.ts). */
export const WIN_CALLS = [
  'Mission accomplished, pilot. Outstanding flying!',
  'All stations, we have mission success. Great work up there!',
  'Control confirms, objective complete. The whole room is cheering!',
  'That was a textbook flight, pilot. Welcome to the history books!',
  'Mission success! You make this look easy, pilot.'
] as const;

/** Said after any failed flight, so none of them can name a particular way of failing. */
export const LOSE_CALLS = [
  'We have lost the mission, pilot. Let’s review the data and go again.',
  'Control to pilot, that one did not go to plan. Back to the drawing board.',
  'Mission failure. All stations, stand down.',
  'Tough break, pilot. Every great rocket starts with a few failures.',
  'Flight is over, pilot. Reset the board and try again.'
] as const;

/** One of the five calls, at random. */
export function missionCall(won: boolean, random: () => number = Math.random): string {
  const calls = won ? WIN_CALLS : LOSE_CALLS;
  return calls[Math.min(calls.length - 1, Math.floor(random() * calls.length))];
}
