/**
 * useSceneManager Hook
 * Manages scene index and transition logic
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ScrollMode } from '../types';

function isScrollDebugEnabled(): boolean {
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') {
    return false;
  }

  return Boolean(
    (window as Window & { __CINEVIEW_SCROLL_DEBUG__?: boolean }).__CINEVIEW_SCROLL_DEBUG__
  );
}

function debugSceneManager(message: string, details?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  if (details) {
    console.debug(`[useSceneManager] ${message}`, details);
    return;
  }

  console.debug(`[useSceneManager] ${message}`);
}

function warnSceneManager(message: string): void {
  console.warn(`[useSceneManager] ${message}`);
}

// Two-track model (2026-06-25): the element timeline no longer lives in a single
// global scalar handed across the commit. Instead the outgoing scene's release
// publishes ONE read-only release directive; each incoming Scene instance owns
// and drives its own element track in response. `dragRelease` is that directive
// — a single-writer input, NOT a shared timeline value.
export interface DragRelease {
  token: number;
  // 'settle'/'bounce' are gesture releases (settle feeds the deferred-completion
  // join). 'enter' is a PROGRAMMATIC navigation directive (goToScene/next/prev in
  // drag mode): it drives the destination scene's element track 0 -> T so the
  // authored enter timeline plays, but it is deliberately kept OUT of the gesture
  // join (it never sets expectedSettleRef), so it cannot corrupt a later commit.
  mode: 'settle' | 'bounce' | 'enter';
  direction: 'forward' | 'backward';
  targetSceneIndex: number;
  // The drag timeline ratio r in [0, 1] captured at release time, authoritative
  // for seeding the incoming scene's element-track continuation. The follow-finger
  // ref can read a stale 0 when the whole gesture flushes in one synchronous batch
  // (no intervening render); carrying r in the directive guarantees the settle
  // continues from the release elapsed instead of replaying from 0.
  progressRatio?: number;
}

export type DragReleaseInput = Omit<DragRelease, 'token'>;

export interface ScrollTransitionSnapshot {
  fromScene: number;
  toScene: number;
  direction: 'forward' | 'backward';
  progressRatio: number;
  startedAt: number;
  lastInputAt: number;
  isSettling: boolean;
  settleDirection: 'forward' | 'backward' | null;
}

export interface UseSceneManagerOptions {
  totalScenes: number;
  initialScene?: number;
  mode?: ScrollMode;
  onBeforeChange?: (from: number, to: number) => void;
  /**
   * Fires at the authoritative index commit. Unlike onAfterChange, this is not a
   * lifecycle notification and is used internally to mint Scene activation tokens.
   */
  onCommit?: (sceneIndex: number, previousIndex: number, kind: 'drag' | 'programmatic') => void;
  onAfterChange?: (sceneIndex: number, previousIndex?: number) => void;
}

export interface SceneManagerState {
  currentScene: number;
  isAnimating: boolean;
  direction: 'forward' | 'backward' | null;
  dragProgress: number; // Added: drag progress
  dragTimelineProgress: number;
  scrollProgress: number;
  scrollDirection: 'forward' | 'backward' | null;
  renderProgress: number;
  isDragging: boolean; // Added: is currently dragging
  isScrolling: boolean;
  sharedTimelineDurationMs: number;
  dragRelease: DragRelease | null;
  scrollTransitionSnapshot: ScrollTransitionSnapshot | null;
}

export interface SceneManagerActions {
  goToScene: (index: number, animated?: boolean) => void;
  nextScene: () => void;
  prevScene: () => void;
  setAnimating: (animating: boolean) => void;
  canGoNext: () => boolean;
  canGoPrev: () => boolean;
  setDragProgress: (progress: number) => void; // Added: set drag progress
  setDragTimelineProgress: (progress: number) => void;
  setScrollProgress: (progress: number) => void;
  setScrollDirection: (direction: 'forward' | 'backward' | null) => void;
  setScrollTransitionSnapshot: (snapshot: ScrollTransitionSnapshot | null) => void;
  setRenderProgress: (progress: number) => void;
  setIsDragging: (dragging: boolean) => void; // Added: set dragging state
  setIsScrolling: (scrolling: boolean) => void;
  setSharedTimelineDurationMs: (duration: number) => void;
  setDragRelease: (release: DragReleaseInput | null) => void;
  resetDragInteraction: () => void;
  /** Ends a superseded settle/bounce join without changing the current render position. */
  abortDragContinuation: () => void;
  resetScrollInteraction: () => void;
  /**
   * Applies a drag commit. Returns `true` when the scene index actually moved.
   * An out-of-bounds target returns `false` WITHOUT touching `currentScene`, so
   * callers that arm work on the scene-change render must disarm it on `false`.
   */
  commitDragSceneChange: (
    direction: 'forward' | 'backward',
    progressRatio: number,
    elapsedMs?: number,
    timelineDuration?: number
  ) => boolean;
  completeDragTransition: () => void;
  commitScrollSceneChange: (direction: 'forward' | 'backward', progressRatio: number) => void;
  clearScrollTransitionSnapshot: () => void;
}

export const useSceneManager = (
  options: UseSceneManagerOptions
): [SceneManagerState, SceneManagerActions] => {
  const {
    totalScenes,
    initialScene = 0,
    mode = 'drag',
    onBeforeChange,
    onCommit,
    onAfterChange,
  } = options;

  const [currentScene, setCurrentScene] = useState<number>(
    Math.max(0, Math.min(initialScene, totalScenes - 1))
  );
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [direction, setDirection] = useState<'forward' | 'backward' | null>(null);
  const [dragProgress, setDragProgress] = useState<number>(0);
  const [dragTimelineProgress, setDragTimelineProgress] = useState<number>(0);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [scrollDirection, setScrollDirection] = useState<'forward' | 'backward' | null>(null);
  const [renderProgress, setRenderProgress] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isScrolling, setIsScrolling] = useState<boolean>(false);
  // KEEP: still reported up to CineView (harmless) so cold-start/registry growth
  // diagnostics keep working. It is NOT the element timeline value anymore — each
  // Scene owns its own element track via useElementTrack.
  const [sharedTimelineDurationMs, setSharedTimelineDurationMs] = useState<number>(0);
  // Two-track model: the single read-only release directive published by the
  // outgoing scene's release. Replaces the deleted `dragTransitionSnapshot`.
  const [dragRelease, setDragRelease] = useState<DragRelease | null>(null);
  const dragReleaseTokenRef = useRef<number>(0);
  const [scrollTransitionSnapshot, setScrollTransitionSnapshot] =
    useState<ScrollTransitionSnapshot | null>(null);

  const animatingRef = useRef<boolean>(false);
  const currentSceneRef = useRef<number>(currentScene);
  // The public onSceneLeave now fires at COMMIT (render arm), not at the join
  // close. The two-arm join is RETAINED but its job is narrowed to STATE CLEANUP
  // timing — deciding WHEN it is safe to clear `dragRelease`/`direction`/scalars:
  //  - render arm: the page-slide reaches the target -> commitDragSceneChange
  //    advances the index, fires onAfterChange, and records
  //    `pendingTransitionFromRef` (the from index) so the element arm knows a
  //    commit already happened.
  //  - element arm: the incoming scene's element track reaches T ->
  //    completeDragTransition.
  // Cleanup must wait for BOTH: clearing `dragRelease` while the incoming element
  // track is still running snaps the incoming scene to rest (useAnimateDrag keeps
  // the cross-commit continuation alive only while dragRelease.mode === 'settle'),
  // and clearing `direction`/scalars while the page is still sliding strands the
  // outgoing scene. The page-slide runs on a fixed slideDuration while the element
  // track runs on the incoming scene's own T_self, so either arm can arrive first;
  // whichever arrives second runs the cleanup.
  const pendingTransitionFromRef = useRef<number | null>(null);
  // Set by the element arm when it arrives before the render commit. The render
  // arm runs the cleanup when it sees this.
  const settleArrivedRef = useRef<boolean>(false);
  // True only while a settle release is outstanding. Gates the element arm so a
  // stray completion (e.g. a cold-start extend re-firing onActivationComplete
  // after its window closed) cannot record a phantom early-settle and pollute the
  // next transition's cleanup join.
  const expectedSettleRef = useRef<boolean>(false);
  // In-flight PROGRAMMATIC animated goToScene bookkeeping (D-F6). Records the
  // true from-index (so setAnimating(false) — the settle-timer close — can pass
  // it to onAfterChange instead of letting CineView fall back to the ALREADY
  // UPDATED currentSceneRef, which produced fromIndex === toIndex) and the token
  // of the 'enter' directive this goToScene published (so the timer clears ONLY
  // its own directive — never a real gesture's release that superseded it while
  // the timer was still pending, which would snap the incoming elements).
  const programmaticNavRef = useRef<{ fromScene: number; releaseToken: number | null } | null>(
    null
  );

  currentSceneRef.current = currentScene;

  // B2: runtime children shrink (conditional rendering removing scenes) can
  // leave the active index out of range — blank viewport — and CineView's
  // settle effect early-returns on the missing scene so isAnimating would hang
  // forever. Re-clamp the active index and unhang the animation flag; no
  // onAfterChange is fabricated (nothing "completed", a scene was removed).
  useEffect(() => {
    const maxIndex = Math.max(totalScenes - 1, 0);
    if (currentSceneRef.current <= maxIndex) return;
    setCurrentScene(maxIndex);
    if (animatingRef.current) {
      setIsAnimating(false);
      animatingRef.current = false;
      setDirection(null);
      programmaticNavRef.current = null;
    }
  }, [totalScenes]);

  // Cleans up the drag-transition state: clears the lingering drag scalars, the
  // direction, and the release directive. This is CLEANUP ONLY — it no longer
  // fires onAfterChange (that now fires at commit, see commitDragSceneChange).
  // Direction/release are cleared HERE (at the join close, when both arms are
  // done) and never by a single arm — clearing them while the page is still
  // sliding would strand the outgoing scene mid-transition, and clearing
  // `dragRelease` while the incoming element track is still running would snap
  // the incoming scene to rest (useAnimateDrag reads dragRelease.mode === 'settle'
  // to keep the cross-commit element continuation alive). So the element track
  // reaching T is what releases this cleanup.
  const cleanupAfterTransition = useCallback(() => {
    pendingTransitionFromRef.current = null;
    settleArrivedRef.current = false;
    expectedSettleRef.current = false;
    setDragProgress(0);
    setDragTimelineProgress(0);
    setSharedTimelineDurationMs(0);
    setDragRelease(null);
    setDirection(null);
  }, []);

  // Publishes the single read-only release directive. The token is injected here
  // (monotonic) so each release is uniquely identifiable and every scene's
  // useElementTrack can react exactly once per release (StrictMode-safe).
  const publishDragRelease = useCallback((release: DragReleaseInput | null) => {
    if (release === null) {
      expectedSettleRef.current = false;
      setDragRelease(null);
      return;
    }
    // Only a settle release feeds the deferred-completion join; a bounce/boundary
    // release does not commit a scene change. A superseding bounce clears the flag.
    expectedSettleRef.current = release.mode === 'settle';
    dragReleaseTokenRef.current += 1;
    setDragRelease({ ...release, token: dragReleaseTokenRef.current });
  }, []);

  // Check if can move forward
  const canGoNext = useCallback((): boolean => {
    return currentScene < totalScenes - 1;
  }, [currentScene, totalScenes]);

  // Check if can move backward
  const canGoPrev = useCallback((): boolean => {
    return currentScene > 0;
  }, [currentScene]);

  // Navigate to specified scene
  const goToScene = useCallback(
    (index: number, animated: boolean = true) => {
      debugSceneManager('goToScene requested', {
        fromScene: currentScene,
        toScene: index,
        animated,
      });

      // Validate index
      if (index < 0 || index >= totalScenes) {
        warnSceneManager(`Invalid scene index: ${index}. Must be between 0 and ${totalScenes - 1}`);
        return;
      }

      // Skip if already at target scene
      if (index === currentScene) {
        debugSceneManager('goToScene skipped because scene is already active', {
          scene: index,
        });
        return;
      }

      // Trigger onBeforeChange callback
      onBeforeChange?.(currentScene, index);

      // Set direction
      const newDirection = index > currentScene ? 'forward' : 'backward';
      setDirection(newDirection);

      // Update scene index
      debugSceneManager('Applying scene change', {
        toScene: index,
        direction: newDirection,
      });
      setCurrentScene(index);
      onCommit?.(index, currentScene, 'programmatic');

      // If animation is needed
      if (animated) {
        setIsAnimating(true);
        animatingRef.current = true;
        // D-F6: remember the true from-index for the settle-timer close.
        programmaticNavRef.current = { fromScene: currentScene, releaseToken: null };
        // Drag mode: programmatic navigation must still play the destination
        // scene's element-timeline enter. Gesture/release nav drives the element
        // track via a release directive; a bare setCurrentScene does not, so the
        // incoming scene would otherwise snap to rest (mode 'rest', localProgress
        // 1) with no per-element delay sequencing. Publish an 'enter' directive so
        // the destination's useElementTrack replays 0->T. This deliberately does
        // NOT enter the gesture join (expectedSettleRef stays false for 'enter'),
        // so it cannot corrupt a later gesture commit; completion is still driven
        // by CineView's animated-settle timer -> setAnimating(false).
        if (mode === 'drag') {
          dragReleaseTokenRef.current += 1;
          programmaticNavRef.current.releaseToken = dragReleaseTokenRef.current;
          setDragRelease({
            token: dragReleaseTokenRef.current,
            mode: 'enter',
            direction: newDirection,
            targetSceneIndex: index,
          });
        }
      } else {
        // Immediately trigger onAfterChange (with real from-index)
        onAfterChange?.(index, currentScene);
      }
    },
    [currentScene, totalScenes, mode, onBeforeChange, onCommit, onAfterChange]
  );

  // Next scene
  const nextScene = useCallback(() => {
    const canAdvance = canGoNext();
    debugSceneManager('nextScene requested', {
      currentScene,
      canAdvance,
    });
    if (canAdvance) {
      goToScene(currentScene + 1);
    } else {
      debugSceneManager('nextScene skipped at upper boundary', {
        currentScene,
      });
    }
  }, [currentScene, canGoNext, goToScene]);

  // Previous scene
  const prevScene = useCallback(() => {
    const canRetreat = canGoPrev();
    debugSceneManager('prevScene requested', {
      currentScene,
      canRetreat,
    });
    if (canRetreat) {
      goToScene(currentScene - 1);
    } else {
      debugSceneManager('prevScene skipped at lower boundary', {
        currentScene,
      });
    }
  }, [currentScene, canGoPrev, goToScene]);

  // Set animation state
  const setAnimating = useCallback(
    (animating: boolean) => {
      setIsAnimating(animating);
      animatingRef.current = animating;

      // Trigger onAfterChange when animation ends (D-F6: carry the real from-index
      // recorded by goToScene, otherwise CineView falls back to the already updated
      // currentSceneRef, producing from === to)
      if (!animating) {
        const programmaticNav = programmaticNavRef.current;
        programmaticNavRef.current = null;
        if (programmaticNav) {
          onAfterChange?.(currentScene, programmaticNav.fromScene);
        } else {
          onAfterChange?.(currentScene);
        }
        setDirection(null);
        // Clear the programmatic 'enter' directive (goToScene): the destination
        // scene's element track has reached T by now; leaving the directive set
        // would keep useAnimateDrag in 'enter' mode reading a settled track.
        // D-F6: clear ONLY the directive THIS goToScene published (token
        // compare). If the settle timer expires during a LATER real gesture's
        // settle, that release carries a newer token and must stay live —
        // clearing it would snap the incoming scene's elements to rest.
        const releaseToken = programmaticNav?.releaseToken;
        if (releaseToken != null) {
          setDragRelease((prev) => (prev !== null && prev.token === releaseToken ? null : prev));
        }
      }
    },
    [currentScene, onAfterChange]
  );

  const resetDragInteraction = useCallback(() => {
    // D-F1: a settle join can still be OUTSTANDING when a gesture-level reset
    // arrives — a tap lands after the commit (tiny progress -> onDragReset)
    // while the committed-to scene's element track is still completing
    // (preempted in place by H2). The live settle `dragRelease` and the join
    // refs must SURVIVE that reset: clearing the directive here snaps the
    // incoming scene's mid-enter elements to terminal (useAnimateDrag keeps
    // the cross-commit continuation alive only while dragRelease.mode ===
    // 'settle'), and clearing the join refs corrupts the pending cleanup join.
    // D-F7: preservation requires the render arm to have COMMITTED
    // (pendingTransitionFromRef). A settle whose page-slide was taken over by
    // a rush re-grab and then scrubbed back to rest is ABANDONED pre-commit —
    // its render arm will never come, so preserving it would resume the
    // element continuation toward a transition that no longer exists and hang
    // the join (a stale early-settle then corrupts the NEXT commit's cleanup).
    // Plain aborts still tear everything down: a bounce release publishes
    // first and flips expectedSettleRef to false before its onComplete calls
    // this.
    const settleJoinOutstanding =
      expectedSettleRef.current && pendingTransitionFromRef.current !== null;
    debugSceneManager('resetDragInteraction', {
      currentScene: currentSceneRef.current,
      settleJoinOutstanding,
    });
    if (!settleJoinOutstanding) {
      // Abort path (bounce / reset / abandoned pre-commit settle): no
      // transition is pending, so tear down the join state too or a stale
      // early-settle flag would leak into the next one.
      pendingTransitionFromRef.current = null;
      settleArrivedRef.current = false;
      expectedSettleRef.current = false;
      setDragRelease(null);
    }
    setDragProgress(0);
    setDragTimelineProgress(0);
    setRenderProgress(0);
    setIsDragging(false);
    setSharedTimelineDurationMs(0);
  }, []);

  const abortDragContinuation = useCallback(() => {
    // Internal retarget/abort: stop waiting for the superseded element arm and
    // remove its release directive, but preserve the live render position and
    // pointer-session state. The replacement gesture becomes the sole writer.
    pendingTransitionFromRef.current = null;
    settleArrivedRef.current = false;
    expectedSettleRef.current = false;
    setDragRelease(null);
    setDirection(null);
    setDragTimelineProgress(0);
    setSharedTimelineDurationMs(0);
  }, []);

  const resetScrollInteraction = useCallback(() => {
    debugSceneManager('resetScrollInteraction', {
      currentScene: currentSceneRef.current,
    });
    setScrollProgress(0);
    setScrollDirection(null);
    setIsScrolling(false);
    setScrollTransitionSnapshot(null);
  }, []);

  const commitDragSceneChange = useCallback(
    (
      direction: 'forward' | 'backward',
      progressRatio: number,
      _elapsedMs?: number,
      _timelineDuration?: number
    ) => {
      void _elapsedMs;
      void _timelineDuration;
      const fromScene = currentSceneRef.current;
      const targetScene = direction === 'forward' ? fromScene + 1 : fromScene - 1;
      const normalizedProgressRatio = Math.max(0, Math.min(progressRatio, 1));

      debugSceneManager('commitDragSceneChange:start', {
        fromScene,
        targetScene,
        direction,
        progressRatio: normalizedProgressRatio.toFixed(3),
      });

      if (targetScene < 0 || targetScene >= totalScenes) {
        resetDragInteraction();
        setDirection(null);
        setIsAnimating(false);
        animatingRef.current = false;
        // No commit: `currentScene` is untouched, so anything the caller armed
        // for the scene-change render will never fire. Say so.
        return false;
      }

      // Two-track commit: the page-slide (render lane) reached the target. This
      // IS the scene-switch-complete moment, so onAfterChange (-> onSceneLeave)
      // fires HERE, at commit — NOT deferred to the element track. The element
      // timeline is a separate, interruptible line: it keeps running to T on the
      // incoming scene's own track for the visual enter continuation, but it no
      // longer gates the public callback. We still remember `pendingTransitionFromRef`
      // so the element arm (completeDragTransition) knows a commit happened and can
      // safely run state cleanup once the track reaches T (clearing `dragRelease`
      // early would snap the incoming scene to rest). We do NOT build a snapshot
      // and do NOT touch any element timeline value (each Scene owns its own track).
      onBeforeChange?.(fromScene, targetScene);
      setDirection(direction);
      setDragTimelineProgress(normalizedProgressRatio);
      pendingTransitionFromRef.current = fromScene;
      setCurrentScene(targetScene);
      onCommit?.(targetScene, fromScene, 'drag');
      onAfterChange?.(targetScene, fromScene);
      setDragProgress(0);
      setRenderProgress(0);
      setIsDragging(false);
      setIsAnimating(false);
      animatingRef.current = false;

      debugSceneManager('commitDragSceneChange:done', {
        currentSceneWillBe: targetScene,
        dragTimelineProgress: normalizedProgressRatio.toFixed(3),
        settleAlreadyArrived: settleArrivedRef.current,
      });

      // Render arm of the join. If the element arm already arrived (the incoming
      // scene's T_self was shorter than the page slide), the element track is done,
      // so run cleanup now. Otherwise leave the drag state live for the element arm
      // to clean up when it reaches T.
      if (settleArrivedRef.current) {
        cleanupAfterTransition();
      }

      return true;
    },
    [
      cleanupAfterTransition,
      onAfterChange,
      onBeforeChange,
      onCommit,
      resetDragInteraction,
      totalScenes,
    ]
  );

  // Element arm of the join. Called by the incoming scene (via
  // onActivationComplete) when ITS element track reaches T. The public callback
  // already fired at commit; this arm only drives state CLEANUP. If the render arm
  // has already committed (pendingTransitionFromRef set), the element track is now
  // at T so it is safe to clear `dragRelease`/`direction`/scalars. If it arrives
  // FIRST (T_self < slideDuration), only record the arrival — direction/release
  // must stay live while the page is still sliding, so the render commit runs the
  // cleanup. A stray completion with no outstanding settle and no pending commit
  // (e.g. a cold-start extend re-firing after its window closed) is ignored, so it
  // cannot record a phantom early-settle that would corrupt the next transition.
  const completeDragTransition = useCallback(() => {
    const completedFromScene = pendingTransitionFromRef.current;

    debugSceneManager('completeDragTransition', {
      currentScene: currentSceneRef.current,
      fromScene: completedFromScene,
      renderArmCommitted: completedFromScene !== null,
    });

    if (completedFromScene !== null) {
      cleanupAfterTransition();
      return;
    }

    if (expectedSettleRef.current) {
      settleArrivedRef.current = true;
    }
  }, [cleanupAfterTransition]);

  const commitScrollSceneChange = useCallback(
    (direction: 'forward' | 'backward', progressRatio: number) => {
      const fromScene = currentSceneRef.current;
      const targetScene = direction === 'forward' ? fromScene + 1 : fromScene - 1;
      const normalizedProgressRatio = Math.max(0, Math.min(progressRatio, 1));

      debugSceneManager('commitScrollSceneChange:start', {
        fromScene,
        targetScene,
        direction,
        progressRatio: normalizedProgressRatio.toFixed(3),
      });
      if (isScrollDebugEnabled()) {
        console.debug('[useSceneManager][scroll-debug] commit start', {
          fromScene,
          targetScene,
          direction,
          progressRatio: normalizedProgressRatio.toFixed(3),
        });
      }

      if (targetScene < 0 || targetScene >= totalScenes) {
        resetScrollInteraction();
        setDirection(null);
        setIsAnimating(false);
        animatingRef.current = false;
        return;
      }

      onBeforeChange?.(fromScene, targetScene);
      setDirection(direction);
      setScrollDirection(direction);
      setScrollProgress(normalizedProgressRatio);
      setScrollTransitionSnapshot({
        fromScene,
        toScene: targetScene,
        direction,
        progressRatio: normalizedProgressRatio,
        startedAt: Date.now(),
        lastInputAt: Date.now(),
        isSettling: false,
        settleDirection: null,
      });
      setCurrentScene(targetScene);
      setScrollProgress(0);
      setScrollDirection(null);
      setScrollTransitionSnapshot(null);
      setIsScrolling(false);
      setIsAnimating(false);
      animatingRef.current = false;
      onAfterChange?.(targetScene, fromScene);

      debugSceneManager('commitScrollSceneChange:done', {
        currentSceneWillBe: targetScene,
        progressRatio: normalizedProgressRatio.toFixed(3),
      });
      if (isScrollDebugEnabled()) {
        console.debug('[useSceneManager][scroll-debug] commit done', {
          currentSceneWillBe: targetScene,
          progressRatio: normalizedProgressRatio.toFixed(3),
        });
      }
    },
    [onAfterChange, onBeforeChange, resetScrollInteraction, totalScenes]
  );

  const clearScrollTransitionSnapshot = useCallback(() => {
    debugSceneManager('clearScrollTransitionSnapshot', {
      currentScene: currentSceneRef.current,
      previousScrollProgress: scrollProgress.toFixed(3),
    });
    setScrollProgress(0);
    setScrollDirection(null);
    setScrollTransitionSnapshot(null);
  }, [scrollProgress]);

  const state: SceneManagerState = {
    currentScene,
    isAnimating,
    direction,
    dragProgress,
    dragTimelineProgress,
    scrollProgress,
    scrollDirection,
    renderProgress,
    isDragging,
    isScrolling,
    sharedTimelineDurationMs,
    dragRelease,
    scrollTransitionSnapshot,
  };

  const actions: SceneManagerActions = {
    goToScene,
    nextScene,
    prevScene,
    setAnimating,
    canGoNext,
    canGoPrev,
    setDragProgress,
    setDragTimelineProgress,
    setScrollProgress,
    setScrollDirection,
    setScrollTransitionSnapshot,
    setRenderProgress,
    setIsDragging,
    setIsScrolling,
    setSharedTimelineDurationMs,
    setDragRelease: publishDragRelease,
    resetDragInteraction,
    abortDragContinuation,
    resetScrollInteraction,
    commitDragSceneChange,
    completeDragTransition,
    commitScrollSceneChange,
    clearScrollTransitionSnapshot,
  };

  return [state, actions];
};
