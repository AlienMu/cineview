import type {
  AnimationType,
  SceneAnchor,
  SceneProps,
  SceneStackMode,
  ScrollMode,
  ScrollTimelineState,
} from '../../types';
import type { DragTransitionSnapshot, ScrollTransitionSnapshot } from '../../hooks/useSceneManager';

export type SceneState = 'initial' | 'entering' | 'active' | 'exiting';

export interface SceneLegacyCompatProps {
  mode?: ScrollMode;
  slideDirection?: 'x' | 'y';
  slideDuration?: number;
  sceneTransitionDuration?: number;
  enterAnimation?: AnimationType;
  exitAnimation?: AnimationType;
  exitDuration?: number;
  sceneWidth?: number | string;
  sceneHeight?: number | string;
  sceneAnchor?: SceneAnchor;
  sceneZIndex?: number;
  sceneOverflow?: 'hidden' | 'visible';
  sceneStackMode?: SceneStackMode;
  replayOnReenter?: boolean;
  scrollSpeed?: number;
  scrollControlled?: boolean;
  scrollCommitThreshold?: number;
  scrollReleaseDuration?: number;
  scrollLockToSingleScene?: boolean;
  scrollEnterLength?: number;
  scrollHoldLength?: number;
  scrollExitLength?: number;
  onVisibilityChange?: (visible: boolean, progress: number) => void;
  preloadImages?: string[];
}

export interface SceneInternalProps extends SceneProps, SceneLegacyCompatProps {
  runtimeMode?: ScrollMode;
  runtimeDirection?: 'x' | 'y';
  isActive?: boolean;
  sceneIndex?: number;
  totalScenes?: number;
  currentSceneIndex?: number;
  sceneRuntime?: {
    mode?: ScrollMode;
    direction?: 'x' | 'y';
    isActive?: boolean;
    sceneIndex?: number;
    totalScenes?: number;
    currentSceneIndex?: number;
    transitionDirection?: 'forward' | 'backward' | null;
    isSceneAnimating?: boolean;
    sharedElapsedMs?: number;
    sharedTimelineDurationMs?: number;
    viewportWidth?: number;
    viewportHeight?: number;
  };
  dragRuntime?: {
    progress?: number;
    renderProgress?: number;
    timelineProgress?: number;
    isDragging?: boolean;
    transitionSnapshot?: DragTransitionSnapshot | null;
    onCommit?: (
      direction: 'forward' | 'backward',
      progressRatio: number,
      elapsedMs: number,
      timelineDuration?: number
    ) => void;
    onReset?: () => void;
    onActivationComplete?: () => void;
    onProgressChange?: (progress: number) => void;
    onRenderProgressChange?: (progress: number) => void;
    onTimelineProgressChange?: (progress: number) => void;
    onSharedElapsedMsChange?: (elapsedMs: number) => void;
    onDraggingChange?: (dragging: boolean) => void;
    onSharedTimelineDurationChange?: (duration: number) => void;
  };
  scrollRuntime?: {
    progress?: number;
    isScrolling?: boolean;
    direction?: 'forward' | 'backward' | null;
    transitionSnapshot?: ScrollTransitionSnapshot | null;
    backdropActive?: boolean;
    timelineState?: ScrollTimelineState | null;
    activeSceneIndex?: number;
    viewportOffset?: number;
    onProgressChange?: (progress: number) => void;
    onDirectionChange?: (direction: 'forward' | 'backward' | null) => void;
    onScrollingChange?: (scrolling: boolean) => void;
    onCommit?: (direction: 'forward' | 'backward', progressRatio: number) => void;
    onReset?: () => void;
  };
  onDragCommit?: (
    direction: 'forward' | 'backward',
    progressRatio: number,
    elapsedMs: number,
    timelineDuration?: number
  ) => void;
  onDragReset?: () => void;
  globalDragProgress?: number;
  globalRenderProgress?: number;
  globalDragTimelineProgress?: number;
  globalIsDragging?: boolean;
  globalScrollProgress?: number;
  globalIsScrolling?: boolean;
  globalScrollDirection?: 'forward' | 'backward' | null;
  globalScrollTransitionSnapshot?: ScrollTransitionSnapshot | null;
  globalScrollBackdropActive?: boolean;
  globalScrollTimelineState?: ScrollTimelineState | null;
  globalScrollActiveSceneIndex?: number;
  globalScrollViewportOffset?: number;
  globalViewportWidth?: number;
  globalViewportHeight?: number;
  globalSharedElapsedMs?: number;
  globalSharedTimelineDurationMs?: number;
  globalDragTransitionSnapshot?: DragTransitionSnapshot | null;
  globalDirection?: 'forward' | 'backward' | null;
  globalIsSceneAnimating?: boolean;
  onActivationComplete?: () => void;
  onDragProgressChange?: (progress: number) => void;
  onRenderProgressChange?: (progress: number) => void;
  onDragTimelineProgressChange?: (progress: number) => void;
  onSharedElapsedMsChange?: (elapsedMs: number) => void;
  onDraggingChange?: (dragging: boolean) => void;
  onSharedTimelineDurationChange?: (duration: number) => void;
  onScrollProgressChange?: (progress: number) => void;
  onScrollDirectionChange?: (direction: 'forward' | 'backward' | null) => void;
  onScrollingChange?: (scrolling: boolean) => void;
  onScrollCommit?: (direction: 'forward' | 'backward', progressRatio: number) => void;
  onScrollReset?: () => void;
  onSceneChange?: (direction: 'forward' | 'backward') => void;
}
