/**
 * The `fx` language and the preset library.
 *
 *   fx="rise, reveal(left) 0% 60%, drift(strong)"
 *   fx="focus(band) entry 0% cover 50%"
 *
 * An item is a preset name, optional word-first arguments, and an optional range: plain
 * percentages are a part of the element's progress; named ranges (`cover`, `contain`, `entry`,
 * `exit`, `entry-crossing`, `exit-crossing`, as in CSS `animation-range`) place a view-driven
 * effect on the subject's passage through the viewport.
 *
 * Presets are the lexicon turned into functions: each carries its craft numbers (amounts, curve,
 * duration) so a short name gives a finished result. Raw values go through `from` / `to`; reusable
 * custom presets through `defineEffect()`.
 */
import { cubicBezier, easeInOut, linear, pan, parseEase, settle, type Ease } from './ease';
import type { Report } from './errors';
import {
  applyTrack,
  parseDeclarations,
  parseVars,
  resetFrame,
  tracksBetween,
  varsBetween,
  varValue,
  type Clip,
  type Frame,
  type Prop,
  type Tracks,
  type Value,
  type VarTrack,
} from './props';

/** Progress sources (plan v3 §3.5). */
export type Source =
  'scene' | 'enter' | 'view' | 'page' | 'clock' | 'eye' | 'velocity' | 'direction';

export type ViewRangeName =
  'cover' | 'contain' | 'entry' | 'exit' | 'entry-crossing' | 'exit-crossing';
export interface ViewEdge {
  name: ViewRangeName;
  offset: number;
}

export interface Effect {
  /** Tracks as [from, to], evaluated at eased progress. */
  tracks: Tracks;
  /** Flattened tracks for the per-frame loop. */
  entries: ReadonlyArray<readonly [Prop, Value, Value]>;
  /** Custom property tracks (`--name`), written beside the tracks above. */
  vars: readonly VarTrack[];
  /** Part of the element's progress this effect occupies. */
  range: readonly [number, number];
  /** Named view range; only meaningful on view sources (resolved against measured geometry). */
  viewRange: readonly [ViewEdge, ViewEdge] | null;
  ease: Ease;
  /** Rate presets keep this source inside zones and drag scenes; null = time (context decides). */
  own: Source | null;
  /** Layer transform-origin (push focus). */
  origin: string | null;
  /** Suggested duration (ms) when the element sets none. */
  duration: number | null;
  /** Decorative motion dropped under prefers-reduced-motion (plan v3 §13: parallax drift). */
  reducible: boolean;
}

interface EffectInit {
  tracks: Tracks;
  vars?: readonly VarTrack[];
  ease?: Ease;
  own?: Source | null;
  origin?: string | null;
  duration?: number | null;
  range?: readonly [number, number];
  reducible?: boolean;
}

export function makeEffect(init: EffectInit): Effect {
  const entries = (Object.keys(init.tracks) as Prop[]).map(
    (p) => [p, init.tracks[p]![0], init.tracks[p]![1]] as const
  );
  return {
    tracks: init.tracks,
    entries,
    vars: init.vars ?? [],
    range: init.range ?? [0, 1],
    viewRange: null,
    ease: init.ease ?? settle,
    own: init.own ?? null,
    origin: init.origin ?? null,
    duration: init.duration ?? null,
    reducible: init.reducible ?? false,
  };
}

/** The same effect played backwards: an entrance used as an exit (identity → its from-state). */
export function asExit(e: Effect): Effect {
  const tracks: Tracks = {};
  for (const [p, from, to] of e.entries) tracks[p] = [to, from];
  const vars = e.vars.map((v) => ({ ...v, from: v.to, to: v.from }) as VarTrack);
  const ease = e.ease;
  return {
    ...makeEffect({
      tracks,
      vars,
      ease: (t) => 1 - ease(1 - t),
      own: e.own,
      origin: e.origin,
      reducible: e.reducible,
    }),
    range: [1 - e.range[1], 1 - e.range[0]],
  };
}

// ---- evaluation -----------------------------------------------------------------------------------

/** Which tracks a layer carries: shadow layers split clip from the rest; light-DOM targets take all. */
export type Select = 'rest' | 'clip' | 'all';
const selects = (select: Select, prop: Prop): boolean =>
  select === 'all' || (prop === 'clip') === (select === 'clip');

/** Evaluate same-source effects at progress p into `frame` (mutated, no allocation). */
export function evaluate(
  effects: readonly Effect[],
  p: number,
  frame: Frame,
  select: Select
): void {
  resetFrame(frame);
  for (const e of effects) {
    const [a, b] = e.range;
    const q = b <= a ? (p >= b ? 1 : 0) : p <= a ? 0 : p >= b ? 1 : (p - a) / (b - a);
    const t = e.ease(q);
    for (const [prop, from, to] of e.entries) {
      if (selects(select, prop)) applyTrack(frame, prop, from, to, t);
    }
    if (select !== 'clip') for (const v of e.vars) frame.vars.set(v.name, varValue(v, t));
  }
}

/** Custom properties an effect list writes on a layer with this selection. */
export function usedVars(effects: readonly Effect[], select: Select): Set<string> {
  const names = new Set<string>();
  if (select !== 'clip') for (const e of effects) for (const v of e.vars) names.add(v.name);
  return names;
}

export function usedProps(effects: readonly Effect[], select: Select): Set<Prop> {
  const used = new Set<Prop>();
  for (const e of effects) {
    for (const [p] of e.entries) if (selects(select, p)) used.add(p);
  }
  return used;
}

// ---- presets --------------------------------------------------------------------------------------

type Factory = (args: readonly string[], report: Report) => Effect | Effect[];

const presets = new Map<string, Factory>();

/** Word levels (`soft` / `strong`) or an explicit number with an allowed unit. */
function amount(
  arg: string | undefined,
  levels: { soft: number; normal: number; strong: number },
  report: Report,
  preset: string,
  units: readonly string[] = ['']
): { value: number; unit: string } {
  if (arg === undefined || arg === '') return { value: levels.normal, unit: units[0]! };
  if (arg === 'soft' || arg === 'strong') return { value: levels[arg], unit: units[0]! };
  const m = /^(-?\d*\.?\d+)([a-z%]*)$/.exec(arg);
  if (m && units.includes(m[2]!)) return { value: Number(m[1]), unit: m[2]! };
  const accepted = units.map((u) => (u ? `n${u}` : 'n')).join(', ');
  report(`${preset}(${arg}): expected soft, strong or ${accepted}`);
  return { value: levels.normal, unit: units[0]! };
}

/** wipe sides: left/right/top/bottom name the starting edge; up/down name the travel. */
const WIPE: Readonly<Record<string, Clip>> = {
  left: [0, 100, 0, 0],
  right: [0, 0, 0, 100],
  top: [0, 0, 100, 0],
  bottom: [100, 0, 0, 0],
  up: [100, 0, 0, 0],
  down: [0, 0, 100, 0],
  center: [0, 50, 0, 50],
};
const CLEAR: Clip = [0, 0, 0, 0];

function wipeTrack(side: string | undefined, report: Report): Tracks {
  const from = WIPE[side ?? 'left'];
  if (!from) report(`wipe(${side}): expected ${Object.keys(WIPE).join(', ')}`);
  return { clip: [from ?? WIPE.left!, CLEAR] };
}

/** Lexicon #12 depth of field: blur 4.5px and opacity .34 out of focus. */
function focusTracks(arg: string | undefined, report: Report): Tracks {
  const blur = amount(arg, { soft: 2.5, normal: 4.5, strong: 9 }, report, 'focus', [
    '',
    'px',
  ]).value;
  return { blur: [Math.max(0, blur), 0], opacity: [0.34, 1] };
}

function scaleArg(
  arg: string | undefined,
  fallback: number,
  report: Report,
  preset: string
): number {
  if (arg === undefined || arg === '') return fallback;
  const n = Number(arg);
  if (Number.isFinite(n) && n >= 0) return n;
  report(`${preset}(${arg}): expected a scale such as 1.06`);
  return fallback;
}

presets.set('fade', () => makeEffect({ tracks: { opacity: [0, 1] }, duration: 600 }));

// Lexicon #32: lines come up 40px and settle. `rise(line)`: a split line rises out of its clip,
// 105% of its height and tilted 2.5deg about its bottom-left corner.
const LINE_EASE = cubicBezier(0.19, 0.8, 0.22, 1);
presets.set('rise', (args, report) => {
  if (args[0] === 'line') {
    return makeEffect({
      tracks: { yp: [105, 0], rotate: [2.5, 0] },
      ease: LINE_EASE,
      origin: 'left bottom',
      duration: 950,
    });
  }
  const a = amount(args[0], { soft: 20, normal: 40, strong: 80 }, report, 'rise', ['', 'px', '%']);
  const track: Prop = a.unit === '%' ? 'yp' : 'y';
  return makeEffect({ tracks: { opacity: [0, 1], [track]: [a.value, 0] }, duration: 950 });
});

presets.set('grow', (args, report) => {
  const from =
    args[0] === undefined || args[0] === 'soft' || args[0] === 'strong'
      ? { soft: 0.96, normal: 0.9, strong: 0.8 }[args[0] ?? 'normal']!
      : scaleArg(args[0], 0.9, report, 'grow');
  return makeEffect({ tracks: { opacity: [0, 1], scale: [from, 1] }, duration: 800 });
});

presets.set('focus', (args, report) => {
  if (args[0] === 'band') {
    // Sharp only in the middle of the passage (lexicon focusband keyframes: 46%–54%).
    const tracks = focusTracks(args[1], report);
    const into = makeEffect({ tracks, ease: linear, own: 'view', range: [0, 0.46] });
    const out = asExit(makeEffect({ tracks, ease: linear, own: 'view' }));
    return [into, { ...out, range: [0.54, 1] }];
  }
  return makeEffect({ tracks: focusTracks(args[0], report), duration: 900 });
});

// Lexicon #30: an edge travels across.
presets.set('wipe', (args, report) =>
  makeEffect({ tracks: wipeTrack(args[0], report), ease: pan, duration: 1100 })
);

// Lexicon #26 Ken Burns: scale around a focus point. push(from, to, focus).
presets.set('push', (args, report) => {
  const word = args[0] === 'in' || args[0] === 'out' ? args[0] : null;
  const [from, to] = word
    ? word === 'in'
      ? [1, 1.16]
      : [1.16, 1]
    : [scaleArg(args[0], 1.06, report, 'push'), scaleArg(args[1], 1, report, 'push')];
  const origin = args[word ? 1 : 2] ?? null;
  if (origin !== null && !/^[\w\s.%-]+$/.test(origin))
    report(`push focus "${origin}" is not a position`);
  return makeEffect({ tracks: { scale: [from, to] }, ease: pan, origin, duration: 1200 });
});

// focus + wipe + push in one name (lexicon #12 + #30 + #26).
presets.set('reveal', (args, report) => [
  makeEffect({ tracks: focusTracks(args[1], report), duration: 1200 }),
  makeEffect({ tracks: wipeTrack(args[0], report), ease: pan, duration: 1200 }),
  makeEffect({ tracks: { scale: [1.06, 1] }, ease: pan, duration: 1200 }),
]);

// Lexicon #4 parallax: a rate difference reads as depth. Positive drifts lag (far), negative lead.
presets.set('drift', (args, report) => {
  const a = amount(args[0], { soft: 3.5, normal: 10, strong: 16 }, report, 'drift', [
    '%',
    '',
    'px',
  ]);
  const track: Prop = a.unit === '%' ? 'yp' : 'y';
  return makeEffect({
    tracks: { [track]: [-a.value, a.value] },
    ease: linear,
    own: 'view',
    reducible: true,
  });
});

// Lexicon #7 velocity skew: content leans with the reader's speed (skewY -4deg and scaleY 1.1 at
// full speed) and straightens as it settles; the signal mirrors the lean when moving backward.
presets.set('skew', (args, report) => {
  const a = amount(args[0], { soft: 2, normal: 4, strong: 8 }, report, 'skew', ['', 'deg']);
  return makeEffect({
    tracks: { sky: [0, -a.value], sy: [1, 1 + a.value * 0.025] },
    ease: linear,
    own: 'velocity',
    reducible: true,
  });
});

// Lexicon #37 token interpolation: one shared hue angle, `--cv-hue`, turned with the passage (or
// any source). Author colours keep their own lightness and chroma and add the angle:
// `color: oklch(.27 .045 calc(18deg + var(--cv-hue)))`. hue(to) or hue(from, to); default a full
// turn. Not motion: kept under reduced motion.
const angle = (arg: string | undefined, fallback: number, report: Report): number => {
  if (arg === undefined || arg === '') return fallback;
  const m = /^(-?\d*\.?\d+)(deg|turn|rad)?$/.exec(arg);
  if (m) return Number(m[1]) * (m[2] === 'turn' ? 360 : m[2] === 'rad' ? 180 / Math.PI : 1);
  report(`hue(${arg}): expected an angle such as 180deg or .5turn`);
  return fallback;
};
presets.set('hue', (args, report) => {
  const [from, to] =
    args.length > 1
      ? [angle(args[0], 0, report), angle(args[1], 360, report)]
      : [0, angle(args[0], 360, report)];
  return makeEffect({
    tracks: {},
    vars: [{ name: '--cv-hue', from, to, unit: 'deg' }],
    ease: linear,
    own: 'view',
  });
});

// 1.x presets still used on the site, with their exact 1.x values (1.x played them ease-in-out).
const legacy =
  (tracks: Tracks): Factory =>
  () =>
    makeEffect({ tracks, ease: easeInOut, duration: 600 });
presets.set('fade-in', legacy({ opacity: [0, 1] }));
presets.set('slide-up', legacy({ yp: [100, 0], opacity: [0, 1] }));
presets.set('zoom-in', legacy({ scale: [0, 1], opacity: [0, 1] }));
presets.set('rotate-in', legacy({ rotate: [-180, 0], scale: [0, 1], opacity: [0, 1] }));
presets.set('blur-in', legacy({ blur: [10, 0], opacity: [0, 1] }));

export const presetNames = (): string[] => [...presets.keys()];

// ---- defineEffect ---------------------------------------------------------------------------------

/**
 * Declarations as text (`"y:40; opacity:0; --tint:#e33"`) or an object
 * (`{ y: 40, opacity: 0, blur: '6px', '--tint': '#e33' }`).
 */
export type Declarations = string | Readonly<Record<string, number | string>>;

export interface EffectDefinition {
  from?: Declarations;
  to?: Declarations;
  /** A name from the ease table or `cubic-bezier(…)`. Default `settle`. */
  ease?: string;
  /** Suggested duration in ms. */
  duration?: number;
  /** Keep this source inside zones and drag scenes (rate effects). Default: follow the timeline. */
  on?: 'view' | 'page' | 'clock';
  /** Part of the element's progress, 0–1. */
  range?: readonly [number, number];
  origin?: string;
}

const declarationText = (d: Declarations | undefined): string | null =>
  d === undefined
    ? null
    : typeof d === 'string'
      ? d
      : Object.entries(d)
          .map(([k, v]) => `${k}:${v}`)
          .join(';');

function fromDefinition(def: EffectDefinition, report: Report): Effect {
  const fromText = declarationText(def.from);
  const toText = declarationText(def.to);
  const from = parseDeclarations(fromText, report);
  const to = parseDeclarations(toText, report);
  const ease = def.ease === undefined ? settle : parseEase(def.ease);
  if (!ease) report(`Unknown ease "${def.ease}"`);
  return makeEffect({
    tracks: tracksBetween(from, to),
    vars: varsBetween(parseVars(fromText, report), parseVars(toText, report), report),
    ease: ease ?? settle,
    own: def.on ?? null,
    origin: def.origin ?? null,
    duration: def.duration ?? null,
    ...(def.range ? { range: def.range } : {}),
  });
}

export const NAME = /^[a-z][a-z0-9-]*$/;
const custom = new Set<string>();
const definedListeners = new Set<(name: string) => void>();
/** Stages rebuild when a preset they may use is defined after them. */
export const onEffectDefined = (listener: (name: string) => void): (() => void) => {
  definedListeners.add(listener);
  return () => definedListeners.delete(listener);
};

/**
 * Register a preset usable in `fx`, `exit` and `loop`. A function receives the item's arguments
 * (`fx="swing(left, 12)"` → `['left', '12']`). Names are lowercase; built-in names cannot be replaced.
 */
export function defineEffect(
  name: string,
  definition:
    | EffectDefinition
    | readonly EffectDefinition[]
    | ((args: readonly string[]) => EffectDefinition | readonly EffectDefinition[])
): void {
  if (!NAME.test(name))
    throw new TypeError(`defineEffect: "${name}" is not a valid name (a-z, 0-9, -)`);
  if (presets.has(name) && !custom.has(name)) {
    throw new TypeError(`defineEffect: "${name}" is a built-in preset`);
  }
  custom.add(name);
  presets.set(name, (args, report) => {
    const result = typeof definition === 'function' ? definition(args) : definition;
    const list: readonly EffectDefinition[] = Array.isArray(result)
      ? (result as readonly EffectDefinition[])
      : [result as EffectDefinition];
    return list.map((d) => fromDefinition(d, report));
  });
  definedListeners.forEach((listener) => listener(name));
}

// ---- parsing --------------------------------------------------------------------------------------

const VIEW_NAMES: ReadonlySet<string> = new Set([
  'cover',
  'contain',
  'entry',
  'exit',
  'entry-crossing',
  'exit-crossing',
]);

/** Split on commas outside parentheses. */
export function splitTop(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if (c === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

interface ParsedRange {
  range: readonly [number, number];
  view: readonly [ViewEdge, ViewEdge] | null;
}

/** `0% 50%`, `20%`, `entry`, `entry 10% cover 50%`, `cover 20% 80%`. */
function parseRange(text: string): ParsedRange | null {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { range: [0, 1], view: null };
  const pct = (t: string | undefined): number | null => {
    const m = t === undefined ? null : /^(-?\d*\.?\d+)%$/.exec(t);
    return m ? Number(m[1]) / 100 : null;
  };
  const edges: Array<{ name: ViewRangeName | null; offset: number | null }> = [];
  let i = 0;
  while (i < tokens.length && edges.length < 2) {
    const t = tokens[i]!;
    if (VIEW_NAMES.has(t)) {
      const offset = pct(tokens[i + 1]);
      edges.push({ name: t as ViewRangeName, offset });
      i += offset === null ? 1 : 2;
    } else {
      const offset = pct(t);
      if (offset === null) return null;
      edges.push({ name: null, offset });
      i += 1;
    }
  }
  if (i < tokens.length || !edges.length) return null;
  const [a, b] = edges as [(typeof edges)[0], (typeof edges)[0] | undefined];
  const named = a.name !== null || (b !== undefined && b.name !== null);
  if (!named) {
    const start = a.offset ?? 0;
    const end = b?.offset ?? 1;
    return { range: [start, end], view: null };
  }
  // A range name alone spans that whole range; a bare second edge stays in the first edge's range.
  const startName = a.name ?? 'cover';
  const start: ViewEdge = { name: startName, offset: a.offset ?? 0 };
  const end: ViewEdge = b
    ? { name: b.name ?? startName, offset: b.offset ?? 1 }
    : { name: startName, offset: 1 };
  return { range: [0, 1], view: [start, end] };
}

export interface ParsedItem {
  name: string;
  args: string[];
  range: ParsedRange;
}

/** One item: `name(args) range`. Null when it cannot be read. */
export function parseItem(item: string): ParsedItem | null {
  const m = /^([a-z][a-z0-9-]*)\s*(?:\(([^()]*)\))?\s*(.*)$/.exec(item);
  const range = m ? parseRange(m[3]!) : null;
  if (!m || !range) return null;
  const parts = m[2] === undefined ? [] : splitTop(m[2]).map((s) => s.trim());
  const args = parts.length === 1 && parts[0] === '' ? [] : parts;
  return { name: m[1]!, args, range };
}

/** Parse one list (`fx`, `exit`, `loop`) into items. Bad items are reported and skipped. */
export function parseItems(text: string | null, report: Report): ParsedItem[] {
  const out: ParsedItem[] = [];
  for (const raw of splitTop(text ?? '')) {
    const item = raw.trim();
    if (!item) continue;
    const parsed = parseItem(item);
    if (parsed) out.push(parsed);
    else report(`Cannot parse fx item "${item}"`);
  }
  return out;
}

/** Effects for an `fx` list. Unknown presets are reported, not thrown. */
export function parseFx(text: string | null, report: Report): Effect[] {
  const out: Effect[] = [];
  // One pass, so messages come in source order.
  for (const raw of splitTop(text ?? '')) {
    if (!raw.trim()) continue;
    const item = parseItem(raw.trim());
    if (!item) {
      report(`Cannot parse fx item "${raw.trim()}"`);
      continue;
    }
    const factory = presets.get(item.name);
    if (!factory) {
      report(`Unknown preset "${item.name}"`, 'unknown-effect');
      continue;
    }
    const made = factory(item.args, (m) => report(m));
    for (const e of Array.isArray(made) ? made : [made]) {
      out.push(applyRange(e, item.range));
    }
  }
  return out;
}

/** An item range narrows the effect's own range (a preset's segments keep their proportions). */
function applyRange(e: Effect, r: ParsedRange): Effect {
  const [a, b] = r.range;
  const [x, y] = e.range;
  return { ...e, range: [a + (b - a) * x, a + (b - a) * y], viewRange: r.view ?? e.viewRange };
}

/** `exit`: raw target values (`opacity:0; y:-40`) or presets played in reverse (`fade, rise`). */
export function parseExit(text: string | null, ease: Ease | null, report: Report): Effect[] {
  if (!text) return [];
  if (text.includes(':')) {
    const target = parseDeclarations(text, report);
    return [
      makeEffect({
        tracks: tracksBetween({}, target),
        vars: varsBetween({}, parseVars(text, report), report),
        ease: ease ?? easeInOut,
      }),
    ];
  }
  return parseFx(text, report).map((e) => asExit(ease ? { ...e, ease } : e));
}

/** `from` / `to`: one effect between two raw states. */
export function parseFromTo(
  from: string | null,
  to: string | null,
  ease: Ease | null,
  report: Report
): Effect | null {
  if (from === null && to === null) return null;
  const tracks = tracksBetween(parseDeclarations(from, report), parseDeclarations(to, report));
  const vars = varsBetween(parseVars(from, report), parseVars(to, report), report);
  if (!Object.keys(tracks).length && !vars.length) return null;
  return makeEffect({ tracks, vars, ease: ease ?? easeInOut });
}

/** Sample effects into WAAPI keyframes (native and clock paths). */
export function sampleKeyframes(
  effects: readonly Effect[],
  select: Select,
  css: (frame: Frame) => Record<string, string>,
  frame: Frame,
  samples = 12
): Keyframe[] {
  const frames: Keyframe[] = [];
  for (let i = 0; i <= samples; i++) {
    const p = i / samples;
    evaluate(effects, p, frame, select);
    frames.push({ offset: p, ...css(frame) });
  }
  return frames;
}
