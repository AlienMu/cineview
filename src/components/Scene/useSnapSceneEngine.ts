import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react';
import { useEffect, useRef } from 'react';
import type { AnimationControls } from 'framer-motion';
import type { PresetAnimation } from '../../animations/presets';
import { createSnapGestureHandlers } from '../../utils/gestureHandlers';
import type { SceneState } from './types';

function isVerboseSnapDebug(): boolean {
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') {
    return false;
  }

  return Boolean(
    (window as Window & { __CINEVIEW_SNAP_DEBUG__?: boolean }).__CINEVIEW_SNAP_DEBUG__
  );
}

function debugSnap(message: string): void {
  if (!isVerboseSnapDebug()) {
    return;
  }

  console.log(message);
}

interface UseSnapSceneEngineParams {
  slideMode: 'snap' | 'drag' | 'scroll';
  isActive: boolean;
  slideDirection: 'x' | 'y';
  slideDuration: number;
  isAnimating: boolean;
  sceneIndex: number;
  enterVariant: PresetAnimation | null;
  exitVariant: PresetAnimation | null;
  replayOnReenter: boolean;
  activeEpoch: number;
  direction: 'forward' | 'backward' | null;
  isSceneAnimating: boolean;
  controls: AnimationControls;
  containerRef: RefObject<HTMLDivElement>;
  touchStartRef: MutableRefObject<{ x: number; y: number } | null>;
  prevSnapActiveRef: MutableRefObject<boolean>;
  hasEnteredOnceRef: MutableRefObject<boolean>;
  setSceneEnterCompleted: Dispatch<SetStateAction<boolean>>;
  setSceneState: Dispatch<SetStateAction<SceneState>>;
  setIsAnimating: Dispatch<SetStateAction<boolean>>;
  onSceneChange?: (direction: 'forward' | 'backward') => void;
}

export function useSnapSceneEngine({
  slideMode,
  isActive,
  slideDirection,
  slideDuration,
  isAnimating,
  sceneIndex,
  enterVariant,
  exitVariant,
  replayOnReenter,
  activeEpoch,
  direction,
  isSceneAnimating,
  controls,
  containerRef,
  touchStartRef,
  prevSnapActiveRef,
  hasEnteredOnceRef,
  setSceneEnterCompleted,
  setSceneState,
  setIsAnimating,
  onSceneChange,
}: UseSnapSceneEngineParams): void {
  const lastHandledEpochRef = useRef<number>(0);

  useEffect(() => {
    if (!isActive || !enterVariant || slideMode !== 'snap') return;
    if (activeEpoch === 0) return;
    if (lastHandledEpochRef.current === activeEpoch) return;

    lastHandledEpochRef.current = activeEpoch;

    let cancelled = false;

    const playEnterAnimation = async (): Promise<void> => {
      if (isSceneAnimating && direction === 'backward') {
        controls.stop();
        controls.set(enterVariant.animate as never);
        setSceneEnterCompleted(true);
        hasEnteredOnceRef.current = true;
        setSceneState('active');
        return;
      }

      if (!replayOnReenter && hasEnteredOnceRef.current) {
        controls.stop();
        controls.set(enterVariant.animate as never);
        setSceneEnterCompleted(true);
        setSceneState('active');
        return;
      }

      debugSnap(`🎬 [Scene ${sceneIndex}] snap mode enter animation start`);
      debugSnap(`🎬 [Scene ${sceneIndex}] State transition: initial -> entering`);

      setSceneState('entering');
      setSceneEnterCompleted(false);
      controls.stop();
      controls.set(enterVariant.initial as never);
      await controls.start(enterVariant.animate);
      if (cancelled) return;
      setSceneEnterCompleted(true);
      hasEnteredOnceRef.current = true;

      debugSnap(`🎬 [Scene ${sceneIndex}] snap mode enter animation complete`);
      debugSnap(`🎬 [Scene ${sceneIndex}] State transition: entering -> active`);
      setSceneState('active');
    };

    playEnterAnimation();

    return () => {
      cancelled = true;
      controls.stop();
    };
  }, [
    isActive,
    enterVariant,
    slideMode,
    controls,
    sceneIndex,
    replayOnReenter,
    activeEpoch,
    direction,
    isSceneAnimating,
    hasEnteredOnceRef,
    setSceneEnterCompleted,
    setSceneState,
  ]);

  useEffect(() => {
    const wasActive = prevSnapActiveRef.current;
    prevSnapActiveRef.current = isActive;

    if (slideMode !== 'snap' || !exitVariant || isActive || !wasActive) return;

    let cancelled = false;

    const playExitAnimation = async (): Promise<void> => {
      debugSnap(`🎬 [Scene ${sceneIndex}] State transition: exiting`);

      setSceneState('exiting');
      controls.stop();
      await controls.start(exitVariant.exit);
      if (cancelled) return;

      debugSnap(`🎬 [Scene ${sceneIndex}] State transition: exiting -> initial`);
      setSceneState('initial');
    };

    playExitAnimation();

    return () => {
      cancelled = true;
      controls.stop();
    };
  }, [isActive, exitVariant, slideMode, controls, sceneIndex, prevSnapActiveRef, setSceneState]);

  useEffect(() => {
    if (slideMode !== 'snap' || !isActive) return;

    const container = containerRef.current;
    if (!container) return;

    const handlers = createSnapGestureHandlers(touchStartRef, {
      slideDirection,
      slideDuration,
      isAnimating,
      onSceneChange,
      onAnimatingChange: setIsAnimating,
    });

    container.addEventListener('touchstart', handlers.handleTouchStart, { passive: true });
    container.addEventListener('touchend', handlers.handleTouchEnd, { passive: true });
    container.addEventListener('mousedown', handlers.handleMouseDown);
    container.addEventListener('mouseup', handlers.handleMouseUp);
    container.addEventListener('wheel', handlers.handleWheel, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handlers.handleTouchStart);
      container.removeEventListener('touchend', handlers.handleTouchEnd);
      container.removeEventListener('mousedown', handlers.handleMouseDown);
      container.removeEventListener('mouseup', handlers.handleMouseUp);
      container.removeEventListener('wheel', handlers.handleWheel);
    };
  }, [
    slideMode,
    isActive,
    isAnimating,
    slideDirection,
    slideDuration,
    onSceneChange,
    setIsAnimating,
    containerRef,
    touchStartRef,
  ]);
}
