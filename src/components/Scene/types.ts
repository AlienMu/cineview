import type {
  AnimationType,
  DragThresholdConfig,
  DragTimelineUnit,
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
import type {
  DragSceneTransaction,
  PreparedSceneInvalidation,
  PreparedSceneSnapshot,
} from './dragPreparedState';
import type { ScrollSceneFrameStore } from '../runtime/scrollSceneFrameStore';

export type SceneState = 'initial' | 'entering' | 'active' | 'exiting';

/**
 * The single global render-lane slot (D-F1/D-F7). At most ONE render-lane
 * tween (settle page-slide or bounce) exists at a time — renderProgress has
 * one owner. The slot lets ANY scene's drag engine take over the in-flight
 * lane on a new pointerdown, even when the lane was created by a DIFFERENT
 * scene's engine (a rush re-grab mid-slide lands on whichever scene covers
 * the touch point — usually the incoming one — while the lane still belongs
 * to the releasing engine). CineView owns one shared ref; a standalone Scene
 * falls back to an engine-local slot.
 */
export interface DragRenderLane {
  kind: 'settle' | 'bounce';
  /** The sceneIndex of the engine that created this lane (unmount cleanup). */
  ownerSceneIndex: number;
  /** Permanently stop this continuation. Used by teardown and superseding lanes. */
  stop: () => void;
  /**
   * Reversibly pause at the current render position. A pointer-down candidate
   * uses this before public drag ownership exists, so commit cannot race the
   * direction/readiness gate.
   */
  suspend?: () => void;
  /** Resume a previously suspended continuation from its frozen position. */
  resume?: () => void;
  /** Permanently discard a suspension after a candidate acquires ownership. */
  preempt?: () => void;
  /** Latest frozen/rendered progress, used to seed ownership without a stale React frame. */
  getCurrent?: () => number;
}

/** Synchronous rush re-grab baseline shared across the render and element lanes. */
export interface DragTakeoverSnapshot {
  readonly token: number;
  readonly sceneIndices: readonly number[];
  readonly staleRatio: number;
  readonly baseRatio: number | null;
}

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

export type SceneActivationKind = 'ready' | 'static' | 'commit' | 'programmatic';

export interface SceneActivationRecord {
  token: number;
  kind: SceneActivationKind;
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
    /** Monotonic formal-arrival token for this Scene in drag mode. */
    activationToken?: number;
    activationKind?: SceneActivationKind | null;
    viewportWidth?: number;
    viewportHeight?: number;
    // False only while the scroll external store has not published its first
    // real snapshot. Prevents the empty sentinel from impersonating timeout fallback.
    firstSceneEnterGateKnown?: boolean;
    // CineView-owned signal: the initial active scene is playing its one-shot
    // first-screen enter animation (driven by its own element track once
    // first-screen priority assets settle). Distinct from the scene-switch
    // release path.
    firstSceneEnterActive?: boolean;
    // CineView-owned trigger: first-screen priority assets are ready (or forced
    // ready). Turns on the scene-0 cold-start element-track driver. Distinct
    // from the active flag above (which holds the scene at its initial frame
    // until then).
    firstSceneEnterReady?: boolean;
  };
  dragRuntime?: {
    progress?: number;
    renderProgress?: number;
    timelineProgress?: number;
    /** Shared per-frame render lane; the drag engine is its only writer. */
    renderProgressMotion?: import('framer-motion').MotionValue<number>;
    /** Shared per-frame ratio consumed by each Scene-owned element-track writer. */
    timelineProgressMotion?: import('framer-motion').MotionValue<number>;
    isDragging?: boolean;
    release?: DragRelease | null;
    threshold?: DragThresholdConfig;
    /** Root/Scene-resolved mapping; omitted only for standalone legacy callers. */
    dragMappingConfig?: {
      unit: DragTimelineUnit;
      scale: number;
    };
    /** Frozen playback data for the target scene; null when no transaction exists. */
    transaction?: DragSceneTransaction | null;
    /** Publishes only fully stable Scene preparation to the CineView owner. */
    onPrepared?: (snapshot: PreparedSceneSnapshot) => void;
    /** Exact instance/revision invalidation; stale cleanups are ignored by the owner. */
    onPreparedInvalidated?: (invalidation: PreparedSceneInvalidation) => void;
    /**
     * Synchronous candidate preflight. Ownership is granted only after the root
     * validates the target Scene's business flag and prepared snapshot, creates
     * the driving transaction, and emits the directional drag-start callback.
     */
    onOwnershipRequest?: (direction: 'forward' | 'backward') => boolean;
    /** Internal re-grab candidate state; never exposed as a public drag session. */
    candidateSuspended?: boolean;
    /** Returns true when an in-flight render/element continuation was suspended. */
    onCandidateSuspensionChange?: (suspended: boolean) => boolean;
    /** Synchronously registers whether this Scene owns a resumable element continuation. */
    onElementContinuationChange?: (active: boolean) => void;
    /** Authoritative cross-lane rush re-grab baseline, written at ownership. */
    takeoverSnapshot?: import('react').MutableRefObject<DragTakeoverSnapshot | null>;
    /** Internal pointer-session boundary used for callback de-duplication. */
    onPointerSessionStart?: () => void;
    onCommit?: (
      direction: 'forward' | 'backward',
      progressRatio: number,
      elapsedMs: number,
      timelineDuration?: number
    ) => void;
    onReset?: () => void;
    onActivationComplete?: () => void;
    /** Releases only the matching frozen playback transaction. */
    onTransactionComplete?: (transactionId: symbol) => void;
    onProgressChange?: (progress: number) => void;
    onRenderProgressChange?: (progress: number) => void;
    onTimelineProgressChange?: (progress: number) => void;
    onSharedElapsedMsChange?: (elapsedMs: number) => void;
    onDraggingChange?: (dragging: boolean) => void;
    onSharedTimelineDurationChange?: (duration: number) => void;
    onRelease?: (release: DragReleaseInput | null) => void;
    /**
     * CineView-owned shared render-lane slot (see {@link DragRenderLane}).
     * Stable ref for the lifetime of the CineView instance.
     */
    renderLane?: import('react').MutableRefObject<DragRenderLane | null>;
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
    /** Stable imperative frame lane; continuous scroll values never enter React props. */
    frameStore?: ScrollSceneFrameStore;
    sceneIndex?: number;
  };
  onDragGestureEnd?: (
    direction: 'forward' | 'backward',
    progressRatio: number,
    elapsedMs: number,
    timelineDuration?: number
  ) => void;
  onDragReset?: () => void;
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
