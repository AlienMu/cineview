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

function createSceneContext(
  overrides?: Partial<Omit<SceneContextType, 'dragProgressMotion' | 'sharedElapsedMotion'>>
): SceneContextType {
  return {
    mode: 'drag',
    isActive: false,
    isDragging: false,
    dragProgressMotion: createMotionValueStub(0.4),
    dragTimelineProgress: 0.4,
    sharedElapsedMotion: createMotionValueStub(320),
    renderProgress: 0.8,
    sceneState: 'entering',
    sceneOffset: 1,
    sceneTransitionDuration: 800,
    sharedElapsedMs: 320,
    sharedTimelineDurationMs: 800,
    dragTransitionSnapshot: {
      fromScene: 0,
      toScene: 1,
      direction: 'forward',
      progressRatio: 0.4,
      sharedElapsedMs: 320,
      sharedTimelineDurationMs: 800,
    },
    getTimelineDuration: jest.fn(() => 800),
    registerAnimate: jest.fn(),
    unregisterAnimate: jest.fn(),
    getCalculatedDelay: jest.fn(() => 500),
    enterDuration: 200,
    ...overrides,
  } as SceneContextType;
}

describe('useAnimateDrag', () => {
  it('keeps delayed settle-enter elements on timeline progress instead of render release progress', () => {
    const sceneContext = createSceneContext();
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

    expect(result.current.scale.get()).toBeCloseTo(0.2);
  });
});
