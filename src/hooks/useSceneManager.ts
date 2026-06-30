/**
 * useSceneManager Hook
 * 管理场景索引和切换逻辑
 */

import { useState, useCallback, useRef } from 'react';
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
  onAfterChange?: (sceneIndex: number, previousIndex?: number) => void;
}

export interface SceneManagerState {
  currentScene: number;
  isAnimating: boolean;
  direction: 'forward' | 'backward' | null;
  dragProgress: number; // 新增：拖拽进度
  dragTimelineProgress: number;
  scrollProgress: number;
  scrollDirection: 'forward' | 'backward' | null;
  renderProgress: number;
  isDragging: boolean; // 新增：是否正在拖拽
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
  setDragProgress: (progress: number) => void; // 新增：设置拖拽进度
  setDragTimelineProgress: (progress: number) => void;
  setScrollProgress: (progress: number) => void;
  setScrollDirection: (direction: 'forward' | 'backward' | null) => void;
  setScrollTransitionSnapshot: (snapshot: ScrollTransitionSnapshot | null) => void;
  setRenderProgress: (progress: number) => void;
  setIsDragging: (dragging: boolean) => void; // 新增：设置拖拽状态
  setIsScrolling: (scrolling: boolean) => void;
  setSharedTimelineDurationMs: (duration: number) => void;
  setDragRelease: (release: DragReleaseInput | null) => void;
  resetDragInteraction: () => void;
  resetScrollInteraction: () => void;
  commitDragSceneChange: (
    direction: 'forward' | 'backward',
    progressRatio: number,
    elapsedMs?: number,
    timelineDuration?: number
  ) => void;
  completeDragTransition: () => void;
  commitScrollSceneChange: (direction: 'forward' | 'backward', progressRatio: number) => void;
  clearScrollTransitionSnapshot: () => void;
}

export const useSceneManager = (
  options: UseSceneManagerOptions
): [SceneManagerState, SceneManagerActions] => {
  const { totalScenes, initialScene = 0, mode = 'drag', onBeforeChange, onAfterChange } = options;

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
  // The public onSceneDidChange now fires at COMMIT (render arm), not at the join
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

  currentSceneRef.current = currentScene;

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

  // 检查是否可以前进
  const canGoNext = useCallback((): boolean => {
    return currentScene < totalScenes - 1;
  }, [currentScene, totalScenes]);

  // 检查是否可以后退
  const canGoPrev = useCallback((): boolean => {
    return currentScene > 0;
  }, [currentScene]);

  // 跳转到指定场景
  const goToScene = useCallback(
    (index: number, animated: boolean = true) => {
      debugSceneManager('goToScene requested', {
        fromScene: currentScene,
        toScene: index,
        animated,
      });

      // 验证索引有效性
      if (index < 0 || index >= totalScenes) {
        warnSceneManager(`Invalid scene index: ${index}. Must be between 0 and ${totalScenes - 1}`);
        return;
      }

      // 如果已经在目标场景，不执行切换
      if (index === currentScene) {
        debugSceneManager('goToScene skipped because scene is already active', {
          scene: index,
        });
        return;
      }

      // 触发 onBeforeChange 回调
      onBeforeChange?.(currentScene, index);

      // 设置方向
      const newDirection = index > currentScene ? 'forward' : 'backward';
      setDirection(newDirection);

      // 更新场景索引
      debugSceneManager('Applying scene change', {
        toScene: index,
        direction: newDirection,
      });
      setCurrentScene(index);

      // 如果需要动画
      if (animated) {
        setIsAnimating(true);
        animatingRef.current = true;
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
          setDragRelease({
            token: dragReleaseTokenRef.current,
            mode: 'enter',
            direction: newDirection,
            targetSceneIndex: index,
          });
        }
      } else {
        // 立即触发 onAfterChange
        onAfterChange?.(index);
      }
    },
    [currentScene, totalScenes, mode, onBeforeChange, onAfterChange]
  );

  // 下一个场景
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

  // 上一个场景
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

  // 设置动画状态
  const setAnimating = useCallback(
    (animating: boolean) => {
      setIsAnimating(animating);
      animatingRef.current = animating;

      // 动画结束时触发 onAfterChange
      if (!animating) {
        onAfterChange?.(currentScene);
        setDirection(null);
        // Clear any programmatic 'enter' directive (goToScene). The destination
        // scene's element track has reached T by now; leaving the directive set
        // would keep useAnimateDrag in 'enter' mode reading a settled track.
        setDragRelease(null);
      }
    },
    [currentScene, onAfterChange]
  );

  const resetDragInteraction = useCallback(() => {
    debugSceneManager('resetDragInteraction', {
      currentScene: currentSceneRef.current,
    });
    // Abort path (bounce / reset): no transition is pending, so tear down the
    // join state too or a stale early-settle flag would leak into the next one.
    pendingTransitionFromRef.current = null;
    settleArrivedRef.current = false;
    expectedSettleRef.current = false;
    setDragProgress(0);
    setDragTimelineProgress(0);
    setRenderProgress(0);
    setIsDragging(false);
    setSharedTimelineDurationMs(0);
    setDragRelease(null);
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
        return;
      }

      // Two-track commit: the page-slide (render lane) reached the target. This
      // IS the scene-switch-complete moment, so onAfterChange (-> onSceneDidChange)
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
    },
    [cleanupAfterTransition, onAfterChange, onBeforeChange, resetDragInteraction, totalScenes]
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
    resetScrollInteraction,
    commitDragSceneChange,
    completeDragTransition,
    commitScrollSceneChange,
    clearScrollTransitionSnapshot,
  };

  return [state, actions];
};
