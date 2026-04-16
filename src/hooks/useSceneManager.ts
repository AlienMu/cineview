/**
 * useSceneManager Hook
 * 管理场景索引和切换逻辑
 */

import { useState, useCallback, useRef } from 'react';
import type { ScrollMode } from '../types';

export interface UseSceneManagerOptions {
  totalScenes: number;
  initialScene?: number;
  mode?: ScrollMode;
  onBeforeChange?: (from: number, to: number) => void;
  onAfterChange?: (sceneIndex: number) => void;
}

export interface SceneManagerState {
  currentScene: number;
  isAnimating: boolean;
  direction: 'forward' | 'backward' | null;
}

export interface SceneManagerActions {
  goToScene: (index: number, animated?: boolean) => void;
  nextScene: () => void;
  prevScene: () => void;
  setAnimating: (animating: boolean) => void;
  canGoNext: () => boolean;
  canGoPrev: () => boolean;
}

export const useSceneManager = (
  options: UseSceneManagerOptions
): [SceneManagerState, SceneManagerActions] => {
  const { totalScenes, initialScene = 0, mode = 'snap', onBeforeChange, onAfterChange } = options;

  const [currentScene, setCurrentScene] = useState<number>(
    Math.max(0, Math.min(initialScene, totalScenes - 1))
  );
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [direction, setDirection] = useState<'forward' | 'backward' | null>(null);

  const animatingRef = useRef<boolean>(false);

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
      // 验证索引有效性
      if (index < 0 || index >= totalScenes) {
        console.warn(`Invalid scene index: ${index}. Must be between 0 and ${totalScenes - 1}`);
        return;
      }

      // 如果正在动画中且是 snap 模式，阻止新的切换
      if (mode === 'snap' && animatingRef.current) {
        return;
      }

      // 如果已经在目标场景，不执行切换
      if (index === currentScene) {
        return;
      }

      // 触发 onBeforeChange 回调
      onBeforeChange?.(currentScene, index);

      // 设置方向
      const newDirection = index > currentScene ? 'forward' : 'backward';
      setDirection(newDirection);

      // 更新场景索引
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
    [currentScene, totalScenes, mode, onBeforeChange, onAfterChange]
  );

  // 下一个场景
  const nextScene = useCallback(() => {
    if (canGoNext()) {
      goToScene(currentScene + 1);
    }
  }, [currentScene, canGoNext, goToScene]);

  // 上一个场景
  const prevScene = useCallback(() => {
    if (canGoPrev()) {
      goToScene(currentScene - 1);
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

  const state: SceneManagerState = {
    currentScene,
    isAnimating,
    direction,
  };

  const actions: SceneManagerActions = {
    goToScene,
    nextScene,
    prevScene,
    setAnimating,
    canGoNext,
    canGoPrev,
  };

  return [state, actions];
};
