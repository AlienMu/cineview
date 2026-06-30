/**
 * useAnimateDrag 分支补充测试
 *
 * 覆盖以下未覆盖分支（通过 hook 驱动内部纯函数，内部函数未导出）：
 * - lerpStringValue 的 function-form 字符串插值分支（lines 101-105）
 * - parseNumericValue 的字符串解析分支（lines 113-117）
 * - debugDrag + isVerboseDragDebug 的 development + __CINEVIEW_DRAG_DEBUG__ 路径
 *   （lines 145-166, mode handoff 540, delay gate 570, verbose snapshot 590-593）
 * - resolveEnterLocalProgress 的 enterDuration <= 0 分支（line 212）
 *
 * 复用与 useAnimateDrag.test.ts 相同的 framer-motion mock。
 */

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
  options: { elementElapsedMs: number },
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

describe('useAnimateDrag branch coverage', () => {
  it('parses string numeric variant values for numeric properties (parseNumericValue string branch)', () => {
    // rest mode (active, offset 0, idle, not entering) returns the animate value
    // directly. scale animate is the STRING "0.7" -> parseNumericValue must take
    // its string-parse branch and yield 0.7.
    const sceneContext = createSceneContext(
      { elementElapsedMs: 0 },
      {
        isActive: true,
        sceneOffset: 0,
        isDragging: false,
        renderProgress: 0,
        dragRelease: null,
        firstSceneEnterActive: false,
      }
    );
    const enterVariant = {
      initial: { scale: 0.2 },
      animate: { scale: '0.7' },
      exit: {},
    } as unknown as ParsedAnimationVariant;

    const { result } = renderHook(() =>
      useAnimateDrag({
        sceneContext,
        enterVariant,
        exitVariant: null,
        componentId: 'string-numeric',
        delay: 0,
        enterDuration: 200,
        exitDuration: 200,
      })
    );

    expect(result.current.scale.get()).toBeCloseTo(0.7);
  });

  it('treats enterDuration <= 0 as immediately complete (localProgress 1)', () => {
    // enter mode (incoming offset 1, renderProgress > 0) → drag scrub. A fully
    // degenerate element (delay 0 + duration 0) has no axis to scrub, so it
    // completes the moment the drag starts (r > 0). r = 600/800 = 0.75 > 0 → 1,
    // and the enter lerp lands on the animate value (scale 1).
    const sceneContext = createSceneContext(
      { elementElapsedMs: 600 },
      {
        sceneOffset: 1,
        renderProgress: 0.8,
        getCalculatedDelay: jest.fn(() => 0),
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
        componentId: 'zero-duration-enter',
        delay: 0,
        enterDuration: 0,
        exitDuration: 200,
      })
    );

    expect(result.current.scale.get()).toBeCloseTo(1);
  });

  it('interpolates function-form string transforms during enter (lerpStringValue func branch)', () => {
    // x initial "translate(0px)" -> animate "translate(100px)" at enter
    // localProgress 0.5 exercises the same-function-name interpolation branch.
    // The mock only stores numeric transform outputs, so we assert the numeric
    // opacity (which shares the same enter localProgress) lands at the midpoint,
    // proving the enter path ran while x's string lerp branch was executed.
    // Single shared timeline: the element reads the track elapsed directly and
    // gates on its own (delay 0, duration 200). elapsed 100 -> (100-0)/200 = 0.5.
    const sceneContext = createSceneContext(
      { elementElapsedMs: 100 },
      {
        sceneOffset: 1,
        renderProgress: 0.8,
        getCalculatedDelay: jest.fn(() => 0),
      }
    );
    const enterVariant = {
      initial: { x: 'translate(0px)', opacity: 0 },
      animate: { x: 'translate(100px)', opacity: 1 },
      exit: {},
    } as unknown as ParsedAnimationVariant;

    const { result } = renderHook(() =>
      useAnimateDrag({
        sceneContext,
        enterVariant,
        exitVariant: null,
        componentId: 'func-string-enter',
        delay: 0,
        enterDuration: 200,
        exitDuration: 200,
      })
    );

    // elapsed 100; (100-0)/200 = 0.5 -> opacity lerp(0, 1, 0.5) = 0.5.
    expect(result.current.opacity.get()).toBeCloseTo(0.5);
  });

  it('emits verbose drag debug logs when development + __CINEVIEW_DRAG_DEBUG__ are enabled', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const dbgWindow = window as Window & { __CINEVIEW_DRAG_DEBUG__?: boolean };
    const originalFlag = dbgWindow.__CINEVIEW_DRAG_DEBUG__;
    process.env.NODE_ENV = 'development';
    dbgWindow.__CINEVIEW_DRAG_DEBUG__ = true;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      // enter mode with partial progress so the mode-handoff log (540), the
      // delay-gate trace (570, mode === 'enter'), and the verbose snapshot
      // (590-593) all fire on the initial updateVisualMotion.
      const sceneContext = createSceneContext(
        { elementElapsedMs: 100 },
        {
          sceneOffset: 1,
          renderProgress: 0.8,
          getCalculatedDelay: jest.fn(() => 0),
        }
      );
      const enterVariant = {
        initial: { scale: 0.2 },
        animate: { scale: 1 },
        exit: {},
      } as ParsedAnimationVariant;

      renderHook(() =>
        useAnimateDrag({
          sceneContext,
          enterVariant,
          exitVariant: null,
          componentId: 'debug-enter',
          delay: 0,
          enterDuration: 200,
          exitDuration: 200,
        })
      );

      expect(logSpy).toHaveBeenCalled();
      const messages = logSpy.mock.calls.map((call) => String(call[0]));
      expect(messages.some((m) => m.includes('mode handoff'))).toBe(true);
      expect(messages.some((m) => m.includes('state snapshot'))).toBe(true);
    } finally {
      logSpy.mockRestore();
      process.env.NODE_ENV = originalNodeEnv;
      if (originalFlag === undefined) {
        delete dbgWindow.__CINEVIEW_DRAG_DEBUG__;
      } else {
        dbgWindow.__CINEVIEW_DRAG_DEBUG__ = originalFlag;
      }
    }
  });
});
