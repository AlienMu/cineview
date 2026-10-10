/**
 * <cv-animate>: one element's effects. Attributes are read into layer plans; the shadow layers
 * themselves are built by render/layers.ts and written by whichever input drives the stage.
 */
import { parseEase } from '../core/ease';
import type { Report } from '../core/errors';
import { makeEffect, parseExit, parseFromTo, parseFx, type Effect, type Source } from '../core/fx';
import { parseLoop, type LoopItem } from '../core/loop';
import {
  parseAfter,
  parseAt,
  parseMs,
  parseStagger,
  type Solved,
  type TimeSpec,
} from '../core/time';
import { warnScopedPositioning, warnUnsafeStagger } from '../dev/craft';
import { warn } from '../dev/warn';
import {
  IDLE_FRAME,
  type CvTimeline,
  type TimelineFrame,
  type TimelinePhase,
  type TimelineSource,
} from '../core/timeline';
import { ElementBase } from '../platform';
import type { Clock } from '../render/clock';
import {
  buildLayers,
  buildTargetLayers,
  clearLayer,
  kindOf,
  planLayers,
  type Layer,
  type LayerPlan,
  type Subject,
} from '../render/layers';
import { CvScene } from './scene';
import type { CvAnimateElement } from '../types';

/** Sources whose effects sit on the scene timeline (plan v3 §3.5). */
const ON_TIMELINE: ReadonlySet<Source> = new Set<Source>(['scene', 'enter', 'eye']);
const SIGNALS: ReadonlySet<Source> = new Set<Source>(['velocity', 'direction']);
const SOURCES: ReadonlySet<string> = new Set<Source>([
  'scene',
  'enter',
  'view',
  'page',
  'clock',
  'eye',
  'velocity',
  'direction',
]);
const TIMING_ATTRIBUTES = ['duration', 'delay', 'after', 'at', 'stagger'];
/** Sources that play on a clock rather than follow the reader's input. */
const CLOCK_PLAYED: ReadonlySet<Source> = new Set<Source>(['enter', 'eye', 'clock']);
/** Reduced motion: a clock-played entrance is at most a short fade (plan v3 §13). */
const REDUCED_DURATION = 200;

/** Keep only opacity; null when nothing is left (the element shows its final state at once). */
function opacityOnly(e: Effect): Effect | null {
  const opacity = e.tracks.opacity;
  if (!opacity) return null;
  return { ...makeEffect({ tracks: { opacity }, ease: e.ease, own: e.own }), range: e.range };
}

/** An entrance or exit played on the clock (enter / eye sources), for elements that follow it. */
export type ClockEvent =
  { type: 'enter' | 'exit'; start: number; duration: number } | { type: 'reveal' | 'reset' };

export interface PlanContext {
  /** Time source for time presets here: scene time in zones and drag scenes, enter elsewhere. */
  timeSource: Source;
  reducedMotion: boolean;
}

export interface AnimatePlan {
  layers: LayerPlan[];
  /** Time effects applied to each stagger target instead of the host. */
  staggered: LayerPlan | null;
  /** Takes part in the scene timeline (counts toward the total, can be an `after` target). */
  timed: boolean;
  /** Longest preset default among time effects; used when `duration` is not set. */
  duration: number | null;
  /** Upper bound on the entrance duration (reduced motion on a clock-played entrance). */
  maxDuration: number;
  hasExit: boolean;
  loops: LoopItem[];
}

/** `on`: a source name, `view(self)` or `view(#id)` (an element of the same scene). */
function parseOn(text: string | null, report: Report): { source: Source; subject: Subject } | null {
  if (text === null) return null;
  const t = text.trim();
  const view = /^view\(\s*(self|#[\w-]+)\s*\)$/.exec(t);
  if (view) return { source: 'view', subject: view[1] as Subject };
  if (SOURCES.has(t)) return { source: t as Source, subject: 'scene' };
  report(`Unknown progress source on="${t}"`);
  return null;
}

export class CvAnimate extends ElementBase implements CvAnimateElement {
  static readonly observedAttributes = [
    'fx',
    'from',
    'to',
    'exit',
    'exit-duration',
    'on',
    'ease',
    'name',
    'duration',
    'delay',
    'after',
    'at',
    'stagger',
    'target',
    'loop',
    'loop-duration',
    'margin',
    'replay',
  ];

  scene: CvScene | null = null;
  /** Drag: the element's scene is the current one (undefined under scroll input). */
  dragActive: boolean | undefined = undefined;
  /** The latest published frame (drag, zones; clock runs compute theirs on read). */
  private lastFrame: TimelineFrame = IDLE_FRAME;
  private listeners = new Set<(frame: TimelineFrame) => void>();
  private view: CvTimeline | null = null;
  private shownPhase: string | null = null;
  /** A clock-played entrance or exit in progress: start in clock time (render/clock.ts). */
  private run: { kind: 'enter' | 'exit'; start: number; duration: number } | null = null;
  private runRaf = 0;
  layers: Layer[] = [];
  timed = true;
  solved: Solved | null = null;
  natives: Animation[] = [];
  /** Loop layer and its items (empty under reduced motion). */
  loopLayer: Layer | null = null;
  loopItems: LoopItem[] = [];
  private loopAnimations: Animation[] = [];
  /** Resolved `view(#id)` subjects. */
  private subjects = new Map<string, Element>();
  private presetDuration: number | null = null;
  private maxDuration = Number.POSITIVE_INFINITY;
  private exitPlanned = false;

  connectedCallback(): void {
    // A property assigned before the element was defined (React 19 sets `after` as a property,
    // since ChildNode.after exists) shadows the accessor below: move it to the attribute.
    if (Object.prototype.hasOwnProperty.call(this, 'after')) {
      const value: unknown = (this as { after: unknown }).after;
      delete (this as { after?: unknown }).after;
      reflect(this, 'after', value);
    }
    const scene = this.closest('cv-scene');
    if (!scene) return;
    if (scene instanceof CvScene) {
      this.scene = scene;
      scene.registerAnimate(this);
    } else {
      // Parent not upgraded yet (defined later): register once it is.
      void customElements.whenDefined('cv-scene').then(() => {
        if (this.isConnected && !this.scene) this.connectedCallback();
      });
    }
  }

  attributeChangedCallback(_name: string, before: string | null, after: string | null): void {
    if (before !== after) this.scene?.stage?.invalidate();
  }

  disconnectedCallback(): void {
    cancelAnimationFrame(this.runRaf);
    this.run = null;
    this.release();
    this.scene?.unregisterAnimate(this);
    this.scene = null;
  }

  timeSpec(): TimeSpec {
    const stagger = parseStagger(this.getAttribute('stagger'));
    return {
      name: this.getAttribute('name'),
      duration: Math.min(
        parseMs(this.getAttribute('duration'), this.presetDuration ?? 600),
        this.maxDuration
      ),
      delay: Math.max(0, parseMs(this.getAttribute('delay'), 0)),
      after: parseAfter(this.getAttribute('after')),
      at: parseAt(this.getAttribute('at')),
      // 1.x default: 600 ms, counted only when an exit is declared.
      exitDuration: this.exitPlanned ? parseMs(this.getAttribute('exit-duration'), 600) : 0,
      stagger: stagger && { ...stagger, count: this.staggerTargets().length },
    };
  }

  /**
   * Elements a stagger spreads over: `target` matches, else the children of a single container
   * child (1.x: `<Animate stagger><ul><li>…`), else the direct children.
   */
  staggerTargets(): Array<HTMLElement | SVGElement> {
    const target = this.getAttribute('target');
    const children = [...this.children];
    const found = target
      ? [...this.querySelectorAll(target)]
      : children.length === 1
        ? [...children[0]!.children]
        : children;
    return found.filter((el) => el instanceof HTMLElement || el instanceof SVGElement);
  }

  /**
   * Decide layers from attributes and context. Source precedence (plan v3 §3.5): signal presets
   * keep their signal; then an explicit `on`; then a rate preset's own source; then the context
   * (scene time in zones and drag scenes, enter elsewhere).
   */
  plan(context: PlanContext, report: Report): AnimatePlan {
    const reduced = context.reducedMotion;
    const easeText = this.getAttribute('ease');
    const ease = parseEase(easeText);
    if (easeText !== null && !ease) report(`Unknown ease "${easeText}"`);
    let effects: Effect[] = parseFx(this.getAttribute('fx'), report);
    if (ease) effects = effects.map((e) => ({ ...e, ease }));
    const raw = parseFromTo(this.getAttribute('from'), this.getAttribute('to'), ease, report);
    if (raw) effects.push(raw);
    let exits = parseExit(this.getAttribute('exit'), ease, report);
    const on = parseOn(this.getAttribute('on'), report);
    const loopDuration = this.getAttribute('loop-duration');
    const loops = parseLoop(
      this.getAttribute('loop'),
      loopDuration === null ? null : parseMs(loopDuration, 3000),
      ease,
      report
    );
    if (reduced) effects = effects.filter((e) => !e.reducible);

    const groups = new Map<Source, { effects: Effect[]; exits: Effect[] }>();
    const group = (source: Source): { effects: Effect[]; exits: Effect[] } => {
      let g = groups.get(source);
      if (!g) groups.set(source, (g = { effects: [], exits: [] }));
      return g;
    };
    for (const e of effects) {
      // A named range says the item follows the viewport (plan v3 §3.4), below an explicit `on`.
      const source =
        e.own && SIGNALS.has(e.own)
          ? e.own
          : (on?.source ?? (e.viewRange ? 'view' : null) ?? e.own ?? context.timeSource);
      if (__DEV__ && e.viewRange && source !== 'view') {
        warn(this, `a named range needs a view source; it has no effect with on="${source}"`);
      }
      // Reduced motion: no deformation from the reader's speed or direction (plan v3 §13).
      if (reduced && SIGNALS.has(source)) continue;
      const kept = reduced && CLOCK_PLAYED.has(source) ? opacityOnly(e) : e;
      if (kept) group(source).effects.push(kept);
    }
    const timeSource = on && kindOf(on.source) === 'time' ? on.source : context.timeSource;
    const clockPlayed = reduced && CLOCK_PLAYED.has(on?.source ?? timeSource);
    if (clockPlayed) exits = exits.map(opacityOnly).filter((e): e is Effect => e !== null);
    let hasExit = false;
    if (exits.length) {
      if (on && kindOf(on.source) !== 'time') {
        if (__DEV__) warn(this, `exit has no effect with on="${on.source}": exits follow time`);
      } else {
        group(timeSource).exits.push(...exits);
        hasExit = true;
      }
    }

    // stagger: the time group plays on each target child instead of the host (plan v3 §5, F13).
    let staggered: LayerPlan | null = null;
    if (this.hasAttribute('stagger')) {
      const g = groups.get(timeSource);
      if (g && ON_TIMELINE.has(timeSource)) {
        staggered = {
          kind: 'time',
          source: timeSource,
          subject: 'scene',
          range: null,
          effects: g.effects,
          exitEffects: g.exits,
          select: 'all',
        };
        groups.delete(timeSource);
        if (__DEV__) warnUnsafeStagger(this, staggered);
      } else if (__DEV__) {
        warn(this, 'stagger needs time-driven effects (scene or enter); it has no effect here');
      }
    }
    const sources = [...groups.keys()];
    if (staggered) sources.push(staggered.source);
    // No effects at all still makes a timeline (progress for el.timeline, a video, an anchor);
    // a loop alone does not (1.x: loops add no zone distance).
    const timed = sources.length
      ? sources.some((s) => ON_TIMELINE.has(s))
      : !this.hasAttribute('loop') && (!on || ON_TIMELINE.has(on.source));
    if (__DEV__ && !timed) {
      const ignored = TIMING_ATTRIBUTES.filter((a) => this.hasAttribute(a));
      if (ignored.length) {
        warn(
          this,
          `${ignored.join(', ')} ${ignored.length > 1 ? 'have' : 'has'} no effect: nothing on this element follows time. Use a named view range for view-driven effects.`
        );
      }
    }
    let duration: number | null = null;
    const timeEffects = [
      ...(staggered?.effects ?? []),
      ...sources.flatMap((s) => (ON_TIMELINE.has(s) ? (groups.get(s)?.effects ?? []) : [])),
    ];
    for (const e of timeEffects) {
      if (e.duration !== null) duration = Math.max(duration ?? 0, e.duration);
    }
    return {
      layers: planLayers(groups, on?.subject ?? 'scene', !reduced && loops.length > 0),
      staggered,
      timed,
      duration,
      maxDuration: clockPlayed ? REDUCED_DURATION : Number.POSITIVE_INFINITY,
      hasExit,
      // Reduced motion: loops stop and show their static frame (plan v3 §13).
      loops: reduced ? [] : loops,
    };
  }

  build(plan: AnimatePlan): void {
    this.release();
    this.subjects.clear();
    this.timed = plan.timed;
    this.presetDuration = plan.duration;
    this.maxDuration = plan.maxDuration;
    this.exitPlanned = plan.hasExit;
    this.layers = buildLayers(this, plan.layers);
    this.loopLayer = this.layers.find((l) => l.kind === 'loop') ?? null;
    this.loopItems = plan.loops;
    if (plan.staggered) {
      this.layers.push(...buildTargetLayers(this.staggerTargets(), plan.staggered));
    }
    if (__DEV__ && plan.layers.length) warnScopedPositioning(this);
  }

  /** The scene entered (true) or left (false) the activation window. */
  activated(_on: boolean): void {}

  /**
   * The element whose passage drives a view layer: the scene, this element, or the element of the
   * same scene with that id (`view(#hero)`); the scene when there is none.
   */
  viewSubject(layer: Layer): Element {
    const scene = this.scene ?? this;
    if (layer.subject === 'scene') return scene;
    if (layer.subject === 'self') return this;
    const found = this.subjects.get(layer.subject);
    if (found?.isConnected && scene.contains(found)) return found;
    const el = scene.querySelector(`#${CSS.escape(layer.subject.slice(1))}`);
    if (__DEV__ && !el) {
      warn(this, `on="view(${layer.subject})": no element with that id in this scene`);
    }
    // Kept until the next build, the scene too: frames never search the scene again.
    this.subjects.set(layer.subject, el ?? scene);
    return el ?? scene;
  }

  /** The element's timeline (plan v3 §3.6): current frame and a subscription. */
  get timeline(): CvTimeline {
    if (!this.view) {
      const frame = (): TimelineFrame =>
        this.run
          ? this.clockFrame()
          : (this.scene?.stage?.engine?.frameOf?.(this) ?? this.lastFrame);
      this.view = {
        get frame(): TimelineFrame {
          return frame();
        },
        get progress(): number {
          return frame().progress;
        },
        get signedProgress(): number {
          return frame().signedProgress;
        },
        get phase(): TimelinePhase {
          return frame().phase;
        },
        get source(): TimelineSource {
          return frame().source;
        },
        subscribe: (listener): (() => void) => {
          this.listeners.add(listener);
          if (this.run) this.tickRun();
          return (): void => {
            this.listeners.delete(listener);
          };
        },
      };
    }
    return this.view;
  }

  /** Someone follows the timeline: inputs build and send it frames (others read on demand). */
  get subscribed(): boolean {
    return this.listeners.size > 0;
  }

  /** Inputs that compute time on the main thread (drag, zones): a frame, with its phase. */
  sendFrame(frame: TimelineFrame): void {
    this.showPhase(frame.phase);
    this.publish(frame);
  }

  /** `data-cv-phase`: the timeline phase, plus `waiting` (for a predecessor) on the clock. */
  showPhase(phase: TimelinePhase | 'waiting'): void {
    if (phase === this.shownPhase) return;
    this.shownPhase = phase;
    this.setAttribute('data-cv-phase', phase);
  }

  /** Entrance or exit played on the clock (enter / eye): frames tick while there are subscribers. */
  clockEvent(event: ClockEvent): void {
    cancelAnimationFrame(this.runRaf);
    this.runRaf = 0;
    if (event.type !== 'enter' && event.type !== 'exit') {
      this.run = null;
      this.publish(
        event.type === 'reset'
          ? IDLE_FRAME
          : { progress: 1, signedProgress: 1, phase: 'entered', source: 'visibility' }
      );
      return;
    }
    const clock = this.scene?.stage?.clock;
    this.run = {
      kind: event.type,
      start: clock ? clock.now(event.start) : event.start,
      duration: event.duration,
    };
    this.tickRun();
  }

  private clockFrame(): TimelineFrame {
    const run = this.run!;
    const now = this.scene?.stage?.clock.now() ?? performance.now();
    if (now < run.start) {
      // Inside its delay: the starting frame.
      return run.kind === 'enter'
        ? { ...IDLE_FRAME, phase: 'entering', source: 'visibility' }
        : { ...IDLE_FRAME, phase: 'exiting', source: 'visibility' };
    }
    const p = run.duration > 0 ? Math.min(1, (now - run.start) / run.duration) : 1;
    const phase =
      run.kind === 'enter' ? (p >= 1 ? 'entered' : 'entering') : p >= 1 ? 'exited' : 'exiting';
    return { progress: p, signedProgress: p, phase, source: 'visibility' };
  }

  private tickRun = (): void => {
    this.runRaf = 0;
    if (!this.run || !this.listeners.size) return;
    const frame = this.clockFrame();
    this.publish(frame);
    if (frame.phase === 'entered' || frame.phase === 'exited') this.run = null;
    else this.runRaf = requestAnimationFrame(this.tickRun);
  };

  /** Keep the frame and tell subscribers when it changed. */
  private publish(frame: TimelineFrame): void {
    const last = this.lastFrame;
    if (
      last.phase === frame.phase &&
      last.source === frame.source &&
      Math.abs(last.progress - frame.progress) < 1e-4 &&
      Math.abs(last.signedProgress - frame.signedProgress) < 1e-4
    ) {
      return;
    }
    this.lastFrame = frame;
    for (const listener of this.listeners) listener(frame);
  }

  cancelNatives(): void {
    for (const a of this.natives) a.cancel();
    this.natives = [];
  }

  get looping(): boolean {
    return this.loopAnimations.length > 0;
  }

  /** Start the loops (idempotent). They run until stopLoops(); the clock pauses them with the stage. */
  startLoops(clock: Clock): void {
    const layer = this.loopLayer;
    if (!layer || this.loopAnimations.length) return;
    for (const item of this.loopItems) {
      this.loopAnimations.push(
        clock.add(
          layer.el.animate(item.keyframes, { duration: item.duration, iterations: Infinity })
        )
      );
    }
  }

  stopLoops(): void {
    for (const a of this.loopAnimations) a.cancel();
    this.loopAnimations = [];
  }

  /** Stop animations and undo writes on author elements (shadow layers are simply replaced). */
  release(): void {
    this.stopLoops();
    this.cancelNatives();
    for (const l of this.layers) {
      l.native = null;
      if (l.target) clearLayer(l);
    }
  }
}

/** Property → attribute (null, undefined and false remove it). */
function reflect(el: Element, name: string, value: unknown): void {
  if (value === null || value === undefined || value === false) el.removeAttribute(name);
  else el.setAttribute(name, value === true ? '' : String(value));
}

// React 19 sets a custom element prop as a property when the element has one by that name, and
// every element has `after` (ChildNode.after). Give it an accessor that writes the attribute,
// while reading still returns the DOM method.
if (typeof Element !== 'undefined') {
  Object.defineProperty(CvAnimate.prototype, 'after', {
    configurable: true,
    get(): unknown {
      return Element.prototype.after;
    },
    set(this: CvAnimate, value: unknown) {
      reflect(this, 'after', value);
    },
  });
}
