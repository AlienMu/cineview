export const TIMELINE_PHASE_WARMUP_MAX = 0.12;
export const TIMELINE_PHASE_RISE_MIN = 0.18;
export const TIMELINE_PHASE_DONE_MIN = 0.96;

export type TimelinePhaseProbeId =
  | 'timeline-phase-baseline'
  | 'timeline-phase-shifted'
  | 'timeline-phase-visibility-note';

export interface ProbeMetric {
  opacity: number | null;
  top: number | null;
  bottom: number | null;
  inViewport: boolean;
  fullyVisible: boolean;
}

export type ProbeMetricMap = Record<TimelinePhaseProbeId, ProbeMetric>;

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

export const EMPTY_PROBE_METRIC: ProbeMetric = {
  opacity: null,
  top: null,
  bottom: null,
  inViewport: false,
  fullyVisible: false,
};

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
  previous: TimelinePhaseEvidenceState,
  metrics: ProbeMetricMap
): TimelinePhaseEvidenceState {
  const baselineOpacity = metrics['timeline-phase-baseline'].opacity ?? 0;
  const shiftedOpacity = metrics['timeline-phase-shifted'].opacity ?? 0;
  const visibilityMetric = metrics['timeline-phase-visibility-note'];
  const visibilityOpacity = visibilityMetric.opacity ?? 0;

  const maxShiftedBeforeBaselineDone = previous.baselineDoneObserved
    ? previous.maxShiftedBeforeBaselineDone
    : Math.max(previous.maxShiftedBeforeBaselineDone, shiftedOpacity);
  const maxVisibilityBeforeViewportEntry = visibilityMetric.fullyVisible
    ? previous.maxVisibilityBeforeViewportEntry
    : Math.max(previous.maxVisibilityBeforeViewportEntry, visibilityOpacity);
  const visibilityWasOutOfViewport =
    previous.visibilityWasOutOfViewport || !visibilityMetric.inViewport;
  const baselineDoneObserved =
    previous.baselineDoneObserved || baselineOpacity >= TIMELINE_PHASE_DONE_MIN;

  return {
    sampleCount: previous.sampleCount + 1,
    baselineLeadObserved:
      previous.baselineLeadObserved ||
      (baselineOpacity >= TIMELINE_PHASE_RISE_MIN && shiftedOpacity <= TIMELINE_PHASE_WARMUP_MAX),
    baselineDoneObserved,
    shiftedLateObserved:
      previous.shiftedLateObserved ||
      (baselineDoneObserved &&
        maxShiftedBeforeBaselineDone <= TIMELINE_PHASE_WARMUP_MAX &&
        shiftedOpacity >= TIMELINE_PHASE_RISE_MIN),
    visibilityIndependentObserved:
      previous.visibilityIndependentObserved ||
      (visibilityWasOutOfViewport &&
        visibilityMetric.fullyVisible &&
        maxVisibilityBeforeViewportEntry <= TIMELINE_PHASE_WARMUP_MAX &&
        visibilityOpacity >= TIMELINE_PHASE_RISE_MIN),
    visibilityWasOutOfViewport,
    maxShiftedBeforeBaselineDone,
    maxVisibilityBeforeViewportEntry,
  };
}

export function mergeTimelinePhaseEvidence(
  primary: TimelinePhaseEvidenceState,
  secondary: TimelinePhaseEvidenceState
): TimelinePhaseEvidenceState {
  return {
    sampleCount: Math.max(primary.sampleCount, secondary.sampleCount),
    baselineLeadObserved: primary.baselineLeadObserved || secondary.baselineLeadObserved,
    baselineDoneObserved: primary.baselineDoneObserved || secondary.baselineDoneObserved,
    shiftedLateObserved: primary.shiftedLateObserved || secondary.shiftedLateObserved,
    visibilityIndependentObserved:
      primary.visibilityIndependentObserved || secondary.visibilityIndependentObserved,
    visibilityWasOutOfViewport:
      primary.visibilityWasOutOfViewport || secondary.visibilityWasOutOfViewport,
    maxShiftedBeforeBaselineDone: Math.max(
      primary.maxShiftedBeforeBaselineDone,
      secondary.maxShiftedBeforeBaselineDone
    ),
    maxVisibilityBeforeViewportEntry: Math.max(
      primary.maxVisibilityBeforeViewportEntry,
      secondary.maxVisibilityBeforeViewportEntry
    ),
  };
}
