/**
 * Task flow: 2026-06-25-drag-waitfor-cascade-frozen
 *
 * Hook-level deterministic proof for root cause #2: a scene-0 cold-start that
 * COMPLETES before the waitFor-bearing children grow the registry duration must
 * still extend its element track to the larger (cascaded) T.
 *
 * The integration-level test could not force the warm-cache ordering (the
 * Animate children usually register before the cold-start tween completes), so
 * it false-greened against the buggy guard. This hook test controls both axes
 * directly: `getTimelineDuration` is a mutable closure, and the framer-motion
 * `animate` mock is a STEP DRIVER (no auto-advance) so a tween can be left
 * in-flight or completed on demand. We:
 *   1. start the cold-start (T = 600) and COMPLETE it (controlsRef -> null),
 *   2. grow T to 3000 and rerender (the timelineDurationState dep changes),
 *   3. assert a NEW tween launched toward 3000.
 *
 * Against the historic guard (`if (!controlsRef.current) return`) step 3 finds
 * no new tween — the proof is genuinely red without the fix.
 */

import { renderHook } from '@testing-library/react';

interface AnimateCall {
  target: number;
  completed: boolean;
  stopped: boolean;
  readCurrent: () => number;
  complete: () => void;
}

const animateCalls: AnimateCall[] = [];

jest.mock('framer-motion', () => ({
  __esModule: true,
  // Step driver: animate() records the call and seeds onUpdate to the START
  // value (no jump to target). It advances to target only when complete() is
  // called explicitly, so an in-flight vs completed tween is distinguishable and
  // the test controls ordering.
  animate: (
    value: { get: () => number; set: (n: number) => void },
    target: number,
    options?: any
  ) => {
    const call: AnimateCall = {
      target,
      completed: false,
      stopped: false,
      readCurrent: () => value.get(),
      complete: () => {
        if (call.stopped || call.completed) return;
        value.set(target);
        options?.onUpdate?.(target);
        options?.onComplete?.();
        call.completed = true;
      },
    };
    const controls = {
      stop: () => {
        call.stopped = true;
      },
    };
    animateCalls.push(call);
    return controls;
  },
}));

// Import AFTER the mock is registered.
import { useElementTrack } from './useElementTrack';

function createMotionValueStub(initial: number) {
  let current = initial;
  return {
    get: () => current,
    set: (value: number) => {
      current = value;
    },
  };
}

describe('useElementTrack cold-start extend-after-completion (waitFor cascade-frozen)', () => {
  beforeEach(() => {
    animateCalls.length = 0;
  });

  it('launches a new extend tween toward the grown T even after the cold-start completed', () => {
    const motion = createMotionValueStub(0);
    // Mutable timeline duration: starts small (warm-cache cold-start target),
    // then grows once the waitFor-bearing children register.
    let timelineDuration = 600;
    const getTimelineDuration = (): number => timelineDuration;

    const { rerender } = renderHook(
      ({ tdState }: { tdState: number }) =>
        useElementTrack({
          slideMode: 'drag',
          isActive: true,
          sceneIndex: 0,
          sceneOffset: 0,
          globalDirection: null,
          globalIsDragging: false,
          globalRenderProgress: 0,
          globalDragTimelineProgress: 0,
          dragRelease: null,
          firstSceneEnterReady: true,
          elementElapsedMotion: motion as never,
          getTimelineDuration,
          timelineDurationState: tdState,
          onSettleComplete: undefined,
          onColdStartComplete: undefined,
        }),
      { initialProps: { tdState: 600 } }
    );

    // Cold-start launched toward the initial T = 600.
    const coldStart = animateCalls.find((c) => c.target === 600);
    expect(coldStart).toBeDefined();
    expect(coldStart!.stopped).toBe(false);

    // Warm-cache ordering: the cold-start COMPLETES (track at 600, controlsRef
    // -> null) BEFORE the waitFor children register.
    coldStart!.complete();
    expect(coldStart!.completed).toBe(true);
    expect(motion.get()).toBe(600);

    // Now the registry grows: `gated` (waitFor 'dep') pushes T to 3000. The
    // Scene bumps timelineDurationState, re-firing the cold-start effect.
    timelineDuration = 3000;
    rerender({ tdState: 3000 });

    // A NEW tween must have launched toward the grown T (>= 3000), continuing
    // from the current elapsed (600). The historic guard returned early because
    // controlsRef was null after completion, so no such tween existed and the
    // track stayed capped at 600 — below `gated`'s 2500ms gate.
    const extend = animateCalls.find((c) => c.target >= 3000 && c !== coldStart);
    expect(extend).toBeDefined();

    extend!.complete();
    expect(motion.get()).toBeGreaterThanOrEqual(2500);
  });
});

describe('useElementTrack programmatic "enter" directive (ref nav)', () => {
  beforeEach(() => {
    animateCalls.length = 0;
  });

  it('replays the destination track 0 -> T and does NOT fire onSettleComplete', () => {
    // Programmatic goToScene publishes an 'enter' directive targeting the new
    // (already-current) scene. Unlike a gesture settle, this is a fresh enter:
    // the track must replay from 0 to T, and it must NOT enter the gesture join
    // (no onSettleComplete) — completion is driven by CineView's animated timer.
    const motion = createMotionValueStub(0);
    const tSelf = 800;
    const getTimelineDuration = (): number => tSelf;
    const onSettleComplete = jest.fn();

    renderHook(() =>
      useElementTrack({
        slideMode: 'drag',
        isActive: true,
        sceneIndex: 2,
        sceneOffset: 0,
        globalDirection: 'forward',
        globalIsDragging: false,
        globalRenderProgress: 0,
        globalDragTimelineProgress: 0,
        dragRelease: { token: 7, mode: 'enter', direction: 'forward', targetSceneIndex: 2 },
        firstSceneEnterReady: false,
        elementElapsedMotion: motion as never,
        getTimelineDuration,
        timelineDurationState: tSelf,
        onSettleComplete,
        onColdStartComplete: undefined,
      })
    );

    const enter = animateCalls.find((c) => c.target === tSelf);
    expect(enter).toBeDefined();
    // Fresh replay: the track was reset to 0 before the tween launched.
    expect(enter!.readCurrent()).toBe(0);

    enter!.complete();
    expect(motion.get()).toBe(tSelf);
    // Crucially out of the join: programmatic enter never closes a settle arm.
    expect(onSettleComplete).not.toHaveBeenCalled();
  });

  it('ignores an "enter" directive targeting a different scene', () => {
    const motion = createMotionValueStub(0);
    renderHook(() =>
      useElementTrack({
        slideMode: 'drag',
        isActive: false,
        sceneIndex: 1,
        sceneOffset: -1,
        globalDirection: 'forward',
        globalIsDragging: false,
        globalRenderProgress: 0,
        globalDragTimelineProgress: 0,
        dragRelease: { token: 9, mode: 'enter', direction: 'forward', targetSceneIndex: 2 },
        firstSceneEnterReady: false,
        elementElapsedMotion: motion as never,
        getTimelineDuration: () => 800,
        timelineDurationState: 800,
        onSettleComplete: undefined,
        onColdStartComplete: undefined,
      })
    );

    // Not the target scene → no tween launched.
    expect(animateCalls.length).toBe(0);
  });
});

describe('useElementTrack follow-finger time mapping scale', () => {
  beforeEach(() => {
    animateCalls.length = 0;
  });

  // The follow-finger write maps drag percent to an ABSOLUTE ms rate
  // (`unit: time` scale in ms per 1%), NOT to r * T_self. This decouples the shared clock
  // from the scene's own timeline so short elements no longer race to terminal
  // just because the drag fraction is large. The write is synchronous (motion.set),
  // so assert on motion.get() directly.
  function dragTo(
    motion: { get: () => number; set: (n: number) => void },
    r: number,
    opts: { mappingScale?: number; tSelf: number }
  ): void {
    renderHook(() =>
      useElementTrack({
        slideMode: 'drag',
        isActive: false,
        sceneIndex: 1,
        sceneOffset: 1,
        globalDirection: 'forward',
        globalIsDragging: true,
        globalRenderProgress: r,
        globalDragTimelineProgress: r,
        dragRelease: null,
        firstSceneEnterReady: false,
        elementElapsedMotion: motion as never,
        getTimelineDuration: () => opts.tSelf,
        timelineDurationState: opts.tSelf,
        dragMappingConfig: { unit: 'time', scale: opts.mappingScale ?? 10 },
        onSettleComplete: undefined,
        onColdStartComplete: undefined,
      })
    );
  }

  it('maps drag percent by the absolute scale, NOT by r * T_self', () => {
    // `unit: time, scale: 100` means 100ms/1%, or a 10_000ms full span. At r=0.5
    // the elapsed is 5000ms. With a long T_self (20_000) the clamp does not bite:
    // elapsed stays 5000, NOT r*T_self (which would be 10_000).
    const motion = createMotionValueStub(0);
    dragTo(motion, 0.5, { mappingScale: 100, tSelf: 20_000 });
    expect(motion.get()).toBeCloseTo(5000);
  });

  it('defaults to the shared time mapping scale (10ms per 1%) when scale is omitted', () => {
    // Regression: the fallback must match DEFAULT_DRAG_TIMELINE_SCALE.time (10),
    // not a divergent local default.
    const motion = createMotionValueStub(0);
    dragTo(motion, 0.25, { tSelf: 20_000 });
    // 0.25 * (10 * 100) = 250.
    expect(motion.get()).toBeCloseTo(250);
  });

  it('clamps the elapsed to T_self so the track never reports past terminal', () => {
    // Short scene (T_self 2000) with a 100ms/1% scale: r=0.5 would be 5000ms,
    // but the clamp pins it to T_self 2000 (element already fully settled — the
    // accepted early-settle behaviour).
    const motion = createMotionValueStub(0);
    dragTo(motion, 0.5, { mappingScale: 100, tSelf: 2000 });
    expect(motion.get()).toBe(2000);
  });

  it('a lower scale keeps a long animation from fully playing out mid-drag', () => {
    // A 10ms/1% scale has a 1000ms full span. Even dragged fully (r=1), elapsed
    // remains far below a 5000ms T_self, so settle continues the remainder.
    const motion = createMotionValueStub(0);
    dragTo(motion, 1, { mappingScale: 10, tSelf: 5000 });
    expect(motion.get()).toBeCloseTo(1000);
  });
});
