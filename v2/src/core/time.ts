/**
 * Scene timeline solver.
 *
 * Every timed element of a scene gets an entrance window on one time axis (ms). Positions come from
 * `delay`, `after="name ±offset"` (or the scene's `sequence`), stagger tails, and optional `at`
 * fractions of the whole timeline (1.x `timeline.phase`). Solved once per structure change, never
 * per frame.
 *
 * Kept from 1.x (site docs: zones-budget, orchestration, two-track):
 * - a follower waits for its predecessor's entrance end, never its exit, then adds its own delay;
 * - in a zone, an element's exit follows its own entrance; an `at` element's exit ends with the zone;
 * - `at` is a fraction of the total, and the total grows until every window fits
 *   (T >= fraction·T + constant, solved directly);
 * - unsolvable declarations fail open: reported, then ignored. The solver never throws.
 *
 * New in 2.0: negative `after` offsets (overlap), scene `sequence`, and stagger expressed as
 * fractions of the element's own progress, so staggered children follow every time source,
 * scrubbed ones included.
 */

export type StaggerFrom = 'first' | 'last' | 'center';

/** Report an unreadable declaration; the caller attaches the element and its code. */
export type TimeReport = (message: string, code?: 'invalid-attribute' | 'bad-at') => void;

export interface TimeSpec {
  name: string | null;
  /** Entrance duration (ms). At least 1 ms on the timeline, as in 1.x. */
  duration: number;
  /** Added after the predecessor's end, or after 0 (ms, >= 0). */
  delay: number;
  after: { name: string; offset: number } | null;
  /** Entrance window as fractions of the scene timeline; an omitted end keeps the authored timing. */
  at: { start?: number; end?: number } | null;
  /** 0 when no exit is declared. */
  exitDuration: number;
  stagger: { each: number; from: StaggerFrom; count: number } | null;
}

export interface SolveOptions {
  /** Scene `sequence`: elements without `after` follow the previous one (gap in ms, may be negative). */
  sequence?: number | null;
  /**
   * Zone (scroll input): exits occupy scene time and count toward the total. Drag input: exits run
   * on the departure (page travel) instead, so the total is the entrance total (1.x two-track).
   */
  exitsOnTimeline?: boolean;
  /** The scene lasts at least this long (a `track="x"` scene: its travel, 1 px per ms). */
  span?: number;
}

export interface Solved {
  /** Entrance window on the scene timeline. */
  start: number;
  end: number;
  /** Exit window on the scene timeline (zones). Equal to `end` when there is no exit. */
  exitStart: number;
  exitEnd: number;
  exitDuration: number;
  /** Staggered children: child k plays over [from[k], to[k]] of this element's progress. */
  items: { from: number[]; to: number[] } | null;
  /** Index of the element this one follows (`after` or `sequence`), or -1. */
  predecessor: number;
}

export type TimeErrorCode =
  'duplicate-name' | 'missing-after' | 'cycle' | 'unbounded-at' | 'bad-at';

export interface TimeError {
  code: TimeErrorCode;
  index: number;
  message: string;
}

export interface SceneSolution {
  /** Latest entrance end. */
  entranceEnd: number;
  /** Scroll distance of a zone (1 ms = 1 px), or the drag element total. */
  total: number;
  byIndex: Solved[];
  errors: TimeError[];
}

// ---- attribute parsing ------------------------------------------------------------------------

/**
 * `600`, `600ms`, `0.6s` → ms. A missing value returns `fallback` silently; an unreadable one is
 * reported and then falls back, so a typo (`duration="fast"`) never looks like a working value.
 */
export function parseMs(text: string | null, fallback: number, report?: TimeReport): number {
  if (text === null) return fallback;
  const m = /^\s*(-?\d*\.?\d+)\s*(ms|s)?\s*$/.exec(text);
  if (!m) {
    report?.(`"${text.trim()}": expected a time such as 600, 600ms or 0.6s; using ${fallback}`);
    return fallback;
  }
  const n = Number(m[1]) * (m[2] === 's' ? 1000 : 1);
  return Number.isFinite(n) ? n : fallback;
}

/** `title`, `title -400`, `title + 120ms`. */
export function parseAfter(text: string | null, report?: TimeReport): TimeSpec['after'] {
  if (!text?.trim()) return null;
  const m = /^\s*([\w-]+)\s*(?:([+-])\s*(\d*\.?\d+\s*(?:ms|s)?))?\s*$/.exec(text);
  if (!m) {
    report?.(`after="${text}": expected a name with an optional time offset, such as "title -400"`);
    return null;
  }
  const offset = m[3] ? parseMs(m[3], 0, report) * (m[2] === '-' ? -1 : 1) : 0;
  return { name: m[1]!, offset };
}

/** `40`, `40 center`, `last 60ms`. Count is filled in by the caller. */
export function parseStagger(
  text: string | null,
  report?: TimeReport
): { each: number; from: StaggerFrom } | null {
  if (text === null) return null;
  let each = 40;
  let from: StaggerFrom = 'first';
  for (const token of text.trim().split(/\s+/)) {
    if (!token) continue;
    if (token === 'first' || token === 'last' || token === 'center') from = token;
    else each = Math.max(0, parseMs(token, each, report));
  }
  return { each, from };
}

/**
 * `20% 80%`, `20%` (start only), `auto 80%` (end only).
 *
 * Every value must carry `%`: `at="20 80"` is a typo, not a fraction. A bad token is reported and
 * the whole `at` is ignored (the element keeps its chain timing), so the scene's solved total stays
 * finite — an unreadable `at` used to poison every window in the scene.
 */
export function parseAt(text: string | null, report?: TimeReport): TimeSpec['at'] {
  if (!text) return null;
  let bad = false;
  const read = (token: string | undefined): number | undefined => {
    if (token === undefined || token === 'auto') return undefined;
    const m = /^(\d*\.?\d+)%$/.exec(token);
    if (!m) {
      bad = true;
      return undefined;
    }
    return Math.min(Math.max(Number(m[1]) / 100, 0), 1);
  };
  const [a, b] = text.trim().split(/\s+/);
  const start = read(a);
  const end = read(b);
  if (bad) {
    report?.(
      `at="${text.trim()}": expected percentages such as "20% 80%"; the whole \`at\` is ignored`,
      'bad-at'
    );
    return null;
  }
  const at: { start?: number; end?: number } = {};
  if (start !== undefined) at.start = start;
  if (end !== undefined) at.end = end;
  return at;
}

// ---- linear terms: a time is max over terms of (f·T + c), T = the solved total ---------------------

interface Term {
  f: number;
  c: number;
  /** Index of the element whose `at` introduced the fraction (to reject it if unsolvable). */
  owner: number;
}
type Expr = Term[];

const constant = (c: number): Expr => [{ f: 0, c, owner: -1 }];
const shift = (e: Expr, d: number): Expr => e.map((t) => ({ f: t.f, c: t.c + d, owner: t.owner }));
const maximum = (...exprs: Expr[]): Expr => {
  const byFraction = new Map<number, Term>();
  for (const e of exprs) {
    for (const t of e) {
      const kept = byFraction.get(t.f);
      if (!kept || kept.c < t.c) byFraction.set(t.f, t);
    }
  }
  return [...byFraction.values()];
};
const valueAt = (e: Expr, total: number): number =>
  e.reduce((m, t) => {
    const v = t.f * total + t.c;
    // A non-finite term never wins: Math.max(x, NaN) is NaN, which would poison the whole scene.
    return Number.isFinite(v) ? Math.max(m, v) : m;
  }, Number.NEGATIVE_INFINITY);

const nonNegative = (n: number): number => (Number.isFinite(n) ? Math.max(0, n) : 0);

function staggerItems(spec: TimeSpec): { tail: number; items: Solved['items'] } {
  const s = spec.stagger;
  if (!s || s.count < 1) return { tail: 0, items: null };
  const order = (k: number): number =>
    s.from === 'last' ? s.count - 1 - k : s.from === 'center' ? Math.abs(k - (s.count - 1) / 2) : k;
  let last = 0;
  for (let k = 0; k < s.count; k++) last = Math.max(last, order(k));
  const tail = last * nonNegative(s.each);
  const item = Math.max(nonNegative(spec.duration), 1);
  const span = tail + item;
  const from: number[] = [];
  const to: number[] = [];
  for (let k = 0; k < s.count; k++) {
    const begin = order(k) * nonNegative(s.each);
    from.push(begin / span);
    to.push((begin + item) / span);
  }
  return { tail, items: { from, to } };
}

// ---- solver ---------------------------------------------------------------------------------------

export function solveScene(specs: readonly TimeSpec[], options: SolveOptions = {}): SceneSolution {
  const exitsOnTimeline = options.exitsOnTimeline ?? true;
  const errors: TimeError[] = [];
  const n = specs.length;

  const byName = new Map<string, number>();
  specs.forEach((s, i) => {
    if (!s.name) return;
    if (byName.has(s.name)) {
      errors.push({
        code: 'duplicate-name',
        index: i,
        message: `Duplicate name "${s.name}" in scene`,
      });
    } else byName.set(s.name, i);
  });

  // Predecessor graph: explicit `after`, else the previous element under `sequence`.
  const predecessor = new Array<number>(n).fill(-1);
  const lead = new Array<number>(n).fill(0);
  specs.forEach((s, i) => {
    if (s.after) {
      const dep = byName.get(s.after.name);
      if (dep === undefined) {
        errors.push({
          code: 'missing-after',
          index: i,
          message: `after="${s.after.name}" does not match a name in this scene`,
        });
      } else {
        predecessor[i] = dep;
        lead[i] = Number.isFinite(s.after.offset) ? s.after.offset : 0;
      }
    } else if (options.sequence !== undefined && options.sequence !== null && i > 0) {
      predecessor[i] = i - 1;
      lead[i] = options.sequence;
    }
  });

  // Each element has at most one predecessor, so cycles are found by walking pointers. Every member
  // of a cycle fails open (keeps only its own delay); followers outside the cycle still follow.
  const state = new Array<0 | 1 | 2>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const path: number[] = [];
    let j = i;
    while (j !== -1 && state[j] === 0) {
      state[j] = 1;
      path.push(j);
      j = predecessor[j]!;
    }
    if (j !== -1 && state[j] === 1) {
      const cycle = path.slice(path.indexOf(j));
      for (const k of cycle) {
        errors.push({
          code: 'cycle',
          index: k,
          message: `Circular after dependency at "${specs[k]!.name ?? k}"`,
        });
        predecessor[k] = -1;
      }
    }
    for (const k of path) state[k] = 2;
  }

  const stagger = specs.map(staggerItems);
  const invalidAt = new Set<number>();

  // Build start/completion expressions; repeat while some `at` cannot fit in any finite total.
  let starts: Expr[] = [];
  let completions: Expr[] = [];
  let total = 0;
  for (;;) {
    starts = new Array<Expr>(n);
    completions = new Array<Expr>(n);
    const extents: Expr[] = [];
    const resolve = (i: number): Expr => {
      const done = completions[i];
      if (done) return done;
      const spec = specs[i]!;
      const dep = predecessor[i]!;
      const base = dep === -1 ? constant(0) : shift(resolve(dep), lead[i]!);
      const chainStart = maximum(shift(base, nonNegative(spec.delay)), constant(0));
      const length = Math.max(nonNegative(spec.duration), 1) + stagger[i]!.tail;
      const nominalEnd = shift(chainStart, length);
      const exit = exitsOnTimeline ? nonNegative(spec.exitDuration) : 0;
      extents.push(shift(nominalEnd, exit));
      let start = chainStart;
      let completion = nominalEnd;
      const at = invalidAt.has(i) ? null : spec.at;
      if (at && (at.start !== undefined || at.end !== undefined)) {
        if (at.start !== undefined) {
          start = maximum([{ f: at.start, c: 0, owner: i }], dep === -1 ? [] : chainStart);
        }
        completion = maximum(
          at.end === undefined ? nominalEnd : [{ f: at.end, c: 0, owner: i }],
          shift(start, 1)
        );
        // The window must be reachable, and a declared exit needs at least 1 ms after it.
        extents.push(shift(completion, exit > 0 ? 1 : 0));
      }
      starts[i] = start;
      completions[i] = completion;
      return completion;
    };
    for (let i = 0; i < n; i++) resolve(i);

    total = nonNegative(options.span ?? 0);
    const before = invalidAt.size;
    for (const e of extents) {
      for (const t of e) {
        const required = !Number.isFinite(t.f)
          ? Number.POSITIVE_INFINITY
          : t.f < 1
            ? t.c / (1 - t.f)
            : t.c <= 0
              ? 0
              : Number.POSITIVE_INFINITY;
        if (Number.isFinite(required)) total = Math.max(total, required);
        else if (t.owner !== -1) invalidAt.add(t.owner);
      }
    }
    if (invalidAt.size === before) break;
  }
  for (const i of invalidAt) {
    errors.push({
      code: 'unbounded-at',
      index: i,
      message: `at="${formatAt(specs[i]!.at)}" leaves no room for what follows; ignored`,
    });
  }

  const byIndex: Solved[] = specs.map((spec, i) => {
    const start = valueAt(starts[i]!, total);
    const end = valueAt(completions[i]!, total);
    const exitDuration = nonNegative(spec.exitDuration);
    const pinned =
      spec.at !== null &&
      !invalidAt.has(i) &&
      Number.isFinite(spec.at.start ?? 0) &&
      Number.isFinite(spec.at.end ?? 1) &&
      exitsOnTimeline;
    let exitStart = end;
    let exitEnd = end + exitDuration;
    if (exitDuration > 0 && pinned) {
      // 1.x: an `at` element's exit is reserved at the end of the zone.
      exitEnd = total;
      exitStart = Math.max(end, total - exitDuration);
    }
    return {
      start,
      end,
      exitStart,
      exitEnd: exitDuration > 0 ? exitEnd : end,
      exitDuration,
      items: stagger[i]!.items,
      predecessor: predecessor[i]!,
    };
  });

  let entranceEnd = 0;
  for (const s of byIndex) entranceEnd = Math.max(entranceEnd, s.end);
  // Last line of defence: a non-finite total would make a zone one screen tall and freeze its time.
  if (!Number.isFinite(entranceEnd) || !Number.isFinite(total)) {
    let safe = 0;
    for (const s of byIndex) if (Number.isFinite(s.end)) safe = Math.max(safe, s.end);
    errors.push({
      code: 'bad-at',
      index: -1,
      message: 'scene time did not solve to a finite total; timing restarts from entrances',
    });
    return { entranceEnd: safe, total: safe, byIndex, errors };
  }
  return { entranceEnd, total: Math.max(total, entranceEnd), byIndex, errors };
}

function formatAt(at: TimeSpec['at']): string {
  const pct = (v: number | undefined): string => (v === undefined ? 'auto' : `${v * 100}%`);
  return at ? `${pct(at.start)} ${pct(at.end)}` : '';
}
