// @ts-expect-error the project has no Node types; this test only needs to see if a file exists
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clipName, spokenText } from './speech';
import { allVoiceLines } from './voiceLines';

describe('what the voice says', () => {
  it('says capitals as words, and letters only where they are letters', () => {
    expect(spokenText('We fly at DAWN today.')).toBe('We fly at dawn today.');
    expect(spokenText('tiny jets called RCS')).toBe('tiny jets called R C S');
    expect(spokenText('After OK, tap B')).toBe('After okay, tap B');
    expect(spokenText('Tap A and D, then W')).toBe('Tap Ay and D, then W');
    expect(spokenText('MAX-Q: the air')).toBe('Max Q: the air');
    expect(spokenText('NASA’s Shuttle')).toBe('NASA’s Shuttle');
    expect(spokenText('crew 90 kg, pays ×2')).toBe('crew 90 kilograms, pays times 2');
  });

  it('leaves no shouted word in anything Flight School says', () => {
    for (const line of allVoiceLines()) expect(spokenText(line).replace(/NASA/g, ''), line).not.toMatch(/\b[A-Z]{2,}\b/);
  });
});

describe('the recordings', () => {
  it('has one for every line (run `npm run voice` after changing a line)', () => {
    for (const line of allVoiceLines()) {
      expect(existsSync(new URL(`../../public/assets/voice/${clipName(line)}`, import.meta.url)), line).toBe(true);
    }
  });

  it('never gives two different lines the same file', () => {
    const lines = allVoiceLines();
    expect(new Set(lines.map(clipName)).size).toBe(new Set(lines.map(spokenText)).size);
  });

  it('shares a file only when the words sound the same', () => {
    expect(clipName('We fly at DAWN.')).toBe(clipName('We fly at dawn.'));
    expect(clipName('We fly at dawn.')).not.toBe(clipName('We fly at noon.'));
  });
});
