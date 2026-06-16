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

export interface DragTransitionSnapshot {
  fromScene: number;
  toScene: number;
  direction: 'forward' | 'backward';
  progressRatio: number;
  sharedElapsedMs: number;
  sharedTimelineDurationMs: number;
}

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
  sharedElapsedMs: number;
  sharedTimelineDurationMs: number;
  dragTransitionSnapshot: DragTransitionSnapshot | null;
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
  setSharedElapsedMs: (elapsedMs: number) => void;
  setIsDragging: (dragging: boolean) => void; // 新增：设置拖拽状态
  setIsScrolling: (scrolling: boolean) => void;
  setSharedTimelineDurationMs: (duration: number) => void;
  resetDragInteraction: () => void;
  resetScrollInteraction: () => void;
  commitDragSceneChange: (
    direction: 'forward' | 'backward',
    progressRatio: number,
    elapsedMs: number,
    timelineDuration?: number
  ) => void;
  clearDragTransitionSnapshot: () => void;
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
  const [sharedElapsedMs, setSharedElapsedMs] = useState<number>(0);
  const [sharedTimelineDurationMs, setSharedTimelineDurationMs] = useState<number>(0);
  const [dragTransitionSnapshot, setDragTransitionSnapshot] =
    useState<DragTransitionSnapshot | null>(null);
  const [scrollTransitionSnapshot, setScrollTransitionSnapshot] =
    useState<ScrollTransitionSnapshot | null>(null);

  const animatingRef = useRef<boolean>(false);
  const currentSceneRef = useRef<number>(currentScene);

  currentSceneRef.current = currentScene;

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
    setDragProgress(0);
    setDragTimelineProgress(0);
    setRenderProgress(0);
    setIsDragging(false);
    setSharedElapsedMs(0);
    setSharedTimelineDurationMs(0);
    setDragTransitionSnapshot(null);
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
      elapsedMs: number,
      timelineDuration: number = 0
    ) => {
      const fromScene = currentSceneRef.current;
      const targetScene = direction === 'forward' ? fromScene + 1 : fromScene - 1;
      const normalizedProgressRatio = Math.max(0, Math.min(progressRatio, 1));
      const normalizedElapsedMs = Math.max(0, elapsedMs);
      const normalizedTimelineDuration = Math.max(0, timelineDuration);

      debugSceneManager('commitDragSceneChange:start', {
        fromScene,
        targetScene,
        direction,
        progressRatio: normalizedProgressRatio.toFixed(3),
        sharedElapsedMs: normalizedElapsedMs.toFixed(1),
        sharedTimelineDurationMs: normalizedTimelineDuration,
      });

      if (targetScene < 0 || targetScene >= totalScenes) {
        resetDragInteraction();
        setDirection(null);
        setIsAnimating(false);
        animatingRef.current = false;
        return;
      }

      onBeforeChange?.(fromScene, targetScene);
      setDirection(direction);
      setDragTimelineProgress(normalizedProgressRatio);
      setSharedElapsedMs(normalizedElapsedMs);
      setSharedTimelineDurationMs(normalizedTimelineDuration);
      const needsSettleCompletion =
        normalizedTimelineDuration > 0 &&
        normalizedElapsedMs < normalizedTimelineDuration - 0.001 &&
        normalizedProgressRatio < 1 - 0.001;

      setDragTransitionSnapshot(
        needsSettleCompletion
          ? {
              fromScene,
              toScene: targetScene,
              direction,
              progressRatio: normalizedProgressRatio,
              sharedElapsedMs: normalizedElapsedMs,
              sharedTimelineDurationMs: normalizedTimelineDuration,
            }
          : null
      );
      setCurrentScene(targetScene);
      setDragProgress(0);
      setRenderProgress(0);
      setIsDragging(false);
      setIsAnimating(false);
      animatingRef.current = false;
      if (!needsSettleCompletion) {
        onAfterChange?.(targetScene, fromScene);
      }

      debugSceneManager('commitDragSceneChange:done', {
        currentSceneWillBe: targetScene,
        dragProgressResetTo: 0,
        isDraggingResetTo: false,
        dragTimelineProgress: normalizedProgressRatio.toFixed(3),
        sharedElapsedMs: normalizedElapsedMs.toFixed(1),
        sharedTimelineDurationMs: normalizedTimelineDuration,
        needsSettleCompletion,
      });
    },
    [onAfterChange, onBeforeChange, resetDragInteraction, totalScenes]
  );

  const clearDragTransitionSnapshot = useCallback(() => {
    const completedScene = currentSceneRef.current;
    const completedFromScene = dragTransitionSnapshot?.fromScene;
    const hadSnapshot = dragTransitionSnapshot !== null;

    debugSceneManager('clearDragTransitionSnapshot', {
      currentScene: completedScene,
      previousSharedElapsedMs: sharedElapsedMs.toFixed(1),
      hadSnapshot,
    });
    setDragProgress(0);
    setDragTimelineProgress(0);
    setSharedElapsedMs(0);
    setSharedTimelineDurationMs(0);
    setDragTransitionSnapshot(null);
    if (hadSnapshot) {
      onAfterChange?.(completedScene, completedFromScene);
    }
  }, [dragTransitionSnapshot, onAfterChange, sharedElapsedMs]);

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
    sharedElapsedMs,
    sharedTimelineDurationMs,
    dragTransitionSnapshot,
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
    setSharedElapsedMs,
    setIsDragging,
    setIsScrolling,
    setSharedTimelineDurationMs,
    resetDragInteraction,
    resetScrollInteraction,
    commitDragSceneChange,
    clearDragTransitionSnapshot,
    commitScrollSceneChange,
    clearScrollTransitionSnapshot,
  };

  return [state, actions];
};
