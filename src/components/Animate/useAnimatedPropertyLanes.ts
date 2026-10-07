/** Shared visual outputs for drag, scroll and clock-driven animations.
 * One source subscription updates all properties in Motion's pre-render phase.
 * Outputs keep separate MotionValues so DOM rendering and subscriptions retain
 * their existing semantics, without ten independent frame callbacks per driver.
 */
import { cancelFrame, frame, useMotionValue, type MotionValue } from 'framer-motion';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import {
  getDefaultValue,
  parseNumericValue,
  type AnimatableProperty,
  type TransformValue,
} from './animateInterpolation';

export type PropertyValueResolver<T, V> = (
  input: T,
  variants: V,
  property: AnimatableProperty
) => TransformValue;

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
  const numeric = (input: T, property: AnimatableProperty): number => {
    const fallback = parseNumericValue(getDefaultValue(property, 'animate'), 0);
    return parseNumericValue(
      (resolveNumericValue ?? resolveValue)(input, variantsRef.current, property),
      fallback
    );
  };
  const initial = source.get();
  const opacity = useMotionValue(numeric(initial, 'opacity'));
  const x = useMotionValue(resolveValue(initial, variantsRef.current, 'x'));
  const y = useMotionValue(resolveValue(initial, variantsRef.current, 'y'));
  const scale = useMotionValue(numeric(initial, 'scale'));
  const rotate = useMotionValue(resolveValue(initial, variantsRef.current, 'rotate'));
  const rotateX = useMotionValue(resolveValue(initial, variantsRef.current, 'rotateX'));
  const rotateY = useMotionValue(resolveValue(initial, variantsRef.current, 'rotateY'));
  const skewX = useMotionValue(resolveValue(initial, variantsRef.current, 'skewX'));
  const skewY = useMotionValue(resolveValue(initial, variantsRef.current, 'skewY'));
  const filter = useMotionValue(resolveValue(initial, variantsRef.current, 'filter'));

  // The queued callback always reads the current source and variants. A parent
  // render can replace either while work is waiting for the pre-render phase.
  const updateRef = useRef<() => void>(() => {});
  updateRef.current = (): void => {
    const input = source.get();
    const variants = variantsRef.current;
    opacity.set(numeric(input, 'opacity'));
    x.set(resolveValue(input, variants, 'x'));
    y.set(resolveValue(input, variants, 'y'));
    scale.set(numeric(input, 'scale'));
    rotate.set(resolveValue(input, variants, 'rotate'));
    rotateX.set(resolveValue(input, variants, 'rotateX'));
    rotateY.set(resolveValue(input, variants, 'rotateY'));
    skewX.set(resolveValue(input, variants, 'skewX'));
    skewY.set(resolveValue(input, variants, 'skewY'));
    filter.set(resolveValue(input, variants, 'filter'));
  };

  useEffect(() => {
    const update = (): void => updateRef.current();
    const schedule = (): void => {
      frame.preRender(update, false, true);
    };
    const unsubscribe = source.on('change', schedule);
    return (): void => {
      unsubscribe();
      cancelFrame(update);
    };
  }, [source]);

  // Variant refs can change without the numeric source moving (for example an
  // async preset arriving at progress zero). Publish that authored frame too.
  useEffect(() => updateRef.current());

  return useMemo(() => {
    const style = { opacity, x, y, scale, rotate, rotateX, rotateY, skewX, skewY, filter };
    return { style, ...style };
  }, [opacity, x, y, scale, rotate, rotateX, rotateY, skewX, skewY, filter]);
}
