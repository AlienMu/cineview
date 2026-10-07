import { act } from 'react';
import { renderHook } from '@testing-library/react';
import { frame, motionValue, useMotionValue } from 'framer-motion';
import type { MutableRefObject } from 'react';
import {
  getDefaultValue,
  getVariantValue,
  lerpTransformValue,
  parseNumericValue,
  type VariantRecord,
} from './animateInterpolation';
import { useAnimatedPropertyLanes, type PropertyValueResolver } from './useAnimatedPropertyLanes';

/**
 * Contract tests for the shared property-lane factory.
 *
 * The load-bearing distinction: an "arrival-style" numeric resolver (parse
 * both endpoints, then lerp) keeps tweening toward the fallback when the
 * animate endpoint is an unparseable string, while the default
 * `parse ∘ mixed-resolve` composition holds at the initial value and snaps on
 * the terminal frame. That boundary is exactly why useAnimateArrival injects
 * its own resolver — lock it here so the argument cannot be dropped silently.
 */

interface ArrivalShape {
  initial: VariantRecord;
  animate: VariantRecord;
}

const arrivalMixed: PropertyValueResolver<number, ArrivalShape> = (progress, variants, property) =>
  lerpTransformValue(
    getVariantValue(variants.initial, property, getDefaultValue(property, 'initial')),
    getVariantValue(variants.animate, property, getDefaultValue(property, 'animate')),
    progress
  );

const arrivalNumeric: PropertyValueResolver<number, ArrivalShape> = (
  progress,
  variants,
  property
) => {
  const fallback = parseNumericValue(getDefaultValue(property, 'animate'), 0);
  const initial = parseNumericValue(
    getVariantValue(variants.initial, property, getDefaultValue(property, 'initial')),
    fallback
  );
  const target = parseNumericValue(
    getVariantValue(variants.animate, property, getDefaultValue(property, 'animate')),
    fallback
  );
  return initial + (target - initial) * progress;
};

function renderLanes(variants: ArrivalShape, withNumericResolver: boolean) {
  const variantsRef: MutableRefObject<ArrivalShape> = { current: variants };
  const view = renderHook(() => {
    const source = useMotionValue(0);
    const lanes = useAnimatedPropertyLanes(
      source,
      variantsRef,
      arrivalMixed,
      withNumericResolver ? arrivalNumeric : undefined
    );
    return { source, lanes };
  });
  // The hook refreshes outputs after each render, so these interpolation checks
  // can run without the frame loop. The separate scheduling test drives source
  // changes through a real Motion frame without rerendering.
  const driveTo = (progress: number): void => {
    act(() => {
      view.result.current.source.set(progress);
    });
    act(() => {
      view.rerender();
    });
  };
  return { ...view, driveTo };
}

describe('useAnimatedPropertyLanes', () => {
  it('shares one source subscription and publishes the latest frame without a React render', async () => {
    const source = motionValue(0);
    const subscribe = jest.spyOn(source, 'on');
    const variants = {
      current: { initial: { opacity: 0, x: 0 }, animate: { opacity: 1, x: 100 } },
    };
    let renders = 0;
    const view = renderHook(() => {
      renders += 1;
      return useAnimatedPropertyLanes(source, variants, arrivalMixed);
    });
    expect(subscribe.mock.calls.filter(([event]) => event === 'change')).toHaveLength(1);
    const initialRenders = renders;
    await act(async () => {
      source.set(0.2);
      source.set(0.75);
      await new Promise<void>((resolve) => frame.postRender(() => resolve()));
    });
    expect(view.result.current.opacity.get()).toBe(0.75);
    expect(view.result.current.x.get()).toBe(75);
    expect(renders).toBe(initialRenders);
    const opacity = view.result.current.opacity;
    act(() => source.set(0.9));
    view.unmount();
    await new Promise<void>((resolve) => frame.postRender(() => resolve()));
    expect(opacity.get()).toBe(0.75);
    source.destroy();
  });

  it('refreshes changed variants at a stationary progress and detaches a replaced source', async () => {
    const first = motionValue(0.5);
    const second = motionValue(0.25);
    const variants = {
      current: { initial: { opacity: 0, x: 0 }, animate: { opacity: 1, x: 100 } },
    };
    const view = renderHook(
      ({ source }) => useAnimatedPropertyLanes(source, variants, arrivalMixed),
      { initialProps: { source: first } }
    );
    const output = view.result.current.x;
    expect(output.get()).toBe(50);
    variants.current = { initial: { opacity: 0, x: 0 }, animate: { opacity: 1, x: 200 } };
    view.rerender({ source: first });
    expect(output.get()).toBe(100);
    act(() => first.set(0.9));
    view.rerender({ source: second });
    await act(async () => {
      first.set(1);
      second.set(0.4);
      await new Promise<void>((resolve) => frame.postRender(() => resolve()));
    });
    expect(view.result.current.x).toBe(output);
    expect(output.get()).toBe(80);
    view.unmount();
    first.destroy();
    second.destroy();
  });

  it('tweens an arrival-style numeric lane toward the fallback for unparseable targets', () => {
    const { result, driveTo } = renderLanes(
      { initial: { opacity: 0 }, animate: { opacity: 'visible' } },
      true
    );

    expect(result.current.lanes.opacity.get()).toBe(0);
    driveTo(0.5);
    expect(result.current.lanes.opacity.get()).toBe(0.5);
    driveTo(1);
    expect(result.current.lanes.opacity.get()).toBe(1);
  });

  it('holds at the initial value and snaps on the terminal frame without a numeric resolver', () => {
    // Documents the boundary that makes the arrival resolver necessary: the
    // default composition resolves the mixed value first, and a type-mismatched
    // lerp holds at `start` until progress >= 1.
    const { result, driveTo } = renderLanes(
      { initial: { opacity: 0 }, animate: { opacity: 'visible' } },
      false
    );

    driveTo(0.5);
    expect(result.current.lanes.opacity.get()).toBe(0);
    driveTo(1);
    expect(result.current.lanes.opacity.get()).toBe(1);
  });

  it('agrees between both numeric paths for parseable endpoints', () => {
    const withResolver = renderLanes(
      { initial: { opacity: 0, scale: 0.5 }, animate: { opacity: 1, scale: '0.9' } },
      true
    );
    const withoutResolver = renderLanes(
      { initial: { opacity: 0, scale: 0.5 }, animate: { opacity: 1, scale: '0.9' } },
      false
    );

    withResolver.driveTo(0.25);
    withoutResolver.driveTo(0.25);
    expect(withResolver.result.current.lanes.opacity.get()).toBeCloseTo(0.25);
    expect(withoutResolver.result.current.lanes.opacity.get()).toBeCloseTo(0.25);
    expect(withResolver.result.current.lanes.scale.get()).toBeCloseTo(0.6);
    expect(withoutResolver.result.current.lanes.scale.get()).toBeCloseTo(0.6);
  });

  it('exposes the ten style keys in the fixed lane order', () => {
    const { result } = renderLanes({ initial: {}, animate: {} }, true);
    expect(Object.keys(result.current.lanes.style)).toEqual([
      'opacity',
      'x',
      'y',
      'scale',
      'rotate',
      'rotateX',
      'rotateY',
      'skewX',
      'skewY',
      'filter',
    ]);
  });
});
