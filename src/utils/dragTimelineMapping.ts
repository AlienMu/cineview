import type { DragModeConfig, DragTimelineUnit, SceneDragConfig } from '../types';

export const DEFAULT_DRAG_TIMELINE_UNIT: DragTimelineUnit = 'time';
export const DEFAULT_DRAG_TIMELINE_SCALE = {
  time: 10,
  percent: 1,
} as const satisfies Record<DragTimelineUnit, number>;

export const DEFAULT_DRAG_TIMELINE_CONFIG: ResolvedDragTimelineConfig = {
  unit: DEFAULT_DRAG_TIMELINE_UNIT,
  scale: DEFAULT_DRAG_TIMELINE_SCALE[DEFAULT_DRAG_TIMELINE_UNIT],
};

export interface ResolvedDragTimelineConfig {
  unit: DragTimelineUnit;
  scale: number;
}

export type InvalidDragTimelineField = 'unit' | 'scale';

export interface InvalidDragTimelineConfig {
  field: InvalidDragTimelineField;
  value: unknown;
}

export interface ResolvedDragTimelineMapping extends ResolvedDragTimelineConfig {
  msPerDragPercent: number;
  map: (dragPercent: number) => number;
}

type DragMappingSource = Pick<DragModeConfig, 'unit' | 'scale'> | SceneDragConfig;

function isDragTimelineUnit(value: unknown): value is DragTimelineUnit {
  return value === 'time' || value === 'percent';
}

function hasSceneMappingOverride(scene: SceneDragConfig | undefined): boolean {
  return scene?.unit !== undefined || scene?.scale !== undefined;
}

/**
 * Resolves the authored root/Scene mapping as one group. A Scene that provides
 * either `unit` or `scale` stops inheriting the root mapping; its omitted field
 * falls back to the framework default for the resolved unit.
 */
export function resolveDragTimelineConfig(
  root: Pick<DragModeConfig, 'unit' | 'scale'> | undefined,
  scene?: SceneDragConfig,
  onInvalid?: (issue: InvalidDragTimelineConfig) => void
): ResolvedDragTimelineConfig {
  const source: DragMappingSource | undefined = hasSceneMappingOverride(scene) ? scene : root;
  const authoredUnit = source?.unit;

  if (authoredUnit !== undefined && !isDragTimelineUnit(authoredUnit)) {
    onInvalid?.({ field: 'unit', value: authoredUnit });
    return {
      unit: DEFAULT_DRAG_TIMELINE_UNIT,
      scale: DEFAULT_DRAG_TIMELINE_SCALE.time,
    };
  }

  const unit = authoredUnit ?? DEFAULT_DRAG_TIMELINE_UNIT;
  const authoredScale = source?.scale;
  if (
    authoredScale !== undefined &&
    (typeof authoredScale !== 'number' || !Number.isFinite(authoredScale) || authoredScale < 0)
  ) {
    onInvalid?.({ field: 'scale', value: authoredScale });
    return { unit, scale: DEFAULT_DRAG_TIMELINE_SCALE[unit] };
  }

  return {
    unit,
    scale: authoredScale ?? DEFAULT_DRAG_TIMELINE_SCALE[unit],
  };
}

/** Allocation-free authoritative drag-percent → element-elapsed conversion. */
export function mapDragPercentToElapsed(
  config: ResolvedDragTimelineConfig,
  timelineDurationMs: number,
  dragPercent: number
): number {
  const tSelf = Math.max(0, Number.isFinite(timelineDurationMs) ? timelineDurationMs : 0);
  const finitePercent = Number.isFinite(dragPercent) ? dragPercent : 0;
  const msPerDragPercent = config.unit === 'time' ? config.scale : (tSelf * config.scale) / 100;
  return Math.min(tSelf, Math.max(0, finitePercent * msPerDragPercent));
}

/** Creates the diagnostic/readable mapping object outside animation hot paths. */
export function createDragTimelineMapping(
  config: ResolvedDragTimelineConfig,
  timelineDurationMs: number
): ResolvedDragTimelineMapping {
  const tSelf = Math.max(0, Number.isFinite(timelineDurationMs) ? timelineDurationMs : 0);
  const msPerDragPercent = config.unit === 'time' ? config.scale : (tSelf * config.scale) / 100;

  return {
    ...config,
    msPerDragPercent,
    map(dragPercent: number): number {
      return mapDragPercentToElapsed(config, tSelf, dragPercent);
    },
  };
}
