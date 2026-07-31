import {
  DEFAULT_DRAG_TIMELINE_SCALE,
  createDragTimelineMapping,
  resolveDragTimelineConfig,
} from './dragTimelineMapping';

describe('drag timeline mapping', () => {
  it('uses time + 10 when no mapping is authored', () => {
    expect(resolveDragTimelineConfig(undefined)).toEqual({ unit: 'time', scale: 10 });
  });

  it('inherits the complete root mapping when Scene omits unit and scale', () => {
    expect(resolveDragTimelineConfig({ unit: 'percent', scale: 0.5 }, { enabled: false })).toEqual({
      unit: 'percent',
      scale: 0.5,
    });
  });

  it('treats a Scene mapping as a group override', () => {
    expect(resolveDragTimelineConfig({ unit: 'percent', scale: 0.5 }, { unit: 'time' })).toEqual({
      unit: 'time',
      scale: DEFAULT_DRAG_TIMELINE_SCALE.time,
    });
    expect(resolveDragTimelineConfig({ unit: 'percent', scale: 0.5 }, { scale: 2 })).toEqual({
      unit: 'time',
      scale: 2,
    });
  });

  it('reports invalid values and falls back without returning unsafe numbers', () => {
    const issues: Array<{ field: string; value: unknown }> = [];
    expect(
      resolveDragTimelineConfig({ unit: 'percent', scale: Number.NaN }, undefined, (issue) =>
        issues.push(issue)
      )
    ).toEqual({ unit: 'percent', scale: 1 });
    expect(issues).toEqual([{ field: 'scale', value: Number.NaN }]);

    expect(
      resolveDragTimelineConfig({ unit: 'frames' as 'time', scale: 0.5 }, undefined, (issue) =>
        issues.push(issue)
      )
    ).toEqual({ unit: 'time', scale: 10 });
    expect(issues[1]).toEqual({ field: 'unit', value: 'frames' });
  });

  it('maps time units in milliseconds per drag percent', () => {
    const mapping = createDragTimelineMapping({ unit: 'time', scale: 10 }, 2_000);
    expect(mapping.msPerDragPercent).toBe(10);
    expect(mapping.map(50)).toBe(500);
    expect(mapping.map(500)).toBe(2_000);
  });

  it('maps percent units relative to the Scene timeline', () => {
    const mapping = createDragTimelineMapping({ unit: 'percent', scale: 0.5 }, 2_000);
    expect(mapping.msPerDragPercent).toBe(10);
    expect(mapping.map(50)).toBe(500);
    expect(mapping.map(100)).toBe(1_000);
    expect(mapping.map(200)).toBe(2_000);
  });

  it('clamps non-finite and negative inputs safely', () => {
    const mapping = createDragTimelineMapping({ unit: 'time', scale: 10 }, 1_000);
    expect(mapping.map(Number.NaN)).toBe(0);
    expect(mapping.map(-10)).toBe(0);
    expect(createDragTimelineMapping({ unit: 'time', scale: 10 }, Number.NaN).map(100)).toBe(0);
  });
});
