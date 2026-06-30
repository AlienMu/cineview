import { calculateThreshold } from './useDragSceneEngine';

describe('calculateThreshold (DragThresholdConfig plumbing)', () => {
  it('uses hardcoded defaults when no config is provided', () => {
    // Default band: maxThreshold 0.3 (slow), minThreshold 0.15 (fast),
    // maxVelocity 1000.
    expect(calculateThreshold(0)).toBeCloseTo(0.3, 5);
    expect(calculateThreshold(1000)).toBeCloseTo(0.15, 5);
    expect(calculateThreshold(500)).toBeCloseTo(0.225, 5);
    // Non-finite velocity falls back to the max (slow) threshold.
    expect(calculateThreshold(Number.NaN)).toBeCloseTo(0.3, 5);
  });

  it('honors a consumer-provided threshold config (minRatio/maxRatio/maxVelocity)', () => {
    const config = { minVelocity: 0, maxVelocity: 2000, minRatio: 0.4, maxRatio: 0.6 };
    // Slow (v=0) -> maxRatio; fast (v>=maxVelocity) -> minRatio.
    expect(calculateThreshold(0, config)).toBeCloseTo(0.6, 5);
    expect(calculateThreshold(2000, config)).toBeCloseTo(0.4, 5);
    expect(calculateThreshold(1000, config)).toBeCloseTo(0.5, 5);
    // Velocity beyond maxVelocity clamps to the fast threshold.
    expect(calculateThreshold(5000, config)).toBeCloseTo(0.4, 5);
  });

  it('returns the max threshold when the configured velocity span is degenerate', () => {
    const config = { minVelocity: 1000, maxVelocity: 1000, minRatio: 0.1, maxRatio: 0.5 };
    expect(calculateThreshold(1000, config)).toBeCloseTo(0.5, 5);
  });
});
