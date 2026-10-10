/**
 * Layers for <cv-animate>. Each layer is driven by one progress source.
 *
 * Shadow layers nest in a fixed order from outside in (plan v3 §4.2):
 *
 *   space (view, page) → time (scene, enter + exits) → clock (on="clock") → loop → signal
 *   (velocity, direction) → clip (clip-path from any source, innermost so the window moves with
 *   the content)
 *
 * Author children stay in light DOM behind a <slot>. Layers are blocks that size to the host, so
 * percentage sizes in author content resolve against the host (§4.3).
 *
 * Target layers are author elements themselves (stagger children). On those the framework writes
 * only translate, rotate, scale and opacity, which compose with the author's own `transform`;
 * anything else reaches them as `--cv-filter`, `--cv-clip-path` and `--cv-transform` (§5, F13).
 *
 * Piece layers are the words or lines of split text (text/split.ts): elements of the copy in the
 * shadow root, so every track is written on them, always on the main thread.
 */
import {
  evaluate,
  sampleKeyframes,
  usedProps,
  usedVars,
  type Effect,
  type Select,
  type Source,
} from '../core/fx';
import {
  combine,
  compositorEligible,
  frameCss,
  identityFrame,
  mirrorFrame,
  type Frame,
  type Prop,
} from '../core/props';
import type { Solved } from '../core/time';
import { sameRange, type ViewRange } from '../core/view';

export type LayerKind = 'space' | 'time' | 'clock' | 'loop' | 'signal' | 'clip';

/**
 * Whose passage through the viewport drives a view layer: the scene, the element itself, or an
 * element of the same scene named by id (`view(#hero)`, plan v3 §3.5).
 */
export type Subject = 'scene' | 'self' | `#${string}`;

const KIND_OF: Readonly<Record<Source, Exclude<LayerKind, 'clip' | 'loop'>>> = {
  view: 'space',
  page: 'space',
  scene: 'time',
  enter: 'time',
  eye: 'time',
  clock: 'clock',
  velocity: 'signal',
  direction: 'signal',
};
const RANK: Readonly<Record<LayerKind, number>> = {
  space: 0,
  time: 1,
  clock: 2,
  loop: 3,
  signal: 4,
  clip: 5,
};

export const kindOf = (source: Source): Exclude<LayerKind, 'clip' | 'loop'> => KIND_OF[source];

/** Absolute window of a time layer on its scene timeline (ms). */
export interface Window {
  start: number;
  end: number;
  exitStart: number;
  exitEnd: number;
}

export interface Layer {
  kind: LayerKind;
  source: Source;
  /** For view sources: whose passage drives it. */
  subject: Subject;
  /** For view sources: the named range its progress runs over (null = all of `cover`). */
  range: ViewRange | null;
  /** Entrance (or only) effects, evaluated at the layer's progress. */
  effects: Effect[];
  /** Exits, evaluated at exit progress and composed on top (time layers). */
  exitEffects: Effect[];
  /** Tracks this layer carries. */
  select: Select;
  el: HTMLElement | SVGElement;
  /** An author element (stagger child) rather than a shadow layer. */
  target: boolean;
  /** A word or line of split text. */
  piece: boolean;
  /** Index among the element's stagger targets or split pieces; -1 otherwise. */
  item: number;
  /** Told the progress of every direct write (split text follows its first piece). */
  watch: ((p: number) => void) | null;
  /** Time layers: window on the scene timeline, assigned after the scene is solved. */
  window: Window | null;
  used: Set<Prop>;
  /**
   * Custom properties written here. They inherit into the slotted content only: the layer is the
   * lowest scope that reaches it (lexicon #38), never the stage or the root.
   */
  vars: Set<string>;
  /** Scratch frames reused every write. */
  frame: Frame;
  scratch: Frame;
  /** Last written value per CSS property, to skip redundant writes and to undo them. */
  last: Map<string, string>;
  /** Live native animation, when this layer runs off the main thread. */
  native: Animation | null;
}

/** What an element decides about a layer before the layer exists. */
export type LayerPlan = Pick<
  Layer,
  'kind' | 'source' | 'subject' | 'range' | 'effects' | 'exitEffects' | 'select'
>;

const LAYER_STYLE =
  ':host{display:block;position:relative}' +
  ':host([display=inline]){display:inline-block}' +
  '.l{display:block;width:100%;height:100%}' +
  'slot{display:contents}';

const hasTracks = (effects: readonly Effect[], clip: boolean): boolean =>
  effects.some(
    (e) => e.entries.some(([p]) => (p === 'clip') === clip) || (!clip && e.vars.length > 0)
  );

/** View effects split by named range, in order of first use: one native timeline range each. */
function byRange(
  effects: readonly Effect[]
): Array<{ range: ViewRange | null; effects: Effect[] }> {
  const parts: Array<{ range: ViewRange | null; effects: Effect[] }> = [];
  for (const e of effects) {
    const part = parts.find((p) => sameRange(p.range, e.viewRange));
    if (part) part.effects.push(e);
    else parts.push({ range: e.viewRange, effects: [e] });
  }
  return parts;
}

/**
 * Plans for one element: one layer per source for non-clip tracks, plus one clip layer per source
 * that has clip tracks. Exits join the time layer of their source. View effects get one layer per
 * named range, since a native animation runs over a single range.
 */
export function planLayers(
  groups: ReadonlyMap<Source, { effects: Effect[]; exits: Effect[] }>,
  subject: Subject,
  loop = false
): LayerPlan[] {
  const plans: LayerPlan[] = [];
  if (loop) {
    plans.push({
      kind: 'loop',
      source: 'clock',
      subject,
      range: null,
      effects: [],
      exitEffects: [],
      select: 'rest',
    });
  }
  for (const [source, group] of groups) {
    const parts =
      source === 'view' ? byRange(group.effects) : [{ range: null, effects: group.effects }];
    for (const { range, effects } of parts) {
      const exits = range === null ? group.exits : [];
      const all = [...effects, ...exits];
      const plan = { source, subject, range, effects, exitEffects: exits };
      if (hasTracks(all, false)) plans.push({ ...plan, kind: kindOf(source), select: 'rest' });
      if (hasTracks(all, true)) plans.push({ ...plan, kind: 'clip', select: 'clip' });
    }
  }
  // Canonical order; clip layers keep their sources' order among themselves.
  return plans.sort(
    (a, b) => RANK[a.kind] - RANK[b.kind] || RANK[kindOf(a.source)] - RANK[kindOf(b.source)]
  );
}

function makeLayer(
  plan: LayerPlan,
  el: HTMLElement | SVGElement,
  target: boolean,
  item: number,
  piece = false
): Layer {
  return {
    ...plan,
    el,
    target,
    piece,
    item,
    watch: null,
    window: null,
    used: new Set<Prop>([
      ...usedProps(plan.effects, plan.select),
      ...usedProps(plan.exitEffects, plan.select),
    ]),
    vars: new Set([
      ...usedVars(plan.effects, plan.select),
      ...usedVars(plan.exitEffects, plan.select),
    ]),
    frame: identityFrame(),
    scratch: identityFrame(),
    last: new Map(),
    native: null,
  };
}

export function buildLayers(host: HTMLElement, plans: readonly LayerPlan[]): Layer[] {
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  root.textContent = '';
  const style = document.createElement('style');
  style.textContent = LAYER_STYLE;
  root.append(style);
  let parent: ParentNode = root;
  const layers: Layer[] = [];
  for (const plan of plans) {
    const el = document.createElement('div');
    el.className = 'l';
    el.setAttribute('part', `layer ${plan.kind}`);
    const origin = plan.select === 'clip' ? null : plan.effects.find((e) => e.origin)?.origin;
    if (origin) el.style.transformOrigin = origin;
    parent.append(el);
    parent = el;
    layers.push(makeLayer(plan, el, false, -1));
  }
  parent.append(document.createElement('slot'));
  return layers;
}

/** One target layer per stagger child, carrying every track of the staggered effects. */
export function buildTargetLayers(
  targets: ReadonlyArray<HTMLElement | SVGElement>,
  plan: LayerPlan
): Layer[] {
  return targets.map((el, item) => makeLayer({ ...plan, select: 'all' }, el, true, item));
}

/**
 * Layers for split text pieces, every track on each. On a time source each piece is an item of the
 * solved stagger (assignWindows); on others piece k takes [k s, (k + 5) s] of the element's
 * progress, s = 1 / (n + 4), so each overlaps the four after it (lexicon #10: a word's window is
 * five units, one unit apart; too little overlap blinks word by word, too much lights the line at
 * once).
 */
export function buildPieceLayers(
  pieces: readonly HTMLElement[],
  plans: readonly LayerPlan[],
  timed: boolean
): Layer[] {
  const n = pieces.length;
  const s = 1 / (n + 4);
  const layers: Layer[] = [];
  for (const plan of plans) {
    const origin = plan.effects.find((e) => e.origin)?.origin;
    pieces.forEach((el, k) => {
      if (origin) el.style.transformOrigin = origin;
      const [from, to] = timed ? [0, 1] : [k * s, (k + 5) * s];
      const effects = timed
        ? plan.effects
        : plan.effects.map((e) => ({
            ...e,
            range: [from + e.range[0] * (to - from), from + e.range[1] * (to - from)] as const,
          }));
      layers.push(makeLayer({ ...plan, effects, select: 'all' }, el, false, k, true));
    });
  }
  return layers;
}

/** Assign windows to time layers from the element's solved window; stagger children get their slice. */
export function assignWindows(layers: readonly Layer[], solved: Solved | null): void {
  for (const layer of layers) {
    if (!solved || kindOf(layer.source) !== 'time') {
      layer.window = null;
      continue;
    }
    const items = solved.items;
    if (layer.item < 0 || !items) {
      layer.window = solved;
      continue;
    }
    const from = items.from[layer.item] ?? 0;
    const to = items.to[layer.item] ?? 1;
    const length = solved.end - solved.start;
    const exitLength = solved.exitEnd - solved.exitStart;
    layer.window = {
      start: solved.start + from * length,
      end: solved.start + to * length,
      exitStart: solved.exitStart + from * exitLength,
      exitEnd: solved.exitStart + to * exitLength,
    };
  }
}

/**
 * Evaluate a layer at entrance progress p and exit progress px (0 = no exit in play); `mirror`
 * reverses the result (a velocity layer while the reader moves backward).
 */
export function evaluateLayer(layer: Layer, p: number, px: number, mirror = false): Frame {
  evaluate(layer.effects, p, layer.frame, layer.select);
  if (px > 0 && layer.exitEffects.length) {
    evaluate(layer.exitEffects, px, layer.scratch, layer.select);
    combine(layer.frame, layer.scratch);
  }
  if (mirror) mirrorFrame(layer.frame);
  return layer.frame;
}

/** On author elements, properties outside the safe four travel as custom properties. */
const TARGET_VARS: Readonly<Record<string, string>> = {
  filter: '--cv-filter',
  clipPath: '--cv-clip-path',
  transform: '--cv-transform',
};

/** CSS for a layer at a frame; target layers rename unsafe properties to their variables. */
export function layerCss(layer: Layer, frame: Frame): Record<string, string> {
  const css = frameCss(frame, layer.used);
  if (!layer.target) return css;
  const out: Record<string, string> = {};
  for (const key in css) out[TARGET_VARS[key] ?? key] = css[key]!;
  return out;
}

/** Direct style write (drag input and the scroll main-thread path). Skips unchanged values. */
export function writeLayer(layer: Layer, p: number, px: number, mirror = false): void {
  layer.watch?.(p);
  const css = layerCss(layer, evaluateLayer(layer, p, px, mirror));
  const style = layer.el.style;
  for (const key in css) {
    const value = css[key]!;
    if (layer.last.get(key) === value) continue;
    layer.last.set(key, value);
    if (key.startsWith('--')) style.setProperty(key, value);
    else (style as unknown as Record<string, string>)[key] = value;
  }
}

/** Remove what writeLayer wrote (before a clock animation takes over, or when the layer goes away). */
export function clearLayer(layer: Layer): void {
  const style = layer.el.style;
  for (const key of layer.last.keys()) {
    if (key.startsWith('--')) style.removeProperty(key);
    else (style as unknown as Record<string, string>)[key] = '';
  }
  layer.last.clear();
}

/**
 * Whether a scroll-driven animation can carry the layer off the main thread: transform and opacity
 * only. Custom properties are main-thread values and step between keyframes unless registered;
 * split pieces each run over a narrow window that a dozen samples would not draw.
 */
export const compositorLayer = (layer: Layer): boolean =>
  !layer.piece && compositorEligible(layer.used) && layer.vars.size === 0;

/**
 * Keyframe samples for a clock-played layer of `duration` ms. An unregistered custom property
 * animates discretely between keyframes, so layers that write one get a keyframe per 60 Hz frame.
 */
export const samplesFor = (layer: Layer, duration: number): number =>
  layer.vars.size ? Math.max(12, Math.ceil(duration / (1000 / 60))) : 12;

/** Keyframes over the layer's own progress (view and clock paths). */
export function layerKeyframes(layer: Layer, samples = 12): Keyframe[] {
  return sampleKeyframes(
    layer.effects,
    layer.select,
    (f) => layerCss(layer, f),
    identityFrame(),
    samples
  );
}

/** Keyframes of a layer's exit alone (entrance complete), for exits played on a clock. */
export function exitKeyframes(layer: Layer, samples = 12): Keyframe[] {
  const frames: Keyframe[] = [];
  for (let i = 0; i <= samples; i++) {
    const px = i / samples;
    frames.push({ offset: px, ...layerCss(layer, evaluateLayer(layer, 1, px)) });
  }
  return frames;
}

/** Keyframes for a time layer over a whole scene timeline of length `total` ms. */
export function sceneKeyframes(
  layer: Layer,
  window: Window,
  total: number,
  samplesPerSegment = 8
): Keyframe[] {
  const points = new Set<number>([0, total]);
  const addSegment = (a: number, b: number): void => {
    if (b <= a) return;
    for (let i = 0; i <= samplesPerSegment; i++) points.add(a + ((b - a) * i) / samplesPerSegment);
  };
  addSegment(window.start, window.end);
  if (layer.exitEffects.length) addSegment(window.exitStart, window.exitEnd);
  const times = [...points].filter((t) => t >= 0 && t <= total).sort((a, b) => a - b);
  return times.map((t) => ({
    offset: total > 0 ? t / total : 0,
    ...layerCss(
      layer,
      evaluateLayer(
        layer,
        progressIn(t, window.start, window.end),
        layer.exitEffects.length ? progressIn(t, window.exitStart, window.exitEnd) : 0
      )
    ),
  }));
}

export function progressIn(t: number, a: number, b: number): number {
  if (b <= a) return t >= b ? 1 : 0;
  return t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a);
}
