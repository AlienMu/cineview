import { act, renderHook } from '@testing-library/react';
import type { ParsedAnimationVariant } from '../../types';
import type { SceneContextType } from './Animate';
import { useAnimateArrival } from './useAnimateArrival';

/**
 * Wiring lock for the arrival driver's property lanes (task-flow
 * 2026-08-22-m-level-remediation N2+N3).
 *
 * Unlike useAnimateArrival.test.tsx (which mocks all of framer-motion), this
 * file uses the REAL useTransform/useMotionValue so lane outputs can be read
 * after the variants have been frozen. The load-bearing assertion: with an
 * unparseable animate endpoint (`opacity: 'visible'`), the numeric lane keeps
 * tweening toward the fallback — the semantics that
 * resolveArrivalNumericPropertyValue exists to preserve. Dropping the numeric
 * resolver from the useAnimatedPropertyLanes call would make mid-pass values
 * hold at the initial frame instead (0 instead of 0.5 below).
 */
jest.mock('framer-motion', () => {
  const actual = jest.requireActual('framer-motion');
  return {
    ...actual,
    animate: jest.fn(() => ({ stop: jest.fn() })),
  };
});

const UNPARSEABLE_OPACITY_VARIANT: ParsedAnimationVariant = {
  initial: { opacity: 0 },
  animate: { opacity: 'visible' },
  exit: {},
};

function createSceneContext(overrides: Partial<SceneContextType> = {}): SceneContextType {
  return {
    mode: 'drag',
    isActive: true,
    isDragging: false,
    dragProgressMotion: { get: () => 0, set: () => undefined, on: () => () => undefined } as never,
    sceneState: 'active',
    sceneOffset: 0,
    sceneTransitionDuration: 800,
    enterDuration: 800,
    registerAnimate: jest.fn(),
    unregisterAnimate: jest.fn(),
    getCalculatedDelay: jest.fn(() => 0),
    activationToken: 1,
    activationKind: 'ready',
    ...overrides,
  };
}

describe('useAnimateArrival property lanes', () => {
  it('tweens numeric lanes toward the fallback when the animate endpoint is unparseable', () => {
    const props = {
      sceneContext: createSceneContext(),
      enterVariant: UNPARSEABLE_OPACITY_VARIANT,
      hasAuthoredEnterAnimation: true,
      parseReady: true,
      delay: 0,
      enterDuration: 0,
    };
    const view = renderHook((p: typeof props) => useAnimateArrival({ enabled: true, ...p }), {
      initialProps: props,
    });
    // framer-motion recomputes useTransform outputs synchronously during
    // render, so rerendering after a set() is the deterministic drive.
    const driveTo = (progress: number): void => {
      act(() => {
        view.result.current.visualMotion.set(progress);
      });
      act(() => {
        view.rerender(props);
      });
    };

    // Enter duration 0 lands directly on the terminal frame.
    expect(view.result.current.style.opacity.get()).toBe(1);
    driveTo(0.5);
    expect(view.result.current.style.opacity.get()).toBe(0.5);
    driveTo(0);
    expect(view.result.current.style.opacity.get()).toBe(0);
  });
});
