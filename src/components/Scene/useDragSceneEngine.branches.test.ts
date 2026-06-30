/**
 * Branch coverage for useDragSceneEngine — the pan/release gesture engine.
 *
 * The existing `useDragSceneEngine.threshold.test.ts` only exercises the pure
 * `calculateThreshold` helper. These tests drive the hook itself
 * (handleDragStart / handlePan / handlePanEnd) through the scene-state sync
 * effect and every release branch:
 *   - scene-state sync transitions (active/exiting/entering/initial),
 *   - handleDragStart finalizing a pending release without a flush (line 209),
 *   - handlePan render-lane publish + verbose bucket debug (lines 254-267),
 *   - handlePanEnd: tiny-progress reset, boundary bounce (312-342),
 *     completeReleaseImmediately switch, normal switch + commitRelease re-entry
 *     guard (409) + verbose render tick (455-458), direction-reversal bounce,
 *     and the bounce-back tween onUpdate/onComplete (487-498).
 *
 * The framer-motion `animate` mock is a step driver supporting BOTH the
 * MotionValue form (handlePanEnd bounce: animate(dragProgressMotion, 0, ...))
 * and the number form (switch: animate(currentProgress, targetProgress, ...)).
 * Expected values are read directly off useDragSceneEngine.ts.
 */

import { renderHook } from '@testing-library/react';
import type { AnimationControls, MotionValue, PanInfo } from 'framer-motion';

interface AnimateCall {
  target: number;
  isMotion: boolean;
  completed: boolean;
  stopped: boolean;
  onUpdate?: (latest: number) => void;
  onComplete?: () => void;
  complete: () => void;
}

const animateCalls: AnimateCall[] = [];
// When true, number-form (render-lane) controls expose a flush() that completes
// the tween synchronously — modeling framer-motion's flush. handleDragStart
// prefers flush() over the pending commit() (line 207) when present.
let enableRenderFlush = false;

jest.mock('framer-motion', () => ({
  __esModule: true,
  animate: (
    value: { get: () => number; set: (n: number) => void } | number,
    target: number,
    options?: { onUpdate?: (latest: number) => void; onComplete?: () => void }
  ) => {
    const isMotion = typeof value === 'object' && value !== null && 'set' in value;
    const call: AnimateCall = {
      target,
      isMotion,
      completed: false,
      stopped: false,
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
    const controls: { stop: () => void; flush?: () => void } = {
      stop: () => {
        call.stopped = true;
      },
    };
    if (!isMotion && enableRenderFlush) {
      controls.flush = () => call.complete();
    }
    return controls;
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

function createControlsStub(): AnimationControls {
  return {
    set: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    mount: jest.fn(),
  } as unknown as AnimationControls;
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
    onDragCommit: jest.fn(),
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
    expect(spies.onSharedTimelineDurationChange).toHaveBeenCalledWith(800);
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
    expect(spies.onDragCommit).toHaveBeenCalledWith('forward', 1, 800, 800);
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
    expect(spies.onDragCommit).toHaveBeenCalledWith('forward', 0.8, 0.8 * 800, 800);
    expect(spies.onRenderProgressChange).toHaveBeenLastCalledWith(0);
    expect(spies.setIsAnimating).toHaveBeenLastCalledWith(false);
  });

  it('a new drag start finalizes a pending release via commit, and a late slide-complete is a no-op', () => {
    const { view, spies, dragProgressMotion } = setup();
    // Drive a normal switch so a pending release is queued (its slide tween is
    // left in-flight by the step-driver mock).
    dragProgressMotion.set(0.8);
    view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(0));
    expect(spies.onDragCommit).not.toHaveBeenCalled(); // slide still in flight

    // A new drag start finalizes the pending release. The mock controls expose
    // no flush(), so handleDragStart takes the else branch and calls
    // pendingRelease.commit() directly (line 209).
    view.result.current.handleDragStart();
    expect(spies.onDragCommit).toHaveBeenCalledTimes(1);
    expect(spies.onDraggingChange).toHaveBeenLastCalledWith(true);

    // Completing the original slide tween now re-enters commitRelease, which
    // finds pendingReleaseRef cleared and returns early (line 409) — no double
    // commit.
    const slide = animateCalls.find((c) => !c.isMotion && c.target === 1);
    slide!.complete();
    expect(spies.onDragCommit).toHaveBeenCalledTimes(1);
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

  it('a new drag start finalizes a pending release via the render flush() path', () => {
    // With flush() present on the render-lane controls, handleDragStart prefers
    // it over commit() (line 207). flush() completes the slide tween, which runs
    // commitRelease through its onComplete.
    enableRenderFlush = true;
    const { view, spies, dragProgressMotion } = setup();
    dragProgressMotion.set(0.8);
    view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(0));
    expect(spies.onDragCommit).not.toHaveBeenCalled(); // slide still in flight

    view.result.current.handleDragStart();
    // flush() drove the slide to completion -> commit fired exactly once.
    expect(spies.onDragCommit).toHaveBeenCalledTimes(1);
    expect(spies.onDraggingChange).toHaveBeenLastCalledWith(true);
  });

  it('a re-grab during an in-flight bounce stops it so the new pan is the sole render-lane writer', () => {
    // Below-threshold release starts a bounce tween (render lane -> 0). It is
    // left in-flight by the step-driver mock (no .complete()).
    const { view, dragProgressMotion } = setup();
    dragProgressMotion.set(0.1);
    view.result.current.handlePanEnd(new MouseEvent('mouseup'), panInfo(0));
    const bounce = animateCalls.find((c) => c.isMotion && c.target === 0);
    expect(bounce).toBeDefined();
    expect(bounce!.stopped).toBe(false);

    // Re-grab before the bounce finishes. With no pending settle, handleDragStart
    // must stop the in-flight bounce — otherwise its onUpdate keeps writing the
    // render lane while handlePan also writes it (two writers / single-writer
    // invariant break).
    view.result.current.handleDragStart();
    expect(bounce!.stopped).toBe(true);

    // A late bounce frame after the stop is now inert (the mock's complete()
    // respects the stopped flag), so it cannot clobber the new gesture.
    bounce!.complete();
    expect(dragProgressMotion.get()).toBe(0.1);
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
    enableRenderFlush = false;
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
