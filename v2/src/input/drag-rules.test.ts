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
