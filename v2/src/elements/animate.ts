/**
 * <cv-animate>: one element's effects. Attributes are read into layer plans; the shadow layers
 * themselves are built by render/layers.ts and written by whichever input drives the stage.
 */
import { parseEase } from '../core/ease';
import { parseExit, parseFromTo, parseFx, type Effect, type Source } from '../core/fx';
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
const ON_TIMELINE: ReadonlySet<Source> = new Set<Source>(['scene', 'enter']);
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

export interface AnimatePlan {
  layers: LayerPlan[];
  /** Time effects applied to each stagger target instead of the host. */
  staggered: LayerPlan | null;
  /** Takes part in the scene timeline (counts toward the total, can be an `after` target). */
  timed: boolean;
  /** Longest preset default among time effects; used when `duration` is not set. */
  duration: number | null;
  hasExit: boolean;
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
  ];

  scene: CvScene | null = null;
  layers: Layer[] = [];
  timed = true;
  solved: Solved | null = null;
  natives: Animation[] = [];
  /** Effects that play on a clock once the element enters (normal flow). */
  enterLayers: Layer[] = [];
  entered = false;
  private presetDuration: number | null = null;
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
      duration: parseMs(this.getAttribute('duration'), this.presetDuration ?? 600),
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
  plan(context: { timeSource: Source }, report: (m: string) => void): AnimatePlan {
    const easeText = this.getAttribute('ease');
    const ease = parseEase(easeText);
    if (easeText !== null && !ease) report(`Unknown ease "${easeText}"`);
    let effects: Effect[] = parseFx(this.getAttribute('fx'), report);
    if (ease) effects = effects.map((e) => ({ ...e, ease }));
    const raw = parseFromTo(this.getAttribute('from'), this.getAttribute('to'), ease, report);
    if (raw) effects.push(raw);
    const exits = parseExit(this.getAttribute('exit'), ease, report);
    const on = parseOn(this.getAttribute('on'), report);

    const groups = new Map<Source, { effects: Effect[]; exits: Effect[] }>();
    const group = (source: Source): { effects: Effect[]; exits: Effect[] } => {
      let g = groups.get(source);
      if (!g) groups.set(source, (g = { effects: [], exits: [] }));
      return g;
    };
    for (const e of effects) {
      const source =
        e.own && SIGNALS.has(e.own) ? e.own : (on?.source ?? e.own ?? context.timeSource);
      group(source).effects.push(e);
    }
    const timeSource = on && kindOf(on.source) === 'time' ? on.source : context.timeSource;
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
    // No effects at all still makes a timeline (progress for el.timeline, a video, an anchor).
    const timed = sources.length
      ? sources.some((s) => ON_TIMELINE.has(s))
      : !on || ON_TIMELINE.has(on.source);
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
      layers: planLayers(groups, on?.subject ?? 'scene'),
      staggered,
      timed,
      duration,
      hasExit,
    };
  }

  build(plan: AnimatePlan): void {
    this.release();
    this.timed = plan.timed;
    this.presetDuration = plan.duration;
    this.exitPlanned = plan.hasExit;
    this.layers = buildLayers(this, plan.layers);
    if (plan.staggered) {
      this.layers.push(...buildTargetLayers(this.staggerTargets(), plan.staggered));
    }
    this.enterLayers = this.layers.filter((l) => l.source === 'enter');
    this.entered = false;
    if (__DEV__ && plan.layers.length) warnScopedPositioning(this);
  }

  cancelNatives(): void {
    for (const a of this.natives) a.cancel();
    this.natives = [];
  }

  /** Stop animations and undo writes on author elements (shadow layers are simply replaced). */
  release(): void {
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
