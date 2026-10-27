import {
  cancelDuration,
  DEFAULT_THRESHOLD,
  mapDrag,
  parseMapping,
  parseThreshold,
  shouldCommit,
  thresholdAt,
} from './drag-rules';

describe('threshold (1.x: 30% at rest, 15% at 1000 px/s, linear between)', () => {
  it('falls linearly with speed', () => {
    expect(thresholdAt(0, DEFAULT_THRESHOLD)).toBe(0.3);
    expect(thresholdAt(500, DEFAULT_THRESHOLD)).toBeCloseTo(0.225);
    expect(thresholdAt(1000, DEFAULT_THRESHOLD)).toBeCloseTo(0.15);
    expect(thresholdAt(5000, DEFAULT_THRESHOLD)).toBeCloseTo(0.15);
    expect(thresholdAt(Number.NaN, DEFAULT_THRESHOLD)).toBe(0.3);
  });

  it('parses slow, fast and velocity, keeping fast <= slow', () => {
    expect(parseThreshold('0.4 0.2 800', DEFAULT_THRESHOLD)).toEqual({
      slow: 0.4,
      fast: 0.2,
      velocity: 800,
    });
    expect(parseThreshold('0.1', DEFAULT_THRESHOLD)).toEqual({
      slow: 0.1,
      fast: 0.1,
      velocity: 1000,
    });
    expect(parseThreshold('nope', DEFAULT_THRESHOLD)).toEqual(DEFAULT_THRESHOLD);
  });

  it('reports invalid threshold fields while preserving fallback and empty-attribute behavior', () => {
    const report = jest.fn();
    expect(parseThreshold('long:35%', DEFAULT_THRESHOLD, report)).toEqual(DEFAULT_THRESHOLD);
    expect(report).toHaveBeenCalledTimes(1);
    report.mockClear();
    expect(parseThreshold('0.4 nope 800', DEFAULT_THRESHOLD, report)).toEqual({
      slow: 0.4,
      fast: 0.15,
      velocity: 800,
    });
    expect(report).toHaveBeenCalledTimes(1);
    report.mockClear();
    expect(parseThreshold('', DEFAULT_THRESHOLD, report)).toEqual(DEFAULT_THRESHOLD);
    expect(parseThreshold('0.1', DEFAULT_THRESHOLD, report)).toEqual({
      slow: 0.1,
      fast: 0.1,
      velocity: 1000,
    });
    expect(report).not.toHaveBeenCalled();
  });
});

describe('shouldCommit', () => {
  it('needs strictly more than the threshold', () => {
    expect(shouldCommit(0.3, 0, DEFAULT_THRESHOLD, false)).toBe(false);
    expect(shouldCommit(0.31, 0, DEFAULT_THRESHOLD, false)).toBe(true);
    expect(shouldCommit(-0.31, 0, DEFAULT_THRESHOLD, false)).toBe(true);
    expect(shouldCommit(0.2, 1000, DEFAULT_THRESHOLD, false)).toBe(true);
  });

  it('cancels a fast flick back against the displacement', () => {
    expect(shouldCommit(0.6, -700, DEFAULT_THRESHOLD, false)).toBe(false);
    expect(shouldCommit(0.6, -500, DEFAULT_THRESHOLD, false)).toBe(true);
  });

  it('never commits on pointercancel', () => {
    expect(shouldCommit(0.9, 2000, DEFAULT_THRESHOLD, true)).toBe(false);
  });
});

describe('default short swipe and long drag', () => {
  const commit = (
    r: number,
    duration: number,
    displacement: number,
    velocity = 0,
    cancelled = false
  ) => shouldCommit(r, velocity, null, cancelled, { duration, displacement, viewport: 800 });

  it('commits a short swipe in either direction without the legacy 15% minimum', () => {
    expect(commit(0.079, 80, 64, 1500)).toBe(true);
    expect(commit(-0.079, 80, -64, -1500)).toBe(true);
    expect(commit(0.1, 300, 80)).toBe(true);
  });

  it('ignores taps and net movement of at most 5px', () => {
    expect(commit(0, 80, 0)).toBe(false);
    expect(commit(0.005, 80, 5)).toBe(false);
    expect(commit(-0.005, 80, -5)).toBe(false);
    expect(commit(0.006, 80, 6)).toBe(false);
  });

  it('requires 8% net finger movement for short swipes, even when released fast', () => {
    expect(commit(0.03, 80, 25, 1500)).toBe(false);
    expect(commit(0.078, 80, 63, 1500)).toBe(false);
    expect(commit(-0.078, 80, -63, -1500)).toBe(false);
    expect(commit(0.079, 80, 64)).toBe(true);
  });

  it('scales the short-swipe minimum with the viewport height', () => {
    expect(
      shouldCommit(0.079, 0, null, false, { duration: 150, displacement: 55, viewport: 699 })
    ).toBe(false);
    expect(
      shouldCommit(0.079, 0, null, false, { duration: 150, displacement: 56, viewport: 699 })
    ).toBe(true);
  });

  it('requires half the page after 300ms, regardless of release speed', () => {
    expect(commit(0.499, 301, 400, 2000)).toBe(false);
    expect(commit(0.5, 301, 401)).toBe(true);
    expect(commit(-0.5, 301, -401)).toBe(true);
  });

  it('cancels a short re-grab pulled back toward the current scene', () => {
    expect(commit(0.6, 100, -64)).toBe(false);
    expect(commit(-0.6, 100, 64)).toBe(false);
    expect(commit(0.6, 100, 64)).toBe(true);
  });

  it('uses net page position for a long re-grab', () => {
    expect(commit(0.4, 400, -80)).toBe(false);
    expect(commit(0.6, 400, -80)).toBe(true);
  });

  it('retains fast reverse and native cancellation', () => {
    expect(commit(0.6, 100, 480, -700)).toBe(false);
    expect(commit(0.6, 400, 480, -700)).toBe(false);
    expect(commit(0.8, 80, 640, 2000, true)).toBe(false);
  });
});

describe('durations and mapping', () => {
  it('caps the snap-back at 300 ms', () => {
    expect(cancelDuration(0.2, 800)).toBe(160);
    expect(cancelDuration(0.9, 800)).toBe(300);
  });

  it('maps drag to element time (time: 10 ms per 1%; percent: share of the timeline)', () => {
    const time = { unit: 'time', scale: 10 } as const;
    expect(mapDrag(1, 6500, time)).toBe(1000);
    expect(mapDrag(0.5, 300, time)).toBe(300);
    expect(mapDrag(0.5, 1200, { unit: 'percent', scale: 1 })).toBe(600);
    expect(mapDrag(-1, 1200, time)).toBe(0);
  });

  it('overrides unit and scale as a group, resetting what is missing to defaults', () => {
    const root = { unit: 'percent', scale: 0.5 } as const;
    expect(parseMapping(null, '2', root).mapping).toEqual({ unit: 'time', scale: 2 });
    expect(parseMapping('percent', null, root).mapping).toEqual({ unit: 'percent', scale: 1 });
    expect(parseMapping(null, null, root).mapping).toBe(root);
    expect(parseMapping('meters', '2', root)).toEqual({
      mapping: { unit: 'time', scale: 2 },
      invalid: true,
    });
  });
});
