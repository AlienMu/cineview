import { parseAfter, solveScene, type TimeSpec } from './time';

const spec = (over: Partial<TimeSpec> = {}): TimeSpec => ({
  name: null,
  duration: 600,
  delay: 0,
  after: null,
  exitDuration: 0,
  ...over,
});

describe('parseAfter', () => {
  it('reads a name with an optional signed offset', () => {
    expect(parseAfter('title')).toEqual({ name: 'title', offset: 0 });
    expect(parseAfter('title -400')).toEqual({ name: 'title', offset: -400 });
    expect(parseAfter(' title + 120 ')).toEqual({ name: 'title', offset: 120 });
    expect(parseAfter(null)).toBeNull();
    expect(parseAfter('a b')).toBeNull();
  });
});

describe('solveScene', () => {
  it('places an after-reference at the end of its target, offset applied', () => {
    const s = solveScene([
      spec({ name: 'title', duration: 800 }),
      spec({ after: { name: 'title', offset: -400 } }),
    ]);
    expect(s.byIndex[1]).toMatchObject({ start: 400, end: 1000 });
    expect(s.entranceEnd).toBe(1000);
    expect(s.errors).toEqual([]);
  });

  it('puts exits after the whole entrance section', () => {
    const s = solveScene([spec({ duration: 500, exitDuration: 300 }), spec({ delay: 200 })]);
    expect(s.entranceEnd).toBe(800);
    expect(s.byIndex[0]).toMatchObject({ exitStart: 800, exitEnd: 1100 });
    expect(s.total).toBe(1100);
  });

  it('reports missing names and cycles instead of throwing', () => {
    const missing = solveScene([spec({ after: { name: 'nope', offset: 0 } })]);
    expect(missing.errors[0]).toMatch(/does not match/);
    const cycle = solveScene([
      spec({ name: 'a', after: { name: 'b', offset: 0 } }),
      spec({ name: 'b', after: { name: 'a', offset: 0 } }),
    ]);
    expect(cycle.errors.some((e) => /Circular/.test(e))).toBe(true);
  });
});
