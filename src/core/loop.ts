/**
 * `loop`: ambient motion on the clock, after the entrance (plan v3 §4.2: clock layers sit inside
 * space and time, so a loop runs around wherever the element has arrived).
 *
 *   loop="float"                                   a loop preset
 *   loop="pulse(strong), breathe"                  several, each its own period
 *   loop="push(in)"                                any fx preset, played there and back
 *   loop="opacity: 1 .45 1; scale: 1 1.45 1"       raw keyframe lists (1.x loopAnimation arrays)
 *   loop="--glow: 0 1 0; --tint: #e33 #36c #e33"   custom properties, for author CSS to consume
 *
 * Disjoint items use native animations. Overlapping outputs are evaluated and composed once per clock tick. `loop-duration` sets the cycle length; the
 * element's `ease` applies per segment (default ease-in-out, as 1.x loops). Custom properties with
 * numbers or colours run as an item of their own, sampled once per 60 Hz frame (an unregistered
 * property steps between keyframes; colours go around the OKLCH hue circle as in from/to);
 * `--cv-axis-<tag>` lists are written as variable-font axes (props.ts).
 */
import { easeInOut, parseEase, type Ease } from './ease';
import type { Report } from './errors';
import { parseFx, parseItem, splitTop, withoutKeyframes } from './fx';
import {
  applyTrack,
  combine,
  frameCss,
  IDENTITY,
  identityFrame,
  NO_CLIP,
  parseDeclarations,
  parseVarValue,
  resetFrame,
  varsCss,
  varValue,
  type Frame,
  type Clip,
  type Prop,
  type Value,
  type VarTrack,
  type VarValue,
} from './props';

export interface LoopItem {
  keyframes: Keyframe[];
  /** One cycle, ms. */
  duration: number;
  /** Custom properties the item writes. */
  vars: string[];
  used: Prop[];
  sample(progress: number, frame: Frame): void;
}

/** Interpolable custom property lists: numbers in one unit, or colours. */
type VarLists = Record<string, VarValue[]>;

/** Keyframe lists per property; custom properties keep their raw text. */
interface Lists {
  props: Partial<Record<Prop, Value[]>>;
  custom: Record<string, string[]>;
  easing: string;
  duration: number;
}

const level = (
  arg: string | undefined,
  values: [number, number, number],
  report: Report,
  name: string
): number => {
  if (arg === undefined || arg === '') return values[1];
  if (arg === 'soft') return values[0];
  if (arg === 'strong') return values[2];
  const n = Number.parseFloat(arg);
  if (Number.isFinite(n)) return n;
  report(`${name}(${arg}): expected soft, strong or a number`);
  return values[1];
};

const LOOPS: Readonly<
  Record<
    string,
    (args: readonly string[], report: Report) => Omit<Lists, 'easing'> & { easing?: string }
  >
> = {
  float: (args, report) => {
    const a = level(args[0], [4, 8, 16], report, 'float');
    return { props: { y: [0, -a, 0] }, custom: {}, duration: 4000 };
  },
  sway: (args, report) => {
    const a = level(args[0], [1.5, 3, 6], report, 'sway');
    return { props: { rotate: [0, a, 0, -a, 0] }, custom: {}, duration: 5000 };
  },
  pulse: (args, report) => {
    const a = level(args[0], [0.02, 0.04, 0.08], report, 'pulse');
    return { props: { scale: [1, 1 + a, 1] }, custom: {}, duration: 2000 };
  },
  breathe: (args, report) => {
    const a = level(args[0], [0.2, 0.4, 0.6], report, 'breathe');
    return { props: { opacity: [1, 1 - a, 1] }, custom: {}, duration: 3000 };
  },
  spin: (args) => {
    const turn = args[0] === 'left' || args[0] === 'ccw' ? -360 : 360;
    return { props: { rotate: [0, turn] }, custom: {}, duration: 8000, easing: 'linear' };
  },
};

export const loopNames = (): string[] => Object.keys(LOOPS);

/** Split on spaces outside parentheses: `#e33 oklch(.7 .1 200)` is two values. */
function words(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let word = '';
  for (const c of text) {
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    if (/\s/.test(c) && depth === 0) {
      if (word) out.push(word);
      word = '';
    } else {
      word += c;
    }
  }
  if (word) out.push(word);
  return out;
}

/** Values all numbers in one unit (bare numbers join it) or all colours; null otherwise. */
function interpolable(values: readonly string[]): VarValue[] | null {
  const parsed = values.map(parseVarValue);
  if (parsed.some((v) => v === null)) return null;
  const list = parsed as VarValue[];
  if (list.every((v) => 'color' in v)) return list;
  if (list.some((v) => 'color' in v)) return null;
  const units = new Set(list.map((v) => ('unit' in v ? v.unit : '')).filter(Boolean));
  if (units.size > 1) return null;
  const unit = [...units][0] ?? '';
  return list.map((v) => ({ n: 'n' in v ? v.n : 0, unit }));
}

/** `opacity: 1 .45 1; x: 0 -100% 0; --glow: 0 1 0`. */
function parseRaw(
  text: string,
  report: Report
): Omit<Lists, 'easing' | 'duration'> & { vars: VarLists } {
  const props: Partial<Record<Prop, Value[]>> = {};
  const custom: Record<string, string[]> = {};
  const vars: VarLists = {};
  for (const pair of text.split(';')) {
    if (!pair.trim()) continue;
    const colon = pair.indexOf(':');
    const key = pair.slice(0, colon).trim();
    const values = words(pair.slice(colon + 1).trim());
    if (colon < 0 || !values.length) {
      report(`Cannot read loop "${pair.trim()}"`);
      continue;
    }
    if (key.startsWith('--')) {
      const list = interpolable(values);
      if (list) vars[key] = list;
      else custom[key] = values;
      continue;
    }
    // Reuse the declaration reader per value so units behave exactly as in from/to. One key can
    // land on two tracks (x: 0 -100% → x and xp); keep them index-aligned, identity where unused.
    const records = values.map((v) => parseDeclarations(`${key}:${v}`, report));
    const touched = new Set(records.flatMap((r) => Object.keys(r) as Prop[]));
    for (const p of touched) {
      props[p] = records.map((r) => r[p] ?? (p === 'clip' ? NO_CLIP : IDENTITY[p]));
    }
  }
  return { props, custom, vars };
}

/**
 * Custom property lists as their own keyframes, one per 60 Hz frame of the cycle, the ease
 * applied per segment in the samples (the browser would only flip an unregistered property).
 */
function varFrames(lists: VarLists, ease: Ease, duration: number): Keyframe[] {
  const n = Math.max(2, ...Object.values(lists).map((v) => v.length));
  const per = Math.max(2, Math.ceil(duration / (n - 1) / (1000 / 60)));
  const at = (values: VarValue[], i: number): VarValue => values[Math.min(i, values.length - 1)]!;
  const track = (name: string, a: VarValue, b: VarValue): VarTrack =>
    'color' in a
      ? { name, from: a.color, to: (b as { color: string }).color, unit: null }
      : { name, from: a.n, to: (b as { n: number }).n, unit: a.unit };
  const out: Keyframe[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < per; k++) {
      const t = ease(k / per);
      const frame: Keyframe = { offset: (i + k / per) / (n - 1), easing: 'linear' };
      varsCss(
        Object.entries(lists).map(([name, values]): [string, string] => [
          name,
          varValue(track(name, at(values, i), at(values, i + 1)), t),
        ]),
        frame
      );
      out.push(frame);
    }
  }
  const last: Keyframe = { offset: 1 };
  varsCss(
    Object.entries(lists).map(([name, values]): [string, string] => {
      const v = at(values, n - 1);
      return [name, 'color' in v ? v.color : `${v.n}${v.unit}`];
    }),
    last
  );
  out.push(last);
  return out;
}

/** Pad every list to the longest one by holding its last value. */
function frames(lists: Lists): Keyframe[] {
  const lengths = [
    ...Object.values(lists.props).map((v) => v!.length),
    ...Object.values(lists.custom).map((v) => v.length),
  ];
  const n = Math.max(2, ...lengths);
  const used = new Set(Object.keys(lists.props) as Prop[]);
  const frame = identityFrame();
  const out: Keyframe[] = [];
  for (let i = 0; i < n; i++) {
    resetFrame(frame);
    for (const [p, values] of Object.entries(lists.props) as Array<[Prop, Value[]]>) {
      const v = values[Math.min(i, values.length - 1)]!;
      if (p === 'clip') frame.clip = v as Clip;
      else frame[p] = v as number;
    }
    const k: Keyframe = { offset: i / (n - 1), ...frameCss(frame, used) };
    for (const [name, values] of Object.entries(lists.custom)) {
      k[name] = values[Math.min(i, values.length - 1)]!;
    }
    if (i < n - 1) k.easing = lists.easing;
    out.push(k);
  }
  return out;
}

/** Keep numeric tracks for overlapping loops, whose outputs share ordinary effect semantics. */
function makeItem(lists: Lists, values: VarLists, curve: Ease, keyframes: Keyframe[]): LoopItem {
  const numeric = Object.entries(lists.props) as Array<[Prop, Value[]]>;
  const custom = Object.entries(lists.custom);
  const n = Math.max(
    2,
    ...numeric.map(([, v]) => v.length),
    ...custom.map(([, v]) => v.length),
    ...Object.values(values).map((v) => v.length)
  );
  const variables = Object.entries(values).map(([name, list]) => {
    const tracks: VarTrack[] = [];
    for (let i = 0; i < n - 1; i++) {
      const a = list[Math.min(i, list.length - 1)]!,
        b = list[Math.min(i + 1, list.length - 1)]!;
      tracks.push(
        'color' in a
          ? { name, from: a.color, to: (b as { color: string }).color, unit: null }
          : { name, from: a.n, to: (b as { n: number }).n, unit: a.unit }
      );
    }
    return { name, tracks };
  });
  return {
    keyframes,
    duration: lists.duration,
    vars: [...custom.map(([name]) => name), ...variables.map(({ name }) => name)],
    used: numeric.map(([prop]) => prop),
    sample(progress, frame): void {
      resetFrame(frame);
      const at = Math.min(1, Math.max(0, progress)) * (n - 1);
      const i = Math.min(n - 2, Math.floor(at)),
        t = curve(at - i);
      for (const [prop, list] of numeric)
        applyTrack(
          frame,
          prop,
          list[Math.min(i, list.length - 1)]!,
          list[Math.min(i + 1, list.length - 1)]!,
          t
        );
      for (const { name, tracks } of variables) frame.vars.set(name, varValue(tracks[i]!, t));
      for (const [name, list] of custom)
        frame.vars.set(name, list[Math.min(t < 0.5 ? i : i + 1, list.length - 1)]!);
    },
  };
}

/** True when independent native animations would replace each other's CSS output. */
export function loopsOverlap(items: readonly LoopItem[]): boolean {
  const seen = new Set<string>();
  for (const item of items) {
    for (const key of Object.keys(item.keyframes[0] ?? {})) {
      if (key === 'offset' || key === 'easing') continue;
      if (seen.has(key)) return true;
      seen.add(key);
    }
  }
  return false;
}

/** Each item keeps its own period; fold evaluated frames once before writing the loop layer. */
export function evaluateLoops(
  items: readonly LoopItem[],
  elapsed: number,
  frame: Frame,
  scratch: Frame
): Frame {
  resetFrame(frame);
  for (const item of items) {
    item.sample((Math.max(0, elapsed) % item.duration) / item.duration, scratch);
    combine(frame, scratch);
  }
  return frame;
}

/**
 * Parse `loop`. `duration` is `loop-duration` (ms) or null for each item's own default; `ease` is
 * the element's ease (its CSS form is used per segment).
 */
export function parseLoop(
  text: string | null,
  duration: number | null,
  ease: Ease | null,
  report: Report
): LoopItem[] {
  if (!text || !text.trim()) return [];
  if (duration !== null && duration <= 0) {
    report('loop-duration must be greater than 0');
    return [];
  }
  const easing = ease?.css ?? easeInOut.css ?? 'ease-in-out';
  const items: LoopItem[] = [];
  const addVars = (lists: VarLists, cycle: number): void => {
    if (!Object.keys(lists).length) return;
    const keyframes = varFrames(lists, ease ?? easeInOut, cycle);
    items.push(
      makeItem(
        { props: {}, custom: {}, easing: 'linear', duration: cycle },
        lists,
        ease ?? easeInOut,
        keyframes
      )
    );
  };
  if (text.includes(':')) {
    const { vars, ...raw } = parseRaw(text, report);
    const cycle = duration ?? 3000;
    if (
      Object.keys(raw.props).length ||
      Object.keys(raw.custom).length ||
      !Object.keys(vars).length
    ) {
      const lists = { ...raw, easing, duration: cycle };
      items.push(makeItem(lists, {}, ease ?? easeInOut, frames(lists)));
    }
    addVars(vars, cycle);
    return items;
  }
  for (const part of splitTop(text)) {
    if (!part.trim()) continue;
    const item = parseItem(part.trim());
    if (!item) {
      report(`Cannot parse loop item "${part.trim()}"`);
      continue;
    }
    const loop = LOOPS[item.name];
    if (loop) {
      const lists = loop(item.args, report);
      const cycle = {
        ...lists,
        easing: ease ? easing : (lists.easing ?? easing),
        duration: duration ?? lists.duration,
      };
      items.push(makeItem(cycle, {}, ease ?? parseEase(cycle.easing) ?? easeInOut, frames(cycle)));
      continue;
    }
    // Any fx preset: from → to → from.
    const effects = withoutKeyframes(parseFx(part.trim(), report), 'loop', report);
    if (!effects.length) continue;
    const props: Partial<Record<Prop, Value[]>> = {};
    const vars: VarLists = {};
    for (const e of effects) {
      for (const [p, from, to] of e.entries) props[p] = [from, to, from];
      for (const v of e.vars) {
        if (v.unit !== null && (Number.isNaN(v.from) || Number.isNaN(v.to))) {
          report(`${part.trim()}: a loop needs both values of each axis`);
          continue;
        }
        const [a, b]: VarValue[] =
          v.unit === null
            ? [{ color: v.from }, { color: v.to as string }]
            : [
                { n: v.from, unit: v.unit },
                { n: v.to as number, unit: v.unit },
              ];
        vars[v.name] = [a!, b!, a!];
      }
    }
    const own = effects.reduce((m, e) => Math.max(m, e.duration ?? 0), 0) || 1500;
    const cycle = duration ?? own * 2;
    if (Object.keys(props).length) {
      const lists = { props, custom: {}, easing, duration: cycle };
      items.push(makeItem(lists, {}, ease ?? easeInOut, frames(lists)));
    }
    addVars(vars, cycle);
  }
  return items;
}
