import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { useAnimation } from 'framer-motion';
import type { ScrollMode, ScrollTimelineState } from '../../types';
import type { PresetAnimation } from '../../animations/presets';
import { interpolateVariant } from '../../utils/animationHelpers';
import type { ScrollTransitionSnapshot } from '../../hooks/useSceneManager';
import type { SceneState } from './types';
import type { ScrollSceneFrame, ScrollSceneFrameStore } from '../runtime/scrollSceneFrameStore';

type LegacyAnimationControls = ReturnType<typeof useAnimation>;

interface UseScrollSceneEngineParams {
  slideMode: ScrollMode;
  isActive: boolean;
  sceneOffset: number;
  sceneStackMode: 'replace' | 'cover';
  controls: LegacyAnimationControls;
  enterVariant: PresetAnimation | null;
  exitVariant: PresetAnimation | null;
  globalIsScrolling: boolean;
  globalScrollProgress: number;
  globalScrollDirection: 'forward' | 'backward' | null;
  globalScrollTransitionSnapshot: ScrollTransitionSnapshot | null;
  globalScrollBackdropActive: boolean;
  globalScrollTimelineState: ScrollTimelineState | null;
  scrollFrameStore?: ScrollSceneFrameStore;
  scrollFrameSceneIndex?: number;
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
  scrollFrameStore,
  scrollFrameSceneIndex,
  setSceneState,
}: UseScrollSceneEngineParams): void {
  type EngineInputs = {
    slideMode: ScrollMode;
    isActive: boolean;
    sceneOffset: number;
    sceneStackMode: 'replace' | 'cover';
    controls: LegacyAnimationControls;
    enterVariant: PresetAnimation | null;
    exitVariant: PresetAnimation | null;
    globalIsScrolling: boolean;
    globalScrollProgress: number;
    globalScrollDirection: 'forward' | 'backward' | null;
    globalScrollTransitionSnapshot: ScrollTransitionSnapshot | null;
    globalScrollBackdropActive: boolean;
    globalScrollTimelineState: ScrollTimelineState | null;
    setSceneState: Dispatch<SetStateAction<SceneState>>;
  };

  const inputsRef = useRef<EngineInputs | null>(null);
  inputsRef.current = {
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
  };
  const lastSceneStateRef = useRef<SceneState | null>(null);
  const lastVisualRef = useRef<{
    kind: string;
    progress: number;
    enterVariant: PresetAnimation | null;
    exitVariant: PresetAnimation | null;
    controls: LegacyAnimationControls;
  } | null>(null);

  // Continuous scroll frames are consumed here, outside React. The callback
  // writes the scene's Framer controls (visual lane) and only publishes a
  // React SceneState when a discrete phase actually changes.
  const applyFrame = useCallback((frame: ScrollSceneFrame | null): void => {
    const current = inputsRef.current;
    if (!current || current.slideMode !== 'scroll') return;

    const hasFrame = frame !== null;
    const timelineState = hasFrame ? frame.timelineState : current.globalScrollTimelineState;
    const frameIsActive = hasFrame ? frame.isCurrent : current.isActive;
    const frameIsScrolling = hasFrame ? frame.isScrolling : current.globalIsScrolling;
    const frameIsBackdropActive = hasFrame
      ? frame.isBackdropActive
      : current.globalScrollBackdropActive;
    const frameDirection = hasFrame ? frame.scrollDirection : current.globalScrollDirection;
    const frameProgress = hasFrame ? frame.progress : current.globalScrollProgress;
    const transitionDirection = current.globalScrollTransitionSnapshot?.direction ?? frameDirection;
    const incomingScene =
      (transitionDirection === 'forward' && current.sceneOffset === 1) ||
      (transitionDirection === 'backward' && current.sceneOffset === -1);
    const outgoingScene = frameIsActive && frameIsScrolling && frameProgress > 0.001;
    const backdropCoveredScene =
      !frameIsActive &&
      current.sceneStackMode === 'cover' &&
      frameIsBackdropActive &&
      (current.sceneOffset === 0 || current.sceneOffset === -1);
    const activeSceneState = resolveVariantState(
      current.enterVariant?.animate,
      DEFAULT_SCENE_VISUAL_STATE
    );
    const initialSceneState = resolveVariantState(current.enterVariant?.initial, activeSceneState);
    const exitedSceneState = resolveVariantState(current.exitVariant?.exit, activeSceneState);

    const publishSceneState = (next: SceneState): void => {
      if (lastSceneStateRef.current === next) return;
      lastSceneStateRef.current = next;
      current.setSceneState(next);
    };
    const setVisual = (kind: string, progress: number, value: Record<string, unknown>): void => {
      const previous = lastVisualRef.current;
      if (
        previous &&
        previous.kind === kind &&
        previous.progress === progress &&
        previous.enterVariant === current.enterVariant &&
        previous.exitVariant === current.exitVariant &&
        previous.controls === current.controls
      ) {
        return;
      }
      lastVisualRef.current = {
        kind,
        progress,
        enterVariant: current.enterVariant,
        exitVariant: current.exitVariant,
        controls: current.controls,
      };
      current.controls.set(value as never);
    };

    if (!timelineState) {
      if (incomingScene) {
        publishSceneState('entering');
        const progress = clampProgress(frameProgress);
        setVisual(
          'fallback-enter',
          progress,
          interpolateVariant(initialSceneState, activeSceneState, progress)
        );
      } else if (outgoingScene || backdropCoveredScene) {
        publishSceneState(current.exitVariant?.exit ? 'exiting' : 'active');
        const progress = clampProgress(frameProgress);
        setVisual(
          'fallback-exit',
          progress,
          current.exitVariant?.exit
            ? interpolateVariant(activeSceneState, exitedSceneState, progress)
            : activeSceneState
        );
      } else {
        publishSceneState(frameIsActive ? 'active' : 'initial');
        setVisual(
          frameIsActive ? 'fallback-active' : 'fallback-initial',
          frameIsActive ? 1 : 0,
          frameIsActive ? activeSceneState : initialSceneState
        );
      }
      return;
    }

    if (timelineState.phase === 'before') {
      publishSceneState('initial');
      setVisual('before', 0, initialSceneState);
      return;
    }

    if (timelineState.phase === 'enter') {
      const progress = clampProgress(timelineState.enterProgress);
      publishSceneState('entering');
      setVisual(
        'enter',
        progress,
        interpolateVariant(initialSceneState, activeSceneState, progress)
      );
      return;
    }

    if (timelineState.phase === 'hold') {
      publishSceneState('active');
      setVisual('hold', 1, activeSceneState);
      return;
    }

    if (timelineState.phase === 'exit') {
      const progress = clampProgress(timelineState.exitProgress);
      publishSceneState(current.exitVariant?.exit ? 'exiting' : 'active');
      setVisual(
        'exit',
        progress,
        current.exitVariant?.exit
          ? interpolateVariant(activeSceneState, exitedSceneState, progress)
          : activeSceneState
      );
      return;
    }

    publishSceneState(
      backdropCoveredScene
        ? current.exitVariant?.exit
          ? 'exiting'
          : 'active'
        : current.exitVariant?.exit
          ? 'exiting'
          : frameIsActive
            ? 'active'
            : 'initial'
    );
    setVisual('after', 1, current.exitVariant?.exit ? exitedSceneState : activeSceneState);
  }, []);

  useEffect(() => {
    if (slideMode !== 'scroll') return undefined;

    if (scrollFrameStore && typeof scrollFrameSceneIndex === 'number') {
      const update = (): void => {
        applyFrame(scrollFrameStore.getKeySnapshot(scrollFrameSceneIndex) ?? null);
      };
      update();
      return scrollFrameStore.subscribeKey(scrollFrameSceneIndex, update);
    }

    applyFrame(null);
    return undefined;
  }, [
    applyFrame,
    enterVariant,
    exitVariant,
    globalScrollBackdropActive,
    globalScrollDirection,
    globalScrollProgress,
    globalScrollTimelineState,
    globalScrollTransitionSnapshot,
    globalIsScrolling,
    isActive,
    sceneOffset,
    sceneStackMode,
    scrollFrameSceneIndex,
    scrollFrameStore,
    slideMode,
  ]);
}
