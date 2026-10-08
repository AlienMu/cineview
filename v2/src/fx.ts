/**
 * `fx` parsing, presets, and per-source composition.
 *
 * An element's effects are grouped by progress source; each group becomes one
 * shadow layer (see layers.ts). Within a group, effects that touch the same
 * property are combined: translate and rotate add, scale and opacity multiply,
 * blur adds. Clip effects always go to the innermost clip layer.
 */

export type Source = 'scene' | 'enter' | 'view' | 'clock';
export type Prop = 'x' | 'y' | 'yp' | 'scale' | 'rotate' | 'opacity' | 'blur' | 'clip';

/** Numeric tracks. `clip` is [top, right, bottom, left] in percent. */
export type Value = number | readonly [number, number, number, number];

export interface Effect {
  /** Property tracks as [from, to]. */
  tracks: Partial<Record<Prop, readonly [Value, Value]>>;
  /** Fraction of the element's progress this effect occupies. */
  range: readonly [number, number];
  ease: Ease;
  /** Source chosen by the preset when nothing overrides it. */
  defaultSource: Source;
  /** Rate presets keep their source inside zones and drag scenes. */
  rate: boolean;
}

export type Ease = (t: number) => number;

const cubic = (x1: number, y1: number, x2: number, y2: number): Ease => {
  // Newton iterations on the x curve, then evaluate y. Enough precision for animation.
  const ax = 3 * x1 - 3 * x2 + 1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let u = t;
    for (let i = 0; i < 6; i++) {
      const x = ((ax * u + bx) * u + cx) * u - t;
      const d = (3 * ax * u + 2 * bx) * u + cx;
      if (Math.abs(x) < 1e-5 || d === 0) break;
      u -= x / d;
    }
    return ((ay * u + by) * u + cy) * u;
  };
};

export const easeOut = cubic(0.22, 1, 0.36, 1);
export const easeInOut = cubic(0.65, 0, 0.35, 1);
export const linear: Ease = (t) => t;

type Preset = (args: string[]) => Effect;

const dirInset = (dir: string): readonly [number, number, number, number] => {
  switch (dir) {
    case 'right':
      return [0, 0, 0, 100];
    case 'up':
      return [100, 0, 0, 0];
    case 'down':
      return [0, 0, 100, 0];
    default:
      return [0, 100, 0, 0];
  }
};

const level = (arg: string | undefined, soft: number, normal: number, strong: number): number =>
  arg === 'soft' ? soft : arg === 'strong' ? strong : normal;

const blurAmount = (arg: string | undefined): number => {
  if (arg && arg.endsWith('px')) return Math.min(Number.parseFloat(arg), 6);
  return level(arg, 3, 6, 6);
};

export const presets: Record<string, Preset> = {
  fade: () => ({
    tracks: { opacity: [0, 1] },
    range: [0, 1],
    ease: easeOut,
    defaultSource: 'enter',
    rate: false,
  }),
  rise: () => ({
    tracks: { opacity: [0, 1], y: [40, 0] },
    range: [0, 1],
    ease: easeOut,
    defaultSource: 'enter',
    rate: false,
  }),
  // reveal = focus + wipe + push (lexicon #12, #30, #26). The clip track goes to the clip layer.
  reveal: (args) => ({
    tracks: {
      blur: [blurAmount(args[1]), 0],
      opacity: [0.34, 1],
      clip: [dirInset(args[0] ?? 'left'), [0, 0, 0, 0]],
      scale: [1.06, 1],
    },
    range: [0, 1],
    ease: easeInOut,
    defaultSource: 'enter',
    rate: false,
  }),
  focus: (args) => ({
    tracks: { blur: [blurAmount(args[0]), 0], opacity: [0.34, 1] },
    range: [0, 1],
    ease: easeOut,
    defaultSource: 'enter',
    rate: false,
  }),
  // Parallax (lexicon #4): small rate differences read as depth.
  drift: (args) => {
    const amount = level(args[0], 4, 8, 14);
    return {
      tracks: { yp: [amount, -amount] },
      range: [0, 1],
      ease: linear,
      defaultSource: 'view',
      rate: true,
    };
  },
};

export interface ParsedFx {
  effect: Effect;
  source: Source;
}

/** Parse `fx="rise, reveal(left) 0% 50%, drift(strong)"`. Unknown presets are reported, not thrown. */
export function parseFx(text: string | null, report: (message: string) => void): Effect[] {
  if (!text) return [];
  const out: Effect[] = [];
  for (const raw of splitTop(text)) {
    const item = raw.trim();
    if (!item) continue;
    const m = /^([a-z][\w-]*)\s*(?:\(([^)]*)\))?\s*(?:(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%)?$/.exec(
      item
    );
    if (!m) {
      report(`Cannot parse fx item "${item}"`);
      continue;
    }
    const preset = presets[m[1]!];
    if (!preset) {
      report(`Unknown preset "${m[1]}"`);
      continue;
    }
    const args = (m[2] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const effect = preset(args);
    if (m[3] !== undefined && m[4] !== undefined) {
      effect.range = [Number(m[3]) / 100, Number(m[4]) / 100];
    }
    out.push(effect);
  }
  return out;
}

function splitTop(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

/** Parse `from="opacity:.2; y:40; scale:.9; x:-20"` into a from/to effect. */
export function parseFromTo(from: string | null, to: string | null): Effect | null {
  if (!from && !to) return null;
  const read = (text: string | null): Partial<Record<Prop, number>> => {
    const values: Partial<Record<Prop, number>> = {};
    if (!text) return values;
    for (const pair of text.split(';')) {
      const [k, v] = pair.split(':').map((s) => s.trim());
      if (!k || v === undefined) continue;
      const n = Number.parseFloat(v);
      if (Number.isNaN(n)) continue;
      if (
        k === 'opacity' ||
        k === 'scale' ||
        k === 'x' ||
        k === 'y' ||
        k === 'rotate' ||
        k === 'blur'
      ) {
        values[k] = n;
      }
    }
    return values;
  };
  const a = read(from);
  const b = read(to);
  const identity: Record<string, number> = { opacity: 1, scale: 1, x: 0, y: 0, rotate: 0, blur: 0 };
  const tracks: Effect['tracks'] = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)]) as Set<Prop>) {
    tracks[key] = [a[key] ?? identity[key]!, b[key] ?? identity[key]!];
  }
  return { tracks, range: [0, 1], ease: easeOut, defaultSource: 'enter', rate: false };
}

/** Values of one layer at one progress. */
export interface Frame {
  x: number;
  y: number;
  yp: number;
  scale: number;
  rotate: number;
  opacity: number;
  blur: number;
  clip: [number, number, number, number] | null;
}

export const identityFrame = (): Frame => ({
  x: 0,
  y: 0,
  yp: 0,
  scale: 1,
  rotate: 0,
  opacity: 1,
  blur: 0,
  clip: null,
});

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Evaluate a set of same-source effects at progress p into `frame` (mutated, no allocation). */
export function evaluate(
  effects: readonly Effect[],
  p: number,
  frame: Frame,
  clipOnly: boolean
): void {
  frame.x = 0;
  frame.y = 0;
  frame.yp = 0;
  frame.scale = 1;
  frame.rotate = 0;
  frame.opacity = 1;
  frame.blur = 0;
  frame.clip = null;
  for (const e of effects) {
    const span = e.range[1] - e.range[0];
    const q =
      span <= 0 ? (p >= e.range[1] ? 1 : 0) : Math.min(1, Math.max(0, (p - e.range[0]) / span));
    const t = e.ease(q);
    const tr = e.tracks;
    if (clipOnly) {
      const c = tr.clip;
      if (c) {
        const from = c[0] as readonly number[];
        const to = c[1] as readonly number[];
        frame.clip = [
          lerp(from[0]!, to[0]!, t),
          lerp(from[1]!, to[1]!, t),
          lerp(from[2]!, to[2]!, t),
          lerp(from[3]!, to[3]!, t),
        ];
      }
      continue;
    }
    if (tr.x) frame.x += lerp(tr.x[0] as number, tr.x[1] as number, t);
    if (tr.y) frame.y += lerp(tr.y[0] as number, tr.y[1] as number, t);
    if (tr.yp) frame.yp += lerp(tr.yp[0] as number, tr.yp[1] as number, t);
    if (tr.rotate) frame.rotate += lerp(tr.rotate[0] as number, tr.rotate[1] as number, t);
    if (tr.scale) frame.scale *= lerp(tr.scale[0] as number, tr.scale[1] as number, t);
    if (tr.opacity) frame.opacity *= lerp(tr.opacity[0] as number, tr.opacity[1] as number, t);
    if (tr.blur) frame.blur += lerp(tr.blur[0] as number, tr.blur[1] as number, t);
  }
}

export const hasNonClip = (effects: readonly Effect[]): boolean =>
  effects.some((e) => Object.keys(e.tracks).some((k) => k !== 'clip'));
export const hasClip = (effects: readonly Effect[]): boolean =>
  effects.some((e) => e.tracks.clip !== undefined);

/** CSS declarations for a frame. Only properties the effects touch are emitted. */
export function frameCss(frame: Frame, used: ReadonlySet<Prop>): Record<string, string> {
  const css: Record<string, string> = {};
  if (used.has('x') || used.has('y') || used.has('yp')) {
    css.translate = frame.yp
      ? `${frame.x}px calc(${frame.y}px + ${frame.yp}%)`
      : `${frame.x}px ${frame.y}px`;
  }
  if (used.has('scale')) css.scale = String(frame.scale);
  if (used.has('rotate')) css.rotate = `${frame.rotate}deg`;
  if (used.has('opacity')) css.opacity = String(frame.opacity);
  if (used.has('blur')) css.filter = `blur(${frame.blur}px)`;
  if (used.has('clip') && frame.clip) {
    const [t, r, b, l] = frame.clip;
    css.clipPath = `inset(${t}% ${r}% ${b}% ${l}%)`;
  }
  return css;
}

export function usedProps(effects: readonly Effect[], clipOnly: boolean): Set<Prop> {
  const used = new Set<Prop>();
  for (const e of effects) {
    for (const k of Object.keys(e.tracks) as Prop[]) {
      if ((k === 'clip') === clipOnly) used.add(k);
    }
  }
  return used;
}

/** Sample effects into WAAPI keyframes (used by the native path). */
export function sampleKeyframes(
  effects: readonly Effect[],
  clipOnly: boolean,
  samples = 12
): Keyframe[] {
  const used = usedProps(effects, clipOnly);
  const frame = identityFrame();
  const frames: Keyframe[] = [];
  for (let i = 0; i <= samples; i++) {
    const p = i / samples;
    evaluate(effects, p, frame, clipOnly);
    frames.push({ offset: p, ...frameCss(frame, used) });
  }
  return frames;
}
