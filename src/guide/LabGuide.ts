import Phaser from 'phaser';
import { getPartTextureKey } from '../core/assets';
import { playSfx } from '../core/sound';
import { FuelKind, PartType, PayloadKind } from '../core/types';
import { hudFrame } from '../ui/CornerHud';
import { pixelBody, pixelTitle, PX } from '../ui/pixel';
import { Rect, rect } from './geometry';
import { GuideId, loadGuide, saveGuide, startStep } from './guideProgress';
import { MissionControl } from './MissionControl';
import { checkPlacement, pickFor, PlacedPart, REFERENCE_ROCKET, RefPart, ROOT_CELL, stepComplete, stepOpen } from './referenceRocket';
import {
  AFTER_GUIDE,
  BUILD_STEPS,
  BuildStep,
  LAB_TOUR,
  LabTarget,
  LAUNCH_STEP,
  Line,
  NO_REMOVE,
  OFFER,
  PAYLOAD_LOCKED,
  WRONG_SPOT,
  WRONG_SPOT_ARROW,
  ROCKET_DONE,
  wrongPart
} from './script';

/** What the guide needs from the Rocket Lab (BuilderScene implements it). */
export interface LabHost {
  readonly scene: Phaser.Scene;
  /** Where something sits on screen right now (null when it isn't showing, e.g. a closed fan). */
  guideRect(target: LabTarget): Rect | null;
  cellRect(x: number, y: number): Rect;
  placedParts(): PlacedPart[];
  /** The part the player would place now, with its fuel. */
  selection(): { type: PartType | null; fuel?: FuelKind };
  /** Open a slot's fan of cards (null closes it). */
  openFlyout(type: 'ENGINE' | 'FUEL_TANK' | 'COCKPIT' | null): void;
  /** Put these parts on the rocket at once (resuming a half-built rocket). */
  buildInstantly(parts: RefPart[]): void;
  /** Take every part off the rocket, leaving the payload on its own (the guide's rocket after the guide). */
  clearRocket(): void;
  setPayload(kind: PayloadKind): void;
}

/** How the lab was opened: a guide to run, or the first-play question to ask. */
export interface LabGuideStart {
  guide?: GuideId;
  restart?: boolean;
  offer?: boolean;
}

/** The guide's word to the flight scene after a guided flight (kept in the game registry). */
export const GUIDE_OUTCOME_KEY = 'guideOutcome';
export type GuideOutcome = 'DONE' | 'SKIPPED' | null;

const PIC_CELL = 28;
const PIC_COLS = { from: 5, to: 9 };
const PIC_ROWS = { from: 6, to: 10 };
export const PICTURE = rect(1280 / 2 - 112, 58, 224, 214);

/**
 * Runs inside the Rocket Lab: the first-play question, the Rocket Lab tour, and part 1 of the game
 * guide (build the reference rocket from a picture, one step at a time, then launch). The lab asks
 * it before acting on clicks, placements, removals, payload swaps and LAUNCH.
 */
export class LabGuide {
  private readonly mc: MissionControl;
  private mode: 'OFFER' | 'LAB' | 'GAME' | 'AFTER' | 'OFF' = 'OFF';
  private step = 0;
  private wrongTries = 0;
  private picture: Phaser.GameObjects.Container | null = null;
  private pictureParts: Array<{ part: RefPart; img: Phaser.GameObjects.Image }> = [];
  private pictureGfx: Phaser.GameObjects.Graphics | null = null;
  private pictureStep: Phaser.GameObjects.Text | null = null;
  private flashUntil = 0;
  private readonly onUpdate = (time: number) => this.update(time);

  constructor(private readonly host: LabHost) {
    const scene = host.scene;
    this.mc = new MissionControl(scene, { onSkip: () => this.skip(), skipAt: { right: 1260, y: 12 } });
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate));
    this.setSkipVisible(false);
  }

  public start(start: LabGuideStart): void {
    if (start.guide === 'LAB') this.startLab(startStep(loadGuide(), 'LAB', start.restart));
    else if (start.guide === 'GAME') this.startGame(startStep(loadGuide(), 'GAME', start.restart));
    else if (start.offer) this.offer();
  }

  // ---------------------------------------------------------------------------
  // What the lab asks
  // ---------------------------------------------------------------------------

  public get active(): boolean {
    return this.mode !== 'OFF';
  }

  /** In the guided flight's lab the payload stays the satellite. */
  public get guidingFlight(): boolean {
    return this.mode === 'GAME';
  }

  public blocks(x: number, y: number): boolean {
    return this.active && this.mc.blocks(x, y);
  }

  public get capturesKeys(): boolean {
    return this.active && this.mc.capturesKeys;
  }

  /** May this part be bolted on here? Says why not when it can't. */
  public allowPlace(x: number, y: number, type: PartType, fuel?: FuelKind): boolean {
    if (this.mode !== 'GAME') return true;
    const s = BUILD_STEPS[this.step];
    if (s.kind !== 'place') {
      this.mc.say(s.kind === 'launch' ? ROCKET_DONE : s.line);
      return false;
    }
    const verdict = checkPlacement(s.cells!, this.host.placedParts(), x, y, type, fuel);
    if (verdict === 'OK') return true;
    playSfx(this.host.scene, 'CLICK_FAIL');
    this.host.scene.cameras.main.shake(140, 0.004);
    this.flashUntil = this.host.scene.time.now + 1100;
    if (verdict === 'WRONG_SPOT') {
      this.wrongTries++;
      const open = stepOpen(s.cells!, this.host.placedParts());
      if (this.wrongTries >= 2 && open.length > 0) {
        this.mc.pointAt(this.host.cellRect(open[0].x, open[0].y));
        this.mc.say(WRONG_SPOT_ARROW);
      } else this.mc.say(WRONG_SPOT);
    } else {
      const want = stepOpen(s.cells!, this.host.placedParts())[0] ?? s.cells![0];
      const pick = pickFor(want);
      this.mc.say(wrongPart(pick.slot, pick.card));
    }
    return false;
  }

  public allowRemove(): boolean {
    if (this.mode !== 'GAME') return true;
    this.mc.say(NO_REMOVE);
    return false;
  }

  public allowPayloadChange(): boolean {
    if (this.mode !== 'GAME') return true;
    this.mc.say(PAYLOAD_LOCKED);
    return false;
  }

  public allowLaunch(): boolean {
    if (this.mode === 'OFF') return true;
    if (this.mode === 'GAME' && BUILD_STEPS[this.step].kind === 'launch') return true;
    return false;
  }

  /** A part was placed: move on once the step's parts are all there. */
  public onChanged(): void {
    if (this.mode !== 'GAME') return;
    const s = BUILD_STEPS[this.step];
    if (s.kind !== 'place') return;
    this.mc.pointAt(null);
    this.wrongTries = 0;
    if (stepComplete(s.cells!, this.host.placedParts())) {
      playSfx(this.host.scene, 'UI_CLICK');
      this.showGameStep(this.step + 1);
    } else {
      this.mc.say(s.line);
    }
    this.refreshPicture();
  }

  /** Launched: the flight scene takes over until the lab wakes again. */
  public onLaunched(): void {
    this.mc.hide();
    this.setSkipVisible(false);
    this.picture?.setVisible(false);
  }

  /** Back from a flight: finished, skipped, or back early (from the pause menu). */
  public onWake(): void {
    if (this.mode !== 'GAME') return;
    const said = this.host.scene.registry.get(GUIDE_OUTCOME_KEY) as GuideOutcome;
    this.host.scene.registry.set(GUIDE_OUTCOME_KEY, null);
    // Leaving the result card by its own buttons still counts as finished.
    const outcome = said ?? (loadGuide().game.done ? 'DONE' : null);
    if (outcome === 'DONE') {
      this.endPicture();
      this.host.clearRocket();
      this.mode = 'AFTER';
      this.setSkipVisible(false);
      this.mc.show({ line: AFTER_GUIDE, holes: [], mode: 'ok' }, { onOk: () => this.stop() });
    } else if (outcome === 'SKIPPED') {
      this.stop();
    } else {
      this.picture?.setVisible(true);
      this.showGameStep(LAUNCH_STEP);
    }
  }

  // ---------------------------------------------------------------------------
  // The first-play question
  // ---------------------------------------------------------------------------

  private offer(): void {
    this.mode = 'OFFER';
    const answered = (yes: boolean) => {
      const g = loadGuide();
      saveGuide({ ...g, asked: true });
      if (yes) this.startGame(0);
      else this.stop();
    };
    this.mc.show({ line: OFFER, holes: [], mode: 'ask', yes: 'YES, GUIDE ME', no: 'NO, I’LL FLY' }, { onYes: () => answered(true), onNo: () => answered(false) });
  }

  // ---------------------------------------------------------------------------
  // Rocket Lab tour
  // ---------------------------------------------------------------------------

  private startLab(from: number): void {
    this.mode = 'LAB';
    this.setSkipVisible(true);
    this.showLabStop(Math.min(from, LAB_TOUR.length - 1));
  }

  private showLabStop(i: number): void {
    this.step = i;
    const g = loadGuide();
    saveGuide({ ...g, lab: { ...g.lab, step: i } });
    const stop = LAB_TOUR[i];
    this.host.openFlyout(stop.flyout ?? null);
    const last = i === LAB_TOUR.length - 1;
    this.mc.show(
      { line: stop.line, holes: this.holes(stop.targets), mode: 'ok', back: i > 0, progress: `${i + 1} / ${LAB_TOUR.length}` },
      {
        onOk: () => {
          if (!last) this.showLabStop(i + 1);
          else {
            const now = loadGuide();
            saveGuide({ ...now, lab: { step: 0, done: true } });
            this.stop();
          }
        },
        onBack: () => this.showLabStop(Math.max(0, i - 1))
      }
    );
  }

  // ---------------------------------------------------------------------------
  // Game guide, part 1: build the reference rocket
  // ---------------------------------------------------------------------------

  private startGame(from: number): void {
    this.mode = 'GAME';
    this.setSkipVisible(true);
    const g = loadGuide();
    saveGuide({ ...g, game: { ...g.game, done: false } });
    this.host.setPayload('SATELLITE');
    const at = Math.min(from, LAUNCH_STEP);
    // Resuming: the parts of the steps already done are put back at once.
    const done = BUILD_STEPS.slice(0, at).flatMap(s => s.cells ?? []);
    if (done.length > 0) this.host.buildInstantly(done);
    this.makePicture();
    this.showGameStep(at);
  }

  private showGameStep(i: number): void {
    this.step = i;
    this.wrongTries = 0;
    const g = loadGuide();
    saveGuide({ ...g, game: { ...g.game, step: i } });
    const s: BuildStep = BUILD_STEPS[i];
    this.host.openFlyout(null);
    const placeSteps = BUILD_STEPS.filter(b => b.kind === 'place');
    const n = placeSteps.indexOf(s);
    this.mc.show(
      {
        line: s.line,
        holes: this.holes(s.targets),
        mode: s.kind === 'ok' ? 'ok' : 'wait',
        progress: n >= 0 ? `STEP ${n + 1} / ${placeSteps.length}` : undefined
      },
      { onOk: () => this.showGameStep(i + 1) }
    );
    this.refreshPicture();
  }

  // ---------------------------------------------------------------------------
  // The picture of the rocket to build
  // ---------------------------------------------------------------------------

  private makePicture(): void {
    if (this.picture) return;
    const scene = this.host.scene;
    // Over the rocket and panels, but under the lab's fan of cards (depth 40): the payload fan opens beside it.
    const c = scene.add.container(PICTURE.x, PICTURE.y).setDepth(35);
    const g = scene.add.graphics();
    hudFrame(g, 0, 0, PICTURE.w, PICTURE.h, PX.gold, 0.9);
    const title = pixelTitle(scene, 12, 10, 'BUILD THIS', 9, PX.text.gold);
    this.pictureStep = pixelBody(scene, PICTURE.w - 12, 4, '', 18, PX.text.muted).setOrigin(1, 0);
    this.pictureGfx = scene.add.graphics();
    c.add([g, this.pictureGfx, title, this.pictureStep]);
    const ox = (PICTURE.w - (PIC_COLS.to - PIC_COLS.from + 1) * PIC_CELL) / 2;
    const oy = 36;
    const at = (x: number, y: number) => ({ px: ox + (x - PIC_COLS.from) * PIC_CELL + PIC_CELL / 2, py: oy + (y - PIC_ROWS.from) * PIC_CELL + PIC_CELL / 2 });
    const root = at(ROOT_CELL.x, ROOT_CELL.y);
    c.add(scene.add.image(root.px, root.py, getPartTextureKey('COCKPIT', undefined, undefined, 'SATELLITE')).setDisplaySize(PIC_CELL, PIC_CELL));
    this.pictureParts = REFERENCE_ROCKET.map(part => {
      const side = part.x < ROOT_CELL.x ? 'LEFT' : 'RIGHT';
      const { px, py } = at(part.x, part.y);
      const img = scene.add
        .image(px, py, getPartTextureKey(part.type, side, undefined, part.fuel))
        .setDisplaySize(PIC_CELL, PIC_CELL)
        .setAngle(part.type === 'RCS' ? (side === 'RIGHT' ? -90 : 90) : 0);
      c.add(img);
      return { part, img };
    });
    c.add(pixelBody(scene, PICTURE.w / 2, PICTURE.h - 30, 'glowing = next', 18, PX.text.muted).setOrigin(0.5, 0));
    this.picture = c;
  }

  private refreshPicture(): void {
    if (!this.picture) return;
    const placeSteps = BUILD_STEPS.filter(b => b.kind === 'place');
    const s = BUILD_STEPS[this.step];
    const n = placeSteps.indexOf(s);
    this.pictureStep?.setText(n >= 0 ? `${n + 1}/${placeSteps.length}` : this.step >= LAUNCH_STEP - 1 ? 'DONE' : '');
  }

  private drawPicture(time: number): void {
    if (!this.picture || !this.pictureGfx) return;
    const placed = this.host.placedParts();
    const s = BUILD_STEPS[this.step];
    const current = s?.kind === 'place' ? stepOpen(s.cells!, placed) : [];
    const fast = time < this.flashUntil;
    const pulse = 0.5 + 0.5 * Math.sin(time / (fast ? 70 : 240));
    const g = this.pictureGfx;
    g.clear();
    for (const { part, img } of this.pictureParts) {
      const isDone = placed.some(q => q.gridX === part.x && q.gridY === part.y);
      const isNext = current.includes(part);
      img.setAlpha(isDone ? 1 : isNext ? 0.45 + 0.55 * pulse : 0.22);
      if (isNext) {
        g.fillStyle(fast ? 0xffffff : PX.gold, 0.35 + 0.65 * pulse);
        const x = img.x - PIC_CELL / 2;
        const y = img.y - PIC_CELL / 2;
        g.fillRect(x - 2, y - 2, PIC_CELL + 4, 2);
        g.fillRect(x - 2, y + PIC_CELL, PIC_CELL + 4, 2);
        g.fillRect(x - 2, y, 2, PIC_CELL);
        g.fillRect(x + PIC_CELL, y, 2, PIC_CELL);
      }
    }
  }

  private endPicture(): void {
    this.picture?.destroy();
    this.picture = null;
    this.pictureParts = [];
    this.pictureGfx = null;
  }

  // ---------------------------------------------------------------------------
  // Shared
  // ---------------------------------------------------------------------------

  private holes(targets: readonly LabTarget[]): Rect[] {
    return targets.map(t => this.host.guideRect(t)).filter((r): r is Rect => r !== null);
  }

  private update(time: number): void {
    if (this.mode === 'OFF') return;
    this.mc.update(time);
    this.drawPicture(time);
    // The fan of cards opens and closes under the player's pointer: keep it lit while it is up.
    const stop = this.mode === 'LAB' ? LAB_TOUR[this.step] : this.mode === 'GAME' ? BUILD_STEPS[this.step] : null;
    if (stop && this.mc.visible) {
      const targets: LabTarget[] = [...stop.targets];
      if (this.mode === 'GAME' && BUILD_STEPS[this.step].kind === 'place') targets.push('flyout');
      this.mc.setHoles(this.holes(targets));
    }
  }

  private setSkipVisible(on: boolean): void {
    this.mc.setSkipVisible(on);
  }

  private skip(): void {
    const g = loadGuide();
    saveGuide({ ...g, asked: true });
    this.stop();
  }

  private stop(): void {
    this.mode = 'OFF';
    this.mc.hide();
    this.setSkipVisible(false);
    this.host.openFlyout(null);
    this.endPicture();
  }

  /** Said by the lab when something needs a word (e.g. LAUNCH pressed too early). */
  public say(line: Line): void {
    if (this.active) this.mc.say(line);
  }
}
