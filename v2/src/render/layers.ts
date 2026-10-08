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
 */
import {
  evaluate,
  sampleKeyframes,
  usedProps,
  type Effect,
  type Select,
  type Source,
} from '../core/fx';
import { combine, frameCss, identityFrame, type Frame, type Prop } from '../core/props';
import type { Solved } from '../core/time';

export type LayerKind = 'space' | 'time' | 'clock' | 'loop' | 'signal' | 'clip';

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
  subject: 'scene' | 'self';
  /** Entrance (or only) effects, evaluated at the layer's progress. */
  effects: Effect[];
  /** Exits, evaluated at exit progress and composed on top (time layers). */
  exitEffects: Effect[];
  /** Tracks this layer carries. */
  select: Select;
  el: HTMLElement | SVGElement;
  /** An author element (stagger child) rather than a shadow layer. */
  target: boolean;
  /** Index among the element's stagger targets; -1 otherwise. */
  item: number;
  /** Time layers: window on the scene timeline, assigned after the scene is solved. */
  window: Window | null;
  used: Set<Prop>;
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
  'kind' | 'source' | 'subject' | 'effects' | 'exitEffects' | 'select'
>;

const LAYER_STYLE =
  ':host{display:block;position:relative}' +
  ':host([display=inline]){display:inline-block}' +
  '.l{display:block;width:100%;height:100%}' +
  'slot{display:contents}';

const hasTracks = (effects: readonly Effect[], clip: boolean): boolean =>
  effects.some((e) => e.entries.some(([p]) => (p === 'clip') === clip));

/**
 * Plans for one element: one layer per source for non-clip tracks, plus one clip layer per source
 * that has clip tracks. Exits join the time layer of their source.
 */
export function planLayers(
  groups: ReadonlyMap<Source, { effects: Effect[]; exits: Effect[] }>,
  subject: 'scene' | 'self',
  loop = false
): LayerPlan[] {
  const plans: LayerPlan[] = [];
  if (loop) {
    plans.push({
      kind: 'loop',
      source: 'clock',
      subject,
      effects: [],
      exitEffects: [],
      select: 'rest',
    });
  }
  for (const [source, { effects, exits }] of groups) {
    const all = [...effects, ...exits];
    if (hasTracks(all, false)) {
      plans.push({
        kind: kindOf(source),
        source,
        subject,
        effects,
        exitEffects: exits,
        select: 'rest',
      });
    }
    if (hasTracks(all, true)) {
      plans.push({ kind: 'clip', source, subject, effects, exitEffects: exits, select: 'clip' });
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
  item: number
): Layer {
  return {
    ...plan,
    el,
    target,
    item,
    window: null,
    used: new Set<Prop>([
      ...usedProps(plan.effects, plan.select),
      ...usedProps(plan.exitEffects, plan.select),
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

/** Evaluate a layer at entrance progress p and exit progress px (0 = no exit in play). */
export function evaluateLayer(layer: Layer, p: number, px: number): Frame {
  evaluate(layer.effects, p, layer.frame, layer.select);
  if (px > 0 && layer.exitEffects.length) {
    evaluate(layer.exitEffects, px, layer.scratch, layer.select);
    combine(layer.frame, layer.scratch);
  }
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
export function writeLayer(layer: Layer, p: number, px: number): void {
  const css = layerCss(layer, evaluateLayer(layer, p, px));
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
