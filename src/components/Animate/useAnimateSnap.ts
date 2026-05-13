/**
 * useAnimateSnap - Snap 模式动画逻辑
 * Scene 动画完成后，根据 delay 和 waitFor 顺序播放动画
 */

import { useEffect, useRef } from 'react';
import { useAnimation, AnimationControls } from 'framer-motion';
import type { ParsedAnimationVariant } from '../../types';
import type { SceneContextType } from './Animate';

function isVerboseSnapDebug(): boolean {
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') {
    return false;
  }

  return Boolean(
    (window as Window & { __CINEVIEW_SNAP_DEBUG__?: boolean }).__CINEVIEW_SNAP_DEBUG__
  );
}

function debugSnap(message: string, details?: Record<string, unknown>): void {
  if (!isVerboseSnapDebug()) {
    return;
  }

  if (details) {
    console.log(message, details);
    return;
  }

  console.log(message);
}

interface UseAnimateSnapParams {
  sceneContext: SceneContextType | null;
  enterVariant: ParsedAnimationVariant | null;
  exitVariant: ParsedAnimationVariant | null;
  componentId: string;
  delay: number;
  enterDuration: number;
  waitFor?: string;
}

interface UseAnimateSnapReturn {
  controls: AnimationControls;
  shouldRunInfinite: boolean;
}

export function useAnimateSnap({
  sceneContext,
  enterVariant,
  exitVariant,
  componentId,
  delay,
  enterDuration,
  waitFor,
}: UseAnimateSnapParams): UseAnimateSnapReturn {
  const controls = useAnimation();
  const calculatedDelayRef = useRef<number>(0);
  const lastActivationVersionRef = useRef<number | undefined>(undefined);
  const prevIsActiveForEnterRef = useRef(false);
  const prevIsActiveForExitRef = useRef(false);
  const isSceneAnimatingRef = useRef(false);
  const transitionDirectionRef = useRef<'forward' | 'backward' | null>(null);

  useEffect(() => {
    isSceneAnimatingRef.current = !!sceneContext?.isSceneAnimating;
    transitionDirectionRef.current = sceneContext?.transitionDirection ?? null;
  }, [sceneContext?.isSceneAnimating, sceneContext?.transitionDirection]);

  // 注册到 Scene
  useEffect(() => {
    if (
      !sceneContext?.registerAnimate ||
      !sceneContext?.unregisterAnimate ||
      !sceneContext?.getCalculatedDelay ||
      !enterVariant
    )
      return;

    sceneContext.registerAnimate(componentId, { delay, duration: enterDuration, waitFor });
    calculatedDelayRef.current = sceneContext.getCalculatedDelay(componentId);

    debugSnap(`🔵 [AnimateSnap ${componentId}] Registered:`, {
      delay,
      enterDuration,
      calculatedDelay: calculatedDelayRef.current,
      waitFor,
    });

    return () => {
      debugSnap(`🔴 [AnimateSnap ${componentId}] Unregistered`);
      sceneContext.unregisterAnimate(componentId);
    };
  }, [
    sceneContext,
    sceneContext?.registerAnimate,
    sceneContext?.unregisterAnimate,
    sceneContext?.getCalculatedDelay,
    componentId,
    delay,
    enterDuration,
    waitFor,
    enterVariant,
  ]);

  // snap 模式：场景激活后立即开始元素入场，不等待 Scene 根动画完成
  useEffect(() => {
    if (!sceneContext || !enterVariant) return;

    const wasActive = prevIsActiveForEnterRef.current;
    prevIsActiveForEnterRef.current = sceneContext.isActive;

    if (sceneContext.sceneOffset !== 0 || !sceneContext.isActive) return;

    const activationVersion = sceneContext.activationVersion;
    const becameActive = !wasActive && sceneContext.isActive;
    const versionChanged =
      activationVersion !== undefined && lastActivationVersionRef.current !== activationVersion;

    if (!becameActive && !versionChanged) {
      return;
    }
    lastActivationVersionRef.current = activationVersion;

    if (isSceneAnimatingRef.current && transitionDirectionRef.current === 'backward') {
      controls.stop();
      controls.set(enterVariant.animate as never);
      return;
    }

    const calculatedDelay = calculatedDelayRef.current;

    debugSnap(
      `🎬 [AnimateSnap ${componentId}] Scene completed, starting after ${calculatedDelay}ms`
    );

    // 设置初始状态
    controls.stop();
    controls.set(enterVariant.initial as never);

    // 等待 calculatedDelay 后播放动画
    const timer = setTimeout(() => {
      debugSnap(`🎬 [AnimateSnap ${componentId}] Playing enter animation`);

      controls.start({
        ...enterVariant.animate,
        transition: {
          duration: enterDuration / 1000,
          ease: 'easeOut',
        },
      } as never);
    }, calculatedDelay);

    return () => clearTimeout(timer);
  }, [
    sceneContext,
    sceneContext?.sceneOffset,
    sceneContext?.isActive,
    sceneContext?.activationVersion,
    enterVariant,
    controls,
    enterDuration,
    componentId,
  ]);

  useEffect(() => {
    if (!sceneContext || !enterVariant) return;
    if (sceneContext.isActive || sceneContext.runtimeState === 'exiting') return;

    controls.stop();
    controls.set(enterVariant.initial as never);
  }, [
    sceneContext,
    sceneContext?.isActive,
    sceneContext?.runtimeState,
    sceneContext?.sceneOffset,
    enterVariant,
    controls,
  ]);

  // 场景离开时，播放离开动画
  useEffect(() => {
    if (!sceneContext || !exitVariant) return;

    const wasActive = prevIsActiveForExitRef.current;
    prevIsActiveForExitRef.current = sceneContext.isActive;

    const shouldPlayExit = wasActive && !sceneContext.isActive;

    if (!shouldPlayExit) return;

    debugSnap(`🚪 [AnimateSnap ${componentId}] Playing exit animation`);

    controls.stop();
    controls.start(exitVariant.exit as never);
  }, [
    sceneContext,
    sceneContext?.isActive,
    sceneContext?.runtimeState,
    exitVariant,
    controls,
    componentId,
  ]);

  const shouldRunInfinite =
    !!sceneContext &&
    sceneContext.isActive &&
    sceneContext.sceneOffset === 0 &&
    !['inactive', 'covered', 'parked', 'exiting'].includes(sceneContext.runtimeState || 'inactive');

  return { controls, shouldRunInfinite };
}
