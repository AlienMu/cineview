// The two framer-motion MotionValue methods v1's canvas effects use (get, on('change')), fed by a v2
// element's timeline (cv-animate .timeline.subscribe), so the v1 drawing code runs unchanged.
export type AnimatePhase = 'idle' | 'entering' | 'entered' | 'exiting' | 'exited';

export interface MotionValue<T> {
  get(): T;
  on(event: 'change', fn: (value: T) => void): () => void;
}

class Value<T> implements MotionValue<T> {
  private listeners = new Set<(value: T) => void>();
  constructor(private value: T) {}
  get(): T {
    return this.value;
  }
  /** Change the value without telling anyone yet; returns whether it changed. */
  stage(next: T): boolean {
    if (Object.is(next, this.value)) return false;
    this.value = next;
    return true;
  }
  notify(): void {
    for (const fn of this.listeners) fn(this.value);
  }
  set(next: T): void {
    if (this.stage(next)) this.notify();
  }
  on(_event: 'change', fn: (value: T) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

interface Frame {
  progress: number;
  phase: string;
}
interface Timed {
  timeline: { frame: Frame; subscribe(fn: (frame: Frame) => void): () => void };
}

const PHASES: ReadonlySet<string> = new Set(['idle', 'entering', 'entered', 'exiting', 'exited']);

/** progress and phase of a cv-animate, as v1 read them from useAnimateTimeline(). */
export function laneValues(el: Element): {
  progress: MotionValue<number>;
  phase: MotionValue<AnimatePhase>;
  stop: () => void;
} {
  const host = el as unknown as Timed;
  const first = host.timeline.frame;
  const progress = new Value<number>(first.progress);
  const phase = new Value<AnimatePhase>(
    PHASES.has(first.phase) ? (first.phase as AnimatePhase) : 'idle'
  );
  // v1 reported an exit as renderElapsed / exitDuration, renderElapsed = page travel x transition;
  // v2 reports the page travel itself. Convert, so v1's exit drawing keeps its pace.
  const stageEl = el.closest('cv-stage');
  const transition = Number(stageEl?.getAttribute('transition-duration') ?? 800) || 800;
  const exitMs = Number(el.getAttribute('exit-duration') ?? 0);
  // Both values change before anyone hears of either: a phase listener that draws must see the
  // new progress (the first frame of a drag is 'exiting' at 0, not 'exiting' at the entered 1,
  // which drew the exit's end for one painted frame).
  const stop = host.timeline.subscribe((frame) => {
    const p =
      frame.phase === 'exiting' && exitMs > 0
        ? Math.min(1, (frame.progress * transition) / exitMs)
        : frame.progress;
    const movedP = progress.stage(p);
    const movedPhase = PHASES.has(frame.phase) && phase.stage(frame.phase as AnimatePhase);
    if (movedPhase) phase.notify();
    if (movedP) progress.notify();
  });
  return { progress, phase, stop };
}

// A gate on the canvases' frame loops: while the embedding page has frozen the drag page (its
// scene is off screen, cineview-freeze), their requestAnimationFrame callbacks wait instead of
// drawing, and run again on thaw. The modules import these under the global names.
let frozen = false;
let nextId = 1;
const waiting = new Map<number, FrameRequestCallback>();
const live = new Map<number, number>();

export function raf(cb: FrameRequestCallback): number {
  const id = nextId++;
  callbacks.set(id, cb);
  if (frozen) waiting.set(id, cb);
  else
    live.set(
      id,
      window.requestAnimationFrame((t) => {
        live.delete(id);
        callbacks.delete(id);
        cb(t);
      })
    );
  return id;
}

export function cancel(id: number): void {
  waiting.delete(id);
  callbacks.delete(id);
  const real = live.get(id);
  if (real !== undefined) window.cancelAnimationFrame(real);
  live.delete(id);
}

const callbacks = new Map<number, FrameRequestCallback>();

export function freezeFrames(): void {
  frozen = true;
  for (const [id, real] of live) {
    window.cancelAnimationFrame(real);
    live.delete(id);
    const cb = callbacks.get(id);
    if (cb) waiting.set(id, cb);
  }
}

export function thawFrames(): void {
  if (!frozen) return;
  frozen = false;
  const queued = [...waiting];
  waiting.clear();
  for (const [, cb] of queued) raf(cb);
}
