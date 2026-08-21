import { resolveZoneApproachBand } from './sceneScrollRuntime';

const VH = 900;

describe('resolveZoneApproachBand (Schmitt trigger)', () => {
  it('returns inside at zero distance regardless of previous band', () => {
    expect(resolveZoneApproachBand(0, VH, 'far')).toBe('inside');
    expect(resolveZoneApproachBand(0, VH, 'near')).toBe('inside');
    expect(resolveZoneApproachBand(0, VH, 'inside')).toBe('inside');
  });

  it('flips near→far only beyond the 1.5-viewport release threshold', () => {
    expect(resolveZoneApproachBand(VH * 1.5, VH, 'near')).toBe('near');
    expect(resolveZoneApproachBand(VH * 1.5 + 1, VH, 'near')).toBe('far');
  });

  it('flips far→near once back within the 1-viewport preload threshold', () => {
    expect(resolveZoneApproachBand(VH, VH, 'far')).toBe('near');
    expect(resolveZoneApproachBand(VH + 1, VH, 'far')).toBe('far');
  });

  it('is stable across the hysteresis gap — no flapping at any single distance', () => {
    // Between 1·VH and 1.5·VH the band simply keeps its previous value:
    // leaving has not yet crossed the release threshold, returning has not
    // yet reached the preload threshold. A hover anywhere in the gap cannot
    // oscillate.
    const inGap = VH * 1.25;
    expect(resolveZoneApproachBand(inGap, VH, 'near')).toBe('near');
    expect(resolveZoneApproachBand(inGap, VH, 'far')).toBe('far');
  });

  it('quantizes to viewport-relative thresholds', () => {
    // 1.6·VH is beyond the release threshold at full viewport but below it
    // at double viewport.
    const d = VH * 1.6;
    expect(resolveZoneApproachBand(d, VH, 'near')).toBe('far');
    expect(resolveZoneApproachBand(d, VH * 2, 'near')).toBe('near');
  });

  it('treats negative distance (inside segment) as inside', () => {
    expect(resolveZoneApproachBand(-300, VH, 'far')).toBe('inside');
  });
});
