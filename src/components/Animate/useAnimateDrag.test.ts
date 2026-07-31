import { renderHook } from '@testing-library/react';
import type { MotionValue } from 'framer-motion';
import {
  buildAnimationRegistrySnapshot,
  freezeAnimationRegistrySnapshot,
} from '../../animations/registry';
import type { ParsedAnimationVariant } from '../../types';
import { DEFAULT_DRAG_TIMELINE_CONFIG } from '../../utils/dragTimelineMapping';
import { createPreparedSceneSnapshot, DragPreparedSceneStore } from '../Scene/dragPreparedState';
import type { SceneContextType } from './Animate';
import { useAnimateDrag } from './useAnimateDrag';

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
        get: () => unknown;
        on: (_event: string, listener: (value: unknown) => void) => () => void;
      },
      transform: (value: unknown) => number | string
    ) => {
      const motionValue = createMotionValueStub(0);
      const update = (): void => {
        // Real framer-motion passes source.get() into the transformer; the
        // hook reads it as the resolved DragVisualState. The old no-arg form
        // left it undefined, so every property fell through to the !vs animate
        // fallback (scale/opacity stuck at 1).
        const next = transform(source.get());
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
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

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

  it('keeps one registry lease while a transaction view advances across drag frames', () => {
    const enterVariant = {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: {},
    } as ParsedAnimationVariant;
    const registrySnapshot = freezeAnimationRegistrySnapshot(
      buildAnimationRegistrySnapshot({
        baseDuration: 0,
        registrations: new Map([
          [
            'stable-lease',
            {
              delay: 0,
              duration: 500,
              driver: 'drag' as const,
            },
          ],
        ]),
      })
    );
    const prepared = createPreparedSceneSnapshot({
      sceneIndex: 1,
      instanceId: Symbol('scene-1'),
      revision: 1,
      enabled: true,
      mapping: DEFAULT_DRAG_TIMELINE_CONFIG,
      registrySnapshot,
      enterVariantsByAnimateId: new Map([['stable-lease', enterVariant]]),
    });
    const store = new DragPreparedSceneStore();
    store.publishPrepared(prepared);

    const dispose = jest.fn();
    const registerAnimate = jest.fn(() => ({
      animateId: 'stable-lease',
      generation: 1,
      getCalculatedDelay: () => 0,
      setEnterVariant: jest.fn(),
      observeWaitFor: () => () => undefined,
      publishEnterCompleted: jest.fn(),
      dispose,
    }));
    const sceneContext = createSceneContext(
      { elementElapsedMs: 100 },
      {
        isDragging: true,
        renderProgress: 0.1,
        registerAnimate,
        dragTransaction: store.beginTransaction(1, 'driving', 0.1),
      }
    );

    const { rerender } = renderHook(
      ({ transaction }) =>
        useAnimateDrag({
          sceneContext: { ...sceneContext, dragTransaction: transaction },
          enterVariant,
          exitVariant: null,
          componentId: 'stable-lease',
          delay: 0,
          enterDuration: 500,
          exitDuration: 200,
        }),
      { initialProps: { transaction: sceneContext.dragTransaction } }
    );

    for (let frame = 2; frame <= 6; frame += 1) {
      rerender({ transaction: store.beginTransaction(1, 'driving', frame / 10) });
    }

    expect(registerAnimate).toHaveBeenCalledTimes(1);
    expect(dispose).not.toHaveBeenCalled();
  });

  it('warns once when drag choreography changes during one frozen transaction', () => {
    process.env.NODE_ENV = 'development';
    const frozenVariant = {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: {},
    } as ParsedAnimationVariant;
    const liveVariant = {
      initial: { opacity: 0.2 },
      animate: { opacity: 1 },
      exit: {},
    } as ParsedAnimationVariant;
    const registrySnapshot = freezeAnimationRegistrySnapshot(
      buildAnimationRegistrySnapshot({
        baseDuration: 0,
        registrations: new Map([
          [
            'mutation-warning',
            {
              delay: 0,
              duration: 500,
              driver: 'drag' as const,
            },
          ],
        ]),
      })
    );
    const store = new DragPreparedSceneStore();
    store.publishPrepared(
      createPreparedSceneSnapshot({
        sceneIndex: 1,
        instanceId: Symbol('scene-1'),
        revision: 1,
        enabled: true,
        mapping: DEFAULT_DRAG_TIMELINE_CONFIG,
        registrySnapshot,
        enterVariantsByAnimateId: new Map([['mutation-warning', frozenVariant]]),
      })
    );
    const sceneContext = createSceneContext(
      { elementElapsedMs: 100 },
      {
        isDragging: true,
        renderProgress: 0.1,
        dragTransaction: store.beginTransaction(1, 'driving', 0.1),
      }
    );
    const warningSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { rerender } = renderHook(
      ({ transaction }) =>
        useAnimateDrag({
          sceneContext: { ...sceneContext, dragTransaction: transaction },
          enterVariant: liveVariant,
          exitVariant: null,
          componentId: 'mutation-warning',
          delay: 20,
          enterDuration: 600,
          exitDuration: 200,
        }),
      { initialProps: { transaction: sceneContext.dragTransaction } }
    );

    rerender({ transaction: store.beginTransaction(1, 'driving', 0.2) });
    rerender({ transaction: store.beginTransaction(1, 'driving', 0.3) });

    expect(warningSpy).toHaveBeenCalledTimes(1);
    expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining('remains frozen'));
    warningSpy.mockRestore();
  });

  it('warns once when an active Scene mounts an Animate outside its playback snapshot', () => {
    process.env.NODE_ENV = 'development';
    const liveVariant = {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: {},
    } as ParsedAnimationVariant;
    const registrySnapshot = freezeAnimationRegistrySnapshot(
      buildAnimationRegistrySnapshot({
        baseDuration: 0,
        registrations: new Map(),
      })
    );
    const store = new DragPreparedSceneStore();
    store.publishPrepared(
      createPreparedSceneSnapshot({
        sceneIndex: 1,
        instanceId: Symbol('scene-1'),
        revision: 1,
        enabled: true,
        mapping: DEFAULT_DRAG_TIMELINE_CONFIG,
        registrySnapshot,
        enterVariantsByAnimateId: new Map(),
      })
    );
    const sceneContext = createSceneContext(
      { elementElapsedMs: 100 },
      {
        isActive: true,
        isDragging: false,
        sceneOffset: 0,
        renderProgress: 0,
        dragTransaction: store.beginTransaction(1, 'settling', 0.5),
      }
    );
    const warningSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { rerender } = renderHook(
      ({ transaction }) =>
        useAnimateDrag({
          sceneContext: { ...sceneContext, dragTransaction: transaction },
          enterVariant: liveVariant,
          exitVariant: null,
          componentId: 'late-mount',
          delay: 0,
          enterDuration: 500,
          exitDuration: 200,
        }),
      { initialProps: { transaction: sceneContext.dragTransaction } }
    );

    rerender({ transaction: store.beginTransaction(1, 'settling', 0.6) });

    expect(warningSpy).toHaveBeenCalledTimes(1);
    expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining('mounted after'));
    warningSpy.mockRestore();
  });
});
