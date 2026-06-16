import { useMemo } from 'react';
import type { SceneRuntimeState } from '../Animate/Animate';
import type { ScrollMode, ScrollTimelineState } from '../../types';
import type { SceneState } from './types';

interface UseSceneRuntimeStateParams {
  slideMode: ScrollMode;
  sceneState: SceneState;
  isActive: boolean;
  sceneOffset: number;
  globalScrollProgress: number;
  globalScrollDirection: 'forward' | 'backward' | null;
  globalIsScrolling: boolean;
  globalScrollBackdropActive: boolean;
  hasExitAnimation: boolean;
  scrollTimelineState?: ScrollTimelineState | null;
}

export function useSceneRuntimeState({
  slideMode,
  sceneState,
  isActive,
  sceneOffset,
  globalScrollProgress,
  globalScrollDirection,
  globalIsScrolling,
  globalScrollBackdropActive,
  hasExitAnimation,
  scrollTimelineState,
}: UseSceneRuntimeStateParams): SceneRuntimeState {
  return useMemo<SceneRuntimeState>(() => {
    if (slideMode === 'drag') {
      if (sceneState === 'exiting') return 'exiting';
      if (sceneState === 'entering') return 'entering';
      if (isActive) return 'active';
      return sceneOffset === 0 ? 'inactive' : 'parked';
    }

    if (slideMode === 'scroll') {
      if (scrollTimelineState) {
        if (scrollTimelineState.phase === 'enter') return 'entering';
        if (scrollTimelineState.phase === 'exit') return hasExitAnimation ? 'exiting' : 'covered';
        if (scrollTimelineState.phase === 'hold') return isActive ? 'active' : 'covered';
        if (scrollTimelineState.phase === 'after') return hasExitAnimation ? 'parked' : 'covered';
        if (isActive) return 'active';
        if (globalScrollBackdropActive) return 'covered';
        return sceneOffset === 0 ? 'inactive' : 'parked';
      }

      const transitionProgress = globalScrollProgress;
      const incomingScene =
        (globalScrollDirection === 'forward' && sceneOffset === 1) ||
        (globalScrollDirection === 'backward' && sceneOffset === -1);

      if (isActive && globalIsScrolling && transitionProgress > 0.001) {
        return hasExitAnimation ? 'exiting' : 'covered';
      }
      if (globalScrollBackdropActive) {
        return 'covered';
      }
      if (incomingScene && transitionProgress > 0.001) {
        return 'entering';
      }
      if (isActive) return 'active';
      return sceneOffset === 0 ? 'inactive' : 'parked';
    }

    return isActive ? 'active' : 'inactive';
  }, [
    slideMode,
    sceneState,
    isActive,
    sceneOffset,
    globalScrollProgress,
    globalScrollDirection,
    globalIsScrolling,
    globalScrollBackdropActive,
    hasExitAnimation,
    scrollTimelineState,
  ]);
}
