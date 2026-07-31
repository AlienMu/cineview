/**
 * Branch coverage for useElementTrack — the per-scene element-timeline driver.
 *
 * These tests target the early-return / snap-immediately guards and the
 * onUpdate/onComplete callbacks of each driver source that the existing
 * `useElementTrack.test.ts` (cold-start extend + programmatic enter) leaves
 * uncovered:
 *   - release 'enter' with a degenerate T (<= 0.001): snap to T, no tween.
 *   - release 'settle' that is already at/past T (clean commit): snap + fire
 *     onSettleComplete with NO tween.
 *   - release 'bounce' already at rest (<= 0.001): snap to 0, no tween.
 *   - release 'bounce' in flight: drive the bounce tween's onUpdate/onComplete.
 *   - cold-start that is already at T on launch: snap + onColdStartComplete.
 *   - cold-start extend where the track is already at/past the grown T: snap +
 *     onColdStartComplete with no extend tween.
 *
 * Same framer-motion step-driver mock as the sibling suite: animate() records
 * the call and only advances to target when complete() is invoked, so an
 * in-flight vs completed tween is observable and the test controls ordering.
 * Expected values are read directly off useElementTrack.ts.
 */

import { renderHook } from '@testing-library/react';

interface AnimateCall {
  target: number;
  completed: boolean;
  stopped: boolean;
  readCurrent: () => number;
  complete: () => void;
  // Raw callback drivers that bypass the completed/stopped bookkeeping, so a
  // SUPERSEDED tween's onUpdate/onComplete can be fired after a new source has
  // bumped the hook's internal release token — exercising the stale-token guard
  // (`if (releaseTokenRef.current !== token) return`) that the normal in-order
  // complete() never reaches.
  fireUpdate: (latest: number) => void;
  fireComplete: () => void;
}

const animateCalls: AnimateCall[] = [];

jest.mock('framer-motion', () => ({
  __esModule: true,
  animate: (
    value: { get: () => number; set: (n: number) => void },
    target: number,
    options?: { onUpdate?: (latest: number) => void; onComplete?: () => void }
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
      fireUpdate: (latest: number) => options?.onUpdate?.(latest),
      fireComplete: () => options?.onComplete?.(),
    };
    animateCalls.push(call);
    return {
      stop: () => {
        call.stopped = true;
      },
    };
  },
}));

import { useElementTrack } from './useElementTrack';
import type { DragRelease } from '../../hooks/useSceneManager';

function createMotionValueStub(initial: number) {
  let current = initial;
  return {
    get: () => current,
    set: (value: number) => {
      current = value;
    },
  };
}

type Params = Parameters<typeof useElementTrack>[0];

function renderTrack(params: Partial<Params> & Pick<Params, 'elementElapsedMotion'>) {
  const full: Params = {
    slideMode: 'drag',
    isActive: true,
    sceneIndex: 0,
    sceneOffset: 0,
    globalDirection: null,
    globalIsDragging: false,
    globalRenderProgress: 0,
    globalDragTimelineProgress: 0,
    dragRelease: null,
    firstSceneEnterReady: false,
    getTimelineDuration: () => 800,
    timelineDurationState: 800,
    // Follow-finger uses the ABSOLUTE `time` mapping scale (ms per 1%) instead
    // of r * T_self. These mechanism tests want the old r * T_self mapping so their
    // seeded elapsed values (e.g. 0.5 -> 400 at T_self 800) still hold, so pin the
    // scale to T_self/100 = 8 (full span 800 == T_self). The absolute-scale behaviour
    // itself is covered separately in useElementTrack.test.ts.
    dragMappingConfig: { unit: 'time', scale: 8 },
    onSettleComplete: undefined,
    onColdStartComplete: undefined,
    ...params,
  };
  return renderHook(() => useElementTrack(full));
}

describe('useElementTrack — release directive guards', () => {
  beforeEach(() => {
    animateCalls.length = 0;
  });

  it('programmatic enter with a degenerate T snaps to T and launches no tween', () => {
    // release.mode 'enter', tSelf <= 0.001: motion.set(0) then motion.set(tSelf)
    // and an immediate return (lines 215-219). No animate() call.
    const motion = createMotionValueStub(0);
    const onSettleComplete = jest.fn();
    const dragRelease: DragRelease = {
      token: 1,
      mode: 'enter',
      direction: 'forward',
      targetSceneIndex: 3,
    };
    renderTrack({
      sceneIndex: 3,
      sceneOffset: 0,
      globalDirection: 'forward',
      dragRelease,
      getTimelineDuration: () => 0,
      elementElapsedMotion: motion as never,
      onSettleComplete,
    });

    expect(animateCalls.length).toBe(0);
    expect(motion.get()).toBe(0); // tSelf is 0
    expect(onSettleComplete).not.toHaveBeenCalled();
  });

  it('settle already at/past T performs a clean commit: snap + onSettleComplete, no tween', () => {
    // progressRatio 1 -> ratioElapsed = tSelf, so current = tSelf and
    // remainingMs <= 0.001: the clean-commit branch (lines 241-246).
    const motion = createMotionValueStub(0);
    const onSettleComplete = jest.fn();
    const dragRelease: DragRelease = {
      token: 5,
      mode: 'settle',
      direction: 'forward',
      targetSceneIndex: 2,
      progressRatio: 1,
    };
    renderTrack({
      sceneIndex: 2,
      sceneOffset: 1,
      globalDirection: 'forward',
      dragRelease,
      getTimelineDuration: () => 800,
      elementElapsedMotion: motion as never,
      onSettleComplete,
    });

    expect(motion.get()).toBe(800); // snapped to T (also via the seed at 203-205)
    expect(onSettleComplete).toHaveBeenCalledTimes(1);
    expect(animateCalls.length).toBe(0);
  });

  it('bounce already at rest snaps to 0 with no tween', () => {
    // progressRatio 0 + motion at 0 -> current <= 0.001: bounce snap branch
    // (lines 266-269).
    const motion = createMotionValueStub(0);
    const dragRelease: DragRelease = {
      token: 8,
      mode: 'bounce',
      direction: 'forward',
      targetSceneIndex: 2,
      progressRatio: 0,
    };
    renderTrack({
      sceneIndex: 2,
      sceneOffset: 1,
      globalDirection: 'forward',
      dragRelease,
      getTimelineDuration: () => 800,
      elementElapsedMotion: motion as never,
    });

    expect(motion.get()).toBe(0);
    expect(animateCalls.length).toBe(0);
  });

  it('settle in flight drives the tween onUpdate/onComplete to T', () => {
    // progressRatio 0.5 -> seed current = 0.5 * 800 = 400; remainingMs = 400 >
    // 0.001 -> launches a settle tween toward T (lines 247-262). Completing it
    // exercises onUpdate + onComplete + onSettleComplete.
    const motion = createMotionValueStub(0);
    const onSettleComplete = jest.fn();
    const dragRelease: DragRelease = {
      token: 21,
      mode: 'settle',
      direction: 'forward',
      targetSceneIndex: 2,
      progressRatio: 0.5,
    };
    renderTrack({
      sceneIndex: 2,
      sceneOffset: 1,
      globalDirection: 'forward',
      dragRelease,
      getTimelineDuration: () => 800,
      elementElapsedMotion: motion as never,
      onSettleComplete,
    });

    const settle = animateCalls.find((c) => c.target === 800);
    expect(settle).toBeDefined();
    expect(settle!.readCurrent()).toBe(400); // seeded to the release elapsed
    expect(onSettleComplete).not.toHaveBeenCalled();

    settle!.complete();
    expect(motion.get()).toBe(800);
    expect(onSettleComplete).toHaveBeenCalledTimes(1);
  });

  it('holds a settle during a candidate and resumes it once from the frozen elapsed', () => {
    const motion = createMotionValueStub(0);
    const onSettleComplete = jest.fn();
    const onElementContinuationChange = jest.fn();
    const baseParams: Params = {
      slideMode: 'drag',
      isActive: false,
      sceneIndex: 1,
      sceneOffset: 1,
      globalDirection: 'forward',
      globalIsDragging: false,
      candidateSuspended: false,
      globalRenderProgress: 0.5,
      globalDragTimelineProgress: 0.5,
      dragRelease: {
        token: 29,
        mode: 'settle',
        direction: 'forward',
        targetSceneIndex: 1,
        progressRatio: 0.5,
      },
      firstSceneEnterReady: false,
      elementElapsedMotion: motion as never,
      getTimelineDuration: () => 800,
      timelineDurationState: 800,
      dragMappingConfig: { unit: 'time', scale: 8 },
      onElementContinuationChange,
      onSettleComplete,
      onColdStartComplete: undefined,
    };
    const { rerender } = renderHook((p: Params) => useElementTrack(p), {
      initialProps: baseParams,
    });

    const initialSettle = animateCalls.find((call) => call.target === 800);
    expect(initialSettle).toBeDefined();
    expect(onElementContinuationChange.mock.calls).toEqual([[true]]);
    initialSettle!.fireUpdate(520);
    expect(motion.get()).toBe(520);

    rerender({ ...baseParams, candidateSuspended: true });
    expect(initialSettle!.stopped).toBe(true);
    expect(animateCalls.filter((call) => call.target === 800)).toHaveLength(1);
    expect(onElementContinuationChange.mock.calls).toEqual([[true]]);
    expect(onSettleComplete).not.toHaveBeenCalled();

    rerender({ ...baseParams, candidateSuspended: false });
    const settles = animateCalls.filter((call) => call.target === 800);
    expect(settles).toHaveLength(2);
    expect(settles[1].readCurrent()).toBe(520);
    expect(onElementContinuationChange.mock.calls).toEqual([[true]]);
    expect(onSettleComplete).not.toHaveBeenCalled();

    settles[1].complete();
    expect(motion.get()).toBe(800);
    expect(onElementContinuationChange.mock.calls).toEqual([[true], [false]]);
    expect(onSettleComplete).toHaveBeenCalledTimes(1);
    initialSettle!.fireComplete();
    expect(onSettleComplete).toHaveBeenCalledTimes(1);
  });

  it('holds a bounce during a candidate and resumes it once from the frozen elapsed', () => {
    const motion = createMotionValueStub(0);
    const onElementContinuationChange = jest.fn();
    const baseParams: Params = {
      slideMode: 'drag',
      isActive: false,
      sceneIndex: 1,
      sceneOffset: 1,
      globalDirection: 'forward',
      globalIsDragging: false,
      candidateSuspended: false,
      globalRenderProgress: 0.5,
      globalDragTimelineProgress: 0.5,
      dragRelease: {
        token: 30,
        mode: 'bounce',
        direction: 'forward',
        targetSceneIndex: 1,
        progressRatio: 0.5,
      },
      firstSceneEnterReady: false,
      elementElapsedMotion: motion as never,
      getTimelineDuration: () => 800,
      timelineDurationState: 800,
      dragMappingConfig: { unit: 'time', scale: 8 },
      onElementContinuationChange,
      onSettleComplete: undefined,
      onColdStartComplete: undefined,
    };
    const { rerender } = renderHook((p: Params) => useElementTrack(p), {
      initialProps: baseParams,
    });

    const initialBounce = animateCalls.find((call) => call.target === 0);
    expect(initialBounce).toBeDefined();
    expect(initialBounce!.readCurrent()).toBe(400);
    expect(onElementContinuationChange.mock.calls).toEqual([[true]]);
    initialBounce!.fireUpdate(260);
    expect(motion.get()).toBe(260);

    rerender({ ...baseParams, candidateSuspended: true });
    expect(initialBounce!.stopped).toBe(true);
    expect(animateCalls.filter((call) => call.target === 0)).toHaveLength(1);
    expect(onElementContinuationChange.mock.calls).toEqual([[true]]);

    rerender({ ...baseParams, candidateSuspended: false });
    const bounces = animateCalls.filter((call) => call.target === 0);
    expect(bounces).toHaveLength(2);
    expect(bounces[1].readCurrent()).toBe(260);
    expect(onElementContinuationChange.mock.calls).toEqual([[true]]);

    bounces[1].complete();
    expect(motion.get()).toBe(0);
    expect(onElementContinuationChange.mock.calls).toEqual([[true], [false]]);
  });

  it('preserves the frozen element frame when a candidate becomes a rush re-grab owner', () => {
    const motion = createMotionValueStub(0);
    const dragRelease: DragRelease = {
      token: 30,
      mode: 'settle',
      direction: 'forward',
      targetSceneIndex: 1,
      progressRatio: 0.5,
    };
    const takeoverSnapshot: NonNullable<Params['takeoverSnapshot']> = { current: null };
    const full: Params = {
      slideMode: 'drag',
      isActive: false,
      sceneIndex: 1,
      sceneOffset: 1,
      globalDirection: 'forward',
      globalIsDragging: false,
      candidateSuspended: false,
      globalRenderProgress: 0.5,
      globalDragTimelineProgress: 0.5,
      dragRelease,
      firstSceneEnterReady: false,
      elementElapsedMotion: motion as never,
      getTimelineDuration: () => 800,
      timelineDurationState: 800,
      dragMappingConfig: { unit: 'time', scale: 8 },
      takeoverSnapshot,
      onSettleComplete: undefined,
      onColdStartComplete: undefined,
    };
    const { rerender } = renderHook((p: Params) => useElementTrack(p), {
      initialProps: full,
    });

    const settle = animateCalls.find((call) => call.target === 800);
    expect(settle).toBeDefined();
    settle!.fireUpdate(520);
    expect(motion.get()).toBe(520);

    takeoverSnapshot.current = {
      token: 1,
      sceneIndices: [1],
      staleRatio: 0.5,
      baseRatio: null,
    };
    rerender({ ...full, candidateSuspended: true });
    expect(settle!.stopped).toBe(true);
    expect(motion.get()).toBe(520);

    // The ownership boundary synchronously publishes the frozen render base.
    takeoverSnapshot.current = { ...takeoverSnapshot.current!, baseRatio: 0.8 };

    // React may first commit the candidate release while the public drag state is
    // still false. The synchronous non-null base marks this as successful
    // ownership, so the frozen element frame must survive that intermediate commit.
    rerender({
      ...full,
      candidateSuspended: false,
      globalIsDragging: false,
      globalRenderProgress: 0.5,
      globalDragTimelineProgress: 0.5,
    });
    expect(motion.get()).toBe(520);

    // Chromium may then commit isDragging + the frozen render position before the
    // timeline ratio update. This stale-ratio frame must be ignored exactly once.
    rerender({
      ...full,
      candidateSuspended: false,
      globalIsDragging: true,
      globalRenderProgress: 0.8,
      globalDragTimelineProgress: 0.5,
    });
    expect(motion.get()).toBe(520);

    // The following base-ratio commit is still zero finger delta.
    rerender({
      ...full,
      candidateSuspended: false,
      globalIsDragging: true,
      globalRenderProgress: 0.8,
      globalDragTimelineProgress: 0.8,
    });
    expect(motion.get()).toBe(520);

    // Only movement after ownership advances the frozen element frame. With an
    // 800ms full mapping, 0.8 -> 0.9 contributes 80ms: 520 -> 600.
    rerender({
      ...full,
      candidateSuspended: false,
      globalIsDragging: true,
      globalRenderProgress: 0.9,
      globalDragTimelineProgress: 0.9,
    });
    expect(motion.get()).toBe(600);
  });

  it('a live drag preempts an in-flight settle in place and pegs an incoming track to r*T', () => {
    // Mount with a settle in flight (controlsRef populated). Then a live drag on
    // an incoming scene re-runs the follow-finger effect: it STOPS the in-flight
    // settle in place (lines 151-155) and, since this scene is incoming, pegs the
    // element track to clamp(r) * T (lines 160-163).
    const motion = createMotionValueStub(0);
    const dragRelease: DragRelease = {
      token: 31,
      mode: 'settle',
      direction: 'forward',
      targetSceneIndex: 1,
      progressRatio: 0.5,
    };
    const full: Params = {
      slideMode: 'drag',
      isActive: false,
      sceneIndex: 1,
      sceneOffset: 1,
      globalDirection: 'forward',
      globalIsDragging: false,
      globalRenderProgress: 0,
      globalDragTimelineProgress: 0,
      dragRelease,
      firstSceneEnterReady: false,
      elementElapsedMotion: motion as never,
      getTimelineDuration: () => 800,
      timelineDurationState: 800,
      // Scale chosen so the absolute follow-finger map (r * scale * 100) equals
      // r * T_self (800), reproducing the legacy ratio map this test was written
      // against — exercises the settle/preempt MECHANISM, not the scale value.
      dragMappingConfig: { unit: 'time', scale: 8 },
      onSettleComplete: undefined,
      onColdStartComplete: undefined,
    };
    const { rerender } = renderHook((p: Params) => useElementTrack(p), {
      initialProps: full,
    });

    const settle = animateCalls.find((c) => c.target === 800);
    expect(settle).toBeDefined();
    expect(settle!.stopped).toBe(false);
    expect(motion.get()).toBe(400); // seeded to r*T

    // A live drag begins on this (incoming, forward) scene. globalRenderProgress
    // > 0 makes dragDirection 'forward' and sceneOffset 1 makes it incoming.
    rerender({
      ...full,
      globalIsDragging: true,
      globalRenderProgress: 0.25,
      globalDragTimelineProgress: 0.25,
    });

    // The in-flight settle was stopped in place, and the incoming track pegged to
    // clamp(0.25) * 800 = 200.
    expect(settle!.stopped).toBe(true);
    expect(motion.get()).toBe(200);
  });

  it('bounce in flight drives the tween onUpdate/onComplete back to 0', () => {
    // progressRatio 0.5 -> ratioElapsed = 400 > 0.001: launches a bounce tween
    // toward 0 (lines 270-285). Completing it exercises onUpdate + onComplete.
    const motion = createMotionValueStub(0);
    const dragRelease: DragRelease = {
      token: 11,
      mode: 'bounce',
      direction: 'forward',
      targetSceneIndex: 2,
      progressRatio: 0.5,
    };
    renderTrack({
      sceneIndex: 2,
      sceneOffset: 1,
      globalDirection: 'forward',
      dragRelease,
      getTimelineDuration: () => 800,
      elementElapsedMotion: motion as never,
    });

    // Seeded to the release elapsed (0.5 * 800 = 400) before the tween launched.
    const bounce = animateCalls.find((c) => c.target === 0);
    expect(bounce).toBeDefined();
    expect(bounce!.readCurrent()).toBe(400);

    bounce!.complete();
    expect(motion.get()).toBe(0);
  });
});

describe('useElementTrack — cold-start guards', () => {
  beforeEach(() => {
    animateCalls.length = 0;
  });

  it('cold-start already at T on launch snaps + fires onColdStartComplete, no tween', () => {
    // scene 0, ready, motion already at tSelf -> remainingMs <= 0.001 inside the
    // first cold-start block (lines 311-317).
    const motion = createMotionValueStub(800);
    const onColdStartComplete = jest.fn();
    renderTrack({
      sceneIndex: 0,
      sceneOffset: 0,
      firstSceneEnterReady: true,
      globalIsDragging: false,
      getTimelineDuration: () => 800,
      elementElapsedMotion: motion as never,
      onColdStartComplete,
    });

    expect(motion.get()).toBe(800);
    expect(onColdStartComplete).toHaveBeenCalledTimes(1);
    expect(animateCalls.length).toBe(0);
  });

  it('cold-start extend where the track is already past the grown T snaps + completes', () => {
    // Launch cold-start (T = 600, in flight). Then the element track is driven
    // past the eventual grown T (we seed the motion stub to 4000 to model the
    // track having already advanced beyond it), and T grows to 3000. The extend
    // branch finds remainingMs <= 0.001 and snaps + completes with no new tween
    // (lines 353-359, the stop() at 349 fires on the in-flight cold-start).
    const motion = createMotionValueStub(0);
    const onColdStartComplete = jest.fn();
    let tSelf = 600;

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
          getTimelineDuration: () => tSelf,
          timelineDurationState: tdState,
          onSettleComplete: undefined,
          onColdStartComplete,
        }),
      { initialProps: { tdState: 600 } }
    );

    const coldStart = animateCalls.find((c) => c.target === 600);
    expect(coldStart).toBeDefined();
    expect(coldStart!.stopped).toBe(false);
    expect(onColdStartComplete).not.toHaveBeenCalled();

    // Track advanced beyond the eventual grown T.
    motion.set(4000);
    // Registry grows T past the prior target; the extend effect re-fires.
    tSelf = 3000;
    rerender({ tdState: 3000 });

    // The in-flight cold-start was stopped; the extend snapped to the grown T.
    expect(coldStart!.stopped).toBe(true);
    expect(motion.get()).toBe(3000);
    expect(onColdStartComplete).toHaveBeenCalledTimes(1);
    // No extend tween (it took the snap branch, not animate()).
    expect(animateCalls.filter((c) => c.target === 3000).length).toBe(0);
  });
});

describe('useElementTrack — stale-token guards (superseded tweens are no-ops)', () => {
  beforeEach(() => {
    animateCalls.length = 0;
  });

  it('a re-targeted settle stops the prior settle; the superseded tween cannot write the track', () => {
    // First release seeds + launches settle A (internal token 1). A second
    // release with a NEW directive token re-runs the effect: it bumps the
    // internal release token to 2 and stops A in place (line 182). Firing A's
    // onUpdate/onComplete afterwards must hit the `releaseTokenRef !== token`
    // guard (lines 252 / 256) and leave the track untouched.
    const motion = createMotionValueStub(0);
    const onSettleComplete = jest.fn();
    const baseParams: Params = {
      slideMode: 'drag',
      isActive: false,
      sceneIndex: 2,
      sceneOffset: 1,
      globalDirection: 'forward',
      globalIsDragging: false,
      globalRenderProgress: 0,
      globalDragTimelineProgress: 0,
      dragRelease: {
        token: 21,
        mode: 'settle',
        direction: 'forward',
        targetSceneIndex: 2,
        progressRatio: 0.5,
      },
      firstSceneEnterReady: false,
      elementElapsedMotion: motion as never,
      getTimelineDuration: () => 800,
      timelineDurationState: 800,
      dragMappingConfig: { unit: 'time', scale: 8 },
      onSettleComplete,
      onColdStartComplete: undefined,
    };
    const { rerender } = renderHook((p: Params) => useElementTrack(p), {
      initialProps: baseParams,
    });

    const settleA = animateCalls.find((c) => c.target === 800);
    expect(settleA).toBeDefined();
    expect(settleA!.readCurrent()).toBe(400); // seeded to 0.5 * 800

    // Re-target with a new directive token (and a larger ratio).
    rerender({
      ...baseParams,
      dragRelease: {
        token: 22,
        mode: 'settle',
        direction: 'forward',
        targetSceneIndex: 2,
        progressRatio: 0.75,
      },
    });

    // A was stopped in place; a fresh settle B launched (seeded to 0.75*800=600).
    expect(settleA!.stopped).toBe(true);
    const settleB = animateCalls.filter((c) => c.target === 800);
    expect(settleB.length).toBe(2);
    expect(motion.get()).toBe(600);

    // Firing the SUPERSEDED tween's callbacks must be ignored by the token guard.
    settleA!.fireUpdate(123);
    expect(motion.get()).toBe(600); // unchanged
    settleA!.fireComplete();
    expect(onSettleComplete).not.toHaveBeenCalled(); // guarded out

    // The live tween B still completes normally.
    settleB[1].complete();
    expect(motion.get()).toBe(800);
    expect(onSettleComplete).toHaveBeenCalledTimes(1);
  });

  it('a re-targeted bounce stops the prior bounce; the superseded tween cannot write the track', () => {
    const motion = createMotionValueStub(0);
    const baseParams: Params = {
      slideMode: 'drag',
      isActive: false,
      sceneIndex: 2,
      sceneOffset: 1,
      globalDirection: 'forward',
      globalIsDragging: false,
      globalRenderProgress: 0,
      globalDragTimelineProgress: 0,
      dragRelease: {
        token: 41,
        mode: 'bounce',
        direction: 'forward',
        targetSceneIndex: 2,
        progressRatio: 0.5,
      },
      firstSceneEnterReady: false,
      elementElapsedMotion: motion as never,
      getTimelineDuration: () => 800,
      timelineDurationState: 800,
      dragMappingConfig: { unit: 'time', scale: 8 },
      onSettleComplete: undefined,
      onColdStartComplete: undefined,
    };
    const { rerender } = renderHook((p: Params) => useElementTrack(p), {
      initialProps: baseParams,
    });

    const bounceA = animateCalls.find((c) => c.target === 0);
    expect(bounceA).toBeDefined();
    expect(bounceA!.readCurrent()).toBe(400);

    rerender({
      ...baseParams,
      dragRelease: {
        token: 42,
        mode: 'bounce',
        direction: 'forward',
        targetSceneIndex: 2,
        progressRatio: 0.25,
      },
    });
    expect(bounceA!.stopped).toBe(true);

    // Superseded bounce A's onUpdate guarded out (motion is the new seed 400 — the
    // re-target seeds max(live, r*T) = max(400, 200) = 400, never shrinking).
    bounceA!.fireUpdate(999);
    expect(motion.get()).toBe(400);
    // onComplete guarded out: A must not snap the track to 0.
    bounceA!.fireComplete();
    expect(motion.get()).toBe(400);
  });

  it('a programmatic enter superseded by a re-target: stale enter callbacks are no-ops', () => {
    const motion = createMotionValueStub(0);
    const baseParams: Params = {
      slideMode: 'drag',
      isActive: true,
      sceneIndex: 2,
      sceneOffset: 0,
      globalDirection: 'forward',
      globalIsDragging: false,
      globalRenderProgress: 0,
      globalDragTimelineProgress: 0,
      dragRelease: { token: 51, mode: 'enter', direction: 'forward', targetSceneIndex: 2 },
      firstSceneEnterReady: false,
      elementElapsedMotion: motion as never,
      getTimelineDuration: () => 800,
      timelineDurationState: 800,
      onSettleComplete: undefined,
      onColdStartComplete: undefined,
    };
    const { rerender } = renderHook((p: Params) => useElementTrack(p), {
      initialProps: baseParams,
    });

    const enterA = animateCalls.find((c) => c.target === 800);
    expect(enterA).toBeDefined();
    expect(enterA!.readCurrent()).toBe(0); // enter resets to 0 before launch

    rerender({
      ...baseParams,
      dragRelease: { token: 52, mode: 'enter', direction: 'forward', targetSceneIndex: 2 },
    });
    expect(enterA!.stopped).toBe(true);

    // Stale enter A onUpdate/onComplete guarded out (lines 229 / 233).
    enterA!.fireUpdate(500);
    expect(motion.get()).toBe(0);
    enterA!.fireComplete();
    expect(motion.get()).toBe(0); // A cannot snap to 800

    // The live enter B completes.
    const enterB = animateCalls.filter((c) => c.target === 800)[1];
    enterB.complete();
    expect(motion.get()).toBe(800);
  });

  it('a cold-start preempted by extend: the stale cold-start tween cannot complete', () => {
    // Launch cold-start A (token 1, T = 600, in flight). Grow T to 3000: the
    // extend block stops A and launches B with a bumped token (line 360). Firing
    // A's onComplete must be guarded out (line 328) so it cannot snap to 600 and
    // fire a spurious onColdStartComplete.
    const motion = createMotionValueStub(0);
    const onColdStartComplete = jest.fn();
    let tSelf = 600;
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
          getTimelineDuration: () => tSelf,
          timelineDurationState: tdState,
          onSettleComplete: undefined,
          onColdStartComplete,
        }),
      { initialProps: { tdState: 600 } }
    );

    const coldA = animateCalls.find((c) => c.target === 600);
    expect(coldA).toBeDefined();

    tSelf = 3000;
    rerender({ tdState: 3000 });
    expect(coldA!.stopped).toBe(true);
    const extendB = animateCalls.find((c) => c.target === 3000);
    expect(extendB).toBeDefined();

    // Stale cold-start A callbacks guarded out.
    coldA!.fireUpdate(600);
    expect(motion.get()).toBe(0);
    coldA!.fireComplete();
    expect(onColdStartComplete).not.toHaveBeenCalled();

    // Live extend B completes the cold-start to the grown T.
    extendB!.complete();
    expect(motion.get()).toBe(3000);
    expect(onColdStartComplete).toHaveBeenCalledTimes(1);
  });
});

describe('useElementTrack — direction / mode early returns', () => {
  beforeEach(() => {
    animateCalls.length = 0;
  });

  it('non-drag mode is inert: no follow-finger, release, or cold-start effects run', () => {
    const motion = createMotionValueStub(0);
    renderTrack({
      slideMode: 'scroll',
      sceneIndex: 0,
      sceneOffset: 1,
      firstSceneEnterReady: true,
      globalIsDragging: true,
      globalRenderProgress: 0.5,
      globalDragTimelineProgress: 0.5,
      dragRelease: { token: 99, mode: 'settle', direction: 'forward', targetSceneIndex: 0 },
      elementElapsedMotion: motion as never,
    });
    expect(animateCalls.length).toBe(0);
    expect(motion.get()).toBe(0);
  });

  it('follow-finger pegs a BACKWARD incoming track via the negative render-progress ternary', () => {
    // globalRenderProgress < -0.0001 -> dragDirection 'backward'; sceneOffset -1
    // -> isIncoming. The follow-finger effect pegs the track to clamp(r) * T.
    const motion = createMotionValueStub(0);
    renderTrack({
      sceneIndex: 1,
      sceneOffset: -1,
      globalDirection: null,
      globalIsDragging: true,
      globalRenderProgress: -0.4,
      globalDragTimelineProgress: 0.4,
      getTimelineDuration: () => 800,
      elementElapsedMotion: motion as never,
    });
    // clamp(0.4) * 800 = 320.
    expect(motion.get()).toBe(320);
  });

  it('follow-finger on a NON-incoming scene stops in-flight work but does not peg the track', () => {
    // dragDirection forward (render > 0) but sceneOffset 0 -> not incoming. The
    // effect runs (stops controls, clears cold-start flags) but skips the
    // elementElapsedMotion.set peg (the isIncoming=false branch at line 160).
    const motion = createMotionValueStub(0);
    renderTrack({
      sceneIndex: 1,
      sceneOffset: 0,
      globalDirection: null,
      globalIsDragging: true,
      globalRenderProgress: 0.4,
      globalDragTimelineProgress: 0.4,
      getTimelineDuration: () => 800,
      elementElapsedMotion: motion as never,
    });
    expect(motion.get()).toBe(0); // not pegged
    expect(animateCalls.length).toBe(0);
  });

  it('re-running the release effect with an already-handled token is a no-op (line 176)', () => {
    // The release effect dedupes on lastHandledReleaseTokenRef. Mount in drag and
    // handle token 7 (clean commit, progressRatio 1). Toggle slideMode to scroll
    // (effect returns at the slideMode guard) and back to drag: the effect re-runs
    // with the SAME token already handled -> the line-176 early return. No second
    // settle completion fires.
    const motion = createMotionValueStub(0);
    const onSettleComplete = jest.fn();
    const baseParams: Params = {
      slideMode: 'drag',
      isActive: false,
      sceneIndex: 2,
      sceneOffset: 1,
      globalDirection: 'forward',
      globalIsDragging: false,
      globalRenderProgress: 0,
      globalDragTimelineProgress: 0,
      dragRelease: {
        token: 7,
        mode: 'settle',
        direction: 'forward',
        targetSceneIndex: 2,
        progressRatio: 1,
      },
      firstSceneEnterReady: false,
      elementElapsedMotion: motion as never,
      getTimelineDuration: () => 800,
      timelineDurationState: 800,
      onSettleComplete,
      onColdStartComplete: undefined,
    };
    const { rerender } = renderHook((p: Params) => useElementTrack(p), {
      initialProps: baseParams,
    });
    expect(onSettleComplete).toHaveBeenCalledTimes(1); // clean commit fired once

    rerender({ ...baseParams, slideMode: 'scroll' });
    rerender({ ...baseParams, slideMode: 'drag' });
    // Token 7 already handled -> no second completion.
    expect(onSettleComplete).toHaveBeenCalledTimes(1);
  });

  it('cold-start effect returns early when scene 0 is not yet ready (line 299)', () => {
    // scene 0, drag, but firstSceneEnterReady false -> the cold-start never starts.
    const motion = createMotionValueStub(0);
    const onColdStartComplete = jest.fn();
    renderTrack({
      sceneIndex: 0,
      sceneOffset: 0,
      firstSceneEnterReady: false,
      globalIsDragging: false,
      getTimelineDuration: () => 800,
      elementElapsedMotion: motion as never,
      onColdStartComplete,
    });
    expect(animateCalls.length).toBe(0);
    expect(onColdStartComplete).not.toHaveBeenCalled();
  });

  it('cold-start effect returns early while a drag is in progress (line 300)', () => {
    // scene 0, ready, but globalIsDragging true -> the cold-start guard at line 300
    // bails (the follow-finger effect owns the track during a drag).
    const motion = createMotionValueStub(0);
    const onColdStartComplete = jest.fn();
    renderTrack({
      sceneIndex: 0,
      sceneOffset: 0,
      firstSceneEnterReady: true,
      globalIsDragging: true,
      getTimelineDuration: () => 800,
      elementElapsedMotion: motion as never,
      onColdStartComplete,
    });
    // The follow-finger effect ran (drag + scene at offset 0 is not incoming, no
    // peg, no tween); the cold-start effect bailed at line 300. No cold-start tween.
    expect(animateCalls.length).toBe(0);
    expect(onColdStartComplete).not.toHaveBeenCalled();
  });

  it('extend effect bails when the cold-start window is no longer extendable (line 347)', () => {
    // Launch cold-start (extendable true, in flight). A live drag preempts it:
    // follow-finger sets coldStartRanRef true AND coldStartExtendableRef false.
    // Drag ends; the registry then grows T and re-fires the cold-start effect.
    // coldStartRanRef true -> skips the launch block; coldStartExtendableRef false
    // -> the line-347 early return. No extend tween is created.
    const motion = createMotionValueStub(0);
    let tSelf = 600;
    const baseParams: Params = {
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
      getTimelineDuration: () => tSelf,
      timelineDurationState: 600,
      onSettleComplete: undefined,
      onColdStartComplete: undefined,
    };
    const { rerender } = renderHook((p: Params) => useElementTrack(p), {
      initialProps: baseParams,
    });
    const coldStart = animateCalls.find((c) => c.target === 600);
    expect(coldStart).toBeDefined();

    // Live drag preempts (follow-finger clears extendable).
    rerender({
      ...baseParams,
      globalIsDragging: true,
      globalRenderProgress: 0.2,
      globalDragTimelineProgress: 0.2,
    });
    expect(coldStart!.stopped).toBe(true);

    // Drag ends and T grows; the extend block must bail (not extendable).
    tSelf = 3000;
    rerender({ ...baseParams, globalIsDragging: false, timelineDurationState: 3000 });
    expect(animateCalls.filter((c) => c.target === 3000).length).toBe(0);
  });

  it('extend effect bails when T has not grown past the current target (line 348)', () => {
    // Launch cold-start (extendable, target 600, in flight). Re-fire the effect via
    // timelineDurationState WITHOUT growing tSelf: tSelf <= target + 0.001 -> the
    // line-348 early return. No new extend tween.
    const motion = createMotionValueStub(0);
    const tSelf = 600;
    const baseParams: Params = {
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
      getTimelineDuration: () => tSelf,
      timelineDurationState: 600,
      onSettleComplete: undefined,
      onColdStartComplete: undefined,
    };
    const { rerender } = renderHook((p: Params) => useElementTrack(p), {
      initialProps: baseParams,
    });
    const coldStart = animateCalls.find((c) => c.target === 600);
    expect(coldStart).toBeDefined();
    const countBefore = animateCalls.length;

    // Re-fire the extend effect; T unchanged -> bail at line 348.
    rerender({ ...baseParams, timelineDurationState: 601 });
    expect(animateCalls.length).toBe(countBefore); // no new tween
    expect(coldStart!.stopped).toBe(false); // in-flight cold-start untouched
  });
});
