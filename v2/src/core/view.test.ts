import { parseFx } from './fx';
import { rangeCss, rangeSpan, sameRange, viewProgress, type ViewRange } from './view';

const range = (text: string): ViewRange | null =>
  parseFx(`fade ${text}`, () => undefined)[0]!.viewRange;

describe('rangeSpan', () => {
  // Subject shorter than the viewport (CSS animation-range, scroll-driven animations spec).
  it.each([
    ['cover', [0, 1000]],
    ['contain', [200, 800]],
    ['entry', [0, 200]],
    ['exit', [800, 1000]],
    ['entry-crossing', [0, 200]],
    ['exit-crossing', [800, 1000]],
  ] as const)('%s for a 200 px subject in an 800 px viewport', (name, span) => {
    expect(rangeSpan(name, 200, 800)).toEqual(span);
  });

  it('swaps contain edges for a subject taller than the viewport', () => {
    expect(rangeSpan('contain', 1200, 800)).toEqual([800, 1200]);
    expect(rangeSpan('entry', 1200, 800)).toEqual([0, 800]);
    expect(rangeSpan('exit', 1200, 800)).toEqual([1200, 2000]);
    expect(rangeSpan('entry-crossing', 1200, 800)).toEqual([0, 1200]);
  });
});

describe('viewProgress', () => {
  it('is the cover formula without a range', () => {
    // Top edge 300 px from the viewport top: 500 px into a 1000 px cover range.
    expect(viewProgress(300, 200, 800, null)).toBeCloseTo(0.5);
    expect(viewProgress(800, 200, 800, null)).toBe(0);
    expect(viewProgress(-200, 200, 800, null)).toBe(1);
    expect(viewProgress(900, 200, 800, null)).toBe(0);
  });

  it('runs over a named range, with offsets', () => {
    // entry = [0, 200]: halfway when the subject is half in.
    expect(viewProgress(700, 200, 800, range('entry'))).toBeCloseTo(0.5);
    expect(viewProgress(500, 200, 800, range('entry'))).toBe(1);
    // entry 0% cover 50%: 0 → 500.
    expect(viewProgress(550, 200, 800, range('entry 0% cover 50%'))).toBeCloseTo(0.5);
    // contain 20% 80% = 320 → 680.
    expect(viewProgress(300, 200, 800, range('contain 20% 80%'))).toBeCloseTo((500 - 320) / 360);
  });

  it('steps at a zero-length range', () => {
    // contain is a point when the subject is exactly as tall as the viewport.
    expect(viewProgress(1, 800, 800, range('contain'))).toBe(0);
    expect(viewProgress(0, 800, 800, range('contain'))).toBe(1);
  });
});

describe('rangeCss', () => {
  it('writes CSS range values', () => {
    expect(rangeCss(null)).toEqual({ rangeStart: 'cover 0%', rangeEnd: 'cover 100%' });
    expect(rangeCss(range('entry 10% cover 50%'))).toEqual({
      rangeStart: 'entry 10%',
      rangeEnd: 'cover 50%',
    });
    expect(rangeCss(range('exit'))).toEqual({ rangeStart: 'exit 0%', rangeEnd: 'exit 100%' });
  });

  it('compares ranges by value', () => {
    expect(sameRange(range('entry'), range('entry 0% entry 100%'))).toBe(true);
    expect(sameRange(range('entry'), range('exit'))).toBe(false);
    expect(sameRange(null, range('cover'))).toBe(false);
    expect(sameRange(null, null)).toBe(true);
  });
});
