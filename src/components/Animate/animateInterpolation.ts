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
  | 'opacity'
  | 'x'
  | 'y'
  | 'scale'
  | 'rotate'
  | 'rotateX'
  | 'rotateY'
  | 'skewX'
  | 'skewY'
  | 'filter';

export type TransformValue = number | string;
export type VariantRecord = Record<string, unknown>;

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
