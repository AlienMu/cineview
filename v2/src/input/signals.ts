/**
 * Signal sources `velocity` and `direction` (plan v3 §3.5; lexicon #7 and #20): how fast and which
 * way the reader moves, from the scroll offset (scroll input) or the page position (drag input).
 *
 * Main thread on every path, the native one included (F14): the input feeds a position whenever
 * the reader moves and steps and writes the signal layers in its write phase. Once the reader
 * stops, speed falls to zero over a few frames, the layers get their resting frame, and no more
 * frames are requested.
 */
import type { Source } from '../core/fx';
import { writeLayer, type Layer } from '../render/layers';

/** Speed (px/ms) of a full velocity effect: 80 px per 60 Hz frame (lexicon #7). */
export const FULL_SPEED = 80 / (1000 / 60);
/**
 * Time constants (ms) of the speed filter: rising about six times faster than it falls, so it reads
 * as inertia rather than jitter (lexicon #7: 0.34 and 0.055 per 60 Hz frame).
 */
const ATTACK_MS = 40;
const RELEASE_MS = 294;
/** Below this share of full speed, with nothing measured, the reader is still (lexicon #7). */
const STILL = 0.0008;
/** Without a new reading for this long (ms), the measured speed is zero. */
const IDLE_MS = 60;
/** Faster than this (px/ms) is a jump (hash entry, goTo without animation), not movement. */
const JUMP = 40;
/** Movements shorter than this (px) are ignored for the heading: trackpad jitter (lexicon #20). */
export const DEAD_ZONE = 6;
/** Within this distance of the start (px) the reader counts as heading back (lexicon #20). */
export const TOP = 40;
/** Time a direction effect takes to turn over (ms). */
const TURN_MS = 240;
/** Longest step between frames that smoothing takes at once (a background tab, a long task). */
const MAX_STEP = 100;

export type Heading = 1 | -1 | 0;

export const isSignal = (source: Source): boolean =>
  source === 'velocity' || source === 'direction';

export class Signals {
  /** Smoothed speed in px/ms, positive forward. */
  velocity = 0;
  /** 1 forward, -1 backward (or within TOP of the start), 0 before the first movement. */
  heading: Heading = 0;
  /** Direction progress: 1 forward, 0 backward (and before any movement); turns over in TURN_MS. */
  turn = 0;
  private measured = 0;
  private lastY = Number.NaN;
  private lastSample = Number.NEGATIVE_INFINITY;
  private lastStep = Number.NaN;
  /** Position at the last movement that counted for the heading. */
  private counted = Number.NaN;

  /** A position reading (px from the start) at time `now` (ms). True when the heading turned. */
  sample(y: number, now: number): boolean {
    if (Number.isFinite(this.lastY)) {
      const dt = now - this.lastSample;
      const v = dt > 0 ? (y - this.lastY) / dt : 0;
      this.measured = Math.abs(v) > JUMP ? 0 : v;
    }
    this.lastY = y;
    this.lastSample = now;
    if (!Number.isFinite(this.counted)) this.counted = y;
    const d = y - this.counted;
    if (Math.abs(d) < DEAD_ZONE) return false;
    this.counted = y;
    const heading: Heading = d > 0 && y > TOP ? 1 : -1;
    if (heading === this.heading) return false;
    this.heading = heading;
    return true;
  }

  /** Advance smoothing to `now`. */
  step(now: number): void {
    const dt = Number.isFinite(this.lastStep) ? Math.min(MAX_STEP, now - this.lastStep) : 16;
    this.lastStep = now;
    if (dt <= 0) return;
    const target = now - this.lastSample > IDLE_MS ? 0 : this.measured;
    const rising = Math.abs(target) > Math.abs(this.velocity);
    this.velocity +=
      (target - this.velocity) * (1 - Math.exp(-dt / (rising ? ATTACK_MS : RELEASE_MS)));
    if (target === 0 && Math.abs(this.velocity) < STILL * FULL_SPEED) this.velocity = 0;
    const goal = this.heading === 1 ? 1 : 0;
    if (this.turn < goal) this.turn = Math.min(goal, this.turn + dt / TURN_MS);
    else if (this.turn > goal) this.turn = Math.max(goal, this.turn - dt / TURN_MS);
  }

  /** Nothing left to settle: no more frames needed until the next reading. */
  get resting(): boolean {
    return this.velocity === 0 && this.turn === (this.heading === 1 ? 1 : 0);
  }

  /** Velocity effect progress, signed: -1 (full speed backward) to 1. */
  get speed(): number {
    return Math.max(-1, Math.min(1, this.velocity / FULL_SPEED));
  }
}

/**
 * Write a signal layer. Velocity effects run on the speed and mirror their offsets, rotations and
 * skews while the reader moves backward; direction effects run on the turn.
 */
export function writeSignal(layer: Layer, signals: Signals): void {
  if (layer.source === 'direction') {
    writeLayer(layer, signals.turn, 0);
    return;
  }
  const s = signals.speed;
  writeLayer(layer, Math.abs(s), 0, s < 0);
}
