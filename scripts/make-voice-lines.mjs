// Records every Mission Control line as a radio message (macOS only: `say` + ffmpeg).
//   npm run voice            records the lines that have no recording yet
//   npm run voice -- --all   records everything again (after changing VOICE or the radio sound)
// Recordings no line uses any more are deleted.
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createServer } from 'vite';

const run = promisify(execFile);
const VOICE = 'Reed (English (US))';
const WORDS_PER_MINUTE = '190';
const RATE = 22050;
const OUT = 'public/assets/voice';
const FORMAT = `aresample=${RATE},aformat=sample_fmts=fltp:channel_layouts=mono`;
const RADIO_SOUND = 'highpass=f=380,highpass=f=380,lowpass=f=2700,lowpass=f=2700,acompressor=threshold=0.08:ratio=8:attack=4:release=70:makeup=5,asoftclip=type=tanh,volume=0.75';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { allVoiceLines } = await vite.ssrLoadModule('/src/guide/voiceLines.ts');
const { clipName, spokenText, RADIO } = await vite.ssrLoadModule('/src/guide/speech.ts');
const lines = allVoiceLines();
await vite.close();

await mkdir(OUT, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), 'voice-'));
const existing = new Set(await readdir(OUT));
const wanted = new Map(lines.map(l => [clipName(l), l]));
const todo = [...wanted].filter(([name]) => process.argv.includes('--all') || !existing.has(name));

async function record([name, line]) {
  const speech = join(temp, `${name}.aiff`);
  await run('say', ['-v', VOICE, '-r', WORDS_PER_MINUTE, '-o', speech, spokenText(line)]);
  const beep = f => `sine=f=${f}:d=${RADIO.beep}:r=${RATE}`;
  await run('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', speech,
    '-f', 'lavfi', '-i', beep(2525),
    '-f', 'lavfi', '-i', beep(2475),
    '-f', 'lavfi', '-i', `anoisesrc=c=pink:a=0.05:r=${RATE}`,
    '-filter_complex',
    `[0]${FORMAT},${RADIO_SOUND},apad=pad_dur=${RADIO.gapAfter}[speech];` +
      `[1]${FORMAT},volume=0.22,apad=pad_dur=${RADIO.gapBefore}[in];` +
      `[2]${FORMAT},volume=0.22,apad=pad_dur=${RADIO.end}[out];` +
      `[in][speech][out]concat=n=3:v=0:a=1[all];` +
      `[3]${FORMAT},highpass=f=500,lowpass=f=2800[hiss];` +
      `[all][hiss]amix=inputs=2:duration=first:normalize=0[radio]`,
    '-map', '[radio]', '-c:a', 'libmp3lame', '-b:a', '48k', join(OUT, name)
  ]);
}

const queue = [...todo];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length > 0) await record(queue.shift());
}));
await rm(temp, { recursive: true });

const unused = [...existing].filter(f => !wanted.has(f));
for (const f of unused) await rm(join(OUT, f));
console.log(`${lines.length} lines: recorded ${todo.length}, removed ${unused.length} unused.`);
