import { renderHook } from '@testing-library/react';
import type { MotionValue } from 'framer-motion';
import { useAnimateDrag } from './useAnimateDrag';
import type { ParsedAnimationVariant } from '../../types';
import type { SceneContextType } from './Animate';

jest.mock('framer-motion', () => {
  const createMotionValueStub = (initial: number) => {
    let current = initial;
    const listeners = new Set<(value: number) => void>();

    return {
      get: (): number => current,
      set: (value: number): void => {
        current = value;
        listeners.forEach((listener) => listener(value));
      },
      on: (_event: string, listener: (value: number) => void): (() => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  };

  return {
    useMotionValue: (initial: number) => createMotionValueStub(initial),
    useTransform: (
      source: {
        get: () => number;
        on: (_event: string, listener: (value: number) => void) => () => void;
      },
      transform: () => number | string
    ) => {
      const motionValue = createMotionValueStub(0);
      const update = (): void => {
        const next = transform();
        if (typeof next === 'number') {
          motionValue.set(next);
        }
      };

      update();
      source.on('change', update);
      return motionValue;
    },
    animate: (
      value: { set?: (next: number) => void } | number,
      _target: number,
      options?: { onUpdate?: (latest: number) => void; onComplete?: () => void }
    ) => {
      if (typeof value === 'object' && value?.set) value.set(_target);
      options?.onUpdate?.(_target);
      options?.onComplete?.();
      return { stop: jest.fn() };
    },
  };
});

function createMotionValueStub(initial: number): MotionValue<number> {
  let current = initial;
  const listeners = new Set<(value: number) => void>();

  return {
    get: (): number => current,
    set: (value: number): void => {
      current = value;
      listeners.forEach((listener) => listener(value));
    },
    on: (_event: string, listener: (value: number) => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } as MotionValue<number>;
}

// Two-track model: the enter source is the per-scene element track
// (sharedElapsedMotion = elapsed ms of THIS scene's enter timeline). The old
// snapshot / sharedElapsedMs scalar inputs are gone — elapsed is fed directly
// via the motion value. The incoming scene (offset 1, renderProgress > 0)
// resolves through the `enter` mode and reads the track.
function createSceneContext(
  options: {
    elementElapsedMs: number;
  },
  overrides?: Partial<Omit<SceneContextType, 'dragProgressMotion' | 'sharedElapsedMotion'>>
): SceneContextType {
  return {
    mode: 'drag',
    isActive: false,
    isDragging: false,
    dragProgressMotion: createMotionValueStub(0.4),
    dragTimelineProgress: 0.4,
    sharedElapsedMotion: createMotionValueStub(options.elementElapsedMs),
    renderProgress: 0.8,
    sceneState: 'entering',
    sceneOffset: 1,
    sceneTransitionDuration: 800,
    sharedTimelineDurationMs: 800,
    dragRelease: null,
    getTimelineDuration: jest.fn(() => 800),
    registerAnimate: jest.fn(),
    unregisterAnimate: jest.fn(),
    getCalculatedDelay: jest.fn(() => 500),
    enterDuration: 200,
    ...overrides,
  } as SceneContextType;
}

describe('useAnimateDrag', () => {
  it('keeps delayed enter elements gated on the element-track elapsed, not render release progress', () => {
    // Element track elapsed = 320ms, which is < delay 500ms, so the element must
    // still be at its enter-initial (scale 0.2). The render release progress
    // (0.8) must NOT inflate the element timeline past the delay gate.
    const sceneContext = createSceneContext({ elementElapsedMs: 320 });
    const enterVariant = {
      initial: { scale: 0.2 },
      animate: { scale: 1 },
      exit: {},
    } as ParsedAnimationVariant;

    const { result } = renderHook(() =>
      useAnimateDrag({
        sceneContext,
        enterVariant,
        exitVariant: null,
        componentId: 'delayed-enter',
        delay: 500,
        enterDuration: 200,
        exitDuration: 200,
      })
    );

    // timelineProgress 0.4 * 800ms = 320ms elapsed, which is < delay 500ms, so
    // the element must still be at its enter-initial (scale 0.2). The render
    // release progress (0.8) must NOT inflate the element timeline past the
    // delay gate — that was the "delay does not block the animation" bug.
    expect(result.current.scale.get()).toBeCloseTo(0.2);
  });

  it('ramps the element timeline linearly from transitionProgress, ignoring the eased render position', () => {
    // delay 400 + duration 400 over an 800ms timeline. At transitionProgress
    // 0.75 the linear elapsed is 600ms -> 200ms into a 400ms enter -> 0.5.
    // The render position (0.95) is eased and would inflate elapsed to ~798ms
    // (localProgress ~1.0) if it leaked into the element timeline — it must not.
    const sceneContext = createSceneContext(
      { elementElapsedMs: 600 },
      {
        dragTimelineProgress: 0.75,
        renderProgress: 0.95,
        getTimelineDuration: jest.fn(() => 800),
        getCalculatedDelay: jest.fn(() => 400),
      }
    );
    const enterVariant = {
      initial: { scale: 0.2 },
      animate: { scale: 1 },
      exit: {},
    } as ParsedAnimationVariant;

    const { result } = renderHook(() =>
      useAnimateDrag({
        sceneContext,
        enterVariant,
        exitVariant: null,
        componentId: 'ramping-enter',
        delay: 400,
        enterDuration: 400,
        exitDuration: 200,
      })
    );

    // Linear: lerp(0.2, 1, 0.5) = 0.6. The eased-render bug would push this to ~1.0.
    expect(result.current.scale.get()).toBeCloseTo(0.6);
  });
});
