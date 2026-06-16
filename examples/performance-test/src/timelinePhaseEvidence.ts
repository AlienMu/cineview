export const TIMELINE_PHASE_WARMUP_MAX = 0.12;

export interface ProbeMetric {
  opacity: number;
  top: number;
  bottom: number;
  inViewport: boolean;
  fullyVisible: boolean;
}

export interface ProbeMetricMap {
  'timeline-phase-baseline': ProbeMetric;
  'timeline-phase-shifted': ProbeMetric;
  'timeline-phase-visibility-note': ProbeMetric;
}

export interface TimelinePhaseEvidenceState {
  sampleCount: number;
  baselineLeadObserved: boolean;
  baselineDoneObserved: boolean;
  shiftedLateObserved: boolean;
  visibilityIndependentObserved: boolean;
  visibilityWasOutOfViewport: boolean;
  maxShiftedBeforeBaselineDone: number;
  maxVisibilityBeforeViewportEntry: number;
}

export function createInitialTimelinePhaseEvidenceState(): TimelinePhaseEvidenceState {
  return {
    sampleCount: 0,
    baselineLeadObserved: false,
    baselineDoneObserved: false,
    shiftedLateObserved: false,
    visibilityIndependentObserved: false,
    visibilityWasOutOfViewport: false,
    maxShiftedBeforeBaselineDone: 0,
    maxVisibilityBeforeViewportEntry: 0,
  };
}

export function reduceTimelinePhaseEvidence(
  state: TimelinePhaseEvidenceState,
  metrics: ProbeMetricMap
): TimelinePhaseEvidenceState {
  const baseline = metrics['timeline-phase-baseline'];
  const shifted = metrics['timeline-phase-shifted'];
  const visibility = metrics['timeline-phase-visibility-note'];
  const baselineDoneObserved = state.baselineDoneObserved || baseline.opacity >= 1;
  const shiftedEarlyOpacity =
    baselineDoneObserved || state.baselineDoneObserved
      ? state.maxShiftedBeforeBaselineDone
      : Math.max(state.maxShiftedBeforeBaselineDone, shifted.opacity);
  const visibilityBeforeEntry =
    visibility.inViewport || visibility.fullyVisible
      ? state.maxVisibilityBeforeViewportEntry
      : Math.max(state.maxVisibilityBeforeViewportEntry, visibility.opacity);

  return {
    sampleCount: state.sampleCount + 1,
    baselineLeadObserved:
      state.baselineLeadObserved ||
      (baseline.inViewport && baseline.opacity > 0 && shifted.opacity <= TIMELINE_PHASE_WARMUP_MAX),
    baselineDoneObserved,
    shiftedLateObserved:
      state.shiftedLateObserved ||
      ((state.baselineDoneObserved || baselineDoneObserved) &&
        shifted.inViewport &&
        shifted.opacity > TIMELINE_PHASE_WARMUP_MAX),
    visibilityIndependentObserved:
      state.visibilityIndependentObserved ||
      (visibility.inViewport && visibility.fullyVisible && visibility.opacity > 0),
    visibilityWasOutOfViewport:
      state.visibilityWasOutOfViewport || !visibility.inViewport,
    maxShiftedBeforeBaselineDone: shiftedEarlyOpacity,
    maxVisibilityBeforeViewportEntry: visibilityBeforeEntry,
  };
}

export function mergeTimelinePhaseEvidence(
  passive: TimelinePhaseEvidenceState,
  proof: TimelinePhaseEvidenceState
): TimelinePhaseEvidenceState {
  return {
    sampleCount: Math.max(passive.sampleCount, proof.sampleCount),
    baselineLeadObserved: passive.baselineLeadObserved || proof.baselineLeadObserved,
    baselineDoneObserved: passive.baselineDoneObserved || proof.baselineDoneObserved,
    shiftedLateObserved: passive.shiftedLateObserved || proof.shiftedLateObserved,
    visibilityIndependentObserved:
      passive.visibilityIndependentObserved || proof.visibilityIndependentObserved,
    visibilityWasOutOfViewport:
      passive.visibilityWasOutOfViewport || proof.visibilityWasOutOfViewport,
    maxShiftedBeforeBaselineDone: Math.max(
      passive.maxShiftedBeforeBaselineDone,
      proof.maxShiftedBeforeBaselineDone
    ),
    maxVisibilityBeforeViewportEntry: Math.max(
      passive.maxVisibilityBeforeViewportEntry,
      proof.maxVisibilityBeforeViewportEntry
    ),
  };
}
