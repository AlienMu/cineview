/**
 * Shadow layers for <cv-animate>. Each layer is driven by one progress source, nested in a fixed
 * order from outside in (plan v3 §4.2):
 *
 *   space (view, page) → time (scene, enter + exits) → clock (clock, loop) → signal (velocity,
 *   direction) → clip (clip-path from any source, innermost so the window moves with the content)
 *
 * Author children stay in light DOM behind a <slot>. Layers are blocks that size to the host, so
 * percentage sizes in author content resolve against the host (§4.3).
 */
import { evaluate, sampleKeyframes, usedProps, type Effect, type Source } from '../core/fx';
import { combine, frameCss, identityFrame, type Frame, type Prop } from '../core/props';

export type LayerKind = 'space' | 'time' | 'clock' | 'signal' | 'clip';

const KIND_OF: Readonly<Record<Source, Exclude<LayerKind, 'clip'>>> = {
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
  signal: 3,
  clip: 4,
};

export const kindOf = (source: Source): Exclude<LayerKind, 'clip'> => KIND_OF[source];

export interface Layer {
  kind: LayerKind;
  source: Source;
  /** For view sources: whose passage drives it. */
  subject: 'scene' | 'self';
  /** Entrance (or only) effects, evaluated at the layer's progress. */
  effects: Effect[];
  /** Exits, evaluated at exit progress and composed on top (time layers). */
  exitEffects: Effect[];
  /** Clip layers evaluate only clip tracks; other layers only the rest. */
  clipOnly: boolean;
  el: HTMLElement;
  used: Set<Prop>;
  /** Scratch frames reused every write. */
  frame: Frame;
  scratch: Frame;
  /** Last written value per CSS property, to skip redundant writes. */
  last: Map<string, string>;
  /** Live native animation, when this layer runs off the main thread. */
  native: Animation | null;
}

/** What an element decides about a layer before the layer exists. */
export type LayerPlan = Pick<
  Layer,
  'kind' | 'source' | 'subject' | 'effects' | 'exitEffects' | 'clipOnly'
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
  subject: 'scene' | 'self'
): LayerPlan[] {
  const plans: LayerPlan[] = [];
  for (const [source, { effects, exits }] of groups) {
    const all = [...effects, ...exits];
    if (hasTracks(all, false)) {
      plans.push({
        kind: kindOf(source),
        source,
        subject,
        effects,
        exitEffects: exits,
        clipOnly: false,
      });
    }
    if (hasTracks(all, true)) {
      plans.push({ kind: 'clip', source, subject, effects, exitEffects: exits, clipOnly: true });
    }
  }
  // Canonical order; clip layers keep their sources' order among themselves.
  return plans.sort(
    (a, b) => RANK[a.kind] - RANK[b.kind] || RANK[kindOf(a.source)] - RANK[kindOf(b.source)]
  );
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
    const origin = plan.clipOnly ? null : plan.effects.find((e) => e.origin)?.origin;
    if (origin) el.style.transformOrigin = origin;
    parent.append(el);
    parent = el;
    const used = new Set<Prop>([
      ...usedProps(plan.effects, plan.clipOnly),
      ...usedProps(plan.exitEffects, plan.clipOnly),
    ]);
    layers.push({
      ...plan,
      el,
      used,
      frame: identityFrame(),
      scratch: identityFrame(),
      last: new Map(),
      native: null,
    });
  }
  parent.append(document.createElement('slot'));
  return layers;
}

/** Evaluate a layer at entrance progress p and exit progress px (0 = no exit in play). */
export function evaluateLayer(layer: Layer, p: number, px: number): Frame {
  evaluate(layer.effects, p, layer.frame, layer.clipOnly);
  if (px > 0 && layer.exitEffects.length) {
    evaluate(layer.exitEffects, px, layer.scratch, layer.clipOnly);
    combine(layer.frame, layer.scratch);
  }
  return layer.frame;
}

/** Direct style write (drag input and the scroll main-thread path). Skips unchanged values. */
export function writeLayer(layer: Layer, p: number, px: number): void {
  const css = frameCss(evaluateLayer(layer, p, px), layer.used);
  const style = layer.el.style as unknown as Record<string, string>;
  for (const key in css) {
    const value = css[key]!;
    if (layer.last.get(key) !== value) {
      layer.last.set(key, value);
      style[key] = value;
    }
  }
}

/** Keyframes over the layer's own progress (view and clock paths). */
export function layerKeyframes(layer: Layer, samples = 12): Keyframe[] {
  return sampleKeyframes(
    layer.effects,
    layer.clipOnly,
    (f) => frameCss(f, layer.used),
    identityFrame(),
    samples
  );
}

/** Keyframes for a time layer over a whole scene timeline of length `total` ms. */
export function sceneKeyframes(
  layer: Layer,
  window: { start: number; end: number; exitStart: number; exitEnd: number },
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
    ...frameCss(
      evaluateLayer(
        layer,
        progressIn(t, window.start, window.end),
        layer.exitEffects.length ? progressIn(t, window.exitStart, window.exitEnd) : 0
      ),
      layer.used
    ),
  }));
}

export function progressIn(t: number, a: number, b: number): number {
  if (b <= a) return t >= b ? 1 : 0;
  return t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a);
}
