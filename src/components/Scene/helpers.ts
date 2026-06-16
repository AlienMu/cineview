import type React from 'react';
import { DEFAULT_SLIDE_DURATION } from '../../types';
import type { SceneAnchor, SceneVisibilityDetail, ScrollMode } from '../../types';
import type { SceneInternalProps } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function resolveSceneAnchor(anchor: SceneAnchor): React.CSSProperties {
  switch (anchor) {
    case 'top-left':
      return { top: 0, left: 0 };
    case 'top-center':
      return { top: 0, left: '50%', transform: 'translateX(-50%)' };
    case 'top-right':
      return { top: 0, right: 0 };
    case 'center-left':
      return { top: '50%', left: 0, transform: 'translateY(-50%)' };
    case 'center':
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    case 'center-right':
      return { top: '50%', right: 0, transform: 'translateY(-50%)' };
    case 'bottom-left':
      return { bottom: 0, left: 0 };
    case 'bottom-center':
      return { bottom: 0, left: '50%', transform: 'translateX(-50%)' };
    case 'bottom-right':
      return { bottom: 0, right: 0 };
    default:
      return { top: 0, left: 0 };
  }
}

export function resolveScrollSceneAnchor(anchor: SceneAnchor): React.CSSProperties {
  switch (anchor) {
    case 'top-right':
    case 'center-right':
    case 'bottom-right':
      return {
        marginLeft: 'auto',
        marginRight: 0,
      };
    case 'top-center':
    case 'center':
    case 'bottom-center':
      return {
        marginLeft: 'auto',
        marginRight: 'auto',
      };
    case 'top-left':
    case 'center-left':
    case 'bottom-left':
    default:
      return {
        marginLeft: 0,
        marginRight: 'auto',
      };
  }
}

export interface NormalizedSceneProps {
  effectiveMode: ScrollMode;
  effectiveDirection: 'x' | 'y';
  isActive: boolean;
  sceneIndex: number;
  totalScenes: number;
  currentSceneIndex: number;
  globalDirection: 'forward' | 'backward' | null;
  globalIsSceneAnimating: boolean;
  globalSharedElapsedMs: number;
  globalSharedTimelineDurationMs: number;
  globalViewportWidth: number;
  globalViewportHeight: number;
  globalDragProgress: number;
  globalRenderProgress: number;
  globalDragTimelineProgress: number;
  globalIsDragging: boolean;
  globalDragTransitionSnapshot: Exclude<
    NonNullable<SceneInternalProps['dragRuntime']>['transitionSnapshot'],
    undefined
  > | null;
  globalScrollProgress: number;
  globalIsScrolling: boolean;
  globalScrollDirection: 'forward' | 'backward' | null;
  globalScrollTransitionSnapshot: Exclude<
    NonNullable<SceneInternalProps['scrollRuntime']>['transitionSnapshot'],
    undefined
  > | null;
  globalScrollBackdropActive: boolean;
  globalScrollTimelineState: Exclude<
    NonNullable<SceneInternalProps['scrollRuntime']>['timelineState'],
    undefined
  > | null;
  globalScrollActiveSceneIndex: number;
  globalScrollViewportOffset: number;
  resolvedSceneWidth: NonNullable<SceneInternalProps['layout']>['width'] | number | string;
  resolvedSceneHeight: NonNullable<SceneInternalProps['layout']>['height'] | number | string;
  resolvedSceneAnchor: SceneAnchor;
  resolvedSceneOverflow:
    | NonNullable<SceneInternalProps['layout']>['overflow']
    | 'hidden'
    | 'visible';
  resolvedSceneZIndex: number | undefined;
  effectiveSceneStackMode: 'replace' | 'cover';
  resolvedSceneTransitionDuration: number;
  resolvedEnterAnimation: SceneInternalProps['enterAnimation'];
  resolvedExitAnimation: SceneInternalProps['exitAnimation'];
  sceneVisibilityCallback?: NonNullable<
    NonNullable<SceneInternalProps['callbacks']>['onVisibilityChange']
  >;
  onVisibilityChange: SceneInternalProps['onVisibilityChange'];
  onSceneChange: SceneInternalProps['onSceneChange'];
  scrollCommitThreshold: number;
  scrollReleaseDuration: number;
  scrollLockToSingleScene: boolean;
  scrollRuntime: SceneInternalProps['scrollRuntime'];
  dragRuntime: SceneInternalProps['dragRuntime'];
  onActivationComplete: SceneInternalProps['onActivationComplete'];
  onDragProgressChange: SceneInternalProps['onDragProgressChange'];
  onRenderProgressChange: SceneInternalProps['onRenderProgressChange'];
  onDragTimelineProgressChange: SceneInternalProps['onDragTimelineProgressChange'];
  onSharedElapsedMsChange: SceneInternalProps['onSharedElapsedMsChange'];
  onDraggingChange: SceneInternalProps['onDraggingChange'];
  onSharedTimelineDurationChange: SceneInternalProps['onSharedTimelineDurationChange'];
  onDragCommit: SceneInternalProps['onDragCommit'];
  onDragReset: SceneInternalProps['onDragReset'];
  onScrollProgressChange: SceneInternalProps['onScrollProgressChange'];
  onScrollDirectionChange: SceneInternalProps['onScrollDirectionChange'];
  onScrollingChange: SceneInternalProps['onScrollingChange'];
  onScrollCommit: SceneInternalProps['onScrollCommit'];
  onScrollReset: SceneInternalProps['onScrollReset'];
  slideDuration: number;
  compatFields: unknown[];
}

export function normalizeSceneProps(props: SceneInternalProps): NormalizedSceneProps {
  const effectiveMode = props.sceneRuntime?.mode ?? props.runtimeMode ?? props.mode ?? 'drag';
  const effectiveDirection =
    props.sceneRuntime?.direction ?? props.runtimeDirection ?? props.slideDirection ?? 'y';
  const resolvedSceneTransitionDuration =
    props.sceneTransitionDuration ?? props.transition?.exitDuration ?? props.exitDuration ?? 800;

  return {
    effectiveMode,
    effectiveDirection,
    isActive: props.sceneRuntime?.isActive ?? props.isActive ?? false,
    sceneIndex: props.sceneRuntime?.sceneIndex ?? props.sceneIndex ?? 0,
    totalScenes: props.sceneRuntime?.totalScenes ?? props.totalScenes ?? 1,
    currentSceneIndex: props.sceneRuntime?.currentSceneIndex ?? props.currentSceneIndex ?? 0,
    globalDirection: props.sceneRuntime?.transitionDirection ?? props.globalDirection ?? null,
    globalIsSceneAnimating:
      props.sceneRuntime?.isSceneAnimating ?? props.globalIsSceneAnimating ?? false,
    globalSharedElapsedMs: props.sceneRuntime?.sharedElapsedMs ?? props.globalSharedElapsedMs ?? 0,
    globalSharedTimelineDurationMs:
      props.sceneRuntime?.sharedTimelineDurationMs ?? props.globalSharedTimelineDurationMs ?? 0,
    globalViewportWidth: props.sceneRuntime?.viewportWidth ?? props.globalViewportWidth ?? 0,
    globalViewportHeight: props.sceneRuntime?.viewportHeight ?? props.globalViewportHeight ?? 0,
    globalDragProgress: props.dragRuntime?.progress ?? props.globalDragProgress ?? 0,
    globalRenderProgress: props.dragRuntime?.renderProgress ?? props.globalRenderProgress ?? 0,
    globalDragTimelineProgress:
      props.dragRuntime?.timelineProgress ?? props.globalDragTimelineProgress ?? 0,
    globalIsDragging: props.dragRuntime?.isDragging ?? props.globalIsDragging ?? false,
    globalDragTransitionSnapshot:
      props.dragRuntime?.transitionSnapshot ?? props.globalDragTransitionSnapshot ?? null,
    globalScrollProgress: props.scrollRuntime?.progress ?? props.globalScrollProgress ?? 0,
    globalIsScrolling: props.scrollRuntime?.isScrolling ?? props.globalIsScrolling ?? false,
    globalScrollDirection: props.scrollRuntime?.direction ?? props.globalScrollDirection ?? null,
    globalScrollTransitionSnapshot:
      props.scrollRuntime?.transitionSnapshot ?? props.globalScrollTransitionSnapshot ?? null,
    globalScrollBackdropActive:
      props.scrollRuntime?.backdropActive ?? props.globalScrollBackdropActive ?? false,
    globalScrollTimelineState:
      props.scrollRuntime?.timelineState ?? props.globalScrollTimelineState ?? null,
    globalScrollActiveSceneIndex:
      props.scrollRuntime?.activeSceneIndex ?? props.globalScrollActiveSceneIndex ?? 0,
    globalScrollViewportOffset:
      props.scrollRuntime?.viewportOffset ?? props.globalScrollViewportOffset ?? 0,
    resolvedSceneWidth: props.layout?.width ?? props.sceneWidth ?? '100vw',
    resolvedSceneHeight:
      props.layout?.height ?? props.sceneHeight ?? (effectiveMode === 'scroll' ? 'auto' : '100vh'),
    resolvedSceneAnchor: props.layout?.anchor ?? props.sceneAnchor ?? 'top-left',
    resolvedSceneOverflow: props.layout?.overflow ?? props.sceneOverflow ?? 'hidden',
    resolvedSceneZIndex: props.stack?.zIndex ?? props.sceneZIndex,
    effectiveSceneStackMode:
      props.stack?.mode ??
      props.sceneStackMode ??
      (effectiveMode === 'scroll' ? 'cover' : 'replace'),
    resolvedSceneTransitionDuration,
    resolvedEnterAnimation: props.transition?.enterAnimation ?? props.enterAnimation,
    resolvedExitAnimation: props.transition?.exitAnimation ?? props.exitAnimation,
    sceneVisibilityCallback: props.callbacks?.onVisibilityChange,
    onVisibilityChange: props.onVisibilityChange,
    onSceneChange: props.onSceneChange,
    scrollCommitThreshold: props.scrollCommitThreshold ?? 0.42,
    scrollReleaseDuration: props.scrollReleaseDuration ?? 220,
    scrollLockToSingleScene: props.scrollLockToSingleScene ?? true,
    scrollRuntime: props.scrollRuntime,
    dragRuntime: props.dragRuntime,
    onActivationComplete: props.onActivationComplete,
    onDragProgressChange: props.onDragProgressChange,
    onRenderProgressChange: props.onRenderProgressChange,
    onDragTimelineProgressChange: props.onDragTimelineProgressChange,
    onSharedElapsedMsChange: props.onSharedElapsedMsChange,
    onDraggingChange: props.onDraggingChange,
    onSharedTimelineDurationChange: props.onSharedTimelineDurationChange,
    onDragCommit: props.onDragCommit,
    onDragReset: props.onDragReset,
    onScrollProgressChange: props.onScrollProgressChange,
    onScrollDirectionChange: props.onScrollDirectionChange,
    onScrollingChange: props.onScrollingChange,
    onScrollCommit: props.onScrollCommit,
    onScrollReset: props.onScrollReset,
    slideDuration: props.slideDuration ?? DEFAULT_SLIDE_DURATION,
    compatFields: [
      props.mode,
      props.slideDirection,
      props.scrollSpeed,
      props.scrollControlled,
      props.scrollCommitThreshold,
      props.scrollReleaseDuration,
      props.scrollLockToSingleScene,
      props.runtimeMode,
      props.runtimeDirection,
      props.isActive,
      props.sceneIndex,
      props.totalScenes,
      props.currentSceneIndex,
      props.globalDragProgress,
      props.globalRenderProgress,
      props.globalDragTimelineProgress,
      props.globalIsDragging,
      props.globalScrollProgress,
      props.globalIsScrolling,
      props.globalScrollDirection,
      props.globalScrollTransitionSnapshot,
      props.globalScrollBackdropActive,
      props.globalScrollTimelineState,
      props.globalScrollActiveSceneIndex,
      props.globalScrollViewportOffset,
      props.globalViewportWidth,
      props.globalViewportHeight,
      props.globalSharedElapsedMs,
      props.globalSharedTimelineDurationMs,
      props.globalDragTransitionSnapshot,
      props.globalDirection,
      props.globalIsSceneAnimating,
      props.onActivationComplete,
      props.onDragProgressChange,
      props.onRenderProgressChange,
      props.onDragTimelineProgressChange,
      props.onSharedElapsedMsChange,
      props.onDraggingChange,
      props.onSharedTimelineDurationChange,
      props.onDragCommit,
      props.onDragReset,
      props.onScrollProgressChange,
      props.onScrollDirectionChange,
      props.onScrollingChange,
      props.onScrollCommit,
      props.onScrollReset,
      props.scrollRuntime,
      props.dragRuntime,
      props.sceneRuntime,
    ],
  };
}

export function getSceneVisibilityProgress({
  effectiveMode,
  isActive,
  globalScrollTimelineState,
  hasExitAnimation,
}: {
  effectiveMode: ScrollMode;
  isActive: boolean;
  globalScrollTimelineState: NormalizedSceneProps['globalScrollTimelineState'];
  hasExitAnimation: boolean;
}): number {
  if (effectiveMode !== 'scroll' || !globalScrollTimelineState) {
    return isActive ? 1 : 0;
  }

  switch (globalScrollTimelineState.phase) {
    case 'before':
      return 0;
    case 'enter':
      return globalScrollTimelineState.enterProgress;
    case 'hold':
      return 1;
    case 'exit':
      return hasExitAnimation ? 1 - globalScrollTimelineState.exitProgress : 1;
    case 'after':
      return hasExitAnimation ? 0 : 1;
    default:
      return 0;
  }
}

export function emitSceneVisibility({
  onVisibilityChange,
  sceneVisibilityCallback,
  sceneIndex,
  visible,
  progress,
}: {
  onVisibilityChange?: (visible: boolean, progress: number) => void;
  sceneVisibilityCallback?: (detail: SceneVisibilityDetail) => void;
  sceneIndex: number;
  visible: boolean;
  progress: number;
}): void {
  onVisibilityChange?.(visible, progress);
  sceneVisibilityCallback?.({
    sceneIndex,
    visible,
    progress,
  });
}

export interface FixedLayerMetrics {
  visible: boolean;
  isHorizontal: boolean;
  hostOffset: number;
  hostSpan: number;
  clipWidth: number;
  clipHeight: number;
}

export function getFixedLayerMetrics({
  effectiveMode,
  effectiveDirection,
  globalScrollTimelineState,
  globalScrollViewportOffset,
  globalViewportWidth,
  globalViewportHeight,
}: {
  effectiveMode: ScrollMode;
  effectiveDirection: 'x' | 'y';
  globalScrollTimelineState: NormalizedSceneProps['globalScrollTimelineState'];
  globalScrollViewportOffset: number;
  globalViewportWidth: number;
  globalViewportHeight: number;
}): FixedLayerMetrics {
  if (effectiveMode !== 'scroll') {
    return {
      visible: false,
      isHorizontal: false,
      hostOffset: 0,
      hostSpan: 0,
      clipWidth: 0,
      clipHeight: 0,
    };
  }

  const sceneStart = globalScrollTimelineState?.rangeStart ?? 0;
  const sceneEnd = globalScrollTimelineState?.rangeEnd ?? sceneStart;
  const isHorizontal = effectiveDirection === 'x';
  const sceneSpanPx = Math.max(sceneEnd - sceneStart, 0);
  const viewportMainSpan = Math.max(isHorizontal ? globalViewportWidth : globalViewportHeight, 0);
  const sceneViewportStart = sceneStart - globalScrollViewportOffset;
  const sceneViewportEnd = sceneEnd - globalScrollViewportOffset;
  const hostSpan = Math.max(Math.min(viewportMainSpan, Math.max(sceneSpanPx, 1)), 1);
  const maxHostOffset = Math.max(sceneSpanPx - hostSpan, 0);
  const hostOffset = clamp(globalScrollViewportOffset - sceneStart, 0, maxHostOffset);
  const visible = sceneSpanPx > 0 && sceneViewportEnd > 0 && sceneViewportStart < viewportMainSpan;

  return {
    visible,
    isHorizontal,
    hostOffset,
    hostSpan,
    clipWidth: isHorizontal ? sceneSpanPx : 0,
    clipHeight: isHorizontal ? 0 : sceneSpanPx,
  };
}
