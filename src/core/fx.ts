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
 * duration) so a short name gives a finished result. Raw values go through `from` / `to`; the
 * page's own @keyframes through `keyframes(name)`; reusable custom presets through `defineEffect()`.
 */
import { cubicBezier, easeInOut, linear, pan, parseEase, settle, type Ease } from './ease';
import type { Report } from './errors';
import {
  applyTrack,
  AXIS,
  isColor,
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
  /**
   * Not a track: `develop` covers the element's pictures until they arrive (media/stills.ts);
   * `invert` blends the element by difference (elements/animate.ts).
   */
  asset: 'develop' | 'invert' | null;
  /**
   * Tracks written for text that starts at its right (vertical-rl): an element whose text starts
   * at its left plays them the other way (`unroll`, elements/animate.ts).
   */
  flow: boolean;
  /**
   * `duotone`: the dark and the light ink. The effect's tracks show the print over the element's
   * images instead of the element (media/stills.ts).
   */
  inks: readonly [string, string] | null;
  /**
   * `keyframes(name)`: the page's @keyframes rule of that name, played on the element's outermost
   * layer (render/keyframes.ts). The effect has no tracks.
   */
  keyframes: string | null;
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
    asset: null,
    flow: false,
    inks: null,
    keyframes: null,
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
    flow: e.flow,
    inks: e.inks,
  };
}

/** The same tracks the other way (from and to swapped), timing kept. */
export function turned(e: Effect): Effect {
  const tracks: Tracks = {};
  for (const [p, from, to] of e.entries) tracks[p] = [to, from];
  return {
    ...e,
    tracks,
    entries: e.entries.map(([p, from, to]) => [p, to, from] as const),
    vars: e.vars.map((v) => ({ ...v, from: v.to, to: v.from }) as VarTrack),
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
  select: Select,
  before = false
): void {
  resetFrame(frame);
  for (const e of effects) {
    const [a, b] = e.range;
    const q =
      b <= a
        ? p > b || (!before && p === b)
          ? 1
          : 0
        : p <= a
          ? 0
          : p >= b
            ? 1
            : (p - a) / (b - a);
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

// Lexicon #25 blur-up: the element's pictures develop from a blurred stand-in once they arrive.
presets.set('develop', () => ({ ...makeEffect({ tracks: {} }), asset: 'develop' }));

// Lexicon #27 duotone: every picture printed in the same two inks, so a set of them reads as one.
// A named pair, a dark and a light colour, or (no arguments) the page's --cv-duotone-dark and
// --cv-duotone-light, else blue. Each image's luminance mixes the inks (media/stills.ts); the
// track presses the print on over the picture as the opacity of its layer, so it runs on the
// compositor. Not motion: kept under reduced motion.
const INKS: Readonly<Record<string, readonly [string, string]>> = {
  blue: ['#0f1d45', '#a9cfea'],
  orange: ['#1a120e', '#f08a2c'],
  terracotta: ['#1d1814', '#d4673f'],
  mono: ['#000', '#fff'],
};
presets.set('duotone', (args, report) => {
  const [dark, light] = INKS.blue!;
  let inks: readonly [string, string] = [
    `var(--cv-duotone-dark,${dark})`,
    `var(--cv-duotone-light,${light})`,
  ];
  if (args.length === 1 && INKS[args[0]!]) inks = INKS[args[0]!]!;
  else if (args.length === 2 && args.every(isColor)) inks = [args[0]!, args[1]!];
  else if (args.length) {
    report(
      `duotone(${args.join(', ')}): expected ${Object.keys(INKS).join(', ')}, or a dark and a light colour`
    );
  }
  return { ...makeEffect({ tracks: { opacity: [0, 1] }, duration: 900 }), inks };
});

// Lexicon #35 vertical writing: a strip longer than its window unrolls across it, start first, as a
// hand scroll is read. It starts moved by the window's width less its own, 100cqw − 100% (the
// window is the nearest size container: the author's, else the stage's frame), and ends in place,
// so nothing is measured. Written for columns from right to left (vertical-rl); a strip that starts
// at its left (vertical-lr, left-to-right lines) runs the other way. It follows the scene's
// passage; `contain` keeps it to a held scene's hold, as the lexicon does. Like a track (#5) it is
// the reader's own scroll, so it stays under reduced motion.
presets.set('unroll', () => ({
  ...makeEffect({ tracks: { xw: [100, 0], xp: [-100, 0] }, ease: linear, own: 'view' }),
  flow: true,
}));

// Lexicon #40 difference inversion: the element shows the inverse of what is behind it (white
// minus the backdrop), so it reads on photos, white and black alike; mid grey is its blind spot.
// Not a track: the element blends by difference and its scene is isolated, so the blend stays
// within the scene (elements/animate.ts). An inversion across scenes sits outside them.
presets.set('invert', () => ({ ...makeEffect({ tracks: {} }), asset: 'invert' }));

// Plan v3 §3.3: the page's own @keyframes, by name, played on a layer of its own outside the
// others and following its progress like any preset: a source, a range, a duration. `ease` times
// each of its segments, as animation-timing-function does; linear without it. Where entrances
// shorten to a fade under reduced motion it is left out (it may be motion); on scroll it stays
// (elements/animate.ts).
const IDENT = /^-?[_a-zA-Z][\w-]*$/;
presets.set('keyframes', (args, report) => {
  const arg = args[0] ?? '';
  const quoted = /^(["'])(.+)\1$/.exec(arg);
  if (args.length !== 1 || !(quoted || IDENT.test(arg))) {
    report(`keyframes(${args.join(', ')}): expected the name of an @keyframes rule`);
    return [];
  }
  return { ...makeEffect({ tracks: {}, ease: linear }), keyframes: quoted ? quoted[2]! : arg };
});

// Lexicon #9 path drawing: each stroke draws itself. The shapes measure 1 (pathLength, set by
// elements/animate.ts), so one dash offset draws any of them without measuring it.
presets.set('draw', () => makeEffect({ tracks: { draw: [0, 1] }, ease: pan, duration: 1400 }));

// Lexicon #13 scroll-triggered count: the number rolls up on digit wheels drawn over it (text/
// count.ts), .17 s a digit (elements/animate.ts counts them). Reduced motion shows the number.
presets.set('count', () =>
  makeEffect({ tracks: { count: [0, 1] }, ease: linear, reducible: true })
);

// Lexicon #33 variable fonts: an axis is a continuous value. axis(wght 300 800, wdth 75 100); one
// value is where the axis starts, and it ends at the text's own (wght, wdth, opsz: NaN here,
// resolved by withOwnAxes). `axis` alone brings the weight up from 200, on the lexicon's sweep
// curve (its weight sweep takes 2.8 s for three such legs).
const SWEEP = cubicBezier(0.45, 0, 0.2, 1);
const OWN_AXES: ReadonlySet<string> = new Set(['wght', 'wdth', 'opsz']);
presets.set('axis', (args, report) => {
  const vars: VarTrack[] = [];
  for (const arg of args.length ? args : ['wght 200']) {
    const [tag = '', ...values] = arg.split(/\s+/);
    const numbers = values.map(Number);
    const [from = 0, to = Number.NaN] = numbers;
    if (
      !/^[a-zA-Z\d]{4}$/.test(tag) ||
      !numbers.length ||
      numbers.length > 2 ||
      !numbers.every(Number.isFinite)
    ) {
      report(`axis(${arg}): expected an axis and one or two numbers, such as wght 300 800`);
    } else if (numbers.length === 1 && !OWN_AXES.has(tag)) {
      report(`axis(${arg}): ${tag} needs a start and an end value`);
    } else {
      vars.push({ name: `${AXIS}${tag}`, from, to, unit: '' });
    }
  }
  return makeEffect({ tracks: {}, vars, ease: SWEEP, duration: 1100 });
});

/** Axes left to the text (NaN) take its own values: `own(tag)` (lexicon #33). */
export function withOwnAxes(e: Effect, own: (tag: string) => number): Effect {
  const left = (v: VarTrack): boolean =>
    v.unit !== null && (Number.isNaN(v.from) || Number.isNaN(v.to));
  if (!e.vars.some(left)) return e;
  const value = (name: string, n: number): number =>
    Number.isNaN(n) ? own(name.slice(AXIS.length)) : n;
  const vars = e.vars.map((v) =>
    v.unit === null ? v : { ...v, from: value(v.name, v.from), to: value(v.name, v.to) }
  );
  return { ...e, vars };
}

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
  // One level of nested parentheses, so a functional-notation colour such as
  // `duotone(oklch(.2 .05 250), oklch(.9 .05 250))` stays one item.
  const m = /^([a-z][a-z0-9-]*)\s*(?:\(((?:[^()]|\([^()]*\))*)\))?\s*(.*)$/.exec(item);
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

/** Effects without `keyframes()`, which plays in `fx` only: reported for `exit` and `loop`. */
export function withoutKeyframes(effects: Effect[], list: string, report: Report): Effect[] {
  return effects.filter((e) => {
    if (e.keyframes) report(`keyframes(${e.keyframes}) plays in fx, not ${list}`);
    return !e.keyframes;
  });
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
  return withoutKeyframes(parseFx(text, report), 'exit', report).map((e) =>
    asExit(ease ? { ...e, ease } : e)
  );
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

/** Sample within each authored range; duplicate offsets preserve a step's left and right values. */
export function samplePoints(
  effects: readonly Effect[],
  samples = 12
): Array<{ offset: number; before: boolean }> {
  const points = new Set<number>();
  const steps = new Set<number>();
  const add = (p: number): void => {
    if (p >= 0 && p <= 1) points.add(p);
  };
  for (let i = 0; i <= samples; i++) add(i / samples);
  for (const {
    range: [a, b],
  } of effects) {
    if (b <= a) {
      if (b >= 0 && b <= 1) {
        points.add(b);
        steps.add(b);
      }
    } else {
      for (let i = 0; i <= samples; i++) add(i === samples ? b : a + ((b - a) * i) / samples);
    }
  }
  return [...points]
    .sort((a, b) => a - b)
    .flatMap((offset) =>
      steps.has(offset)
        ? [
            { offset, before: true },
            { offset, before: false },
          ]
        : [{ offset, before: false }]
    );
}

/** Sample effects into WAAPI keyframes (native and clock paths). */
export function sampleKeyframes(
  effects: readonly Effect[],
  select: Select,
  css: (frame: Frame) => Record<string, string>,
  frame: Frame,
  samples = 12
): Keyframe[] {
  return samplePoints(effects, samples).map(({ offset, before }) => {
    evaluate(effects, offset, frame, select, before);
    return { offset, ...css(frame) };
  });
}
