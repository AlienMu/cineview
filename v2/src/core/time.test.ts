import {
  parseAfter,
  parseAt,
  parseMs,
  parseStagger,
  solveScene,
  type SolveOptions,
  type TimeSpec,
} from './time';

const spec = (over: Partial<TimeSpec> = {}): TimeSpec => ({
  name: null,
  duration: 600,
  delay: 0,
  after: null,
  at: null,
  exitDuration: 0,
  stagger: null,
  ...over,
});
const after = (name: string, offset = 0): TimeSpec['after'] => ({ name, offset });
const solve = (specs: TimeSpec[], options?: SolveOptions) => solveScene(specs, options);

describe('attribute parsing', () => {
  it('reads milliseconds with optional units', () => {
    expect(parseMs('600', 0)).toBe(600);
    expect(parseMs('600ms', 0)).toBe(600);
    expect(parseMs('0.6s', 0)).toBe(600);
    expect(parseMs('fast', 7)).toBe(7);
    expect(parseMs(null, 7)).toBe(7);
  });

  it('reads after with a signed offset', () => {
    expect(parseAfter('title')).toEqual({ name: 'title', offset: 0 });
    expect(parseAfter('title -400')).toEqual({ name: 'title', offset: -400 });
    expect(parseAfter(' title + 0.12s ')).toEqual({ name: 'title', offset: 120 });
    expect(parseAfter(null)).toBeNull();
    expect(parseAfter('a b')).toBeNull();
  });

  it('reads stagger and at', () => {
    expect(parseStagger('')).toEqual({ each: 40, from: 'first' });
    expect(parseStagger('80 center')).toEqual({ each: 80, from: 'center' });
    expect(parseStagger('last 0.1s')).toEqual({ each: 100, from: 'last' });
    expect(parseStagger(null)).toBeNull();
    expect(parseAt('20% 80%')).toEqual({ start: 0.2, end: 0.8 });
    expect(parseAt('20%')).toEqual({ start: 0.2 });
    expect(parseAt('auto 80%')).toEqual({ end: 0.8 });
    expect(parseAt('nope')!.start).toBeNaN();
  });
});

// Cases ported from 1.x sceneScrollBudget tests (same numbers, 2.0 vocabulary).
describe('solveScene: 1.x zone semantics', () => {
  it('is empty without elements', () => {
    expect(solve([])).toMatchObject({ total: 0, entranceEnd: 0, byIndex: [], errors: [] });
  });

  it('maps delay + duration to the zone at 1 ms = 1 px', () => {
    const s = solve([spec({ delay: 100, duration: 300 })]);
    expect(s.total).toBe(400);
    expect(s.byIndex[0]).toMatchObject({ start: 100, end: 400 });
  });

  it('starts a follower after the predecessor entrance and delay, without waiting for its exit', () => {
    const s = solve([
      spec({ name: 'intro', delay: 100, duration: 300, exitDuration: 200 }),
      spec({ delay: 50, duration: 200, after: after('intro') }),
    ]);
    expect(s.total).toBe(650);
    expect(s.byIndex[0]).toMatchObject({ start: 100, end: 400, exitStart: 400, exitEnd: 600 });
    expect(s.byIndex[1]).toMatchObject({ start: 450, end: 650, predecessor: 0 });
  });

  it('resolves at boundaries against the full budget', () => {
    const s = solve([spec({ duration: 1000, exitDuration: 500, at: { start: 0, end: 0.2 } })]);
    expect(s.total).toBe(1500);
    expect(s.byIndex[0]).toMatchObject({ start: 0, end: 300, exitStart: 1000, exitEnd: 1500 });
  });

  it('reserves at-element exits at the end of a longer zone', () => {
    const s = solve([
      spec({ duration: 240, exitDuration: 160, at: { start: 0, end: 0.22 } }),
      spec({ duration: 900, exitDuration: 320, at: { start: 0.12, end: 0.76 } }),
    ]);
    expect(s.total).toBe(1220);
    expect(s.byIndex[0]!.end).toBeCloseTo(268.4);
    expect(s.byIndex[0]).toMatchObject({ exitStart: 1060, exitEnd: 1220 });
  });

  it.each([
    { at: { start: 1 }, exitDuration: 0, total: 100 },
    { at: { start: 0, end: 1 }, exitDuration: 100, total: 200 },
  ])(
    'ignores an at that leaves no reachable entrance or exit: %j',
    ({ at, exitDuration, total }) => {
      const s = solve([spec({ duration: 100, exitDuration, at })]);
      expect(s.errors.map((e) => e.code)).toEqual(['unbounded-at']);
      expect(s.total).toBe(total);
      expect(s.byIndex[0]!.end).toBe(100);
      expect(s.byIndex[0]!.exitEnd).toBe(exitDuration ? total : 100);
    }
  );

  it('reserves a reachable minimum entrance for a near-end leaf', () => {
    const s = solve([spec({ duration: 10, at: { start: 0.99 } })]);
    expect(s.errors).toEqual([]);
    expect(s.total).toBeCloseTo(100);
    expect(s.byIndex[0]!.start).toBeCloseTo(99);
    expect(s.byIndex[0]!.end).toBeCloseTo(100);
  });

  it('lets a leaf without exit finish at the zone end', () => {
    const s = solve([spec({ duration: 100, at: { end: 1 } })]);
    expect(s.errors).toEqual([]);
    expect(s.total).toBe(100);
    expect(s.byIndex[0]!.end).toBe(100);
  });

  it('fails open every member of a cycle, keeping own delays', () => {
    const s = solve([
      spec({ name: 'a', delay: 10, duration: 200, after: after('b') }),
      spec({ name: 'b', delay: 20, duration: 300, after: after('a') }),
    ]);
    expect(s.byIndex[0]).toMatchObject({ start: 10, end: 210, predecessor: -1 });
    expect(s.byIndex[1]).toMatchObject({ start: 20, end: 320, predecessor: -1 });
    expect(s.total).toBe(320);
    expect(s.errors.filter((e) => e.code === 'cycle')).toHaveLength(2);
  });

  it('keeps a follower downstream of a three-node cycle on finite timing', () => {
    const s = solve([
      spec({ name: 'down', delay: 7, duration: 50, after: after('a') }),
      spec({ name: 'a', delay: 10, duration: 20, exitDuration: 5, after: after('b') }),
      spec({ name: 'b', delay: 20, duration: 30, exitDuration: 5, after: after('c') }),
      spec({ name: 'c', delay: 30, duration: 40, exitDuration: 5, after: after('a') }),
    ]);
    expect(s.byIndex[1]).toMatchObject({ start: 10, exitEnd: 35 });
    expect(s.byIndex[2]).toMatchObject({ start: 20, exitEnd: 55 });
    expect(s.byIndex[3]).toMatchObject({ start: 30, exitEnd: 75 });
    expect(s.byIndex[0]).toMatchObject({ start: 37, end: 87, predecessor: 1 });
    expect(s.total).toBe(87);
  });

  it('reports a missing after target and starts from its own delay', () => {
    const s = solve([spec({ duration: 200, after: after('ghost') })]);
    expect(s.byIndex[0]).toMatchObject({ start: 0, end: 200, predecessor: -1 });
    expect(s.errors.map((e) => e.code)).toEqual(['missing-after']);
  });

  it('clamps negative and non-finite numbers', () => {
    expect(solve([spec({ duration: -50 })]).byIndex[0]!.end).toBe(1);
    const nan = solve([
      spec({ delay: Number.NaN, duration: Number.NaN, exitDuration: Number.NaN }),
    ]);
    expect(nan.byIndex[0]).toMatchObject({ start: 0, end: 1, exitEnd: 1, exitDuration: 0 });
    expect(nan.total).toBe(1);
  });

  it('holds followers until an at-leader window closes (T = 0.3T + 6600)', () => {
    const s = solve([
      spec({ name: 'title', at: { start: 0.05, end: 0.3 } }),
      spec({ name: 'subline', after: after('title') }),
      spec({ duration: 6000, after: after('subline') }),
    ]);
    const T = 6600 / 0.7;
    expect(s.total).toBeCloseTo(T, 3);
    expect(s.byIndex[0]!.end).toBeCloseTo(0.3 * T, 3);
    expect(s.byIndex[1]!.start).toBeCloseTo(0.3 * T, 3);
    expect(s.byIndex[2]!.start).toBeCloseTo(0.3 * T + 600, 3);
    expect(s.byIndex[2]!.end).toBeCloseTo(T, 3);
  });

  it('keeps authored at timing without dependencies', () => {
    const s = solve([spec({ delay: 100, duration: 300, at: { start: 0.1, end: 0.4 } })]);
    expect(s.total).toBe(400);
    expect(s.byIndex[0]).toMatchObject({ start: 40, end: 160 });
  });

  it('anchors an at+exit leader at its window close and keeps the zone bounded', () => {
    const s = solve([
      spec({ name: 'leader', exitDuration: 400, at: { start: 0.05, end: 0.3 } }),
      spec({ after: after('leader') }),
    ]);
    expect(s.total).toBe(1000);
    expect(s.byIndex[0]).toMatchObject({ start: 50, end: 300, exitStart: 600, exitEnd: 1000 });
    expect(s.byIndex[1]).toMatchObject({ start: 300, end: 900 });
  });

  it('rejects an unbounded at and keeps reachable after timing', () => {
    const s = solve([
      spec({ name: 'leader', duration: 500, at: { start: 0, end: 1 } }),
      spec({ duration: 200, after: after('leader') }),
    ]);
    expect(s.errors.map((e) => e.code)).toEqual(['unbounded-at']);
    expect(s.total).toBe(700);
    expect(s.byIndex[1]).toMatchObject({ start: 500, end: 700 });
  });

  it('keeps an at-follower behind its predecessor even when its at start is earlier', () => {
    const s = solve([
      spec({ name: 'leader', duration: 300, exitDuration: 200 }),
      spec({ delay: 20, duration: 200, after: after('leader'), at: { start: 0, end: 0.9 } }),
    ]);
    expect(s.byIndex[1]!.start).toBe(320);
    expect(s.byIndex[1]!.end).toBeCloseTo(468);
    expect(s.total).toBe(520);
  });

  it('solves near-one fractions without truncation', () => {
    const s = solve([
      spec({ name: 'leader', duration: 500, at: { start: 0, end: 0.99999 } }),
      spec({ duration: 200, after: after('leader') }),
    ]);
    expect(s.errors).toEqual([]);
    expect(s.total).toBeCloseTo(200 / (1 - 0.99999), 5);
    expect(s.byIndex[1]!.start).toBeCloseTo(s.byIndex[0]!.end, 5);
    expect(s.byIndex[1]!.end).toBeCloseTo(s.total, 5);
  });
});

describe('solveScene: 2.0 additions', () => {
  it('overlaps with a negative after offset, never before 0', () => {
    const s = solve([
      spec({ name: 'title', duration: 800 }),
      spec({ after: after('title', -400) }),
      spec({ after: after('title', -2000) }),
    ]);
    expect(s.byIndex[1]).toMatchObject({ start: 400, end: 1000 });
    expect(s.byIndex[2]).toMatchObject({ start: 0, end: 600 });
  });

  it('adds delay after a negative offset', () => {
    const s = solve([spec({ name: 't' }), spec({ delay: 100, after: after('t', -300) })]);
    expect(s.byIndex[1]!.start).toBe(400);
  });

  it('chains undeclared elements under sequence, with gap or overlap', () => {
    const plain = solve([spec(), spec(), spec()], { sequence: 0 });
    expect(plain.byIndex.map((x) => x.start)).toEqual([0, 600, 1200]);
    expect(plain.total).toBe(1800);
    const overlap = solve([spec(), spec(), spec()], { sequence: -200 });
    expect(overlap.byIndex.map((x) => x.start)).toEqual([0, 400, 800]);
    const gap = solve([spec(), spec({ delay: 50 })], { sequence: 100 });
    expect(gap.byIndex[1]!.start).toBe(750);
  });

  it('lets an explicit after win over sequence', () => {
    const s = solve([spec({ name: 'a' }), spec(), spec({ after: after('a') })], { sequence: 0 });
    expect(s.byIndex.map((x) => x.start)).toEqual([0, 600, 600]);
  });

  it('reports a cycle formed by after against sequence order and fails open', () => {
    const s = solve([spec({ name: 'a', after: after('b') }), spec({ name: 'b' })], {
      sequence: 0,
    });
    expect(s.errors.filter((e) => e.code === 'cycle')).toHaveLength(2);
    expect(s.byIndex.map((x) => x.start)).toEqual([0, 0]);
  });

  it('extends the element by the stagger tail and spreads children over its progress', () => {
    const s = solve([
      spec({ name: 'list', duration: 400, stagger: { each: 100, from: 'first', count: 3 } }),
      spec({ after: after('list') }),
    ]);
    expect(s.byIndex[0]).toMatchObject({ start: 0, end: 600 });
    expect(s.byIndex[0]!.items).toEqual({ from: [0, 1 / 6, 2 / 6], to: [4 / 6, 5 / 6, 1] });
    expect(s.byIndex[1]!.start).toBe(600);
  });

  it('orders stagger from the last or the center', () => {
    const last = solve([spec({ duration: 100, stagger: { each: 100, from: 'last', count: 3 } })]);
    expect(last.byIndex[0]!.items!.from).toEqual([2 / 3, 1 / 3, 0]);
    const center = solve([
      spec({ duration: 100, stagger: { each: 100, from: 'center', count: 4 } }),
    ]);
    // Orders 1.5, 0.5, 0.5, 1.5 → tail 150, span 250.
    expect(center.byIndex[0]!.end).toBe(250);
    expect(center.byIndex[0]!.items!.from).toEqual([0.6, 0.2, 0.2, 0.6]);
  });

  it('keeps exits off the total when they run on the drag departure', () => {
    const s = solve(
      [spec({ name: 'a', exitDuration: 400 }), spec({ duration: 300, after: after('a') })],
      { exitsOnTimeline: false }
    );
    expect(s.total).toBe(900);
    expect(s.byIndex[0]).toMatchObject({ end: 600, exitDuration: 400 });
  });

  it('reports duplicate names and keeps the first', () => {
    const s = solve([
      spec({ name: 'x', duration: 100 }),
      spec({ name: 'x', duration: 900 }),
      spec({ after: after('x') }),
    ]);
    expect(s.errors.map((e) => e.code)).toEqual(['duplicate-name']);
    expect(s.byIndex[2]!.start).toBe(100);
  });
});
