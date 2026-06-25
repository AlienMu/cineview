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
  mode: 'settle' | 'bounce';
  direction: 'forward' | 'backward';
  targetSceneIndex: number;
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
  const { totalScenes, initialScene = 0, onBeforeChange, onAfterChange } = options;

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
  // A drag transition completes when BOTH arms arrive, in EITHER order:
  //  - render arm: the page-slide reaches the target -> commitDragSceneChange
  //    advances the index and records `pendingTransitionFromRef` (the from index).
  //  - element arm: the incoming scene's element track reaches T ->
  //    completeDragTransition.
  // The page-slide runs on a fixed slideDuration while the element track runs on
  // the incoming scene's own T_self, so when T_self < slideDuration the element
  // arm arrives FIRST (before the index has even advanced). The deferred
  // onAfterChange must still fire exactly once, so the two arms form an
  // order-independent join: whichever arrives second closes it. `from`/`to` are
  // only knowable after the render arm has committed, so onAfterChange always
  // fires at the join close (never lost, never early).
  const pendingTransitionFromRef = useRef<number | null>(null);
  // Set by the element arm when it arrives before the render commit. The render
  // arm closes the join when it sees this.
  const settleArrivedRef = useRef<boolean>(false);
  // True only while a settle release is outstanding. Gates the element arm so a
  // stray completion (e.g. a cold-start extend re-firing onActivationComplete
  // after its window closed) cannot record a phantom early-settle and pollute the
  // next transition's join.
  const expectedSettleRef = useRef<boolean>(false);

  currentSceneRef.current = currentScene;

  // Closes the drag-transition join: clears the lingering drag scalars, the
  // direction, and the release directive, then fires the deferred onAfterChange.
  // Direction/release are cleared HERE (at the join, when both arms are done) and
  // never by a single arm — clearing them while the page is still sliding would
  // strand the outgoing scene mid-transition.
  const finalizeTransition = useCallback(
    (toScene: number, fromScene: number | null) => {
      pendingTransitionFromRef.current = null;
      settleArrivedRef.current = false;
      expectedSettleRef.current = false;
      setDragProgress(0);
      setDragTimelineProgress(0);
      setSharedTimelineDurationMs(0);
      setDragRelease(null);
      setDirection(null);
      if (fromScene !== null && fromScene !== toScene) {
        onAfterChange?.(toScene, fromScene);
      }
    },
    [onAfterChange]
  );

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
      } else {
        // 立即触发 onAfterChange
        onAfterChange?.(index);
      }
    },
    [currentScene, totalScenes, onBeforeChange, onAfterChange]
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

      // Two-track commit: the page-slide (render lane) reached the target, so the
      // ONLY job here is to advance the scene index. We do NOT build a snapshot,
      // do NOT touch any element timeline value (each Scene owns its own track),
      // and do NOT fire onAfterChange — that is DEFERRED to completeDragTransition,
      // fired by the incoming scene once ITS element track reaches T. We remember
      // the fromScene so the deferred callback can report the correct previous
      // index even after `direction` is cleared.
      onBeforeChange?.(fromScene, targetScene);
      setDirection(direction);
      setDragTimelineProgress(normalizedProgressRatio);
      pendingTransitionFromRef.current = fromScene;
      setCurrentScene(targetScene);
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
      // scene's T_self was shorter than the page slide), close the join now.
      // Otherwise leave the join open for the element arm to close.
      if (settleArrivedRef.current) {
        finalizeTransition(targetScene, fromScene);
      }
    },
    [finalizeTransition, onBeforeChange, resetDragInteraction, totalScenes]
  );

  // Element arm of the join. Called by the incoming scene (via
  // onActivationComplete) when ITS element track reaches T. If the render arm has
  // already committed (pendingTransitionFromRef set), close the join and fire the
  // deferred onAfterChange. If it arrives FIRST (T_self < slideDuration), only
  // record the arrival — the from/to indices aren't known until the render arm
  // commits, and direction/release must stay live while the page is still sliding.
  // A stray completion with no outstanding settle and no pending commit (e.g. a
  // cold-start extend re-firing after its window closed) is ignored, so it cannot
  // record a phantom early-settle that would corrupt the next transition's join.
  const completeDragTransition = useCallback(() => {
    const completedFromScene = pendingTransitionFromRef.current;

    debugSceneManager('completeDragTransition', {
      currentScene: currentSceneRef.current,
      fromScene: completedFromScene,
      renderArmCommitted: completedFromScene !== null,
    });

    if (completedFromScene !== null) {
      finalizeTransition(currentSceneRef.current, completedFromScene);
      return;
    }

    if (expectedSettleRef.current) {
      settleArrivedRef.current = true;
    }
  }, [finalizeTransition]);

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
