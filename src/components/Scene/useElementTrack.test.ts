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
