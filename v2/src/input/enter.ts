/**
 * Clock-played entrances: enter/eye roots use visibility gates; on="clock" roots use current-Scene
 * entry. Followers share the root's trigger and solved offsets, including offscreen followers.
 * Pending root cancellation and replay reset the dependency run together. A declared exit starts
 * at the displayed frame. Clock time, native playback and Stage pause use one document timeline.
 * Scene-entry clocks have their own solved windows and never contribute scroll-zone distance.
 */
import type { ClockEvent, CvAnimate } from '../elements/animate';
import type { CvScene } from '../elements/scene';
import type { Solved } from '../core/time';
import type { Clock } from '../render/clock';
import {
  clearLayer,
  progressIn,
  exitKeyframes,
  layerKeyframes,
  samplesFor,
  writeLayer,
  type Layer,
} from '../render/layers';
import { gateAction, gates, type GatePhase, type Gates } from './gates';

interface Track {
  a: CvAnimate;
  solved: Solved | null;
  primary: boolean;
  autonomous: boolean;
  onScreen: boolean;
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
  retained: { start: number; unseen: boolean } | undefined;
}

export interface Measurement {
  track: Track;
  top: number;
  bottom: number;
}

const NONE = (): void => undefined;

/** Actual entrance origins retained across structural rebuilds, including unfinished followers. */
const retainedRuns = new WeakMap<CvAnimate, { start: number; unseen: boolean }>();

/** A rejected declaration must not restore its previous visibility run after being corrected. */
export function forgetRetainedRun(a: CvAnimate): void {
  retainedRuns.delete(a);
}

/** The gate machine's phase is also the element's `data-cv-phase`. */
function setPhase(t: Track, phase: GatePhase): void {
  t.phase = phase;
  if (t.autonomous) t.a.clockComplete = phase === 'entered';
  if (t.primary) t.a.showPhase(phase);
}

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
  private activeScene: CvScene | null = null;
  private sceneStartedAt = 0;

  /** Keep the current autonomous run when structure rebuilds without a Scene change. */
  snapshot(): { scene: CvScene; start: number } | null {
    return this.activeScene ? { scene: this.activeScene, start: this.sceneStartedAt } : null;
  }

  constructor(
    private clock: Clock,
    private firstScreen: FirstScreen = { held: () => false, offset: 0 },
    private source: 'visibility' | 'clock' = 'visibility'
  ) {}

  get size(): number {
    return this.tracks.length;
  }

  add(a: CvAnimate, options: { first: boolean; margins: [number, number] }): void {
    const autonomous = this.source === 'clock';
    if (autonomous ? !a.clocked : a.clocked && !a.timed) return;
    const layers = a.layers.filter((l) =>
      autonomous
        ? l.source === 'clock' && l.kind !== 'loop'
        : l.source === 'enter' || l.source === 'eye'
    );
    // Elements on the timeline without effects still have one (el.timeline, <cv-video>, anchors).
    if (!layers.length && !a.loopItems.length && !a.timed && !autonomous) return;
    const retained = autonomous ? undefined : retainedRuns.get(a);
    retainedRuns.delete(a);
    const track: Track = {
      a,
      solved: autonomous ? a.clockSolved : a.solved,
      primary: !autonomous || !a.timed,
      autonomous,
      onScreen: false,
      layers,
      phase: 'idle',
      origin: 'idle',
      measured: !!retained,
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
      retained,
    };
    for (const layer of layers) writeLayer(layer, 0, 0);
    this.tracks.push(track);
    this.byElement.set(a, track);
  }

  /** Resolve `after` / `sequence` predecessors once every element is tracked. */
  link(): void {
    for (const t of this.tracks) {
      const scene = t.a.scene;
      const solved = t.solved;
      if (!scene || !solved || solved.predecessor < 0) continue;
      const leader = (t.autonomous ? scene.clocks : scene.timed)[solved.predecessor];
      const pred = leader ? this.byElement.get(leader) : undefined;
      if (!pred?.solved) continue;
      t.predecessor = pred;
      t.lead = solved.start - pred.solved.start;
    }
    const now = this.clock.now();
    for (const t of this.tracks) {
      // Restoring the highest retained node also enrolls its descendants from the same origin.
      if (t.retained && !t.predecessor?.retained) this.begin(t, now, now, t.retained.start);
    }
    for (const t of this.tracks) {
      if (t.retained) t.unseen = t.retained.unseen;
      t.retained = undefined;
    }
  }

  /** Scene-entry clocks are independent of element visibility and real scroll distance. */
  activateScene(scene: CvScene | null, origin?: number): void {
    if (this.source !== 'clock' || scene === this.activeScene) return;
    if (scene && this.firstScreen.held() && this.tracks.some((t) => t.first && t.a.scene === scene))
      return;
    const previous = this.activeScene;
    this.activeScene = scene;
    const now = this.clock.now();
    this.sceneStartedAt = origin ?? now;
    for (const t of this.tracks) {
      if (t.a.scene !== previous || t.startedAt === null) continue;
      if (t.hasExit) this.exit(t);
      else {
        const elapsed = now - t.startedAt;
        for (const layer of t.layers) {
          const w = layer.window,
            base = t.solved;
          writeLayer(
            layer,
            w && base ? progressIn(elapsed, w.start - base.start, w.end - base.start) : 1,
            0
          );
        }
        this.cancel(t);
        t.a.stopLoops();
        setPhase(t, 'idle');
      }
    }
    for (const t of this.tracks)
      if (t.a.scene === scene && !t.predecessor) this.begin(t, now, this.sceneStartedAt);
  }

  private event(t: Track, event: ClockEvent): void {
    if (t.primary) t.a.clockEvent({ ...event, source: this.source });
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
    const now = this.clock.now();
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
      t.onScreen = g.onScreen;
      if (g.onScreen && (!t.predecessor || (g.enter && !g.exit))) t.unseen = false;
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
    // A dependency shares its root's run. Its own visibility cannot postpone or cancel it.
    if (t.predecessor) {
      if (
        t.startedAt !== null &&
        !t.unseen &&
        t.hasExit &&
        (t.phase === 'entered' || (t.phase === 'entering' && (t.startedAt ?? now) <= now)) &&
        g.exit &&
        !g.enter
      )
        this.exit(t);
      // Back in view after leaving: resume this run where it stands (exit keeps its start). A run
      // that never started keeps waiting for its root.
      else if (
        t.startedAt !== null &&
        gateAction(t.phase, g.enter, g.exit, { hasExit: t.hasExit, replay: true }) === 'enter'
      )
        this.begin(t, now, now, t.startedAt);
      return;
    }
    // Waiting (for a predecessor, or inside its own delay) is revalidated every measurement.
    const pending = t.phase === 'waiting' || (t.phase === 'entering' && (t.startedAt ?? 0) > now);
    if (pending && !inGate) {
      this.cancel(t);
      this.resetFollowers(t);
      setPhase(t, t.origin);
      for (const layer of t.layers) writeLayer(layer, 0, 0);
      return;
    }
    if (
      t.replay &&
      !t.hasExit &&
      (t.phase === 'entered' || t.phase === 'entering') &&
      !g.onScreen
    ) {
      // Re-arm the root; followers keep this run until a new root entry replaces it.
      this.cancel(t);
      setPhase(t, 'idle');
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
    if (active && (!t.a.clocked || t.a.clockComplete)) t.a.startLoops(this.clock);
    else t.a.stopLoops();
  }

  private cancel(t: Track): void {
    t.token++;
    if (t.running.length || t.startedAt !== null) this.event(t, { type: 'reset' });
    for (const a of t.running) a.cancel();
    t.running = [];
    t.startedAt = null;
  }

  /** Final frame at once for an already passed dependency run. */
  private reveal(t: Track): void {
    this.cancel(t);
    for (const layer of t.layers) {
      clearLayer(layer);
      writeLayer(layer, 1, 0);
    }
    setPhase(t, 'entered');
    t.unseen = true;
    t.startedAt = Number.NEGATIVE_INFINITY;
    this.event(t, { type: 'reveal' });
    this.release(t, this.clock.now());
  }

  /** `origin`: when the entrance counts as started (earlier than now when adopting a CSS entrance). */
  private begin(t: Track, now: number, origin = now, retainedStart?: number): void {
    const pred = t.predecessor;
    if (retainedStart === undefined && pred && pred.startedAt === null) {
      setPhase(t, 'waiting');
      return;
    }
    if (
      retainedStart === Number.NEGATIVE_INFINITY ||
      (retainedStart === undefined && pred?.startedAt === Number.NEGATIVE_INFINITY)
    ) {
      this.reveal(t);
      return;
    }
    const startAt =
      retainedStart ??
      (pred
        ? pred.startedAt! + t.lead
        : origin + (t.autonomous ? (t.solved?.start ?? t.delay) : t.delay));
    this.cancel(t);
    this.resetFollowers(t);
    t.measured = true;
    t.unseen = t.predecessor ? true : !t.onScreen;
    t.startedAt = startAt;
    setPhase(t, 'entering');
    const base = t.solved;
    const duration = base ? base.end - base.start : 600;
    this.event(t, { type: 'enter', start: startAt, duration });
    if (now >= startAt + duration) {
      for (const layer of t.layers) {
        clearLayer(layer);
        writeLayer(layer, 1, 0);
      }
      this.complete(t);
      this.release(t, now);
      return;
    }
    if (!t.layers.length) {
      // Nothing to draw: an empty animation keeps the element's time (and the stage's pause).
      t.running.push(this.clock.add(t.a.animate(null, { duration, delay: startAt - now })));
    } else {
      for (const layer of t.layers) {
        const w = layer.window;
        const duration = w ? w.end - w.start : 600;
        clearLayer(layer);
        const animation = layer.el.animate(layerKeyframes(layer, samplesFor(layer, duration)), {
          duration,
          // Stagger children keep their offset inside the element's window.
          // Negative when adopting an entrance already under way.
          delay: startAt - now + (w && base ? w.start - base.start : 0),
          fill: 'both',
          easing: 'linear',
        });
        t.running.push(this.clock.add(animation));
      }
    }
    const token = t.token;
    void Promise.all(t.running.map((a) => a.finished)).then(() => {
      if (t.token !== token) return;
      this.complete(t);
    }, NONE);
    this.release(t, now);
  }

  private complete(t: Track): void {
    setPhase(t, 'entered');
    if (!t.a.loopItems.length) return;
    if (t.autonomous) {
      if (t.a.scene === this.activeScene && (!t.a.timed || t.a.timeline.phase === 'entered'))
        t.a.startLoops(this.clock);
    } else {
      const r = t.a.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight && (!t.a.clocked || t.a.clockComplete))
        t.a.startLoops(this.clock);
    }
  }

  /** Enroll every follower in this dependency run, regardless of its visibility. */
  private release(t: Track, now: number): void {
    for (const f of this.tracks) if (f.predecessor === t) this.begin(f, now);
  }

  private resetFollowers(t: Track): void {
    for (const f of this.tracks)
      if (f.predecessor === t) {
        this.cancel(f);
        setPhase(f, f.origin);
        for (const layer of f.layers) writeLayer(layer, 0, 0);
        this.resetFollowers(f);
      }
  }

  private exit(t: Track): void {
    const base = t.solved;
    const startedAt = t.startedAt;
    const elapsed = startedAt === null ? 0 : this.clock.now() - startedAt;
    // Snapshot before cancelling native output. Sampling itself only touches the value model.
    const frames = t.layers.map((layer) => {
      const w = layer.window;
      const duration = w ? w.exitEnd - w.exitStart : (base?.exitDuration ?? 0);
      const p =
        t.phase === 'entered'
          ? 1
          : w && base
            ? progressIn(elapsed, w.start - base.start, w.end - base.start)
            : 1;
      return exitKeyframes(layer, samplesFor(layer, duration), p);
    });
    this.cancel(t);
    // Leaving ends this output, not the run: a follower coming back resumes from the same start.
    t.startedAt = startedAt;
    t.a.stopLoops();
    setPhase(t, 'exiting');
    const exitDuration = base?.exitDuration ?? 0;
    this.event(t, { type: 'exit', start: this.clock.now(), duration: exitDuration });
    t.origin = 'exited';
    if (!t.layers.length && exitDuration > 0) {
      t.running.push(this.clock.add(t.a.animate(null, { duration: exitDuration })));
    }
    for (const [index, layer] of t.layers.entries()) {
      const w = layer.window;
      const duration = w ? w.exitEnd - w.exitStart : (base?.exitDuration ?? 0);
      if (duration <= 0) {
        writeLayer(layer, 1, 1);
        continue;
      }
      clearLayer(layer);
      const animation = layer.el.animate(frames[index]!, {
        duration,
        delay: w && base ? w.exitStart - base.exitStart : 0,
        fill: 'both',
        easing: 'linear',
      });
      t.running.push(this.clock.add(animation));
    }
    const token = t.token;
    void Promise.all(t.running.map((a) => a.finished)).then(() => {
      if (t.token === token) setPhase(t, 'exited');
    }, NONE);
    if (!t.running.length) setPhase(t, 'exited');
  }

  /** Stop everything (stage teardown). */
  destroy(): void {
    for (const t of this.tracks) {
      if (
        !t.autonomous &&
        t.startedAt !== null &&
        (t.phase === 'entered' || t.phase === 'entering')
      )
        retainedRuns.set(t.a, { start: t.startedAt, unseen: t.unseen });
      this.cancel(t);
      for (const layer of t.layers) clearLayer(layer);
      t.a.stopLoops();
    }
    this.activeScene = null;
    this.tracks = [];
    this.byElement.clear();
  }
}
