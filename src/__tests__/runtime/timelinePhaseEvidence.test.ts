import {
  TIMELINE_PHASE_WARMUP_MAX,
  createInitialTimelinePhaseEvidenceState,
  mergeTimelinePhaseEvidence,
  reduceTimelinePhaseEvidence,
  type ProbeMetricMap,
} from '../../../examples/performance-test/src/timelinePhaseEvidence';

function createMetrics(
  overrides?: Partial<Record<keyof ProbeMetricMap, Partial<ProbeMetricMap[keyof ProbeMetricMap]>>>
): ProbeMetricMap {
  const baseMetric = {
    opacity: 0,
    top: 1200,
    bottom: 1400,
    inViewport: false,
    fullyVisible: false,
  };

  return {
    'timeline-phase-baseline': {
      ...baseMetric,
      ...overrides?.['timeline-phase-baseline'],
    },
    'timeline-phase-shifted': {
      ...baseMetric,
      ...overrides?.['timeline-phase-shifted'],
    },
    'timeline-phase-visibility-note': {
      ...baseMetric,
      ...overrides?.['timeline-phase-visibility-note'],
    },
  };
}

describe('timelinePhaseEvidence', () => {
  it('latches the three page-level evidence checkpoints in the intended order', () => {
    let state = createInitialTimelinePhaseEvidenceState();

    state = reduceTimelinePhaseEvidence(state, createMetrics());
    expect(state.baselineLeadObserved).toBe(false);
    expect(state.shiftedLateObserved).toBe(false);
    expect(state.visibilityIndependentObserved).toBe(false);

    state = reduceTimelinePhaseEvidence(
      state,
      createMetrics({
        'timeline-phase-baseline': { opacity: 0.24, inViewport: true, top: 420, bottom: 620 },
        'timeline-phase-shifted': {
          opacity: TIMELINE_PHASE_WARMUP_MAX,
          inViewport: true,
          top: 720,
          bottom: 920,
        },
      })
    );
    expect(state.baselineLeadObserved).toBe(true);
    expect(state.shiftedLateObserved).toBe(false);

    state = reduceTimelinePhaseEvidence(
      state,
      createMetrics({
        'timeline-phase-baseline': { opacity: 1, inViewport: true, top: 420, bottom: 620 },
        'timeline-phase-shifted': {
          opacity: TIMELINE_PHASE_WARMUP_MAX,
          inViewport: true,
          top: 720,
          bottom: 920,
        },
      })
    );
    expect(state.shiftedLateObserved).toBe(false);

    state = reduceTimelinePhaseEvidence(
      state,
      createMetrics({
        'timeline-phase-baseline': { opacity: 1, inViewport: true, top: 420, bottom: 620 },
        'timeline-phase-shifted': { opacity: 0.36, inViewport: true, top: 720, bottom: 920 },
      })
    );
    expect(state.shiftedLateObserved).toBe(true);

    state = reduceTimelinePhaseEvidence(
      state,
      createMetrics({
        'timeline-phase-baseline': {
          opacity: 1,
          inViewport: true,
          fullyVisible: true,
          top: 420,
          bottom: 620,
        },
        'timeline-phase-shifted': {
          opacity: 1,
          inViewport: true,
          fullyVisible: true,
          top: 720,
          bottom: 920,
        },
        'timeline-phase-visibility-note': {
          opacity: 0.28,
          inViewport: true,
          fullyVisible: true,
          top: 640,
          bottom: 860,
        },
      })
    );
    expect(state.visibilityIndependentObserved).toBe(true);
  });

  it('merges passive board evidence with proof-runner evidence without losing latched checkpoints', () => {
    const passive = {
      ...createInitialTimelinePhaseEvidenceState(),
      sampleCount: 5,
      visibilityIndependentObserved: true,
      visibilityWasOutOfViewport: true,
      maxVisibilityBeforeViewportEntry: 0.04,
    };
    const proof = {
      ...createInitialTimelinePhaseEvidenceState(),
      sampleCount: 9,
      baselineLeadObserved: true,
      baselineDoneObserved: true,
      shiftedLateObserved: true,
      maxShiftedBeforeBaselineDone: 0.09,
    };

    expect(mergeTimelinePhaseEvidence(passive, proof)).toEqual({
      sampleCount: 9,
      baselineLeadObserved: true,
      baselineDoneObserved: true,
      shiftedLateObserved: true,
      visibilityIndependentObserved: true,
      visibilityWasOutOfViewport: true,
      maxShiftedBeforeBaselineDone: 0.09,
      maxVisibilityBeforeViewportEntry: 0.04,
    });
  });
});
