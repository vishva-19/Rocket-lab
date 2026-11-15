import Phaser from 'phaser';
import { playSfx } from '../core/sound';
import { hudFrame } from '../ui/CornerHud';
import { drawPixelPanel, pixelBody, pixelTitle, PX } from '../ui/pixel';
import { bounds, contains, dimRects, insideAny, pickSpot, Rect, rect } from './geometry';
import { Line, SKIP_ASK } from './script';
import { setVoiceOn, speech, voiceOn } from './speech';

const SCREEN_W = 1280;
const SCREEN_H = 720;
const BOX_W = 470;
const BOX_H = 160;
const PORTRAIT = 4; // art pixel size of the flight controller's face
const TYPE_RATE = 55; // letters per second
const VOICE_CLACK = 0.4; // the typewriter keys get quieter under the voice
const DIM = 0x07060b;
const DIM_ALPHA = 0.62;
const SPEAKER_W = 17;
const SPEAKER_H = 16;

/** What one bubble shows and waits for. */
export interface Bubble {
  line: Line;
  /** The lit parts of the screen; everything else is dimmed and can't be clicked. */
  holes: Rect[];
  /** ok: an OK button. wait: no button, the player does the thing. ask: two answers. */
  mode: 'ok' | 'wait' | 'ask';
  back?: boolean;
  yes?: string;
  no?: string;
  /** Small "STEP 3 / 10" note in the box's corner. */
  progress?: string;
  /** Keep the screen undimmed (the lit holes still get their frames). */
  noDim?: boolean;
}

export interface BubbleHandlers {
  onOk?: () => void;
  onBack?: () => void;
  onYes?: () => void;
  onNo?: () => void;
}

// The flight controller, 12 × 13 art pixels: hair, skin, eyes, headset cups, mic boom, shirt.
const FACE = [
  '....HHHH....',
  '..HHHHHHHH..',
  '.KHHSSSSHHK.',
  '.KHSSSSSSHK.',
  'KKSSESSESSKK',
  'KKSSSSSSSSKK',
  '.KSSSSSSSSM.',
  '..SSSOOSSSM.',
  '...SSSSSMM..',
  '....SSSS....',
  '..CCCLLCCC..',
  '.CCCCLLCCCC.',
  'CCCCCLLCCCCC'
];
const FACE_COLORS: Record<string, number> = { H: 0x3a2418, S: 0xf0b98a, E: 0x1b1626, K: 0x3d4a66, M: 0x8a95ad, O: 0x9c4a4a, C: 0x2f6fd0, L: 0xffd23f };

/**
 * Mission Control: the guide's voice. A radio box in the flight HUD's style with a small pixel
 * controller who talks (the text types out along with a radio recording of the line, see speech.ts), a spotlight that dims everything but
 * what it is about, an OK / BACK / TELL ME MORE row and a SKIP GUIDE button in a top corner.
 * Scenes stay in charge of their own input: they ask `blocks()` before acting on a click and
 * `capturesKeys` before acting on ENTER / SPACE.
 */
export class MissionControl {
  private readonly root: Phaser.GameObjects.Container;
  private readonly dim: Phaser.GameObjects.Graphics;
  private readonly frames: Phaser.GameObjects.Graphics;
  private readonly blockers: Phaser.GameObjects.Container;
  private readonly box: Phaser.GameObjects.Container;
  private readonly boxGfx: Phaser.GameObjects.Graphics;
  private readonly face: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private readonly note: Phaser.GameObjects.Text;
  private readonly progress: Phaser.GameObjects.Text;
  private readonly live: Phaser.GameObjects.Graphics;
  private buttons: Phaser.GameObjects.Container[] = [];
  private more: Phaser.GameObjects.Container | null = null;
  private confirm: Phaser.GameObjects.Container | null = null;
  private readonly skip: Phaser.GameObjects.Container;
  private skipRect: Rect;
  private skipOn = true;
  private readonly speaker: Phaser.GameObjects.Container;
  private readonly speakerGfx: Phaser.GameObjects.Graphics;
  private speakerHover = false;
  private speakerDrawn = '';
  /** The game was paused in the middle of a spoken line: read it again on CONTINUE. */
  private cutByPause = false;

  private bubble: Bubble | null = null;
  private handlers: BubbleHandlers = {};
  private boxRect: Rect = rect(0, 0, BOX_W, BOX_H);
  private shown = 0;
  private full = '';
  private blinkAt = 0;
  private lastOk = -Infinity;
  private lastWall = performance.now();
  /** A hole to point an extra pulsing marker at (e.g. "it goes here"). */
  private marker: Rect | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly opts: { onSkip: () => void; skipAt: { right: number; y: number }; depth?: number }
  ) {
    const depth = opts.depth ?? 2000;
    this.root = scene.add.container(0, 0).setDepth(depth);
    this.dim = scene.add.graphics();
    this.blockers = scene.add.container(0, 0);
    this.frames = scene.add.graphics();
    this.box = scene.add.container(0, 0);
    this.boxGfx = scene.add.graphics();
    this.face = scene.add.graphics();
    this.live = scene.add.graphics();
    this.text = pixelBody(scene, 92, 34, '', 24, PX.text.white).setWordWrapWidth(BOX_W - 108).setLineSpacing(-3);
    this.note = pixelBody(scene, 92, BOX_H - 34, '', 20, PX.text.gold);
    this.progress = pixelBody(scene, BOX_W - 12, 6, '', 18, PX.text.muted).setOrigin(1, 0);
    const title = pixelTitle(scene, 30, 9, 'MISSION CONTROL', 9, PX.text.accent);
    // The box swallows clicks so nothing underneath reacts.
    const hit = scene.add.zone(0, 0, BOX_W, BOX_H).setOrigin(0).setInteractive();
    this.speakerGfx = scene.add.graphics();
    const speakerHit = scene.add.zone(-4, -3, SPEAKER_W + 8, SPEAKER_H + 6).setOrigin(0).setInteractive({ useHandCursor: true });
    speakerHit.on('pointerover', () => (this.speakerHover = true));
    speakerHit.on('pointerout', () => (this.speakerHover = false));
    speakerHit.on('pointerup', () => this.toggleVoice());
    this.speaker = scene.add.container(title.x + title.width + 10, 6, [this.speakerGfx, speakerHit]);
    this.box.add([hit, this.boxGfx, this.live, this.face, title, this.speaker, this.progress, this.text, this.note]);
    this.root.add([this.dim, this.blockers, this.frames, this.box]);
    this.drawBox();

    // SKIP GUIDE sits in a top corner the whole time.
    const sw = 150;
    const sh = 34;
    this.skipRect = rect(opts.skipAt.right - sw, opts.skipAt.y, sw, sh);
    this.skip = this.button(this.skipRect.x, this.skipRect.y, sw, sh, 'SKIP GUIDE', 'dim', () => this.askSkip());
    this.root.add(this.skip);

    const kb = scene.input.keyboard;
    kb?.on('keydown-ENTER', this.onKeyOk, this);
    kb?.on('keydown-SPACE', this.onKeyOk, this);
    scene.events.on(Phaser.Scenes.Events.PAUSE, this.onScenePause, this);
    scene.events.on(Phaser.Scenes.Events.RESUME, this.onSceneResume, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.box.setVisible(false);
  }

  // ---------------------------------------------------------------------------
  // What scenes ask
  // ---------------------------------------------------------------------------

  /** A click here must not reach the scene: it is outside the lit holes (or on the box / skip button). */
  public blocks(x: number, y: number): boolean {
    if (this.confirm) return true;
    if (this.skipOn && contains(this.skipRect, x, y)) return true;
    if (!this.bubble) return false;
    if (this.box.visible && contains(this.boxRect, x, y)) return true;
    if (this.more && contains(this.moreRect(), x, y)) return true;
    if (this.bubble.noDim) return false;
    return !insideAny(this.bubble.holes, x, y);
  }

  /** ENTER / SPACE belong to the bubble right now (an OK or a question is up, or OK was just pressed). */
  public get capturesKeys(): boolean {
    return !!this.confirm || (this.bubble !== null && this.bubble.mode !== 'wait') || performance.now() - this.lastOk < 150;
  }

  public setSkipVisible(on: boolean): void {
    this.skipOn = on;
    this.skip.setVisible(on);
  }

  public get visible(): boolean {
    return this.bubble !== null;
  }

  // ---------------------------------------------------------------------------
  // Showing bubbles
  // ---------------------------------------------------------------------------

  public show(bubble: Bubble, handlers: BubbleHandlers = {}): void {
    this.bubble = bubble;
    this.handlers = handlers;
    this.marker = null;
    this.closeMore();
    this.layout();
    this.say(bubble.line, true);
  }

  /** Change the words without changing what the bubble waits for (wrong-part tips, sky peeks). */
  public say(line: Line, fresh = false): void {
    if (!this.bubble) return;
    if (!fresh && this.full === line.text) return;
    this.bubble = { ...this.bubble, line };
    this.full = line.text;
    this.shown = 0;
    // A long line steps the font down a notch so it never runs into the buttons.
    this.text.setFontSize(24).setText(this.full);
    if (this.text.height > BOX_H - 84) this.text.setFontSize(21);
    this.text.setText('');
    this.closeMore();
    this.drawButtons();
    this.speak(this.full);
  }

  /** Read this out, if the player has the voice on; otherwise make sure nothing older is still talking. */
  private speak(text: string): void {
    if (voiceOn() && !this.scene.sound.mute) speech.say(text, this);
    else speech.stop(this);
  }

  /** The speaker button: back on reads whatever is showing again from the start. */
  private toggleVoice(): void {
    if (this.scene.sound.mute) return;
    playSfx(this.scene, 'UI_CLICK');
    setVoiceOn(!voiceOn());
    const card = this.bubble?.line.more;
    if (!voiceOn()) speech.stop(this);
    else if (this.more && card) this.speak(card.text);
    else if (this.bubble) this.say(this.bubble.line, true);
  }

  private onScenePause(): void {
    this.cutByPause = speech.talkingFor(this);
    speech.stop(this);
  }

  private onSceneResume(): void {
    if (!this.cutByPause) return;
    this.cutByPause = false;
    const card = this.bubble?.line.more;
    if (this.more && card) this.speak(card.text);
    else if (this.bubble) this.say(this.bubble.line, true);
  }

  /** Light different parts of the screen (a fan of cards opened, the rocket moved). */
  public setHoles(holes: Rect[]): void {
    if (!this.bubble) return;
    const same = holes.length === this.bubble.holes.length && holes.every((h, i) => JSON.stringify(h) === JSON.stringify(this.bubble!.holes[i]));
    if (same) return;
    this.bubble = { ...this.bubble, holes };
    this.layout();
  }

  /** Point a pulsing marker at one spot (null clears it). */
  public pointAt(spot: Rect | null): void {
    this.marker = spot;
  }

  public hide(): void {
    this.bubble = null;
    this.handlers = {};
    this.marker = null;
    this.closeMore();
    speech.stop(this);
    this.box.setVisible(false);
    this.dim.clear();
    this.frames.clear();
    this.blockers.removeAll(true);
  }

  public destroy(): void {
    const kb = this.scene.input?.keyboard;
    kb?.off('keydown-ENTER', this.onKeyOk, this);
    kb?.off('keydown-SPACE', this.onKeyOk, this);
    this.scene.events.off(Phaser.Scenes.Events.PAUSE, this.onScenePause, this);
    this.scene.events.off(Phaser.Scenes.Events.RESUME, this.onSceneResume, this);
    speech.stop(this);
    this.root.destroy();
  }

  public update(time: number): void {
    // Typing follows the real clock, so a slow frame rate never makes Mission Control drawl.
    const wall = performance.now();
    const dtMs = Math.min(250, wall - this.lastWall);
    this.lastWall = wall;
    if (this.bubble && this.shown < this.full.length) {
      const before = Math.floor(this.shown);
      // The words appear as the recording says them; with no recording playing, at full typing speed.
      const progress = this.more ? null : speech.progressFor(this);
      const voiced = progress !== null;
      this.shown = progress !== null ? Math.max(this.shown, progress * this.full.length) : Math.min(this.full.length, this.shown + (TYPE_RATE * dtMs) / 1000);
      const now = Math.floor(this.shown);
      if (now !== before) {
        this.text.setText(this.full.slice(0, now));
        // A typewriter key every other letter (spaces are silent), each a little different in pitch and force.
        if (Math.floor(now / 2) !== Math.floor(before / 2) && this.full[now - 1].trim() !== '') {
          playSfx(this.scene, 'TYPE_KEY', (0.75 + Math.random() * 0.25) * (voiced ? VOICE_CLACK : 1), (Math.random() - 0.5) * 300);
        }
        // The carriage bell once the line is all typed (a recording ends with its own radio beep instead).
        if (now === this.full.length && !voiced) playSfx(this.scene, 'TYPE_BELL');
      }
    }
    this.drawFace(time);
    this.drawLive(time);
    this.drawSpeaker();
    this.drawFrames(time);
  }

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  private layout(): void {
    const b = this.bubble!;
    const m = 14;
    const spots = [
      rect(m, SCREEN_H - BOX_H - m, BOX_W, BOX_H),
      rect(SCREEN_W - BOX_W - m, SCREEN_H - BOX_H - m, BOX_W, BOX_H),
      rect((SCREEN_W - BOX_W) / 2, SCREEN_H - BOX_H - m, BOX_W, BOX_H),
      rect(m, 60, BOX_W, BOX_H),
      rect(SCREEN_W - BOX_W - m, 60, BOX_W, BOX_H),
      rect((SCREEN_W - BOX_W) / 2, 60, BOX_W, BOX_H)
    ];
    this.boxRect = pickSpot(b.holes, spots);
    this.box.setPosition(this.boxRect.x, this.boxRect.y).setVisible(true);
    this.progress.setText(b.progress ?? '');

    this.dim.clear();
    this.blockers.removeAll(true);
    if (!b.noDim) {
      this.dim.fillStyle(DIM, DIM_ALPHA);
      for (const r of dimRects(b.holes, SCREEN_W, SCREEN_H)) {
        this.dim.fillRect(r.x, r.y, r.w, r.h);
        // Interactive cover: the parts of the game under the dark can't be hovered or clicked.
        this.blockers.add(this.scene.add.zone(r.x, r.y, r.w, r.h).setOrigin(0).setInteractive());
      }
    }
  }

  private drawBox(): void {
    const g = this.boxGfx;
    g.clear();
    hudFrame(g, 0, 0, BOX_W, BOX_H, PX.accent, 0.92);
    // Portrait well.
    g.fillStyle(0x07060b, 1);
    g.fillRect(12, 30, 68, 72);
    g.fillStyle(0x1b2a44, 1);
    g.fillRect(14, 32, 64, 68);
    g.fillStyle(0x24385a, 1);
    for (let y = 34; y < 98; y += 6) g.fillRect(14, y, 64, 2);
  }

  /** The little speaker after the title: crossed out while off, grey when SOUND is off. */
  private drawSpeaker(): void {
    const muted = this.scene.sound.mute;
    const on = voiceOn() && !muted;
    const state = `${muted}|${on}|${this.speakerHover}`;
    if (state === this.speakerDrawn) return;
    this.speakerDrawn = state;
    const g = this.speakerGfx;
    g.clear();
    g.fillStyle(muted ? 0x6b6478 : this.speakerHover ? PX.gold : on ? 0xf4ead5 : 0x9a93a8, 1);
    g.fillRect(0, 5, 4, 6);
    g.fillRect(4, 3, 2, 10);
    g.fillRect(6, 1, 2, 14);
    if (on) {
      g.fillRect(10, 6, 2, 4);
      g.fillRect(13, 3, 2, 10);
    } else {
      g.fillStyle(0xff4f4f, 1);
      for (let i = 0; i < 6; i++) {
        g.fillRect(10 + i, 5 + i, 2, 2);
        g.fillRect(15 - i, 5 + i, 2, 2);
      }
    }
  }

  /** Blinking red "on air" light and the little antenna beside the title. */
  private drawLive(time: number): void {
    const g = this.live;
    g.clear();
    g.fillStyle(0x07060b, 1);
    g.fillRect(11, 9, 12, 12);
    g.fillStyle(Math.sin(time / 260) > 0 ? 0xff4f4f : 0x5a1a1a, 1);
    g.fillRect(13, 11, 8, 8);
    if (this.bubble?.mode === 'wait') {
      // "Your turn": a small blinking play arrow in the bottom-right corner.
      const on = Math.sin(time / 200) > -0.2;
      g.fillStyle(on ? PX.gold : 0x6b5a20, 1);
      const x = BOX_W - 30;
      const y = BOX_H - 28;
      for (let i = 0; i < 6; i++) g.fillRect(x + i * 2, y + i, 2, 12 - i * 2);
    }
  }

  private drawFace(time: number): void {
    const g = this.face;
    g.clear();
    const talking = this.shown < this.full.length && Math.sin(time / 70) > 0;
    if (time > this.blinkAt + 3200) this.blinkAt = time;
    const blinking = time - this.blinkAt < 130;
    const ox = 22;
    const oy = 40;
    FACE.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        if (ch === '.') return;
        let color = FACE_COLORS[ch];
        if (ch === 'E' && blinking) color = FACE_COLORS.S;
        if (ch === 'O' && !talking) color = 0xc98a6a;
        g.fillStyle(color, 1);
        g.fillRect(ox + c * PORTRAIT, oy + r * PORTRAIT, PORTRAIT, PORTRAIT);
      })
    );
  }

  /** Gold corners around each lit hole (and the marker), plus a dotted line from the box to the nearest one. */
  private drawFrames(time: number): void {
    const g = this.frames;
    g.clear();
    const b = this.bubble;
    if (!b) return;
    const pulse = 0.55 + 0.45 * Math.sin(time / 220);
    const corners = (r: Rect, color: number, alpha: number, len = 14, t = 4) => {
      g.fillStyle(color, alpha);
      const x0 = r.x - 4;
      const y0 = r.y - 4;
      const x1 = r.x + r.w + 4;
      const y1 = r.y + r.h + 4;
      g.fillRect(x0, y0, len, t);
      g.fillRect(x0, y0, t, len);
      g.fillRect(x1 - len, y0, len, t);
      g.fillRect(x1 - t, y0, t, len);
      g.fillRect(x0, y1 - t, len, t);
      g.fillRect(x0, y1 - len, t, len);
      g.fillRect(x1 - len, y1 - t, len, t);
      g.fillRect(x1 - t, y1 - len, t, len);
    };
    for (const h of b.holes) corners(h, PX.gold, pulse);
    if (this.marker) {
      const grow = Math.round(pulse * 4);
      corners(rect(this.marker.x - grow, this.marker.y - grow, this.marker.w + grow * 2, this.marker.h + grow * 2), 0xffffff, 1, 16, 5);
    }
    // Dotted line from the box to the closest lit thing.
    const target = this.marker ?? bounds(b.holes.length > 0 ? [b.holes.reduce((best, h) => (dist(h, this.boxRect) < dist(best, this.boxRect) ? h : best))] : []);
    if (!target || overlapsBox(target, this.boxRect)) return;
    const from = edgePoint(this.boxRect, centre(target));
    const to = edgePoint(target, centre(this.boxRect), 8);
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.floor(len / 14);
    const shift = (time / 60) % 14;
    g.fillStyle(PX.gold, 0.9);
    for (let i = 0; i <= steps; i++) {
      const d = Math.min(len, i * 14 + shift);
      g.fillRect(from.x + ((to.x - from.x) * d) / len - 2, from.y + ((to.y - from.y) * d) / len - 2, 5, 5);
    }
    g.fillStyle(0xffffff, 1);
    g.fillRect(to.x - 4, to.y - 4, 9, 9);
  }

  // ---------------------------------------------------------------------------
  // Buttons
  // ---------------------------------------------------------------------------

  private drawButtons(): void {
    for (const b of this.buttons) b.destroy();
    this.buttons = [];
    const b = this.bubble;
    if (!b) return;
    const y = BOX_H - 40;
    let right = BOX_W - 12;
    const add = (w: number, label: string, tone: 'main' | 'dim', fn: () => void) => {
      right -= w;
      const btn = this.button(right, y, w, 30, label, tone, fn);
      this.box.add(btn);
      this.buttons.push(btn);
      right -= 8;
    };
    if (b.mode === 'ok') add(76, 'OK', 'main', () => this.ok());
    if (b.mode === 'ask') {
      add(Math.max(96, (b.yes ?? 'YES').length * 11 + 28), b.yes ?? 'YES', 'main', () => this.answer(true));
      add(Math.max(84, (b.no ?? 'NO').length * 11 + 28), b.no ?? 'NO', 'dim', () => this.answer(false));
    }
    if (b.back) add(84, 'BACK', 'dim', () => this.handlers.onBack?.());
    if (b.line.more) {
      const btn = this.button(92, y, 150, 30, 'TELL ME MORE', 'more', () => this.toggleMore());
      this.box.add(btn);
      this.buttons.push(btn);
    }
    this.note.setText(b.mode === 'wait' ? 'YOUR TURN!' : '').setX(b.line.more ? 252 : 92);
    // The text gets the room above the button row.
    this.text.setWordWrapWidth(BOX_W - 108);
  }

  private button(x: number, y: number, w: number, h: number, label: string, tone: 'main' | 'dim' | 'more', onClick: () => void): Phaser.GameObjects.Container {
    const c = this.scene.add.container(x, y);
    const g = this.scene.add.graphics();
    const fill = tone === 'main' ? 0xd8322f : tone === 'more' ? 0x1d3a5c : PX.panelDeep;
    const border = tone === 'main' ? 0xff8a5c : tone === 'more' ? 0x5cc8ff : PX.border;
    const draw = (hover: boolean) => {
      g.clear();
      drawPixelPanel(g, 0, 0, w, h, { fill: hover ? Phaser.Display.Color.ValueToColor(fill).lighten(12).color : fill, fillAlpha: 1, border, u: 2 });
    };
    draw(false);
    const t = pixelTitle(this.scene, w / 2, h / 2, label, 8, tone === 'dim' ? PX.text.muted : PX.text.white).setOrigin(0.5);
    const hit = this.scene.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => {
      draw(true);
      playSfx(this.scene, 'UI_HOVER');
    });
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.button !== 0) return;
      playSfx(this.scene, 'UI_CLICK');
      onClick();
    });
    c.add([g, t, hit]);
    return c;
  }

  private onKeyOk(): void {
    if (this.confirm || !this.bubble) return;
    if (this.bubble.mode === 'ok') this.ok();
    else if (this.bubble.mode === 'ask') this.answer(true);
  }

  /** OK first finishes the typing; the second press moves on. */
  private ok(): void {
    if (!this.bubble || this.bubble.mode !== 'ok') return;
    this.lastOk = performance.now();
    if (this.shown < this.full.length) {
      this.shown = this.full.length;
      this.text.setText(this.full);
      return;
    }
    const fn = this.handlers.onOk;
    this.hide();
    fn?.();
  }

  private answer(yes: boolean): void {
    this.lastOk = performance.now();
    const h = this.handlers;
    this.hide();
    (yes ? h.onYes : h.onNo)?.();
  }

  // ---------------------------------------------------------------------------
  // TELL ME MORE and the skip question
  // ---------------------------------------------------------------------------

  private moreRect(): Rect {
    const h = 150;
    const above = this.boxRect.y - h - 14 >= 8;
    return rect(this.boxRect.x, above ? this.boxRect.y - h - 14 : this.boxRect.y + BOX_H + 14, BOX_W, h);
  }

  private toggleMore(): void {
    if (this.more) {
      this.closeMore();
      return;
    }
    const info = this.bubble?.line.more;
    if (!info) return;
    const r = this.moreRect();
    const c = this.scene.add.container(r.x, r.y);
    const g = this.scene.add.graphics();
    hudFrame(g, 0, 0, r.w, r.h, 0x5cc8ff, 0.94);
    const title = pixelTitle(this.scene, 14, 12, info.title, 9, '#9fdcff');
    const body = pixelBody(this.scene, 14, 32, info.text, 21, PX.text.cream).setWordWrapWidth(r.w - 28).setLineSpacing(-4);
    // The card fits its text.
    const need = Math.ceil(body.height) + 46;
    g.clear();
    hudFrame(g, 0, 0, r.w, need, 0x5cc8ff, 0.94);
    if (r.y < this.boxRect.y) c.setY(this.boxRect.y - need - 14);
    const hit = this.scene.add.zone(0, 0, r.w, need).setOrigin(0).setInteractive();
    c.add([hit, g, title, body]);
    this.root.add(c);
    this.more = c;
    this.speak(info.text);
  }

  private closeMore(): void {
    if (this.more) speech.stop(this);
    this.more?.destroy();
    this.more = null;
  }

  private askSkip(): void {
    if (this.confirm) return;
    const w = 340;
    const h = 120;
    const c = this.scene.add.container((SCREEN_W - w) / 2, (SCREEN_H - h) / 2);
    const g = this.scene.add.graphics();
    g.fillStyle(DIM, 0.5);
    g.fillRect(-(SCREEN_W - w) / 2, -(SCREEN_H - h) / 2, SCREEN_W, SCREEN_H);
    hudFrame(g, 0, 0, w, h, PX.accent, 0.96);
    const cover = this.scene.add.zone(-(SCREEN_W - w) / 2, -(SCREEN_H - h) / 2, SCREEN_W, SCREEN_H).setOrigin(0).setInteractive();
    const q = pixelTitle(this.scene, w / 2, 30, SKIP_ASK.toUpperCase(), 10, PX.text.cream).setOrigin(0.5);
    const yes = this.button(w / 2 - 128, h - 50, 120, 32, 'YES, SKIP', 'main', () => {
      this.closeConfirm();
      this.opts.onSkip();
    });
    const no = this.button(w / 2 + 8, h - 50, 120, 32, 'NO, STAY', 'dim', () => this.closeConfirm());
    c.add([cover, g, q, yes, no]);
    this.root.add(c);
    this.confirm = c;
  }

  private closeConfirm(): void {
    this.lastOk = performance.now();
    this.confirm?.destroy();
    this.confirm = null;
  }
}

const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const dist = (a: Rect, b: Rect) => Math.hypot(centre(a).x - centre(b).x, centre(a).y - centre(b).y);
const overlapsBox = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Where the line from a rectangle's centre towards a point leaves the rectangle (pushed out by `pad`). */
function edgePoint(r: Rect, toward: { x: number; y: number }, pad = 0): { x: number; y: number } {
  const c = centre(r);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const sx = dx !== 0 ? (r.w / 2 + pad) / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? (r.h / 2 + pad) / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: c.x + dx * s, y: c.y + dy * s };
}
