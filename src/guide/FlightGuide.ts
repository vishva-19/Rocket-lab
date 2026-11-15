import Phaser from 'phaser';
import type { PhaseEvent } from '../game/phases';
import type { TimeOfDay } from '../game/timeOfDay';
import type { ChallengeEvent, ChallengeId } from '../modules';
import { Rect } from './geometry';
import { loadGuide, saveGuide } from './guideProgress';
import { GuideOutcome } from './LabGuide';
import { MissionControl } from './MissionControl';
import { brakeNow, MOON_FUEL } from './moonAssist';
import { doneLine, FlightTarget, Line, MomentId, MOMENTS, skyPeek } from './script';

/** What the guide needs from the flight (FlightScene implements it). */
export interface FlightHost {
  readonly scene: Phaser.Scene;
  rectOf(target: FlightTarget): Rect | null;
  /** Freeze the flight (true) or let it run (false). */
  hold(on: boolean): void;
  /** A save point to come back to after a crash. */
  checkpoint(): unknown;
  setThrottle(level: number): void;
  /** At the Moon: keep the nose pointing backwards and slow time down (true), or hand control back (false). */
  assistMoon(on: boolean): void;
  /** At the Moon: make sure the boosters hold at least this much fuel (kg). */
  topUpFuel(kg: number): void;
  /** Back to a save point (null: start the flight over). */
  rewind(cp: unknown | null): void;
  /** Leave the guided flight for the lab, telling the lab how it ended. */
  leave(outcome: GuideOutcome): void;
}

/** The flight as the guide sees it each frame. */
export interface FlightView {
  onPad: boolean;
  counting: boolean;
  launched: boolean;
  altitude: number;
  airDensity: number;
  canSeparate: boolean;
  separated: boolean;
  rcsReady: boolean;
  inMoonOrbit: boolean;
  moonAltitude: number;
  /** The lowest point of the path around the Moon (m above it), inside its pull. */
  moonPeriapsis: number | null;
  /** LOW and HIGH both in the green band. */
  stableOrbit: boolean;
  /** The nose points against the motion, ready to brake. */
  noseBackwards: boolean;
}

/** Moments a crash never rewinds to: the jam rewinds to the separation before it, the Moon steps to the arrival. */
const NOT_SAVE_POINTS: readonly MomentId[] = ['PAD', 'LAUNCH', 'JAM', 'MOON_BURN', 'MOON_GREEN', 'DONE', 'REWIND'];


const CHALLENGE_MOMENTS: Partial<Record<ChallengeId, MomentId>> = {
  MAX_Q: 'MAX_Q',
  WIND_SHEAR: 'WIND_SHEAR',
  STAGING_FAULT: 'JAM',
  ROCK_BELT: 'ROCKS',
  RADIATION_BELT: 'RADIATION',
  TRANS_LUNAR_BURN: 'TLI'
};

/**
 * Part 2 of the game guide: the guided flight. Each new moment of the climb (liftoff, every
 * challenge, staging, the Moon, the drop) pauses the game while Mission Control explains it,
 * then carries on when the player presses OK or the key it asks for. A crash costs nothing:
 * the flight rewinds to the last moment.
 */
export class FlightGuide {
  private readonly mc: MissionControl;
  private readonly seen = new Set<MomentId>();
  private readonly queue: MomentId[] = [];
  private current: MomentId | null = null;
  private lastCheckpoint: { id: MomentId; cp: unknown } | null = null;
  /** Between the Moon's OK and the braking call: the autopilot turns the nose, the engine stays off. */
  private moonWaiting = false;
  private failing = false;
  private finished = false;
  private readonly onUpdate = (time: number) => this.mc.update(time);

  constructor(private readonly host: FlightHost) {
    const scene = host.scene;
    this.mc = new MissionControl(scene, { onSkip: () => this.skip(), skipAt: { right: 1260, y: 64 } });
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate));
  }

  // ---------------------------------------------------------------------------
  // What the flight asks
  // ---------------------------------------------------------------------------

  /** The flight is frozen while Mission Control talks (except on the pad and while it waits for LAUNCH). */
  public get held(): boolean {
    return this.current !== null && MOMENTS[this.current].kind !== 'go';
  }

  public blocks(x: number, y: number): boolean {
    return this.mc.blocks(x, y);
  }

  public get capturesKeys(): boolean {
    return this.mc.capturesKeys;
  }

  /** While a moment waits for one key, every other flight key is ignored. */
  public allowsKey(key: string): boolean {
    if (!this.current) return true;
    const m = MOMENTS[this.current];
    if (m.kind === 'key') return key.toUpperCase() === m.key;
    return m.kind === 'go';
  }

  // ---------------------------------------------------------------------------
  // What the flight tells it
  // ---------------------------------------------------------------------------

  public update(v: FlightView): void {
    if (this.finished || this.failing) return;
    if (v.onPad) this.trigger('PAD');
    if (this.current === 'LAUNCH' && v.counting) this.close();
    if (v.launched && v.altitude > 40) this.trigger('LIFTOFF');
    if (v.launched && v.airDensity <= 0 && v.canSeparate && !v.separated) this.trigger('SPACE');
    if (v.rcsReady) this.trigger('RCS');
    if (v.inMoonOrbit) this.trigger('MOON');
    if (this.moonWaiting) {
      this.host.setThrottle(0);
      if (brakeNow(v.noseBackwards, v.moonAltitude, v.moonPeriapsis)) {
        this.moonWaiting = false;
        this.trigger('MOON_BURN');
      }
    }
    if (this.seen.has('MOON_BURN') && v.stableOrbit && !this.seen.has('MOON_GREEN')) {
      // Green: stop the engine at once, so holding W a moment too long can't spoil the orbit.
      this.host.setThrottle(0);
      this.host.assistMoon(false);
      this.trigger('MOON_GREEN');
    }
    this.next();
  }

  public onChallengeEvents(events: readonly ChallengeEvent[]): void {
    for (const e of events) {
      const id = e.kind === 'START' ? CHALLENGE_MOMENTS[e.id] : undefined;
      if (id) this.trigger(id);
    }
    this.next();
  }

  public onPhaseEvents(events: readonly PhaseEvent[]): void {
    for (const e of events) if (e.kind === 'PHASE_START' && e.phase === 'DEPLOY') this.trigger('DEPLOY');
    this.next();
  }

  /** The player asked for a key the current moment waits for. */
  public onKey(key: string): void {
    const m = this.current ? MOMENTS[this.current] : null;
    if (m?.kind === 'key' && key.toUpperCase() === m.key) this.close();
  }

  /** A later launch time was clicked on the pad: say what it is like (the guided flight still goes at dawn). */
  public onSkyPick(time: TimeOfDay): void {
    if (this.current === 'PAD') this.mc.say(skyPeek(time));
  }

  /** The flight failed: rewind to the last moment once the player is ready. */
  public onFailed(): void {
    if (this.failing || this.finished) return;
    this.failing = true;
    this.queue.length = 0;
    this.current = 'REWIND';
    this.host.hold(true);
    this.mc.show(
      { line: MOMENTS.REWIND.line, holes: [], mode: 'ok' },
      {
        onOk: () => {
          this.current = null;
          this.failing = false;
          this.moonWaiting = false;
          const save = this.lastCheckpoint;
          this.host.rewind(save?.cp ?? null);
          if (!save) return;
          // Back at the save point: the moments after it come again, and Mission Control repeats what to do here
          // (the flight waits for OK, so nobody is dropped back into the action unprepared).
          let after = false;
          for (const id of [...this.seen]) {
            if (after) this.seen.delete(id);
            if (id === save.id) after = true;
          }
          this.host.setThrottle(save.id === 'MOON' || save.id === 'DEPLOY' ? 0 : 1);
          this.queue.push(save.id);
          this.next();
        }
      }
    );
  }

  /** The mission is done and the result card is up: the last word, then back to the lab. */
  public onResult(bonus: number): void {
    if (this.finished) return;
    this.finished = true;
    this.queue.length = 0;
    this.current = 'DONE';
    this.mc.setSkipVisible(false);
    this.show('DONE', doneLine(bonus));
  }

  // ---------------------------------------------------------------------------
  // Moments
  // ---------------------------------------------------------------------------

  private trigger(id: MomentId): void {
    if (this.seen.has(id)) return;
    this.seen.add(id);
    this.queue.push(id);
  }

  private next(): void {
    if (this.current || this.queue.length === 0) return;
    const id = this.queue.shift()!;
    this.current = id;
    const m = MOMENTS[id];
    if (m.kind !== 'go') this.host.hold(true);
    if (id === 'MOON') {
      // Arriving at the Moon: engine off and enough fuel to brake, before the save point is taken.
      this.host.setThrottle(0);
      this.host.topUpFuel(MOON_FUEL);
    }
    // The moments after liftoff are save points: a crash comes back here.
    if (!NOT_SAVE_POINTS.includes(id)) this.lastCheckpoint = { id, cp: this.host.checkpoint() };
    this.show(id, m.line);
  }

  private show(id: MomentId, line: Line): void {
    const m = MOMENTS[id];
    const holes = m.targets.map(t => this.host.rectOf(t)).filter((r): r is Rect => r !== null);
    this.mc.show(
      { line, holes, mode: m.kind === 'ok' ? 'ok' : 'wait' },
      {
        onOk: () => {
          if (id === 'DONE') {
            this.host.leave('DONE');
            return;
          }
          this.current = null;
          this.host.hold(false);
          if (id === 'PAD') this.trigger('LAUNCH');
          if (id === 'MOON') {
            this.host.assistMoon(true);
            this.moonWaiting = true;
          }
          this.next();
        }
      }
    );
  }

  /** A "go" or "key" moment is over. */
  private close(): void {
    this.mc.hide();
    this.current = null;
    this.host.hold(false);
    this.next();
  }

  private skip(): void {
    const g = loadGuide();
    saveGuide({ ...g, asked: true });
    this.mc.hide();
    this.host.hold(false);
    this.host.leave('SKIPPED');
  }
}
