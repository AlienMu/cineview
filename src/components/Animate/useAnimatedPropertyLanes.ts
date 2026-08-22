/**
 * Shared per-property MotionValue lanes for the Animate drivers.
 *
 * drag / scroll / arrival each resolve variants differently (rich visual-state
 * machine vs signed progress vs plain lerp), but the *lane shape* is identical:
 * ten unconditional `useTransform` calls in a fixed property order, where
 * opacity and scale are numeric-coerced and the rest pass values through.
 * This factory owns that shape once; each driver injects only its leaf
 * resolver. Adding a new animatable property now means editing one file here
 * instead of three parallel hand-enumerated blocks.
 *
 * Contract notes:
 * - Lane order (opacity, x, y, scale, rotate, rotateX, rotateY, skewX, skewY,
 *   filter) and the style key order below are load-bearing: the hook sequence
 *   must stay stable across renders (rules-of-hooks) and matches the order the
 *   drivers previously used.
 * - `resolveNumericValue` exists because arrival's numeric semantics are NOT
 *   `parse ∘ mixed-resolve`: it parses both endpoints first and lerps
 *   numerically, which keeps unparseable endpoint strings tweening toward the
 *   fallback instead of holding and snapping on the final frame. drag/scroll
 *   omit it and get the default `parse ∘ resolveValue` composition, which is
 *   value-for-value identical to their former local helpers.
 *
 * Runtime framer-motion import is restricted to `useTransform` on purpose:
 * the sparse driver-test mocks only provide { useMotionValue, useTransform }.
 */
import { useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import type { MutableRefObject } from 'react';
import {
  getDefaultValue,
  parseNumericValue,
  type AnimatableProperty,
  type TransformValue,
} from './animateInterpolation';

/** Per-driver leaf resolution: (source value, variants, property) → raw value. */
export type PropertyValueResolver<T, V> = (
  input: T,
  variants: V,
  property: AnimatableProperty
) => TransformValue;

function useMixedPropertyLane<T, V>(
  source: MotionValue<T>,
  variantsRef: MutableRefObject<V>,
  property: AnimatableProperty,
  resolveValue: PropertyValueResolver<T, V>
): MotionValue<TransformValue> {
  return useTransform(source, (input) => resolveValue(input, variantsRef.current, property));
}

function useNumericPropertyLane<T, V>(
  source: MotionValue<T>,
  variantsRef: MutableRefObject<V>,
  property: AnimatableProperty,
  resolveValue: PropertyValueResolver<T, V>,
  resolveNumericValue?: PropertyValueResolver<T, V>
): MotionValue<number> {
  return useTransform(source, (input) => {
    const fallback = parseNumericValue(getDefaultValue(property, 'animate'), 0);
    const resolve = resolveNumericValue ?? resolveValue;
    return parseNumericValue(resolve(input, variantsRef.current, property), fallback);
  });
}

export interface AnimatedPropertyLanes {
  style: {
    opacity: MotionValue<number>;
    x: MotionValue<TransformValue>;
    y: MotionValue<TransformValue>;
    scale: MotionValue<number>;
    rotate: MotionValue<TransformValue>;
    rotateX: MotionValue<TransformValue>;
    rotateY: MotionValue<TransformValue>;
    skewX: MotionValue<TransformValue>;
    skewY: MotionValue<TransformValue>;
    filter: MotionValue<TransformValue>;
  };
  opacity: MotionValue<number>;
  x: MotionValue<TransformValue>;
  y: MotionValue<TransformValue>;
  scale: MotionValue<number>;
  rotate: MotionValue<TransformValue>;
  rotateX: MotionValue<TransformValue>;
  rotateY: MotionValue<TransformValue>;
  skewX: MotionValue<TransformValue>;
  skewY: MotionValue<TransformValue>;
  filter: MotionValue<TransformValue>;
}

export function useAnimatedPropertyLanes<T, V>(
  source: MotionValue<T>,
  variantsRef: MutableRefObject<V>,
  resolveValue: PropertyValueResolver<T, V>,
  resolveNumericValue?: PropertyValueResolver<T, V>
): AnimatedPropertyLanes {
  const opacity = useNumericPropertyLane(
    source,
    variantsRef,
    'opacity',
    resolveValue,
    resolveNumericValue
  );
  const x = useMixedPropertyLane(source, variantsRef, 'x', resolveValue);
  const y = useMixedPropertyLane(source, variantsRef, 'y', resolveValue);
  const scale = useNumericPropertyLane(
    source,
    variantsRef,
    'scale',
    resolveValue,
    resolveNumericValue
  );
  const rotate = useMixedPropertyLane(source, variantsRef, 'rotate', resolveValue);
  const rotateX = useMixedPropertyLane(source, variantsRef, 'rotateX', resolveValue);
  const rotateY = useMixedPropertyLane(source, variantsRef, 'rotateY', resolveValue);
  const skewX = useMixedPropertyLane(source, variantsRef, 'skewX', resolveValue);
  const skewY = useMixedPropertyLane(source, variantsRef, 'skewY', resolveValue);
  const filter = useMixedPropertyLane(source, variantsRef, 'filter', resolveValue);

  return {
    style: {
      opacity,
      x,
      y,
      scale,
      rotate,
      rotateX,
      rotateY,
      skewX,
      skewY,
      filter,
    },
    opacity,
    x,
    y,
    scale,
    rotate,
    rotateX,
    rotateY,
    skewX,
    skewY,
    filter,
  };
}
