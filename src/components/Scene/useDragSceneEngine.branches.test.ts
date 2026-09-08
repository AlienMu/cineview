/**
 * Branch coverage for useDragSceneEngine — the pan/release gesture engine.
 *
 * The existing `useDragSceneEngine.threshold.test.ts` only exercises the pure
 * `calculateThreshold` helper. These tests drive the hook itself
 * (handleDragStart / handlePan / handlePanEnd) through the scene-state sync
 * effect and every release branch:
 *   - scene-state sync transitions (active/exiting/entering/initial),
 *   - handleDragStart finalizing a pending release through the render-lane
 *     slot's flush (including cross-engine via the SHARED slot, D-F1),
 *   - handlePan render-lane publish + verbose bucket debug,
 *   - handlePanEnd: tiny-progress reset, boundary bounce,
 *     completeReleaseImmediately switch, normal switch + commitRelease
 *     identity guard + verbose render tick, direction-reversal bounce,
 *     and the bounce-back tween onUpdate/onComplete.
 *
 * The framer-motion `animate` mock is a step driver supporting BOTH the
 * MotionValue form (handlePanEnd bounce: animate(dragProgressMotion, 0, ...))
 * and the number form (switch: animate(currentProgress, targetProgress, ...)).
 * Expected values are read directly off useDragSceneEngine.ts.
 */

import { renderHook } from '@testing-library/react';
import { useAnimation, type MotionValue, type PanInfo } from 'framer-motion';

type LegacyAnimationControls = ReturnType<typeof useAnimation>;

interface AnimateCall {
  target: number;
  isMotion: boolean;
  completed: boolean;
  stopped: boolean;
  duration?: number;
  onUpdate?: (latest: number) => void;
  onComplete?: () => void;
  complete: () => void;
}

const animateCalls: AnimateCall[] = [];

jest.mock('framer-motion', () => ({
  __esModule: true,
  animate: (
    value: { get: () => number; set: (n: number) => void } | number,
    target: number,
    options?: { duration?: number; onUpdate?: (latest: number) => void; onComplete?: () => void }
  ) => {
    const isMotion = typeof value === 'object' && value !== null && 'set' in value;
    const call: AnimateCall = {
      target,
      isMotion,
      completed: false,
      stopped: false,
      duration: options?.duration,
      onUpdate: options?.onUpdate,
      onComplete: options?.onComplete,
      complete: () => {
        if (call.stopped || call.completed) return;
        if (isMotion) (value as { set: (n: number) => void }).set(target);
        options?.onUpdate?.(target);
        options?.onComplete?.();
        call.completed = true;
      },
    };
    animateCalls.push(call);
    return {
      stop: () => {
        call.stopped = true;
      },
    };
  },
}));

import { useDragSceneEngine } from './useDragSceneEngine';
import type { SceneState } from './types';

function createMotionValueStub(initial: number) {
  let current = initial;
  return {
    get: () => current,
    set: (value: number) => {
      current = value;
    },
  } as unknown as MotionValue<number>;
}

function createControlsStub(): LegacyAnimationControls {
  return {
    set: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    mount: jest.fn(),
  } as unknown as LegacyAnimationControls;
}

function panInfo(offset: number, velocity = 0, axis: 'x' | 'y' = 'x'): PanInfo {
  return {
    point: { x: 0, y: 0 },
    delta: { x: 0, y: 0 },
    offset: { x: axis === 'x' ? offset : 0, y: axis === 'y' ? offset : 0 },
    velocity: { x: axis === 'x' ? velocity : 0, y: axis === 'y' ? velocity : 0 },
  } as PanInfo;
}

type Params = Parameters<typeof useDragSceneEngine>[0];

function setup(overrides: Partial<Params> = {}) {
  const spies = {
    setSceneState: jest.fn(),
    setIsAnimating: jest.fn(),
    onDragProgressChange: jest.fn(),
    onRenderProgressChange: jest.fn(),
    onDragTimelineProgressChange: jest.fn(),
    onDraggingChange: jest.fn(),
    onSharedTimelineDurationChange: jest.fn(),
    onDragRelease: jest.fn(),
    onDragEnd: jest.fn(),
    onDragReset: jest.fn(),
  };
  const dragProgressMotion = createMotionValueStub(0);
  const controls = createControlsStub();

  const full: Params = {
    slideMode: 'drag',
    isActive: true,
    sceneIndex: 0,
    currentSceneIndex: 0,
    totalScenes: 3,
    slideDirection: 'x',
    slideDuration: 800,
    sceneTransitionDuration: 800,
    sceneOffset: 0,
    sceneState: 'active' as SceneState,
    globalDirection: null,
    globalRenderProgress: 0,
    globalIsDragging: false,
    globalDragProgress: 0,
    globalDragTimelineProgress: 0,
    controls,
    dragProgressMotion,
    resolveDragProgress: (p: number) => p,
    getTimelineDuration: () => 800,
    completeReleaseImmediately: false,
    ...spies,
    ...overrides,
  };

  const view = renderHook((p: Params) => useDragSceneEngine(p), { initialProps: full });
  return { view, spies, dragProgressMotion, controls, params: full };
}

describe('useDragSceneEngine — scene-state sync effect', () => {
  beforeEach(() => {
    animateCalls.length = 0;
  });

  it('does nothing when slideMode is not drag', () => {
    const { spies, controls } = setup({ slideMode: 'scroll' });
    expect(controls.set).not.toHaveBeenCalled();
    expect(spies.setSceneState).not.toHaveBeenCalled();
  });

  it('active + idle stays active (no transition)', () => {
    const { spies, controls } = setup({ isActive: true, sceneState: 'active' });
    expect(controls.set).toHaveBeenCalled();
    expect(spies.setSceneState).not.toHaveBeenCalled();
  });

  it('active + transitioning -> exiting', () => {
    const { spies } = setup({
      isActive: true,
      sceneState: 'active',
      globalIsDragging: true,
    });
    expect(spies.setSceneState).toHaveBeenCalledWith('exiting');
  });

  it('inactive incoming-forward scene -> entering', () => {
    const { spies } = setup({
      isActive: false,
      sceneState: 'initial',
      sceneOffset: 1,
      globalRenderProgress: 0.3, // dragDirection forward
    });
    expect(spies.setSceneState).toHaveBeenCalledWith('entering');
  });

  it('inactive incoming-backward scene (negative render progress) -> entering', () => {
    const { spies } = setup({
      isActive: false,
      sceneState: 'initial',
      sceneOffset: -1,
      globalRenderProgress: -0.3, // dragDirection backward
    });
    expect(spies.setSceneState).toHaveBeenCalledWith('entering');
  });

  it('inactive non-incoming scene -> initial (uses globalDirection at rest)', () => {
    const { spies } = setup({
      isActive: false,
      sceneState: 'active',
      sceneOffset: 1,
      globalRenderProgress: 0, // at rest -> falls back to globalDirection
      globalDirection: 'backward', // forward offset 1 is NOT incoming
    });
    expect(spies.setSceneState).toHaveBeenCalledWith('initial');
  });
});

describe('useDragSceneEngine — handlePan', () => {
  beforeEach(() => {
    animateCalls.length = 0;
  });

  it('ignores pan when not active', () => {
    const { view, spies } = setup({ isActive: false });
    view.result.current.handlePan(new MouseEvent('mousemove'), panInfo(-100));
    expect(spies.onDragProgressChange).not.toHaveBeenCalled();
  });

  it('publishes render-lane progress on pan', () => {
    const { view, spies, dragProgressMotion } = setup({
      resolveDragProgress: (p: number) => p,
    });
    // offset -100 on x, viewport 1024 -> progress = -(-100)/1024 ≈ 0.0977
    view.result.current.handlePan(new MouseEvent('mousemove'), panInfo(-100));
    expect(spies.onDragProgressChange).toHaveBeenCalled();
    expect(spies.onRenderProgressChange).toHaveBeenCalled();
    expect(spies.onSharedTimelineDurationChange).not.toHaveBeenCalled();
    expect(dragProgressMotion.get()).toBeGreaterThan(0);
  });
});

describe('useDragSceneEngine — handlePanEnd', () => {
  beforeEach(() => {
    animateCalls.length = 0;
  });

  it('ignores pan-end when not active', () => {
    const { view, spies } = setup({ isActive: false });
    view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(0));
    expect(spies.onDragReset).not.toHaveBeenCalled();
  });

  it('tiny final progress resets without a release directive', () => {
    const { view, spies, dragProgressMotion } = setup();
    dragProgressMotion.set(0.0005); // below the 0.001 epsilon
    view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(0));
    expect(spies.onDragReset).toHaveBeenCalledTimes(1);
    expect(spies.onDraggingChange).toHaveBeenCalledWith(false);
    expect(spies.setSceneState).toHaveBeenCalledWith('active');
    expect(spies.onDragRelease).not.toHaveBeenCalled();
  });

  it('boundary-blocked drag bounces both tracks back to 0', () => {
    // resolveDragProgress returns 0 for a nonzero currentProgress -> boundary.
    const { view, spies, dragProgressMotion } = setup({
      resolveDragProgress: () => 0,
    });
    dragProgressMotion.set(0.6);
    view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(0));

    expect(spies.setIsAnimating).toHaveBeenCalledWith(true);
    expect(spies.onDragRelease).toHaveBeenCalledWith({
      mode: 'bounce',
      direction: 'forward',
      targetSceneIndex: 1,
    });
    const bounce = animateCalls.find((c) => c.isMotion && c.target === 0);
    expect(bounce).toBeDefined();

    bounce!.complete();
    expect(dragProgressMotion.get()).toBe(0);
    expect(spies.onDragReset).toHaveBeenCalledTimes(1);
    expect(spies.onDraggingChange).toHaveBeenCalledWith(false);
    expect(spies.setSceneState).toHaveBeenCalledWith('active');
    expect(spies.setIsAnimating).toHaveBeenLastCalledWith(false);
  });

  it('completeReleaseImmediately commits at 100% with no pending release', () => {
    const { view, spies, dragProgressMotion } = setup({
      completeReleaseImmediately: true,
    });
    dragProgressMotion.set(0.6); // > 0.5 threshold
    view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(0));

    expect(spies.onDraggingChange).toHaveBeenCalledWith(false);
    expect(spies.onDragEnd).toHaveBeenCalledWith('forward', 1, 800, 800);
    expect(spies.setIsAnimating).toHaveBeenLastCalledWith(false);
  });

  it('normal switch publishes a settle directive and commits when the slide completes', () => {
    const { view, spies, dragProgressMotion } = setup();
    dragProgressMotion.set(0.8); // > default ~0.3 threshold, no reversal
    view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(0));

    expect(spies.onDragRelease).toHaveBeenCalledWith({
      mode: 'settle',
      direction: 'forward',
      targetSceneIndex: 1,
      progressRatio: 0.8,
    });
    // The page-slide render tween (number form) animates currentProgress -> 1.
    const slide = animateCalls.find((c) => !c.isMotion && c.target === 1);
    expect(slide).toBeDefined();

    slide!.complete();
    expect(spies.onDragEnd).toHaveBeenCalledWith('forward', 0.8, 0.8 * 800, 800);
    expect(spies.onRenderProgressChange).toHaveBeenLastCalledWith(0);
    expect(spies.setIsAnimating).toHaveBeenLastCalledWith(false);
  });

  it('suspends and resumes the same render-lane object from its frozen progress', () => {
    const sharedLane = { current: null as import('./types').DragRenderLane | null };
    const onCandidateSuspensionChange = jest.fn(() => false);
    const { view, dragProgressMotion } = setup({
      renderLaneRef: sharedLane,
      onCandidateSuspensionChange,
    });
    dragProgressMotion.set(0.8);
    view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(0));

    const lane = sharedLane.current;
    const firstArm = animateCalls.find((call) => !call.isMotion && call.target === 1);
    expect(lane).not.toBeNull();
    expect(firstArm).toBeDefined();
    firstArm!.onUpdate?.(0.9);

    expect(view.result.current.handleCandidateSuspend()).toBe(true);
    expect(sharedLane.current).toBe(lane);
    expect(firstArm!.stopped).toBe(true);
    expect(onCandidateSuspensionChange).toHaveBeenLastCalledWith(true);

    const armsBeforeResume = animateCalls.length;
    view.result.current.handleCandidateResume();
    expect(sharedLane.current).toBe(lane);
    expect(animateCalls.length).toBe(armsBeforeResume + 1);
    const resumedArm = animateCalls[animateCalls.length - 1];
    expect(resumedArm?.target).toBe(1);
    expect(resumedArm?.duration).toBeCloseTo(0.08, 5);
    expect(onCandidateSuspensionChange).toHaveBeenLastCalledWith(false);
  });

  it('rejects ownership before stopping an in-flight lane or publishing drag state', () => {
    const { view, spies, dragProgressMotion, params } = setup();
    dragProgressMotion.set(0.8);
    view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(0));
    const slide = animateCalls.find((call) => !call.isMotion && call.target === 1);
    expect(slide).toBeDefined();

    spies.onDraggingChange.mockClear();
    spies.onDragProgressChange.mockClear();
    view.rerender({
      ...params,
      globalRenderProgress: 0.9,
      onOwnershipRequest: jest.fn(() => false),
    });

    expect(view.result.current.handleDragStart('forward')).toBe(false);
    expect(slide!.stopped).toBe(false);
    expect(spies.onDraggingChange).not.toHaveBeenCalled();
    expect(spies.onDragProgressChange).not.toHaveBeenCalled();
  });

  it('a new drag start takes over a pending release IN PLACE (D-F7): no commit, lane stopped, pan continues from the frozen position', () => {
    const takeoverSnapshot: NonNullable<Params['takeoverSnapshot']> = {
      current: { token: 1, sceneIndices: [1], staleRatio: 0.8, baseRatio: null },
    };
    const { view, spies, dragProgressMotion, params } = setup({ takeoverSnapshot });
    // Drive a normal switch so a pending release is queued (its slide tween is
    // left in-flight by the step-driver mock).
    dragProgressMotion.set(0.8);
    view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(0));
    expect(spies.onDragEnd).not.toHaveBeenCalled(); // slide still in flight
    const slide = animateCalls.find((c) => !c.isMotion && c.target === 1);
    expect(slide).toBeDefined();

    // The slide advanced the page to renderProgress 0.9 before the re-grab.
    view.rerender({ ...params, globalRenderProgress: 0.9 });
    view.result.current.handleDragStart('forward');

    // Takeover, not flush: the transition is NOT hard-finalized (a commit here
    // teleports the whole stack by the remaining progress in one frame). The
    // lane is stopped where it is and the gesture baseline is seeded from the
    // frozen render position.
    expect(spies.onDragEnd).not.toHaveBeenCalled();
    expect(slide!.stopped).toBe(true);
    expect(dragProgressMotion.get()).toBe(0.9);
    expect(spies.onDragProgressChange).toHaveBeenLastCalledWith(0.9);
    expect(spies.onDragTimelineProgressChange).toHaveBeenLastCalledWith(0.9);
    expect(spies.onDraggingChange).toHaveBeenLastCalledWith(true);

    // A late frame of the stopped slide tween is inert — it can never commit.
    slide!.complete();
    expect(spies.onDragEnd).not.toHaveBeenCalled();

    // The pan continues from the frozen baseline, never from a fresh 0:
    // finger delta -102.4px on a 1024px viewport = +0.1 -> 0.9 + 0.1 = 1.0.
    view.result.current.handlePan(new MouseEvent('mousemove'), panInfo(-102.4));
    expect(spies.onRenderProgressChange).toHaveBeenLastCalledWith(expect.closeTo(1, 5) as number);

    // Releasing at the exact target commits synchronously. There is no reason to
    // allocate a zero-length replacement tween; the preserved lane identity has
    // already been permanently preempted by ownership.
    view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(-102.4));
    expect(animateCalls.filter((c) => !c.isMotion && c.target === 1)).toEqual([slide]);
    expect(spies.onDragEnd).toHaveBeenCalledTimes(1);
    expect(spies.onDragEnd).toHaveBeenCalledWith('forward', 1, 800, 800);
  });

  it('a takeover scrubbed back to rest abandons the transition: tiny release publishes the bounce rewind (D-F7)', () => {
    const { view, spies, dragProgressMotion, params } = setup();
    dragProgressMotion.set(0.8);
    view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(0));
    spies.onDragRelease.mockClear();

    view.rerender({ ...params, globalRenderProgress: 0.9 });
    view.result.current.handleDragStart('forward');

    // Scrub the page back to rest and release there: the taken-over transition
    // is abandoned pre-commit. The would-be incoming scene's element track must
    // get the bounce rewind (its continuation was preempted mid-enter), and the
    // reset tears the stale settle directive down.
    view.result.current.handlePan(new MouseEvent('mousemove'), panInfo(921.6)); // 0.9 - 0.9
    view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(921.6));

    expect(spies.onDragEnd).not.toHaveBeenCalled();
    expect(spies.onDragRelease).toHaveBeenCalledWith({
      mode: 'bounce',
      direction: 'forward',
      targetSceneIndex: 1,
    });
    expect(spies.onDragReset).toHaveBeenCalledTimes(1);
  });

  it('direction reversal at high velocity forces a bounce-back instead of a switch', () => {
    // currentProgress positive, velocity strongly negative-signed, > 600.
    const { view, spies, dragProgressMotion } = setup();
    dragProgressMotion.set(0.8); // above threshold
    // x-axis velocity +700 -> signedProgressVelocity = -700; 0.8 * -700 < 0 and
    // velocity 700 > 600 -> hasDirectionReversal -> NOT a switch -> bounce-back.
    view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(0, 700, 'x'));

    expect(spies.onDragRelease).toHaveBeenCalledWith({
      mode: 'bounce',
      direction: 'forward',
      targetSceneIndex: 1,
    });
    const bounce = animateCalls.find((c) => c.isMotion && c.target === 0);
    expect(bounce).toBeDefined();
    bounce!.complete();
    expect(dragProgressMotion.get()).toBe(0);
    expect(spies.onDragReset).toHaveBeenCalledTimes(1);
    expect(spies.setIsAnimating).toHaveBeenLastCalledWith(false);
  });

  it('below-threshold release bounces back to 0', () => {
    const { view, spies, dragProgressMotion } = setup();
    dragProgressMotion.set(0.1); // > 0.001 but <= ~0.3 threshold
    view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(0));

    expect(spies.onDragRelease).toHaveBeenCalledWith({
      mode: 'bounce',
      direction: 'forward',
      targetSceneIndex: 1,
    });
    const bounce = animateCalls.find((c) => c.isMotion && c.target === 0);
    expect(bounce).toBeDefined();
    bounce!.complete();
    expect(spies.onDragProgressChange).toHaveBeenLastCalledWith(0);
    expect(spies.onDraggingChange).toHaveBeenLastCalledWith(false);
    expect(spies.setIsAnimating).toHaveBeenLastCalledWith(false);
  });

  it('backward switch targets the previous scene', () => {
    const { view, spies, dragProgressMotion } = setup({ currentSceneIndex: 2 });
    dragProgressMotion.set(-0.8); // negative -> backward
    view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(0));
    expect(spies.onDragRelease).toHaveBeenCalledWith({
      mode: 'settle',
      direction: 'backward',
      targetSceneIndex: 1,
      progressRatio: 0.8,
    });
  });

  it('a DIFFERENT engine takes over an in-flight release through the SHARED render-lane slot (D-F1/D-F7)', () => {
    // Rush re-grab recursion case: engine A (the outgoing scene) owns the
    // in-flight settle page-slide, but the next pointerdown physically lands on
    // engine B (the incoming scene, which now covers most of the viewport).
    // B's handleDragStart must take A's lane over THROUGH THE SHARED SLOT:
    // stop it in place and continue from the frozen render position. With a
    // per-engine slot, A's slide keeps writing the render lane while B's pan
    // writes it too (dual writer) — and a flush-commit here would teleport the
    // whole stack by the remaining progress in one frame.
    const sharedLane = { current: null as import('./types').DragRenderLane | null };
    const engineA = setup({ sceneIndex: 0, currentSceneIndex: 0, renderLaneRef: sharedLane });
    engineA.dragProgressMotion.set(0.8);
    engineA.view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(0));
    expect(engineA.spies.onDragEnd).not.toHaveBeenCalled(); // slide in flight
    expect(sharedLane.current?.kind).toBe('settle');
    expect(sharedLane.current?.ownerSceneIndex).toBe(0);

    // B is not the active scene yet (the commit has not happened — A's slide is
    // still running), so B accepts the grab ONLY because a lane is in flight.
    const engineB = setup({
      sceneIndex: 1,
      currentSceneIndex: 0,
      isActive: false,
      renderLaneRef: sharedLane,
    });
    // The slide had advanced the page to renderProgress 0.9 by the re-grab.
    engineB.view.rerender({ ...engineB.params, isActive: false, globalRenderProgress: 0.9 });
    engineB.view.result.current.handleDragStart('forward');

    // Takeover, not flush: A's release is NOT finalized, its lane is stopped
    // where it stood, and the shared slot is drained so B's pan is the sole
    // render-lane writer.
    expect(engineA.spies.onDragEnd).not.toHaveBeenCalled();
    expect(sharedLane.current).toBeNull();
    expect(engineB.spies.onDraggingChange).toHaveBeenLastCalledWith(true);

    const slide = animateCalls.find((c) => !c.isMotion && c.target === 1);
    expect(slide!.stopped).toBe(true);
    // A late frame of the stopped slide is inert — it can never commit.
    slide!.complete();
    expect(engineA.spies.onDragEnd).not.toHaveBeenCalled();

    // B's gesture continues from the frozen position (0.9), not from a fresh 0.
    expect(engineB.dragProgressMotion.get()).toBe(0.9);
    engineB.view.result.current.handlePan(new MouseEvent('mousemove'), panInfo(-102.4));
    expect(engineB.spies.onRenderProgressChange).toHaveBeenLastCalledWith(
      expect.closeTo(1, 5) as number
    );

    // B reaches the exact target and therefore commits synchronously from B's
    // engine; no zero-length replacement lane is left in the shared slot.
    engineB.view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(-102.4));
    expect(sharedLane.current).toBeNull();
    expect(animateCalls.filter((c) => !c.isMotion && c.target === 1)).toEqual([slide]);
    expect(engineB.spies.onDragEnd).toHaveBeenCalledTimes(1);
    expect(engineA.spies.onDragEnd).not.toHaveBeenCalled();
  });

  it("unmounting a scene does NOT tear down another engine's lane in the shared slot", () => {
    // The slot is global; only the engine that created the in-flight lane may
    // clean it up on unmount. A pruned neighbour scene (window moves to ±1)
    // must leave the active release untouched.
    const sharedLane = { current: null as import('./types').DragRenderLane | null };
    const engineA = setup({ sceneIndex: 0, currentSceneIndex: 0, renderLaneRef: sharedLane });
    engineA.dragProgressMotion.set(0.8);
    engineA.view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(0));
    expect(sharedLane.current?.kind).toBe('settle');

    const engineB = setup({ sceneIndex: 2, currentSceneIndex: 0, renderLaneRef: sharedLane });
    engineB.view.unmount();
    expect(sharedLane.current?.kind).toBe('settle'); // A's lane survives

    engineA.view.unmount();
    expect(sharedLane.current).toBeNull(); // owner unmount cleans up
  });

  it('a re-grab during an in-flight bounce takes it over from the frozen position (sole render-lane writer)', () => {
    // Below-threshold release starts a bounce tween (render lane -> 0). It is
    // left in-flight by the step-driver mock (no .complete()).
    const { view, spies, dragProgressMotion, params } = setup();
    dragProgressMotion.set(0.1);
    view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(0));
    const bounce = animateCalls.find((c) => c.isMotion && c.target === 0);
    expect(bounce).toBeDefined();
    expect(bounce!.stopped).toBe(false);

    // The bounce had rewound the page to renderProgress 0.06 by the re-grab.
    view.rerender({ ...params, globalRenderProgress: 0.06 });
    // Re-grab before the bounce finishes. handleDragStart must stop the
    // in-flight bounce — otherwise its onUpdate keeps writing the render lane
    // while handlePan also writes it (two writers / single-writer invariant
    // break) — and seed the gesture baseline from the frozen position.
    view.result.current.handleDragStart('forward');
    expect(bounce!.stopped).toBe(true);
    expect(dragProgressMotion.get()).toBe(0.06);
    expect(spies.onDragProgressChange).toHaveBeenLastCalledWith(0.06);

    // A late bounce frame after the stop is now inert (the mock's complete()
    // respects the stopped flag), so it cannot clobber the new gesture.
    bounce!.complete();
    expect(dragProgressMotion.get()).toBe(0.06);

    // The new pan continues from the frozen 0.06, never from a fresh 0:
    // finger delta -102.4px on a 1024px viewport = +0.1 -> 0.16.
    view.result.current.handlePan(new MouseEvent('mousemove'), panInfo(-102.4));
    expect(spies.onRenderProgressChange).toHaveBeenLastCalledWith(
      expect.closeTo(0.16, 5) as number
    );
  });

  it('pointercancel above threshold forces a bounce-back — never a commit (D-F5)', () => {
    // System interruption (incoming call / browser gesture takeover) delivers
    // pointercancel. Even with progress far past the threshold, the release must
    // take cancel semantics: bounce both tracks back, no settle, no commit.
    const { view, spies, dragProgressMotion } = setup();
    dragProgressMotion.set(0.8);
    view.result.current.handlePanEnd(new Event('pointercancel') as PointerEvent, panInfo(0));

    expect(spies.onDragEnd).not.toHaveBeenCalled();
    expect(spies.onDragRelease).toHaveBeenCalledWith({
      mode: 'bounce',
      direction: 'forward',
      targetSceneIndex: 1,
    });
    const bounce = animateCalls.find((c) => c.isMotion && c.target === 0);
    expect(bounce).toBeDefined();
    // The physical pointer session ended before the visual bounce starts. Keeping
    // isDragging=true until completion prevents a candidate tap from resuming the
    // suspended element bounce, splitting the render and element lanes.
    expect(spies.onDraggingChange).toHaveBeenCalledTimes(1);
    expect(spies.onDraggingChange).toHaveBeenLastCalledWith(false);

    // Completing the bounce runs the reset path -> onDragReset (which upstream
    // fires the public onDragCancel), still no commit and no duplicate ownership clear.
    bounce!.complete();
    expect(dragProgressMotion.get()).toBe(0);
    expect(spies.onDragReset).toHaveBeenCalledTimes(1);
    expect(spies.onDraggingChange).toHaveBeenCalledTimes(1);
    expect(spies.onDragEnd).not.toHaveBeenCalled();
    expect(spies.setIsAnimating).toHaveBeenLastCalledWith(false);
  });

  it('pointercancel never commits even in completeReleaseImmediately mode (D-F5)', () => {
    const { view, spies, dragProgressMotion } = setup({ completeReleaseImmediately: true });
    dragProgressMotion.set(0.9); // far above the 0.5 standalone threshold
    view.result.current.handlePanEnd(new Event('pointercancel') as PointerEvent, panInfo(0));

    expect(spies.onDragEnd).not.toHaveBeenCalled();
    expect(spies.onDragRelease).toHaveBeenCalledWith(expect.objectContaining({ mode: 'bounce' }));
  });

  it('below-threshold bounce runs on the slideDuration timescale, not the element timeline (D-F2)', () => {
    // Long authored element timeline (site case: T_self ≈ 6.5s) must NOT
    // stretch the render-lane bounce. Old formula: 0.25 * 6500 * 0.5 = 812.5ms.
    // New formula: min(0.25 * slideDuration(800), 300) = 200ms.
    const { view, dragProgressMotion } = setup({
      slideDuration: 800,
      getTimelineDuration: () => 6500,
    });
    dragProgressMotion.set(0.25); // below the default 0.3 threshold at v=0
    view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(0));

    const bounce = animateCalls.find((c) => c.isMotion && c.target === 0);
    expect(bounce).toBeDefined();
    expect(bounce!.duration).toBeCloseTo(0.2, 5);
  });

  it('bounce duration is capped at 300ms, matching the element-track bounce cap (D-F2)', () => {
    const { view, dragProgressMotion } = setup({
      slideDuration: 2000, // 0.25 * 2000 = 500ms -> capped to 300ms
      getTimelineDuration: () => 6500,
    });
    dragProgressMotion.set(0.25);
    view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(0));

    const bounce = animateCalls.find((c) => c.isMotion && c.target === 0);
    expect(bounce).toBeDefined();
    expect(bounce!.duration).toBeCloseTo(0.3, 5);
  });

  it('unmounting mid-release stops the in-flight tween (no setState-after-unmount / rAF leak)', () => {
    // Normal switch leaves a settle render tween in-flight.
    const { view, dragProgressMotion } = setup();
    dragProgressMotion.set(0.8);
    view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(0));
    const slide = animateCalls.find((c) => !c.isMotion && c.target === 1);
    expect(slide).toBeDefined();
    expect(slide!.stopped).toBe(false);

    // Tearing down while the release is still tweening must stop it so
    // framer-motion's rAF does not fire onUpdate/onComplete (setState) after the
    // hook has unmounted.
    view.unmount();
    expect(slide!.stopped).toBe(true);
  });
});

describe('useDragSceneEngine — verbose drag debug branches', () => {
  const realNodeEnv = process.env.NODE_ENV;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    animateCalls.length = 0;
    // isVerboseDragDebug requires development env + the window flag.
    process.env.NODE_ENV = 'development';
    (window as unknown as { __CINEVIEW_DRAG_DEBUG__?: boolean }).__CINEVIEW_DRAG_DEBUG__ = true;
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = realNodeEnv;
    delete (window as unknown as { __CINEVIEW_DRAG_DEBUG__?: boolean }).__CINEVIEW_DRAG_DEBUG__;
    logSpy.mockRestore();
  });

  it('handlePan logs a progress bucket when verbose (and de-dupes the same bucket)', () => {
    const { view } = setup();
    // Two pans landing in the same 0.1 bucket: the first logs, the second is
    // de-duped by lastPanBucketRef (covers both arms of the bucket guard).
    view.result.current.handlePan(new MouseEvent('mousemove'), panInfo(-100));
    const afterFirst = logSpy.mock.calls.length;
    expect(afterFirst).toBeGreaterThan(0);
    view.result.current.handlePan(new MouseEvent('mousemove'), panInfo(-100));
    // Same bucket -> no additional drag-progress log line.
    const dragProgressLogs = logSpy.mock.calls.filter((c) =>
      String(c[0]).includes('drag progress')
    );
    expect(dragProgressLogs.length).toBe(1);
  });

  it('release render tween logs a tick bucket when verbose', () => {
    const { view, dragProgressMotion } = setup();
    dragProgressMotion.set(0.8); // switch
    view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(0));
    const slide = animateCalls.find((c) => !c.isMotion && c.target === 1);
    expect(slide).toBeDefined();
    // Drive an onUpdate tick to exercise the verbose render-tick block.
    slide!.onUpdate?.(0.85);
    const tickLogs = logSpy.mock.calls.filter((c) => String(c[0]).includes('release render tick'));
    expect(tickLogs.length).toBeGreaterThan(0);
  });
});
