import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { animate, type AnimationControls, type MotionValue, type PanInfo } from 'framer-motion';
import type { DragReleaseInput } from '../../hooks/useSceneManager';
import type { DragThresholdConfig, ScrollMode } from '../../types';
import type { SceneState } from './types';

function isVerboseDragDebug(): boolean {
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') {
    return false;
  }

  return Boolean(
    (window as Window & { __CINEVIEW_DRAG_DEBUG__?: boolean }).__CINEVIEW_DRAG_DEBUG__
  );
}

function debugDrag(message: string, details?: Record<string, unknown>): void {
  if (!isVerboseDragDebug()) {
    return;
  }

  if (details) {
    console.log(message, details);
    return;
  }

  console.log(message);
}

export function calculateThreshold(velocity: number, config?: DragThresholdConfig): number {
  const MIN_VELOCITY = config?.minVelocity ?? 0;
  const MAX_VELOCITY = config?.maxVelocity ?? 1000;
  const MIN_THRESHOLD = config?.minRatio ?? 0.15;
  const MAX_THRESHOLD = config?.maxRatio ?? 0.3;

  if (!Number.isFinite(velocity)) {
    return MAX_THRESHOLD;
  }

  const span = MAX_VELOCITY - MIN_VELOCITY;
  if (span <= 0) {
    return MAX_THRESHOLD;
  }
  const clampedVelocity = Math.max(MIN_VELOCITY, Math.min(MAX_VELOCITY, velocity));
  return (
    MAX_THRESHOLD - ((clampedVelocity - MIN_VELOCITY) / span) * (MAX_THRESHOLD - MIN_THRESHOLD)
  );
}

function resolveProgressVelocity(slideDirection: 'x' | 'y', info: PanInfo): number {
  const axisVelocity = slideDirection === 'y' ? info.velocity.y : info.velocity.x;
  return Number.isFinite(axisVelocity) ? -axisVelocity : 0;
}

interface UseDragSceneEngineParams {
  slideMode: ScrollMode;
  isActive: boolean;
  sceneIndex: number;
  currentSceneIndex: number;
  totalScenes: number;
  slideDirection: 'x' | 'y';
  slideDuration: number;
  sceneTransitionDuration: number;
  sceneOffset: number;
  sceneState: SceneState;
  thresholdConfig?: DragThresholdConfig;
  globalDirection: 'forward' | 'backward' | null;
  globalRenderProgress: number;
  globalIsDragging: boolean;
  globalDragProgress: number;
  globalDragTimelineProgress: number;
  controls: AnimationControls;
  dragProgressMotion: MotionValue<number>;
  setSceneState: Dispatch<SetStateAction<SceneState>>;
  setIsAnimating: Dispatch<SetStateAction<boolean>>;
  resolveDragProgress: (rawProgress: number) => number;
  getTimelineDuration: () => number;
  onDragProgressChange?: (progress: number) => void;
  onRenderProgressChange?: (progress: number) => void;
  onDragTimelineProgressChange?: (progress: number) => void;
  onDraggingChange?: (dragging: boolean) => void;
  onSharedTimelineDurationChange?: (duration: number) => void;
  // Two-track model: the outgoing scene's release publishes ONE read-only release
  // directive. Each incoming Scene's useElementTrack reacts to it.
  onDragRelease?: (release: DragReleaseInput | null) => void;
  completeReleaseImmediately?: boolean;
  onDragCommit?: (
    direction: 'forward' | 'backward',
    progressRatio: number,
    elapsedMs: number,
    timelineDuration?: number
  ) => void;
  onDragReset?: () => void;
}

interface UseDragSceneEngineResult {
  handleDragStart: () => void;
  handlePan: (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
  handlePanEnd: (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
}

export function useDragSceneEngine({
  slideMode,
  isActive,
  sceneIndex,
  currentSceneIndex,
  totalScenes,
  slideDirection,
  slideDuration,
  sceneTransitionDuration,
  sceneOffset,
  sceneState,
  globalDirection,
  globalRenderProgress,
  globalIsDragging,
  globalDragProgress,
  globalDragTimelineProgress,
  controls,
  dragProgressMotion,
  setSceneState,
  setIsAnimating,
  resolveDragProgress,
  getTimelineDuration,
  onDragProgressChange,
  onRenderProgressChange,
  onDragTimelineProgressChange,
  onDraggingChange,
  onSharedTimelineDurationChange,
  onDragRelease,
  completeReleaseImmediately = false,
  onDragCommit,
  onDragReset,
  thresholdConfig,
}: UseDragSceneEngineParams): UseDragSceneEngineResult {
  const lastPanBucketRef = useRef<number | null>(null);
  const lastRenderReleaseBucketRef = useRef<number | null>(null);
  const releaseTokenRef = useRef(0);
  const renderReleaseControlsRef = useRef<{ stop: () => void; flush?: () => void } | null>(null);
  const pendingReleaseRef = useRef<{
    token: number;
    direction: 'forward' | 'backward';
    commit: () => void;
  } | null>(null);

  // Scene-state sync. Two-track model: the element timeline no longer feeds this;
  // sceneState now only distinguishes outgoing (exit) vs incoming/active for
  // pointer-events / willChange / runtimeState. The element-track enter progress
  // is resolved independently by useAnimateDrag off the per-scene element track.
  useEffect(() => {
    if (slideMode !== 'drag') return;

    controls.set({
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      rotate: 0,
    });

    const progress = globalRenderProgress;
    const absProgress = Math.abs(progress);
    const isTransitioning = globalIsDragging || absProgress > 0.001;
    const dragDirection = progress > 0 ? 'forward' : progress < 0 ? 'backward' : globalDirection;
    const isIncomingScene =
      (dragDirection === 'forward' && sceneOffset === 1) ||
      (dragDirection === 'backward' && sceneOffset === -1);

    const nextSceneState: SceneState = isActive
      ? isTransitioning
        ? 'exiting'
        : 'active'
      : isIncomingScene
        ? 'entering'
        : 'initial';

    if (sceneState !== nextSceneState) {
      debugDrag(
        `🎬 [Scene ${sceneIndex}] State transition: ${sceneState} -> ${nextSceneState} (drag mode sync)`
      );
      setSceneState(nextSceneState);
    }
  }, [
    slideMode,
    controls,
    isActive,
    sceneState,
    sceneIndex,
    globalRenderProgress,
    globalIsDragging,
    sceneOffset,
    globalDirection,
    setSceneState,
  ]);

  // Stop any in-flight release/bounce tween on unmount. Without this, a release
  // or bounce animation still running when the scene unmounts (route change,
  // conditional render, virtualization pruning an adjacent scene) keeps its
  // framer-motion rAF alive and fires onUpdate/onComplete — which call
  // setState/onRenderProgressChange after teardown (React warning + leaked rAF).
  // The token bump invalidates the settle onUpdate/onComplete guards too.
  useEffect(() => {
    return () => {
      releaseTokenRef.current += 1;
      renderReleaseControlsRef.current?.stop();
      renderReleaseControlsRef.current = null;
      pendingReleaseRef.current = null;
    };
  }, []);

  const handleDragStart = useCallback(() => {
    if (slideMode !== 'drag' || !isActive) return;

    // A new drag starts while a previous release is still sliding the page.
    // Finalize it immediately: flush the render lane so the previous scene
    // commits at its release ratio (its incoming scene's element track keeps
    // running on its own). The OLD incoming scene's in-flight element track is
    // stopped IN PLACE by that scene's own useElementTrack reacting to the new
    // drag (single writer) — NOT here.
    const pendingRelease = pendingReleaseRef.current;
    if (pendingRelease) {
      const renderControls = renderReleaseControlsRef.current;
      if (renderControls?.flush) {
        renderControls.flush();
      } else {
        pendingRelease.commit();
      }

      debugDrag(`🧹 [Scene ${sceneIndex}] finalize pending release before new drag`, {
        direction: pendingRelease.direction,
      });
    } else {
      // No pending settle, but a bounce (boundary / below-threshold) may still be
      // tweening the render lane back to 0. Stop it so this new pan becomes the
      // SOLE writer of renderProgress — without this the in-flight bounce's
      // onUpdate and handlePan both write the render lane during a re-grab,
      // breaking the single-writer invariant and producing a visible stutter.
      renderReleaseControlsRef.current?.stop();
      renderReleaseControlsRef.current = null;
    }

    debugDrag(`🫳 [Scene ${sceneIndex}] drag start`, {
      currentSceneIndex,
      totalScenes,
      dragProgress: globalDragProgress.toFixed(3),
      dragTimelineProgress: globalDragTimelineProgress.toFixed(3),
    });
    onDraggingChange?.(true);
  }, [
    slideMode,
    isActive,
    onDraggingChange,
    sceneIndex,
    currentSceneIndex,
    totalScenes,
    globalDragProgress,
    globalDragTimelineProgress,
  ]);

  const handlePan = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (slideMode !== 'drag' || !isActive) return;

      const offset = slideDirection === 'y' ? info.offset.y : info.offset.x;
      const viewportSize = slideDirection === 'y' ? window.innerHeight : window.innerWidth;
      const progress = resolveDragProgress(-offset / viewportSize);
      const timelineDuration = getTimelineDuration();
      const timelineProgress = Math.abs(progress);

      // Render lane only: page translate + the drag ratio. The element timeline is
      // NOT written here — the incoming scene's useElementTrack pegs its own track
      // to r * T_self off `dragTimelineProgress`. Single writer per track.
      onDragProgressChange?.(progress);
      onDragTimelineProgressChange?.(timelineProgress);
      onRenderProgressChange?.(progress);
      onSharedTimelineDurationChange?.(timelineDuration);
      dragProgressMotion.set(progress);

      if (isVerboseDragDebug()) {
        const bucket = Math.round(Math.abs(progress) * 10) / 10;
        if (lastPanBucketRef.current !== bucket) {
          lastPanBucketRef.current = bucket;
          console.log(`🫳 [Scene ${sceneIndex}] drag progress`, {
            progress: progress.toFixed(3),
            timelineProgress: timelineProgress.toFixed(3),
            offset: offset.toFixed(1),
            velocityX: info.velocity.x.toFixed(1),
            velocityY: info.velocity.y.toFixed(1),
            direction: progress > 0 ? 'forward' : progress < 0 ? 'backward' : 'idle',
          });
        }
      }
    },
    [
      slideMode,
      isActive,
      slideDirection,
      sceneIndex,
      onDragProgressChange,
      onDragTimelineProgressChange,
      onRenderProgressChange,
      onSharedTimelineDurationChange,
      dragProgressMotion,
      resolveDragProgress,
      getTimelineDuration,
    ]
  );

  const handlePanEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (slideMode !== 'drag' || !isActive) return;

      releaseTokenRef.current += 1;
      renderReleaseControlsRef.current?.stop();

      const currentProgress = dragProgressMotion.get();
      const timelineDuration = getTimelineDuration();
      const signedProgressVelocity = resolveProgressVelocity(slideDirection, info);
      const velocity = Math.abs(signedProgressVelocity);
      const absFinalProgress = Math.abs(currentProgress);

      if (absFinalProgress < 0.001) {
        debugDrag(`🫳 [Scene ${sceneIndex}] drag end -> reset (tiny progress)`, {
          currentProgress: currentProgress.toFixed(3),
        });
        onDragReset?.();
        onDraggingChange?.(false);
        setSceneState('active');
        return;
      }

      const direction: 'forward' | 'backward' = currentProgress > 0 ? 'forward' : 'backward';
      const targetSceneIndex =
        direction === 'forward' ? currentSceneIndex + 1 : currentSceneIndex - 1;

      if (resolveDragProgress(currentProgress) === 0 && currentProgress !== 0) {
        setIsAnimating(true);

        debugDrag(`🫳 [Scene ${sceneIndex}] drag end -> blocked by boundary, bounce reset`, {
          currentProgress: currentProgress.toFixed(3),
          velocity: velocity.toFixed(1),
        });

        // Bounce both tracks back to 0 in parallel (I1). The render lane returns
        // via dragProgressMotion; the (would-be) incoming scene's element track
        // returns via the bounce release directive.
        onDragRelease?.({ mode: 'bounce', direction, targetSceneIndex });
        renderReleaseControlsRef.current = animate(dragProgressMotion, 0, {
          duration: 0.15,
          ease: 'easeOut',
          onUpdate: (latest) => {
            onDragProgressChange?.(latest);
            onDragTimelineProgressChange?.(Math.abs(latest));
            onRenderProgressChange?.(latest);
          },
          onComplete: () => {
            onDragProgressChange?.(0);
            onDragTimelineProgressChange?.(0);
            onRenderProgressChange?.(0);
            dragProgressMotion.set(0);
            renderReleaseControlsRef.current = null;
            onDragReset?.();
            onDraggingChange?.(false);
            setSceneState('active');
            setIsAnimating(false);
          },
        });
        return;
      }

      const threshold = completeReleaseImmediately
        ? 0.5
        : calculateThreshold(velocity, thresholdConfig);

      debugDrag(`🎯 [Scene ${sceneIndex}] Threshold:`, {
        velocity: velocity.toFixed(1),
        threshold: threshold.toFixed(3),
        progress: absFinalProgress.toFixed(3),
        shouldSwitch: absFinalProgress > threshold,
      });

      const hasDirectionReversal =
        absFinalProgress > 0.001 && currentProgress * signedProgressVelocity < 0 && velocity > 600;
      const shouldSwitch =
        absFinalProgress > threshold && (completeReleaseImmediately || !hasDirectionReversal);

      debugDrag(`🫳 [Scene ${sceneIndex}] drag end decision`, {
        currentProgress: currentProgress.toFixed(3),
        absFinalProgress: absFinalProgress.toFixed(3),
        direction,
        threshold: threshold.toFixed(3),
        velocity: velocity.toFixed(1),
        signedProgressVelocity: signedProgressVelocity.toFixed(1),
        hasDirectionReversal,
        shouldSwitch,
        sceneTransitionDuration,
      });

      if (shouldSwitch) {
        setIsAnimating(true);
        onDraggingChange?.(false);
        if (completeReleaseImmediately) {
          // Standalone mode: no incoming-scene coordination. Commit at 100%
          // immediately (the local onDragCommit closure rests the element track).
          onDragCommit?.(direction, 1, timelineDuration, timelineDuration);
          setIsAnimating(false);
          return;
        }

        const releaseToken = ++releaseTokenRef.current;
        const targetProgress = direction === 'forward' ? 1 : -1;
        const remainingProgress = Math.abs(targetProgress - currentProgress);
        // The page-slide (render lane) runs on the SCENE-TRANSITION timescale only.
        // It is the SOLE commit trigger. The element timeline continuation runs in
        // PARALLEL on the incoming scene's own track via the release directive set
        // below — created at THIS instant (before the commit), at NATURAL rate.
        const sceneTravelDuration = Math.max(remainingProgress * (slideDuration / 1000), 0);
        const committedProgress = Math.min(absFinalProgress, 1);

        // Publish the release directive NOW (in parallel with the render lane, BEFORE
        // the commit). The incoming scene's useElementTrack continues its element
        // track from the release elapsed to T at natural rate. F1: direction is
        // captured in the directive at creation — the incoming scene never re-reads
        // the global direction (which gets cleared at completeDragTransition).
        // Carry the release ratio (abs drag fraction) IN the directive so the
        // incoming scene's element track can seed its continuation from the
        // release elapsed authoritatively — without depending on a render-synced
        // ratio ref that reads a stale 0 when press/move/release flush in one
        // synchronous batch (the replay-from-0 case).
        onDragRelease?.({
          mode: 'settle',
          direction,
          targetSceneIndex,
          progressRatio: absFinalProgress,
        });

        const commitRelease = (): void => {
          const pendingRelease = pendingReleaseRef.current;
          if (!pendingRelease || pendingRelease.token !== releaseTokenRef.current) {
            return;
          }
          renderReleaseControlsRef.current?.stop();
          pendingReleaseRef.current = null;

          dragProgressMotion.set(targetProgress);
          debugDrag(`🫳 [Scene ${sceneIndex}] release page-slide complete -> commit`, {
            releaseToken,
            committedProgress: committedProgress.toFixed(3),
            direction,
            sceneTravelDurationMs: (sceneTravelDuration * 1000).toFixed(1),
          });
          // Commit advances the scene index only. onSceneDidChange is DEFERRED to
          // the incoming scene's completeDragTransition (when its element track
          // reaches T).
          onDragCommit?.(
            direction,
            committedProgress,
            committedProgress * timelineDuration,
            timelineDuration
          );
          onRenderProgressChange?.(0);
          setIsAnimating(false);
        };

        pendingReleaseRef.current = {
          token: releaseToken,
          direction,
          commit: commitRelease,
        };

        debugDrag(`🫳 [Scene ${sceneIndex}] release scene-travel`, {
          releaseToken,
          fromProgress: currentProgress.toFixed(3),
          sceneTravelDurationMs: (sceneTravelDuration * 1000).toFixed(1),
          committedProgress: committedProgress.toFixed(3),
          timelineDuration,
        });

        renderReleaseControlsRef.current = animate(currentProgress, targetProgress, {
          duration: sceneTravelDuration,
          ease: 'easeOut',
          onUpdate: (latest) => {
            if (releaseTokenRef.current !== releaseToken) return;
            onRenderProgressChange?.(latest);
            if (isVerboseDragDebug()) {
              const bucket = Math.round(Math.abs(latest) * 10) / 10;
              if (lastRenderReleaseBucketRef.current !== bucket) {
                lastRenderReleaseBucketRef.current = bucket;
                console.log(`🎞️ [Scene ${sceneIndex}] release render tick`, {
                  releaseToken,
                  progress: latest.toFixed(3),
                  bucket: bucket.toFixed(1),
                  direction,
                });
              }
            }
          },
          onComplete: () => {
            commitRelease();
          },
        });
      } else {
        setIsAnimating(true);
        const duration = absFinalProgress * (timelineDuration / 1000) * 0.5;

        debugDrag(`🫳 [Scene ${sceneIndex}] release bounce-back`, {
          fromProgress: currentProgress.toFixed(3),
          timelineDuration,
          durationMs: (duration * 1000).toFixed(1),
        });

        // Bounce both tracks back to 0 in parallel (I1).
        onDragRelease?.({ mode: 'bounce', direction, targetSceneIndex });
        renderReleaseControlsRef.current = animate(dragProgressMotion, 0, {
          duration,
          ease: 'easeOut',
          onUpdate: (latest) => {
            onDragProgressChange?.(latest);
            onDragTimelineProgressChange?.(Math.abs(latest));
            onRenderProgressChange?.(latest);
          },
          onComplete: () => {
            onDragProgressChange?.(0);
            onDragTimelineProgressChange?.(0);
            onRenderProgressChange?.(0);
            dragProgressMotion.set(0);
            renderReleaseControlsRef.current = null;
            onDragReset?.();
            onDraggingChange?.(false);
            setIsAnimating(false);
          },
        });
      }
    },
    [
      slideMode,
      isActive,
      slideDirection,
      sceneIndex,
      currentSceneIndex,
      slideDuration,
      dragProgressMotion,
      onDragProgressChange,
      onDragTimelineProgressChange,
      onRenderProgressChange,
      onDragRelease,
      onDragCommit,
      onDragReset,
      onDraggingChange,
      resolveDragProgress,
      getTimelineDuration,
      sceneTransitionDuration,
      setIsAnimating,
      setSceneState,
      completeReleaseImmediately,
      thresholdConfig,
    ]
  );

  return {
    handleDragStart,
    handlePan,
    handlePanEnd,
  };
}
