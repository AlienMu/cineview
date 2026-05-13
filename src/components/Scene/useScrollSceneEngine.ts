import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react';
import { useEffect } from 'react';
import type { AnimationControls } from 'framer-motion';
import type { ScrollTimelineState } from '../../types';
import type { PresetAnimation } from '../../animations/presets';
import type { ScrollTransitionSnapshot } from '../../hooks/useSceneManager';
import type { SceneState } from './types';

interface UseScrollSceneEngineParams {
  slideMode: 'snap' | 'drag' | 'scroll';
  isActive: boolean;
  sceneIndex: number;
  totalScenes: number;
  sceneOffset: number;
  slideDirection: 'x' | 'y';
  sceneStackMode: 'replace' | 'cover';
  controls: AnimationControls;
  enterVariant: PresetAnimation | null;
  exitVariant: PresetAnimation | null;
  globalIsScrolling: boolean;
  globalScrollProgress: number;
  globalScrollDirection: 'forward' | 'backward' | null;
  globalScrollTransitionSnapshot: ScrollTransitionSnapshot | null;
  globalScrollBackdropActive: boolean;
  globalScrollTimelineState: ScrollTimelineState | null;
  containerRef: RefObject<HTMLDivElement>;
  scrollSettleTimerRef: MutableRefObject<number | null>;
  setSceneState: Dispatch<SetStateAction<SceneState>>;
}

export function useScrollSceneEngine({
  slideMode,
  isActive,
  sceneIndex,
  totalScenes,
  sceneOffset,
  slideDirection,
  sceneStackMode,
  controls,
  enterVariant,
  exitVariant,
  globalIsScrolling,
  globalScrollProgress,
  globalScrollDirection,
  globalScrollTransitionSnapshot,
  globalScrollBackdropActive,
  globalScrollTimelineState,
  containerRef,
  scrollSettleTimerRef,
  setSceneState,
}: UseScrollSceneEngineParams): void {
  useEffect(() => {
    if (slideMode !== 'scroll') return;

    const stableSceneState = { opacity: 1, x: 0, y: 0, scale: 1 };
    const timelineState = globalScrollTimelineState;
    const transitionDirection = globalScrollTransitionSnapshot?.direction ?? globalScrollDirection;
    const incomingScene =
      (transitionDirection === 'forward' && sceneOffset === 1) ||
      (transitionDirection === 'backward' && sceneOffset === -1);
    const outgoingScene = isActive && globalIsScrolling && globalScrollProgress > 0.001;
    const backdropCoveredScene =
      !isActive &&
      sceneStackMode === 'cover' &&
      globalScrollBackdropActive &&
      (sceneOffset === 0 || sceneOffset === -1);

    void enterVariant;
    void exitVariant;
    void sceneIndex;
    void totalScenes;
    void slideDirection;
    void containerRef;
    void scrollSettleTimerRef;

    if (!timelineState) {
      if (incomingScene) {
        setSceneState('entering');
      } else if (outgoingScene || backdropCoveredScene) {
        setSceneState(exitVariant?.exit ? 'exiting' : 'active');
      } else {
        setSceneState(isActive ? 'active' : 'initial');
      }
      controls.set(stableSceneState as never);
      return;
    }

    if (timelineState.phase === 'before') {
      setSceneState('initial');
      controls.set(stableSceneState as never);
      return;
    }

    if (timelineState.phase === 'enter') {
      setSceneState('entering');
      controls.set(stableSceneState as never);
      return;
    }

    if (timelineState.phase === 'hold') {
      setSceneState('active');
      controls.set(stableSceneState as never);
      return;
    }

    if (timelineState.phase === 'exit') {
      setSceneState(exitVariant?.exit ? 'exiting' : 'active');
      controls.set(stableSceneState as never);
      return;
    }

    if (backdropCoveredScene) {
      setSceneState(exitVariant?.exit ? 'exiting' : 'active');
    } else {
      setSceneState(exitVariant?.exit ? 'exiting' : isActive ? 'active' : 'initial');
    }
    controls.set(stableSceneState as never);
  }, [
    slideMode,
    isActive,
    sceneOffset,
    sceneStackMode,
    enterVariant,
    exitVariant,
    globalIsScrolling,
    globalScrollProgress,
    globalScrollDirection,
    globalScrollTransitionSnapshot,
    globalScrollBackdropActive,
    globalScrollTimelineState,
    controls,
    setSceneState,
    sceneIndex,
    totalScenes,
    slideDirection,
    containerRef,
    scrollSettleTimerRef,
  ]);
}
