import type { Dispatch, SetStateAction } from 'react';
import { useEffect } from 'react';
import type { AnimationControls } from 'framer-motion';
import type { ScrollMode, ScrollTimelineState } from '../../types';
import type { PresetAnimation } from '../../animations/presets';
import { interpolateVariant } from '../../utils/animationHelpers';
import type { ScrollTransitionSnapshot } from '../../hooks/useSceneManager';
import type { SceneState } from './types';

interface UseScrollSceneEngineParams {
  slideMode: ScrollMode;
  isActive: boolean;
  sceneOffset: number;
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
  setSceneState: Dispatch<SetStateAction<SceneState>>;
}

const DEFAULT_SCENE_VISUAL_STATE: Record<string, unknown> = {
  opacity: 1,
  x: 0,
  y: 0,
  scale: 1,
  rotate: 0,
};

function isVariantRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveVariantState(
  variant: unknown,
  fallback: Record<string, unknown>
): Record<string, unknown> {
  return isVariantRecord(variant) ? { ...fallback, ...variant } : fallback;
}

function clampProgress(value: number): number {
  return Math.max(0, Math.min(value, 1));
}

export function useScrollSceneEngine({
  slideMode,
  isActive,
  sceneOffset,
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
  setSceneState,
}: UseScrollSceneEngineParams): void {
  useEffect(() => {
    if (slideMode !== 'scroll') return;

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
    const activeSceneState = resolveVariantState(enterVariant?.animate, DEFAULT_SCENE_VISUAL_STATE);
    const initialSceneState = resolveVariantState(enterVariant?.initial, activeSceneState);
    const exitedSceneState = resolveVariantState(exitVariant?.exit, activeSceneState);
    const transitionProgress = clampProgress(globalScrollProgress);

    if (!timelineState) {
      if (incomingScene) {
        setSceneState('entering');
        controls.set(
          interpolateVariant(initialSceneState, activeSceneState, transitionProgress) as never
        );
      } else if (outgoingScene || backdropCoveredScene) {
        setSceneState(exitVariant?.exit ? 'exiting' : 'active');
        controls.set(
          (exitVariant?.exit
            ? interpolateVariant(activeSceneState, exitedSceneState, transitionProgress)
            : activeSceneState) as never
        );
      } else {
        setSceneState(isActive ? 'active' : 'initial');
        controls.set((isActive ? activeSceneState : initialSceneState) as never);
      }
      return;
    }

    if (timelineState.phase === 'before') {
      setSceneState('initial');
      controls.set(initialSceneState as never);
      return;
    }

    if (timelineState.phase === 'enter') {
      setSceneState('entering');
      controls.set(
        interpolateVariant(
          initialSceneState,
          activeSceneState,
          clampProgress(timelineState.enterProgress)
        ) as never
      );
      return;
    }

    if (timelineState.phase === 'hold') {
      setSceneState('active');
      controls.set(activeSceneState as never);
      return;
    }

    if (timelineState.phase === 'exit') {
      setSceneState(exitVariant?.exit ? 'exiting' : 'active');
      controls.set(
        (exitVariant?.exit
          ? interpolateVariant(
              activeSceneState,
              exitedSceneState,
              clampProgress(timelineState.exitProgress)
            )
          : activeSceneState) as never
      );
      return;
    }

    if (backdropCoveredScene) {
      setSceneState(exitVariant?.exit ? 'exiting' : 'active');
    } else {
      setSceneState(exitVariant?.exit ? 'exiting' : isActive ? 'active' : 'initial');
    }
    controls.set((exitVariant?.exit ? exitedSceneState : activeSceneState) as never);
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
  ]);
}
