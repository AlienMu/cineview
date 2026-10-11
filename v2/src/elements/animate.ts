/**
 * <cv-animate>: one element's effects. Attributes are read into layer plans; the shadow layers
 * themselves are built by render/layers.ts and written by whichever input drives the stage.
 */
import { parseEase, settle } from '../core/ease';
import type { Report } from '../core/errors';
import {
  evaluate,
  makeEffect,
  parseExit,
  parseFromTo,
  parseFx,
  turned,
  withOwnAxes,
  type Effect,
  type Source,
} from '../core/fx';
import { parseLoop, type LoopItem } from '../core/loop';
import { AXIS, identityFrame, isRest, type VarTrack } from '../core/props';
import {
  parseAfter,
  parseAt,
  parseMs,
  parseStagger,
  type Solved,
  type TimeSpec,
} from '../core/time';
import { warnScopedPositioning, warnUnsafeStagger, warnWideVars } from '../dev/craft';
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
import { stillsModule } from '../media/load-stills';
import type { Develop, Duotone, FadePlan, FocusCopy, InkPlan } from '../media/stills';
import {
  buildAdaptedLayer,
  buildCopyLayer,
  buildFadeLayer,
  buildLayers,
  buildPieceLayers,
  buildTargetLayers,
  clearLayer,
  kindOf,
  planLayers,
  type Layer,
  type LayerPlan,
  type Subject,
} from '../render/layers';
import type { Counter } from '../text/count';
import { splitModule } from '../text/load';
import { countModule } from '../text/load-count';
import type { SplitUnit, TextSplit } from '../text/split';
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
/** Split text on a time source: ms between pieces unless `stagger` says (lexicon #32: 85 ms a line). */
const SPLIT_STEP: Readonly<Record<SplitUnit, number>> = { words: 40, lines: 85 };
/** Lexicon #25: an image arrives over its stand-in in 1.2 s. */
const DEVELOP_DURATION = 1200;
/** Lexicon #13: a count takes .17 s a digit. */
const COUNT_STEP = 170;
/** What `draw` draws: the SVG shapes in the element, or in its `target` matches (lexicon #9). */
const SHAPES = 'path, line, polyline, polygon, circle, ellipse, rect';

/**
 * Keep only opacity and custom properties (values, not motion); null when nothing is left (the
 * element shows its final state at once). Font axes move the text: they hold their end value.
 * Duotone inks stay inks.
 */
function opacityOnly(e: Effect): Effect | null {
  const opacity = e.tracks.opacity;
  if (!opacity && !e.vars.length) return null;
  const vars = e.vars.map((v) =>
    v.name.startsWith(AXIS) ? ({ ...v, from: v.to } as VarTrack) : v
  );
  return {
    ...makeEffect({ tracks: opacity ? { opacity } : {}, vars, ease: e.ease, own: e.own }),
    range: e.range,
    inks: e.inks,
  };
}

/** Whether the element's text starts at its left: vertical-lr, or lines from left to right. */
function startsLeft(el: HTMLElement): boolean {
  const { writingMode, direction } = getComputedStyle(el);
  return writingMode.startsWith('horizontal') ? direction !== 'rtl' : writingMode.endsWith('lr');
}

/** The text's own font axes, read from its first run as styled: weight, width, optical size. */
function ownAxes(el: HTMLElement): (tag: string) => number {
  let style: CSSStyleDeclaration | null = null;
  return (tag: string): number => {
    if (!style) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let text = walker.nextNode();
      while (text && !text.textContent?.trim()) text = walker.nextNode();
      style = getComputedStyle(text?.parentElement ?? el);
    }
    const [value, fallback] =
      tag === 'wght'
        ? [style.fontWeight, 400]
        : tag === 'wdth'
          ? [style.fontStretch, 100]
          : [style.fontSize, 16];
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
  };
}

/** An entrance or exit played on the clock (enter / eye sources), for elements that follow it. */
export type ClockEvent =
  { type: 'enter' | 'exit'; start: number; duration: number } | { type: 'reveal' | 'reset' };

export interface PlanContext {
  /** Time source for time presets here: scene time in zones and drag scenes, enter elsewhere. */
  timeSource: Source;
  reducedMotion: boolean;
}

/** `split`: effects of one source play on the words or lines of a measured copy (text/split.ts). */
export interface SplitPlan {
  unit: SplitUnit;
  /** A time source: pieces are stagger items. Otherwise windows over the progress. */
  timed: boolean;
  /** One plan per named range (view), each with every track. */
  plans: LayerPlan[];
}

export interface AnimatePlan {
  layers: LayerPlan[];
  fades: FadePlan[];
  /** `duotone`: the ink tracks and inks, for the layer of the print over the images. */
  inks: InkPlan[];
  /** `count`: the count tracks, for the layer of the copy with the wheels (text/count.ts). */
  counts: LayerPlan[];
  /** `develop`: the crossfade (ms) from stand-ins to arrived images; null without it. */
  develop: number | null;
  /** `invert`: the element blends by difference, within its scene. */
  invert: boolean;
  /** Time effects applied to each stagger target instead of the host. */
  staggered: LayerPlan | null;
  split: SplitPlan | null;
  /** The layers without `split`: used when the text cannot be split. */
  whole: LayerPlan[] | null;
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
    'split',
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
  /** Split text in place (`split`); null when absent or refused. */
  split: TextSplit | null = null;
  private splitTimed = false;
  /** Copies over the element's images (media/stills.ts). */
  private stills: Array<Develop | FocusCopy | Duotone> = [];
  /** Digit wheels over the element's number (text/count.ts). */
  private counter: Counter | null = null;
  /** Undoes what `draw` set on the shapes it draws. */
  private drawn: Array<() => void> = [];
  /** `invert`: the blend, in the shadow root. */
  private inverted: HTMLStyleElement | null = null;
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
      stagger:
        this.splitStagger(stagger) ??
        (stagger && { ...stagger, count: this.staggerTargets().length }),
    };
  }

  /** Split text on a time source: its pieces are the stagger items. */
  private splitStagger(stagger: ReturnType<typeof parseStagger>): TimeSpec['stagger'] | null {
    const split = this.split;
    if (!split || !this.splitTimed) return null;
    return {
      ...(stagger ?? { each: SPLIT_STEP[split.unit], from: 'first' }),
      count: split.pieces.length,
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
    const develop = effects.some((e) => e.asset === 'develop');
    const invert = effects.some((e) => e.asset === 'invert');
    effects = effects.filter((e) => !e.asset);
    if (ease) effects = effects.map((e) => ({ ...e, ease }));
    if (effects.some((e) => e.tracks.count)) {
      const digits = this.textContent?.match(/\d/g)?.length ?? 0;
      effects = effects.map((e) => (e.tracks.count ? { ...e, duration: COUNT_STEP * digits } : e));
    }
    const raw = parseFromTo(this.getAttribute('from'), this.getAttribute('to'), ease, report);
    if (raw) effects.push(raw);
    let exits = parseExit(this.getAttribute('exit'), ease, report);
    // Axes left to the text take its own values (lexicon #33).
    const own = ownAxes(this);
    effects = effects.map((e) => withOwnAxes(e, own));
    exits = exits.map((e) => withOwnAxes(e, own));
    // A strip whose text starts at its left unrolls the other way (lexicon #35).
    if ([...effects, ...exits].some((e) => e.flow) && startsLeft(this)) {
      effects = effects.map((e) => (e.flow ? turned(e) : e));
      exits = exits.map((e) => (e.flow ? turned(e) : e));
    }
    // Duotone prints the element's images: without the module (no images to load it) it has none.
    if (!stillsModule()) {
      effects = effects.filter((e) => !e.inks);
      exits = exits.filter((e) => !e.inks);
    }
    const on = parseOn(this.getAttribute('on'), report);
    const loopDuration = this.getAttribute('loop-duration');
    const loops = parseLoop(
      this.getAttribute('loop'),
      loopDuration === null ? null : parseMs(loopDuration, 3000),
      ease,
      report
    );
    if (reduced) effects = effects.filter((e) => !e.reducible);
    if (__DEV__) {
      const names = [...effects, ...exits].flatMap((e) => e.vars.map((v) => v.name));
      warnWideVars(this, [...names, ...loops.flatMap((l) => l.vars)]);
    }

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

    // split: one source's effects play on the words or lines of a measured copy (plan v3 §5, F5).
    const splitText = this.getAttribute('split');
    const unit = splitText === 'words' || splitText === 'lines' ? splitText : null;
    if (splitText !== null && !unit) report(`split="${splitText}": expected words or lines`);
    let split: SplitPlan | null = null;
    let whole: LayerPlan[] | null = null;
    const splitSource = on?.source ?? context.timeSource;
    const splitGroup = unit ? groups.get(splitSource) : undefined;
    if (unit && reduced) {
      // Reduced motion: the text shows at once (lexicon #10, #32).
      if (splitGroup) {
        splitGroup.effects = [];
        if (!splitGroup.exits.length) groups.delete(splitSource);
      }
    } else if (
      unit &&
      splitGroup?.effects.length &&
      (ON_TIMELINE.has(splitSource) || splitSource === 'view' || splitSource === 'page')
    ) {
      const subject = on?.subject ?? 'scene';
      whole = planLayers(groups, subject, loops.length > 0);
      const timedSplit = ON_TIMELINE.has(splitSource);
      const plans: LayerPlan[] = [];
      const parts = timedSplit
        ? [
            {
              kind: 'time' as const,
              source: splitSource,
              subject: 'scene' as const,
              range: null,
              effects: splitGroup.effects,
              exitEffects: [],
              select: 'all' as const,
            },
          ]
        : planLayers(new Map([[splitSource, { effects: splitGroup.effects, exits: [] }]]), subject);
      for (const p of parts) {
        if (!plans.some((q) => q.range === p.range))
          plans.push({ ...p, exitEffects: [], select: 'all' });
      }
      split = { unit, timed: timedSplit, plans };
      // Exits stay with the whole element.
      splitGroup.effects = [];
      if (!splitGroup.exits.length) groups.delete(splitSource);
    } else if (unit && __DEV__) {
      warn(this, `split needs effects on a time, view or page source; it has no effect here`);
    }

    // stagger: the time group plays on each target child instead of the host (plan v3 §5, F13).
    let staggered: LayerPlan | null = null;
    if (split) {
      if (__DEV__ && !split.timed && this.hasAttribute('stagger')) {
        warn(
          this,
          'stagger has no effect on split text that follows the viewport: the words overlap instead'
        );
      }
    } else if (this.hasAttribute('stagger')) {
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
      } else if (__DEV__ && !reduced) {
        // Under reduced motion the time group may have nothing left to stagger.
        warn(this, 'stagger needs time-driven effects (scene or enter); it has no effect here');
      }
    }
    const sources = [...groups.keys()];
    if (staggered) sources.push(staggered.source);
    if (split) sources.push(splitSource);
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
      ...(split?.timed ? split.plans.flatMap((p) => p.effects) : []),
      ...sources.flatMap((s) => (ON_TIMELINE.has(s) ? (groups.get(s)?.effects ?? []) : [])),
    ];
    for (const e of timeEffects) {
      if (e.duration !== null) duration = Math.max(duration ?? 0, e.duration);
    }
    const layers = planLayers(groups, on?.subject ?? 'scene', !reduced && loops.length > 0);
    // F12: blur on a large picture fades a blurred copy instead.
    const fades = stillsModule()?.planFades(layers, this) ?? [];
    const inks = stillsModule()?.planInks(layers) ?? [];
    const counts = countModule()?.planCounts(layers) ?? [];
    return {
      layers,
      fades,
      inks,
      counts,
      develop: develop ? (reduced ? REDUCED_DURATION : DEVELOP_DURATION) : null,
      invert,
      staggered,
      split,
      whole,
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
    if (plan.split) this.mountSplit(plan.split, plan.whole!);
    this.mountStills(plan);
    this.loopLayer = this.layers.find((l) => l.kind === 'loop') ?? null;
    this.loopItems = plan.loops;
    if (plan.staggered) {
      this.layers.push(...buildTargetLayers(this.staggerTargets(), plan.staggered));
    }
    this.mountCount(plan);
    this.mountDraw();
    if (plan.invert) this.mountInvert();
    if (__DEV__ && plan.layers.length) warnScopedPositioning(this);
  }

  /**
   * `invert` (lexicon #40): the element blends by difference with what its scene shows behind it,
   * the scene isolating the blend. Its text is white unless the page says otherwise: white minus
   * the backdrop is the inverse.
   */
  private mountInvert(): void {
    const style = document.createElement('style');
    style.textContent = ':host{mix-blend-mode:difference;color:#fff}';
    this.shadowRoot!.append(style);
    this.inverted = style;
    this.scene?.isolate(this, true);
  }

  /** `count`: digit wheels over the number, on a layer of their own (text/count.ts). */
  private mountCount(plan: AnimatePlan): void {
    if (!plan.counts.length) return;
    const slot = this.shadowRoot!.querySelector('slot');
    // The stage loads the module before building elements that may need it.
    const mod = countModule();
    if (!slot || !mod || this.split) {
      if (__DEV__ && this.split) warn(this, 'count has no effect on split text');
      return;
    }
    const counter = new mod.Counter(this, slot, () => this.scene?.stage?.invalidate());
    const refused = counter.mount();
    if (refused) {
      counter.destroy();
      if (__DEV__) warn(this, `count: ${refused}; the number shows as it is`);
      return;
    }
    this.counter = counter;
    for (const p of plan.counts) {
      this.layers.push(buildAdaptedLayer(p, counter.el, counter.adapt, counter.vars));
    }
  }

  /**
   * `draw` (lexicon #9): the shapes it draws measure 1 (pathLength) and dash 1, so the layers'
   * dash offset (inherited, or written on stagger targets) draws any of them. The gap is 2: an
   * undrawn offset a hair past 1 (core/props.ts) stays in it at both ends of the stroke.
   */
  private mountDraw(): void {
    if (!this.layers.some((l) => l.used.has('draw'))) return;
    const target = this.getAttribute('target');
    const roots = target ? [...this.querySelectorAll(target)] : [this];
    const shapes = roots.flatMap((el) =>
      el instanceof SVGGeometryElement ? [el] : [...el.querySelectorAll<SVGElement>(SHAPES)]
    );
    if (__DEV__ && !shapes.length) warn(this, `draw has no shapes to draw (${SHAPES})`);
    for (const el of shapes) {
      const length = el.getAttribute('pathLength');
      const dash = el.style.strokeDasharray;
      el.setAttribute('pathLength', '1');
      el.style.strokeDasharray = '1 2';
      this.drawn.push(() => {
        if (length === null) el.removeAttribute('pathLength');
        else el.setAttribute('pathLength', length);
        el.style.strokeDasharray = dash;
      });
    }
  }

  /**
   * Draw the split copy and its piece layers; text that cannot be split (more than text, rotated,
   * vertical, right-to-left, decorated) animates as a whole instead.
   */
  private mountSplit(plan: SplitPlan, whole: LayerPlan[]): void {
    const slot = this.shadowRoot!.querySelector('slot')!;
    // Pieces on a time source are timed with the scene: their number stays until the next build.
    const rebuild = plan.timed ? null : (): void => this.scene?.stage?.invalidate();
    // The stage loads the module before building; without it (not yet loaded) the text stays whole.
    const mod = splitModule();
    const split = mod && new mod.TextSplit(this, slot, plan.unit, rebuild);
    const refused = split ? split.mount() : 'it is still loading';
    if (!split || refused) {
      split?.destroy();
      if (__DEV__) warn(this, `split="${plan.unit}": ${refused}; the text animates as a whole`);
      this.layers = buildLayers(this, whole);
      return;
    }
    const end = identityFrame();
    split.atRest = plan.plans.every((p) => {
      evaluate(p.effects, 1, end, 'all');
      return isRest(end);
    });
    const pieces = buildPieceLayers(split.pieces, plan.plans, plan.timed);
    if (!plan.timed && pieces[0]) pieces[0].watch = (p): void => split.progress(p);
    this.layers.push(...pieces);
    this.split = split;
    this.splitTimed = plan.timed;
    // Inputs announce the phase again for the new copy.
    this.shownPhase = null;
  }

  /**
   * Copies over the element's images: duotone prints, fade layers (F12), then `develop` stand-ins
   * on top.
   */
  private mountStills(plan: AnimatePlan): void {
    const slot = this.shadowRoot!.querySelector('slot');
    // The stage loads the module before building elements that may need it.
    const mod = stillsModule();
    if (!slot || !mod) return;
    const { Develop, Duotone, FocusCopy, copyContainer } = mod;
    for (const { layer, inks } of plan.inks) {
      if (__DEV__ && !this.querySelector('img')) warn(this, 'duotone has no images to print');
      const print = new Duotone(this, copyContainer(slot, 'duotone'));
      print.mount(inks);
      this.stills.push(print);
      this.layers.push(buildCopyLayer(layer, print.container));
    }
    for (const { layer, blur } of plan.fades) {
      const copy = new FocusCopy(this, copyContainer(slot, 'focus-copy'));
      copy.mount(blur);
      this.stills.push(copy);
      this.layers.push(buildFadeLayer(layer, copy.container, blur));
    }
    if (plan.develop !== null) {
      const develop = new Develop(this, copyContainer(slot, 'develop'));
      develop.mount(plan.develop, settle.css!);
      this.stills.push(develop);
    }
  }

  /** The scene entered (true) or left (false) the activation window. */
  activated(on: boolean): void {
    // Fonts or sizes may have changed while it was away.
    if (on) this.split?.schedule();
  }

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
    if (this.splitTimed) this.split?.phase(phase);
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
    this.split?.destroy();
    this.split = null;
    this.splitTimed = false;
    for (const s of this.stills) s.destroy();
    this.stills = [];
    this.counter?.destroy();
    this.counter = null;
    for (const undo of this.drawn) undo();
    this.drawn = [];
    this.inverted?.remove();
    this.inverted = null;
    this.scene?.isolate(this, false);
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
