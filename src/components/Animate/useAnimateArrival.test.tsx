import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import type { MotionValue } from 'framer-motion';
import type { ParsedAnimationVariant } from '../../types';
import type { SceneContextType } from './Animate';
import { useAnimateArrival } from './useAnimateArrival';

interface AnimationRun {
  stop: jest.Mock;
  onComplete?: () => void;
}

const animationRuns: AnimationRun[] = [];
const mockAnimate = jest.fn(
  (
    _value: unknown,
    _target: unknown,
    options?: { onComplete?: () => void }
  ): { stop: jest.Mock } => {
    const run = { stop: jest.fn(), onComplete: options?.onComplete };
    animationRuns.push(run);
    return { stop: run.stop };
  }
);

jest.mock('framer-motion', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const createMotionValue = <T,>(initial: T) => {
    let current = initial;
    const listeners = new Set<(value: T) => void>();
    return {
      get: (): T => current,
      set: (value: T): void => {
        current = value;
        listeners.forEach((listener) => listener(value));
      },
      on: (_event: string, listener: (value: T) => void): (() => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  };

  return {
    animate: (value: unknown, target: unknown, options?: { onComplete?: () => void }) =>
      mockAnimate(value, target, options),
    useMotionValue: <T,>(initial: T) => {
      const ref = React.useRef<ReturnType<typeof createMotionValue<T>> | null>(null);
      if (!ref.current) ref.current = createMotionValue(initial);
      return ref.current;
    },
    useTransform: <T, R>(source: { get: () => T }, transform: (value: T) => R) => {
      const ref = React.useRef<ReturnType<typeof createMotionValue<R>> | null>(null);
      if (!ref.current) ref.current = createMotionValue(transform(source.get()));
      return ref.current;
    },
  };
});

const ENTER_VARIANT: ParsedAnimationVariant = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

function createMotionValueStub(initial: number): MotionValue<number> {
  let current = initial;
  return {
    get: () => current,
    set: (value: number) => {
      current = value;
    },
    on: () => () => undefined,
  } as unknown as MotionValue<number>;
}

function createSceneContext(overrides: Partial<SceneContextType> = {}): SceneContextType {
  return {
    mode: 'drag',
    isActive: false,
    isDragging: false,
    dragProgressMotion: createMotionValueStub(0),
    sceneState: 'active',
    sceneOffset: 0,
    sceneTransitionDuration: 800,
    enterDuration: 800,
    registerAnimate: jest.fn(),
    unregisterAnimate: jest.fn(),
    getCalculatedDelay: jest.fn(() => 0),
    activationToken: 0,
    activationKind: null,
    ...overrides,
  };
}

interface HookProps {
  sceneContext: SceneContextType;
  enterVariant?: ParsedAnimationVariant | null;
  hasAuthoredEnterAnimation?: boolean;
  parseReady?: boolean;
  delay?: number;
  enterDuration?: number;
}

function renderArrival(initialProps: HookProps, strict = false) {
  return renderHook(
    (props: HookProps) =>
      useAnimateArrival({
        enabled: true,
        sceneContext: props.sceneContext,
        enterVariant: props.enterVariant === undefined ? ENTER_VARIANT : props.enterVariant,
        hasAuthoredEnterAnimation: props.hasAuthoredEnterAnimation ?? true,
        parseReady: props.parseReady ?? true,
        delay: props.delay ?? 0,
        enterDuration: props.enterDuration ?? 100,
      }),
    {
      initialProps,
      wrapper: strict ? StrictMode : undefined,
    }
  );
}

describe('useAnimateArrival', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAnimate.mockClear();
    animationRuns.length = 0;
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('waits for a formal activation token, ignores same-token rerenders, resets on departure, and replays on return', () => {
    const initialContext = createSceneContext({ isActive: true, activationToken: 0 });
    const { result, rerender } = renderArrival({
      sceneContext: initialContext,
      delay: 40,
      enterDuration: 100,
    });

    expect(result.current.phaseMotion.get()).toBe('idle');
    expect(mockAnimate).not.toHaveBeenCalled();

    rerender({
      sceneContext: createSceneContext({
        isActive: true,
        activationToken: 1,
        activationKind: 'commit',
      }),
      delay: 40,
      enterDuration: 100,
    });

    expect(result.current.phaseMotion.get()).toBe('waiting');
    act(() => jest.advanceTimersByTime(39));
    expect(mockAnimate).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(mockAnimate).toHaveBeenCalledTimes(1);
    expect(result.current.phaseMotion.get()).toBe('entering');

    rerender({
      sceneContext: createSceneContext({
        isActive: true,
        activationToken: 1,
        activationKind: 'commit',
      }),
      delay: 5,
      enterDuration: 10,
    });
    act(() => jest.advanceTimersByTime(100));
    expect(mockAnimate).toHaveBeenCalledTimes(1);

    rerender({
      sceneContext: createSceneContext({
        isActive: false,
        activationToken: 1,
        activationKind: 'commit',
      }),
      delay: 5,
      enterDuration: 10,
    });
    expect(animationRuns[0].stop).toHaveBeenCalledTimes(1);
    expect(result.current.phaseMotion.get()).toBe('idle');
    expect(result.current.visualMotion.get()).toBe(0);

    rerender({
      sceneContext: createSceneContext({
        isActive: true,
        activationToken: 2,
        activationKind: 'commit',
      }),
      delay: 5,
      enterDuration: 10,
    });
    act(() => jest.advanceTimersByTime(5));
    expect(mockAnimate).toHaveBeenCalledTimes(2);
  });

  it('reveals an already-mounted static fallback immediately but animates a later mount with the same token', () => {
    const waiting = createSceneContext({ isActive: true, activationToken: 0 });
    const existing = renderArrival({ sceneContext: waiting, delay: 0 });

    existing.rerender({
      sceneContext: createSceneContext({
        isActive: true,
        activationToken: 1,
        activationKind: 'static',
      }),
      delay: 0,
    });

    expect(existing.result.current.staticReveal).toBe(true);
    expect(existing.result.current.phaseMotion.get()).toBe('entered');
    expect(existing.result.current.visualMotion.get()).toBe(1);
    expect(mockAnimate).not.toHaveBeenCalled();
    existing.unmount();

    const dynamic = renderArrival({
      sceneContext: createSceneContext({
        isActive: true,
        activationToken: 1,
        activationKind: 'static',
      }),
      delay: 0,
    });

    expect(dynamic.result.current.staticReveal).toBe(false);
    expect(dynamic.result.current.phaseMotion.get()).toBe('entering');
    expect(mockAnimate).toHaveBeenCalledTimes(1);
  });

  it('holds an active token until parsing settles and fails open to the terminal frame when enter parsing yields no variant', () => {
    const context = createSceneContext({
      isActive: true,
      activationToken: 4,
      activationKind: 'programmatic',
    });
    const { result, rerender } = renderArrival({
      sceneContext: context,
      parseReady: false,
      enterVariant: null,
      delay: 0,
    });

    expect(result.current.phaseMotion.get()).toBe('idle');
    expect(mockAnimate).not.toHaveBeenCalled();

    rerender({
      sceneContext: context,
      parseReady: true,
      enterVariant: null,
      delay: 0,
    });

    expect(result.current.phaseMotion.get()).toBe('entered');
    expect(result.current.visualMotion.get()).toBe(1);
    expect(mockAnimate).not.toHaveBeenCalled();
  });

  it('delays infinite-only playback while keeping content at its terminal frame', () => {
    const { result } = renderArrival({
      sceneContext: createSceneContext({
        isActive: true,
        activationToken: 3,
        activationKind: 'ready',
      }),
      enterVariant: null,
      hasAuthoredEnterAnimation: false,
      delay: 25,
    });

    expect(result.current.visualMotion.get()).toBe(1);
    expect(result.current.phaseMotion.get()).toBe('entered');
    expect(result.current.shouldRunInfinite).toBe(false);
    act(() => jest.advanceTimersByTime(25));
    expect(result.current.shouldRunInfinite).toBe(true);
  });

  it('remains armed after React StrictMode effect replay', () => {
    const { result } = renderArrival(
      {
        sceneContext: createSceneContext({
          isActive: true,
          activationToken: 7,
          activationKind: 'commit',
        }),
        delay: 10,
      },
      true
    );

    act(() => jest.advanceTimersByTime(10));
    expect(result.current.phaseMotion.get()).toBe('entering');
    expect(mockAnimate).toHaveBeenCalled();
    expect(animationRuns.some((run) => !run.stop.mock.calls.length)).toBe(true);
  });
});
