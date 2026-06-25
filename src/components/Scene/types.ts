import type {
  AnimationType,
  SceneAnchor,
  SceneProps,
  SceneStackMode,
  ScrollMode,
  ScrollTimelineState,
} from '../../types';
import type {
  DragRelease,
  DragReleaseInput,
  ScrollTransitionSnapshot,
} from '../../hooks/useSceneManager';

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
    release?: DragRelease | null;
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
    onRelease?: (release: DragReleaseInput | null) => void;
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
  globalSharedTimelineDurationMs?: number;
  // Two-track model: the single read-only release directive (settle / bounce)
  // published by the outgoing scene's release. Replaces globalDragTransitionSnapshot.
  globalDragRelease?: DragRelease | null;
  // CineView-owned signal: the initial active scene is playing its one-shot
  // first-screen enter animation (driven by its own element track once first-screen
  // priority assets settle). Distinct from the scene-switch release path.
  globalFirstSceneEnterActive?: boolean;
  // CineView-owned trigger: first-screen priority assets are ready (or forced
  // ready). Turns on the scene-0 cold-start element-track driver. Distinct from
  // the window flag above (which holds the scene at its initial frame until then).
  globalFirstSceneEnterReady?: boolean;
  globalDirection?: 'forward' | 'backward' | null;
  globalIsSceneAnimating?: boolean;
  onActivationComplete?: () => void;
  onDragProgressChange?: (progress: number) => void;
  onRenderProgressChange?: (progress: number) => void;
  onDragTimelineProgressChange?: (progress: number) => void;
  onSharedElapsedMsChange?: (elapsedMs: number) => void;
  onDraggingChange?: (dragging: boolean) => void;
  onSharedTimelineDurationChange?: (duration: number) => void;
  // Two-track model: the outgoing scene's release publishes the release directive.
  onDragRelease?: (release: DragReleaseInput | null) => void;
  onScrollProgressChange?: (progress: number) => void;
  onScrollDirectionChange?: (direction: 'forward' | 'backward' | null) => void;
  onScrollingChange?: (scrolling: boolean) => void;
  onScrollCommit?: (direction: 'forward' | 'backward', progressRatio: number) => void;
  onScrollReset?: () => void;
  onSceneChange?: (direction: 'forward' | 'backward') => void;
}
