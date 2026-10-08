/**
 * <cv-animate>: one element's effects. Attributes are read into layer plans; the shadow layers
 * themselves are built by render/layers.ts and written by whichever input drives the stage.
 */
import { parseEase } from '../core/ease';
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
import { warn } from '../dev/warn';
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
} from '../render/layers';
import { CvScene } from './scene';

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

/** `on`: a source name or `view(self)`. */
function parseOn(
  text: string | null,
  report: (m: string) => void
): { source: Source; subject: 'scene' | 'self' } | null {
  if (text === null) return null;
  const t = text.trim();
  if (t === 'view(self)') return { source: 'view', subject: 'self' };
  if (SOURCES.has(t)) return { source: t as Source, subject: 'scene' };
  report(`Unknown progress source on="${t}"`);
  return null;
}

export class CvAnimate extends ElementBase {
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
  layers: Layer[] = [];
  timed = true;
  solved: Solved | null = null;
  natives: Animation[] = [];
  /** Loop layer and its items (empty under reduced motion). */
  loopLayer: Layer | null = null;
  loopItems: LoopItem[] = [];
  private loopAnimations: Animation[] = [];
  private presetDuration: number | null = null;
  private maxDuration = Number.POSITIVE_INFINITY;
  private exitPlanned = false;

  connectedCallback(): void {
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
  plan(context: PlanContext, report: (m: string) => void): AnimatePlan {
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
      const source =
        e.own && SIGNALS.has(e.own) ? e.own : (on?.source ?? e.own ?? context.timeSource);
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

const UNSAFE_ON_TARGETS: ReadonlyArray<[string, string]> = [
  ['blur', '--cv-filter'],
  ['clip', '--cv-clip-path'],
  ['rx', '--cv-transform'],
  ['ry', '--cv-transform'],
  ['skx', '--cv-transform'],
  ['sky', '--cv-transform'],
];

function warnUnsafeStagger(el: Element, plan: LayerPlan): void {
  const used = new Set(
    [...plan.effects, ...plan.exitEffects].flatMap((e) => e.entries.map(([p]) => p as string))
  );
  const vars = [...new Set(UNSAFE_ON_TARGETS.filter(([p]) => used.has(p)).map(([, v]) => v))];
  if (vars.length) {
    warn(
      el,
      `stagger writes only translate, rotate, scale and opacity on your elements; the rest arrives as ${vars.join(', ')}. Use them in your CSS, e.g. filter: var(--cv-filter).`
    );
  }
}

/** Layers carry a transform, which scopes sticky, fixed and z-index of everything inside (§4.3). */
function warnScopedPositioning(el: Element): void {
  const nested = el.querySelector('cv-fixed, cv-stack');
  if (nested) {
    warn(
      el,
      `<${nested.localName}> inside <cv-animate> cannot stick to the viewport: the animation layers scope it. Move it outside.`
    );
    return;
  }
  for (const child of el.children) {
    const position = getComputedStyle(child).position;
    if (position === 'sticky' || position === 'fixed') {
      warn(
        el,
        `position: ${position} inside <cv-animate> is scoped by the animation layers and will not stick to the viewport.`
      );
      return;
    }
  }
}
