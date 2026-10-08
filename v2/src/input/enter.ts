/**
 * Entrances played on a clock outside zones (`enter` and `eye` sources), driven by the visibility
 * gates in gates.ts. Per element:
 *
 * - the entrance starts when the element passes its enter gate, after its own delay;
 * - with `after`, it starts no earlier than its predecessor's actual start plus the solved lead
 *   (1.x: a follower waits for the predecessor's entrance at least once; an element that becomes
 *   visible later only waits its own delay);
 * - leaving the gate while still waiting cancels the attempt;
 * - a declared exit plays when the element leaves; entering again replays the entrance;
 * - `replay` without an exit re-arms the entrance once the element is off screen;
 * - at the first measurement an element already above the viewport shows its final frame, and in
 *   the first scene anything fully on the first screen plays regardless of the bottom margin;
 * - loops run while the element is entered and on screen.
 */
import type { CvAnimate } from '../elements/animate';
import type { Clock } from '../render/clock';
import {
  clearLayer,
  exitKeyframes,
  layerKeyframes,
  writeLayer,
  type Layer,
} from '../render/layers';
import { gateAction, gates, type GatePhase, type Gates } from './gates';

interface Track {
  a: CvAnimate;
  layers: Layer[];
  phase: GatePhase;
  /** Phase to return to when a waiting attempt is abandoned. */
  origin: 'idle' | 'exited';
  measured: boolean;
  first: boolean;
  eye: boolean;
  hasExit: boolean;
  replay: boolean;
  /** [enter, exit] margins in design px. */
  margins: [number, number];
  /** Revealed above the top at the first measurement: no exit until seen on screen once. */
  unseen: boolean;
  /** Clock time (performance.now) at which the current entrance starts; null when not started. */
  startedAt: number | null;
  predecessor: Track | null;
  /** Solved distance from the predecessor's start to this start (ms). */
  lead: number;
  delay: number;
  running: Animation[];
  token: number;
}

export interface Measurement {
  track: Track;
  top: number;
  bottom: number;
}

const NONE = (): void => undefined;

/** `margin="50"` or `margin="50 30"`: enter and exit margins in design px (1.x default 50). */
export function parseMargins(text: string | null, fallback: [number, number]): [number, number] {
  if (text === null) return fallback;
  const [a, b] = text.trim().split(/\s+/).map(Number);
  const enter = Number.isFinite(a) ? Math.max(0, a!) : fallback[0];
  return [enter, Number.isFinite(b) ? Math.max(0, b!) : enter];
}

export interface FirstScreen {
  /** The first screen waits for its assets: its entrances are not measured yet. */
  held(): boolean;
  /** The first screen's entrances start this far in (CSS-first adoption), in ms. */
  offset: number;
}

export class EnterController {
  private tracks: Track[] = [];
  private byElement = new Map<CvAnimate, Track>();

  constructor(
    private clock: Clock,
    private firstScreen: FirstScreen = { held: () => false, offset: 0 }
  ) {}

  get size(): number {
    return this.tracks.length;
  }

  add(a: CvAnimate, options: { first: boolean; margins: [number, number] }): void {
    const layers = a.layers.filter((l) => l.source === 'enter' || l.source === 'eye');
    if (!layers.length && !a.loopItems.length) return;
    const track: Track = {
      a,
      layers,
      phase: 'idle',
      origin: 'idle',
      measured: false,
      first: options.first,
      eye: layers.some((l) => l.source === 'eye'),
      hasExit: layers.some((l) => l.exitEffects.length > 0),
      replay: a.hasAttribute('replay'),
      margins: parseMargins(a.getAttribute('margin'), options.margins),
      unseen: false,
      startedAt: null,
      predecessor: null,
      lead: 0,
      delay: a.timeSpec().delay,
      running: [],
      token: 0,
    };
    for (const layer of layers) writeLayer(layer, 0, 0);
    this.tracks.push(track);
    this.byElement.set(a, track);
  }

  /** Resolve `after` / `sequence` predecessors once every element is tracked. */
  link(): void {
    for (const t of this.tracks) {
      const scene = t.a.scene;
      const solved = t.a.solved;
      if (!scene || !solved || solved.predecessor < 0) continue;
      const leader = scene.timed[solved.predecessor];
      const pred = leader ? this.byElement.get(leader) : undefined;
      if (!pred || !leader?.solved) continue;
      t.predecessor = pred;
      t.lead = solved.start - leader.solved.start;
    }
  }

  /** Read phase: rects of tracked elements whose scenes are near the viewport. */
  measure(near: (a: CvAnimate) => boolean): Measurement[] {
    const out: Measurement[] = [];
    for (const track of this.tracks) {
      if (!near(track.a)) continue;
      const r = track.a.getBoundingClientRect();
      out.push({ track, top: r.top, bottom: r.bottom });
    }
    return out;
  }

  /** Write phase: advance each measured element's gate machine. `unit` converts design px. */
  apply(measurements: readonly Measurement[], vh: number, unit: number): void {
    const now = performance.now();
    const held = this.firstScreen.held();
    for (const { track: t, top, bottom } of measurements) {
      // The first scene waits for its assets; it is measured afresh once they are ready.
      if (held && t.first) continue;
      const g = gates({
        top,
        bottom,
        vh,
        enterMargin: t.margins[0] * unit,
        exitMargin: t.margins[1] * unit,
        eye: t.eye,
      });
      if (g.onScreen) t.unseen = false;
      if (!t.measured) {
        t.measured = true;
        if (g.above && !t.eye) {
          this.reveal(t);
          t.unseen = true;
          this.loops(t, g);
          continue;
        }
        if (t.first && !g.oversized && !t.eye && top >= 0 && bottom <= vh) {
          this.begin(t, now, now - this.firstScreen.offset);
          continue;
        }
      }
      this.step(t, g, now);
      this.loops(t, g);
    }
  }

  private step(t: Track, g: Gates, now: number): void {
    const inGate = g.enter && !g.exit;
    // Waiting (for a predecessor, or inside its own delay) is revalidated every measurement.
    const pending = t.phase === 'waiting' || (t.phase === 'entering' && (t.startedAt ?? 0) > now);
    if (pending && !inGate) {
      this.cancel(t);
      t.phase = t.origin;
      for (const layer of t.layers) writeLayer(layer, 0, 0);
      return;
    }
    if (t.replay && !t.hasExit && t.phase === 'entered' && !g.onScreen) {
      // Re-arm off screen, so the next entry plays again.
      this.cancel(t);
      t.phase = 'idle';
      for (const layer of t.layers) writeLayer(layer, 0, 0);
      return;
    }
    const action = gateAction(t.phase, g.enter, g.exit, {
      hasExit: t.hasExit && !t.unseen,
      replay: true,
    });
    if (action === 'enter') this.begin(t, now);
    else if (action === 'exit') this.exit(t);
  }

  private loops(t: Track, g: Gates): void {
    if (!t.a.loopItems.length) return;
    const active = (t.phase === 'entered' || !t.layers.length) && g.onScreen;
    if (active) t.a.startLoops(this.clock);
    else t.a.stopLoops();
  }

  private cancel(t: Track): void {
    t.token++;
    for (const a of t.running) a.cancel();
    t.running = [];
    t.startedAt = null;
  }

  /** Final frame at once (already scrolled past). Followers then wait only their own delay. */
  private reveal(t: Track): void {
    this.cancel(t);
    for (const layer of t.layers) {
      clearLayer(layer);
      writeLayer(layer, 1, 0);
    }
    t.phase = 'entered';
    t.startedAt = Number.NEGATIVE_INFINITY;
    this.release(t, performance.now());
  }

  /** `origin`: when the entrance counts as started (earlier than now when adopting a CSS entrance). */
  private begin(t: Track, now: number, origin = now): void {
    const pred = t.predecessor;
    if (pred && pred.startedAt === null) {
      t.phase = 'waiting';
      return;
    }
    const startAt = pred ? Math.max(origin + t.delay, pred.startedAt! + t.lead) : origin + t.delay;
    this.cancel(t);
    t.startedAt = startAt;
    t.phase = 'entering';
    if (!t.layers.length) {
      t.phase = 'entered';
    } else {
      const base = t.a.solved;
      for (const layer of t.layers) {
        const w = layer.window;
        clearLayer(layer);
        const animation = layer.el.animate(layerKeyframes(layer), {
          duration: w ? w.end - w.start : 600,
          // Stagger children keep their offset inside the element's window.
          // Negative when adopting an entrance already under way.
          delay: startAt - now + (w && base ? w.start - base.start : 0),
          fill: 'both',
          easing: 'linear',
        });
        t.running.push(this.clock.add(animation));
      }
      const token = t.token;
      void Promise.all(t.running.map((a) => a.finished)).then(() => {
        if (t.token !== token) return;
        t.phase = 'entered';
        // Loops wait for the entrance (1.x); the next measurement starts them while on screen.
        const r = t.a.getBoundingClientRect();
        if (t.a.loopItems.length && r.bottom > 0 && r.top < innerHeight) t.a.startLoops(this.clock);
      }, NONE);
    }
    this.release(t, now);
  }

  /** Followers waiting on this element's start can be scheduled now. */
  private release(t: Track, now: number): void {
    for (const f of this.tracks)
      if (f.predecessor === t && f.phase === 'waiting') this.begin(f, now);
  }

  private exit(t: Track): void {
    this.cancel(t);
    t.a.stopLoops();
    t.phase = 'exiting';
    t.origin = 'exited';
    const base = t.a.solved;
    for (const layer of t.layers) {
      const w = layer.window;
      const duration = w ? w.exitEnd - w.exitStart : (base?.exitDuration ?? 0);
      if (duration <= 0) {
        writeLayer(layer, 1, 1);
        continue;
      }
      clearLayer(layer);
      const animation = layer.el.animate(exitKeyframes(layer), {
        duration,
        delay: w && base ? w.exitStart - base.exitStart : 0,
        fill: 'both',
        easing: 'linear',
      });
      t.running.push(this.clock.add(animation));
    }
    const token = t.token;
    void Promise.all(t.running.map((a) => a.finished)).then(() => {
      if (t.token === token) t.phase = 'exited';
    }, NONE);
    if (!t.running.length) t.phase = 'exited';
  }

  /** Stop everything (stage teardown). */
  destroy(): void {
    for (const t of this.tracks) {
      this.cancel(t);
      t.a.stopLoops();
    }
    this.tracks = [];
    this.byElement.clear();
  }
}
