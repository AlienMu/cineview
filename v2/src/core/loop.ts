/**
 * `loop`: ambient motion on the clock, after the entrance (plan v3 §4.2: clock layers sit inside
 * space and time, so a loop runs around wherever the element has arrived).
 *
 *   loop="float"                                   a loop preset
 *   loop="pulse(strong), breathe"                  several, each its own animation
 *   loop="push(in)"                                any fx preset, played there and back
 *   loop="opacity: 1 .45 1; scale: 1 1.45 1"       raw keyframe lists (1.x loopAnimation arrays)
 *   loop="--glow: 0 1 0"                           custom properties, for author CSS to consume
 *
 * Each item becomes one infinite WAAPI animation. `loop-duration` sets the cycle length; the
 * element's `ease` applies per segment (default ease-in-out, as 1.x loops).
 */
import { easeInOut, type Ease } from './ease';
import { parseFx, parseItem, splitTop } from './fx';
import {
  frameCss,
  IDENTITY,
  identityFrame,
  NO_CLIP,
  parseDeclarations,
  resetFrame,
  type Clip,
  type Prop,
  type Value,
} from './props';

export interface LoopItem {
  keyframes: Keyframe[];
  /** One cycle, ms. */
  duration: number;
}

type Report = (message: string) => void;

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

/** `opacity: 1 .45 1; x: 0 -100% 0; --glow: 0 1 0`. */
function parseRaw(text: string, report: Report): Omit<Lists, 'easing' | 'duration'> {
  const props: Partial<Record<Prop, Value[]>> = {};
  const custom: Record<string, string[]> = {};
  for (const pair of text.split(';')) {
    if (!pair.trim()) continue;
    const colon = pair.indexOf(':');
    const key = pair.slice(0, colon).trim();
    const values = pair
      .slice(colon + 1)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (colon < 0 || !values.length) {
      report(`Cannot read loop "${pair.trim()}"`);
      continue;
    }
    if (key.startsWith('--')) {
      custom[key] = values;
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
  return { props, custom };
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
  const easing = ease?.css ?? easeInOut.css ?? 'ease-in-out';
  if (text.includes(':')) {
    const raw = parseRaw(text, report);
    return [{ keyframes: frames({ ...raw, easing, duration: 0 }), duration: duration ?? 3000 }];
  }
  const items: LoopItem[] = [];
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
      items.push({
        keyframes: frames({ ...lists, easing: ease ? easing : (lists.easing ?? easing) }),
        duration: duration ?? lists.duration,
      });
      continue;
    }
    // Any fx preset: from → to → from.
    const effects = parseFx(part.trim(), report);
    if (!effects.length) continue;
    const props: Partial<Record<Prop, Value[]>> = {};
    for (const e of effects) {
      for (const [p, from, to] of e.entries) props[p] = [from, to, from];
    }
    const own = effects.reduce((m, e) => Math.max(m, e.duration ?? 0), 0) || 1500;
    items.push({
      keyframes: frames({ props, custom: {}, easing, duration: 0 }),
      duration: duration ?? own * 2,
    });
  }
  return items;
}
