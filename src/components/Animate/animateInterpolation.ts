/**
 * Shared interpolation/variant helpers for the Animate hooks.
 *
 * `useAnimateDrag` and `useAnimateScroll` are two independent driver
 * implementations (follow-finger element clock vs. scroll-budget / visibility
 * gate), but the leaf math that turns a variant record + progress into a CSS
 * value is identical. These pure helpers were duplicated verbatim in both hooks;
 * keeping one copy here removes the drift risk.
 *
 * `lerpTransformValue` is the superset string interpolator (drag's former
 * `lerpStringValue`): it handles number, unit-suffixed strings (`100%`, `12px`,
 * `45deg`), AND single-arg transform functions (`translateY(100%)`). Scroll's
 * former `lerpValue` lacked the function branch; adopting the superset is purely
 * additive — non-function values resolve identically.
 */

export type AnimatableProperty =
  'opacity' | 'x' | 'y' | 'scale' | 'rotate' | 'rotateX' | 'rotateY' | 'skewX' | 'skewY' | 'filter';

export type TransformValue = number | string;
export type VariantRecord = Record<string, unknown>;

/**
 * Compiled variant records shared by the drag and scroll drivers (both have
 * full enter/exit semantics). The arrival driver intentionally keeps its own
 * two-field shape { initial, animate } — it has no exit concept, and faking an
 * empty exitTarget here would be a semantic lie.
 */
export interface SceneVariantRecords {
  enterInitial: VariantRecord;
  enterAnimate: VariantRecord;
  exitTarget: VariantRecord;
}

function resolveKeyframeTimes(
  record: VariantRecord,
  property: AnimatableProperty,
  length: number
): readonly number[] | null {
  const transition = record.transition as VariantRecord | undefined;
  const propertyTransition = transition?.[property] as VariantRecord | undefined;
  const times =
    (propertyTransition && !Array.isArray(propertyTransition) ? propertyTransition.times : null) ??
    transition?.times;
  return Array.isArray(times) && times.length === length ? (times as number[]) : null;
}

function resolveKeyframeValue(
  keyframes: readonly unknown[],
  index: number,
  fallback: TransformValue
): TransformValue {
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const value = keyframes[cursor];
    if (typeof value === 'number' || typeof value === 'string') return value;
  }
  return fallback;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

export function lerpTransformValue(
  start: TransformValue,
  end: TransformValue,
  progress: number
): TransformValue {
  if (typeof start === 'number' && typeof end === 'number') {
    return lerp(start, end, progress);
  }

  const startStr = String(start);
  const endStr = String(end);
  const startMatch = startStr.match(/^([-\d.]+)(.*)$/);
  const endMatch = endStr.match(/^([-\d.]+)(.*)$/);

  if (startMatch && endMatch) {
    const startNum = parseFloat(startMatch[1]);
    const endNum = parseFloat(endMatch[1]);
    const unit = endMatch[2] || startMatch[2] || '';
    const interpolated = lerp(startNum, endNum, progress);
    return unit ? `${interpolated}${unit}` : interpolated;
  }

  const startFuncMatch = startStr.match(/^([a-zA-Z]+)\(([-\d.]+)(.*)\)$/);
  const endFuncMatch = endStr.match(/^([a-zA-Z]+)\(([-\d.]+)(.*)\)$/);

  if (startFuncMatch && endFuncMatch && startFuncMatch[1] === endFuncMatch[1]) {
    const startNum = parseFloat(startFuncMatch[2]);
    const endNum = parseFloat(endFuncMatch[2]);
    const unit = endFuncMatch[3] || startFuncMatch[3] || '';
    const interpolated = lerp(startNum, endNum, progress);
    return `${endFuncMatch[1]}(${interpolated}${unit})`;
  }

  return progress >= 1 ? end : start;
}

/**
 * Resolve one property from a Framer Motion variant record at a scrubbed local progress.
 * Array targets are full keyframe sequences; scalar targets retain the existing from-to lerp.
 */
export function interpolateVariantValue(
  from: TransformValue,
  record: VariantRecord,
  property: AnimatableProperty,
  fallback: TransformValue,
  progress: number
): TransformValue {
  const target = record[property] ?? fallback;
  const clampedProgress = clamp(progress, 0, 1);
  if (!Array.isArray(target)) {
    return lerpTransformValue(from, target as TransformValue, clampedProgress);
  }
  if (target.length === 0) return from;
  const times = resolveKeyframeTimes(record, property, target.length);
  if (target.length === 1) return resolveKeyframeValue(target, 0, from);

  if (clampedProgress <= (times?.[0] ?? 0)) return resolveKeyframeValue(target, 0, from);
  for (let index = 1; index < target.length; index += 1) {
    const segmentEnd = times?.[index] ?? index / (target.length - 1);
    if (clampedProgress > segmentEnd) continue;
    const segmentStart = times?.[index - 1] ?? (index - 1) / (target.length - 1);
    const segmentLength = segmentEnd - segmentStart;
    const segmentProgress =
      segmentLength <= 0 ? 1 : (clampedProgress - segmentStart) / segmentLength;
    return lerpTransformValue(
      resolveKeyframeValue(target, index - 1, from),
      resolveKeyframeValue(target, index, from),
      segmentProgress
    );
  }
  return resolveKeyframeValue(target, target.length - 1, from);
}

export function getVariantTerminalValue(
  record: VariantRecord,
  property: AnimatableProperty,
  fallback: TransformValue
): TransformValue {
  const target = record[property] ?? fallback;
  if (!Array.isArray(target)) return target as TransformValue;
  return resolveKeyframeValue(target, target.length - 1, fallback);
}

export function parseNumericValue(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function getDefaultValue(
  property: AnimatableProperty,
  phase: 'initial' | 'animate' | 'exit'
): TransformValue {
  switch (property) {
    case 'opacity':
      return phase === 'initial' || phase === 'exit' ? 0 : 1;
    case 'scale':
      return 1;
    case 'filter':
      return 'none';
    default:
      return 0;
  }
}

export function getVariantValue<T extends TransformValue>(
  record: VariantRecord,
  property: AnimatableProperty,
  fallback: T
): T {
  const value = record[property];
  return value === undefined ? fallback : (value as T);
}
