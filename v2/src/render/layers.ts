/**
 * Shadow layers for <cv-animate>: one layer per progress source, in the fixed
 * order space → time → clip (plan v3 §4.2; clock and signal layers join in
 * later phases). Author children stay in light DOM behind a <slot>.
 */
import {
  evaluate,
  frameCss,
  identityFrame,
  sampleKeyframes,
  usedProps,
  type Effect,
  type Frame,
  type Prop,
  type Source,
} from '../core/fx';

export type LayerKind = 'space' | 'time' | 'clip';

export interface Layer {
  kind: LayerKind;
  source: Source;
  /** For view sources: whose passage drives it. */
  subject: 'scene' | 'self';
  effects: Effect[];
  /** Exit effects share the time layer (same source: scene time). */
  exitEffects: Effect[];
  el: HTMLElement;
  used: Set<Prop>;
  clipOnly: boolean;
  /** Scratch frame reused every write. */
  frame: Frame;
  scratch: Frame;
  /** Last written CSS text per property, to skip redundant writes. */
  last: Map<string, string>;
  /** Live native scroll-driven animation, when this layer runs on the compositor. */
  native?: Animation | null;
}

const LAYER_STYLE =
  ':host{display:block;position:relative}' +
  ':host([display=inline]){display:inline-block}' +
  '.l{display:block;width:100%;height:100%}' +
  'slot{display:contents}';

/** What an element decides about a layer before the layer exists. */
export type LayerPlan = Omit<Layer, 'el' | 'used' | 'frame' | 'scratch' | 'last' | 'native'>;

export function buildLayers(host: HTMLElement, plans: readonly LayerPlan[]): Layer[] {
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  root.textContent = '';
  const style = document.createElement('style');
  style.textContent = LAYER_STYLE;
  root.append(style);
  const order: LayerKind[] = ['space', 'time', 'clip'];
  const sorted = plans.slice().sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  let parent: ParentNode = root;
  const layers: Layer[] = [];
  for (const plan of sorted) {
    const el = document.createElement('div');
    el.className = 'l';
    el.setAttribute('part', `layer ${plan.kind}`);
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
    });
  }
  parent.append(document.createElement('slot'));
  return layers;
}

/** Combine b into a (same-source composition rules). */
function combine(a: Frame, b: Frame): void {
  a.x += b.x;
  a.y += b.y;
  a.yp += b.yp;
  a.rotate += b.rotate;
  a.scale *= b.scale;
  a.opacity *= b.opacity;
  a.blur += b.blur;
  if (b.clip) a.clip = b.clip;
}

/**
 * Evaluate a layer. `p` is the enter progress (0..1) and `px` the exit
 * progress (0..1, or -1 when the layer has no exit in play).
 */
export function evaluateLayer(layer: Layer, p: number, px: number): Frame {
  evaluate(layer.effects, p, layer.frame, layer.clipOnly);
  if (px >= 0 && layer.exitEffects.length) {
    evaluate(layer.exitEffects, px, layer.scratch, layer.clipOnly);
    combine(layer.frame, layer.scratch);
  }
  return layer.frame;
}

/** Direct style write (drag input and scroll fallback). Skips unchanged values. */
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
  return times.map((t) => {
    const p = progressIn(t, window.start, window.end);
    const px = layer.exitEffects.length ? progressIn(t, window.exitStart, window.exitEnd) : -1;
    return {
      offset: total > 0 ? t / total : 0,
      ...frameCss(evaluateLayer(layer, p, px), layer.used),
    };
  });
}

export function progressIn(t: number, a: number, b: number): number {
  if (b <= a) return t >= b ? 1 : 0;
  return t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a);
}

export { sampleKeyframes };
