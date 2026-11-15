/**
 * Mission Control's voice: radio recordings of every line, made ahead of time by
 * `npm run voice` (scripts/make-voice-lines.mjs) and kept in public/assets/voice.
 * A file is named after what it says, so changing a line needs a new recording, and a line
 * with no recording simply types out silently.
 */

/** How a recording is laid out around the speech (seconds): beep, gap, speech, gap, beep, end. */
export const RADIO = { beep: 0.25, gapBefore: 0.12, gapAfter: 0.12, end: 0.15 };
const SPEECH_STARTS = RADIO.beep + RADIO.gapBefore;
const AFTER_SPEECH = RADIO.gapAfter + RADIO.beep + RADIO.end;
const SETTING_KEY = 'nasa2026.voice';

/** Words voices misread, fixed in what is spoken only (the screen keeps the original). */
const SAY_INSTEAD: ReadonlyArray<[RegExp, string]> = [
  [/\bMAX-Q\b/g, 'Max Q'],
  [/\bMax-Q\b/g, 'Max Q'],
  [/\bRCS\b/g, 'R C S'],
  [/\bTWR\b/g, 'T W R'],
  [/\bOK\b/g, 'okay'],
  [/\bSaturn V\b/g, 'Saturn Five'],
  // "A" on its own would be read as the word "a".
  [/\bA and D\b/g, 'Ay and D'],
  [/×\s*/g, 'times '],
  [/(\d)\s*kg\b/g, '$1 kilograms']
];
/** All-capital words the voice should say as they are. Every other one is lowered so it isn't spelled out. */
const KEEP_CAPITALS = new Set(['NASA']);

export function spokenText(text: string): string {
  let out = text;
  for (const [from, to] of SAY_INSTEAD) out = out.replace(from, to);
  return out.replace(/\b[A-Z]{2,}\b/g, word => (KEEP_CAPITALS.has(word) ? word : word.toLowerCase()));
}

/** The recording's file name (FNV-1a of the spoken words). */
export function clipName(text: string): string {
  let h = 0x811c9dc5;
  for (const ch of spokenText(text)) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(16).padStart(8, '0')}.mp3`;
}

let enabled = readSetting();

function readSetting(): boolean {
  try {
    return localStorage.getItem(SETTING_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** The player's VOICE setting: on unless they turned it off. */
export function voiceOn(): boolean {
  return enabled;
}

export function setVoiceOn(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(SETTING_KEY, on ? 'on' : 'off');
  } catch {
    // blocked storage: the setting just won't persist
  }
}

/** Plays one line at a time for whoever asked last: a new line always cuts off the old one. */
class Speaker {
  private audio: HTMLAudioElement | null = null;
  private owner: object | null = null;

  public say(text: string, owner: object): void {
    this.halt();
    this.owner = owner;
    if (typeof Audio === 'undefined') return;
    const audio = new Audio(`assets/voice/${clipName(text)}`);
    const finished = () => {
      if (this.audio === audio) this.audio = null;
    };
    audio.onended = finished;
    audio.onerror = finished;
    this.audio = audio;
    audio.play().catch(finished);
  }

  /** This owner's line is playing. */
  public talkingFor(owner: object): boolean {
    return this.audio !== null && this.owner === owner;
  }

  /** How far through its words this owner's line is (0 to 1), or null if it isn't playing. */
  public progressFor(owner: object): number | null {
    if (!this.audio || this.owner !== owner) return null;
    const length = this.audio.duration - SPEECH_STARTS - AFTER_SPEECH;
    if (!(length > 0)) return 0; // still loading
    return Math.min(1, Math.max(0, (this.audio.currentTime - SPEECH_STARTS) / length));
  }

  /** Stop talking, if this owner's line is the one playing. */
  public stop(owner: object): void {
    if (this.owner === owner) this.halt();
  }

  private halt(): void {
    this.audio?.pause();
    this.audio = null;
  }
}

export const speech = new Speaker();
