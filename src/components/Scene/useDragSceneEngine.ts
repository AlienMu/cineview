import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { animate, type AnimationControls, type MotionValue, type PanInfo } from 'framer-motion';
import type { DragTransitionSnapshot } from '../../hooks/useSceneManager';
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

function calculateThreshold(velocity: number): number {
  if (!Number.isFinite(velocity)) {
    return 0.3;
  }

  const MIN_VELOCITY = 0;
  const MAX_VELOCITY = 1000;
  const MIN_THRESHOLD = 0.15;
  const MAX_THRESHOLD = 0.3;
  const clampedVelocity = Math.max(MIN_VELOCITY, Math.min(MAX_VELOCITY, velocity));
  return MAX_THRESHOLD - (clampedVelocity / MAX_VELOCITY) * (MAX_THRESHOLD - MIN_THRESHOLD);
}

function resolveProgressVelocity(slideDirection: 'x' | 'y', info: PanInfo): number {
  const axisVelocity = slideDirection === 'y' ? info.velocity.y : info.velocity.x;
  return Number.isFinite(axisVelocity) ? -axisVelocity : 0;
}

interface UseDragSceneEngineParams {
  slideMode: 'snap' | 'drag' | 'scroll';
  isActive: boolean;
  sceneIndex: number;
  currentSceneIndex: number;
  totalScenes: number;
  slideDirection: 'x' | 'y';
  slideDuration: number;
  sceneTransitionDuration: number;
  sceneOffset: number;
  sceneState: SceneState;
  globalDirection: 'forward' | 'backward' | null;
  globalRenderProgress: number;
  globalIsDragging: boolean;
  globalDragProgress: number;
  globalSharedElapsedMs: number;
  globalDragTimelineProgress: number;
  globalDragTransitionSnapshot: DragTransitionSnapshot | null;
  controls: AnimationControls;
  dragProgressMotion: MotionValue<number>;
  sharedElapsedMotion: MotionValue<number>;
  setSceneState: Dispatch<SetStateAction<SceneState>>;
  setIsAnimating: Dispatch<SetStateAction<boolean>>;
  resolveDragProgress: (rawProgress: number) => number;
  getTimelineDuration: () => number;
  onActivationComplete?: () => void;
  onDragProgressChange?: (progress: number) => void;
  onRenderProgressChange?: (progress: number) => void;
  onDragTimelineProgressChange?: (progress: number) => void;
  onSharedElapsedMsChange?: (elapsedMs: number) => void;
  onDraggingChange?: (dragging: boolean) => void;
  onSharedTimelineDurationChange?: (duration: number) => void;
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
  globalSharedElapsedMs,
  globalDragTimelineProgress,
  globalDragTransitionSnapshot,
  controls,
  dragProgressMotion,
  sharedElapsedMotion,
  setSceneState,
  setIsAnimating,
  resolveDragProgress,
  getTimelineDuration,
  onActivationComplete,
  onDragProgressChange,
  onRenderProgressChange,
  onDragTimelineProgressChange,
  onSharedElapsedMsChange,
  onDraggingChange,
  onSharedTimelineDurationChange,
  completeReleaseImmediately = false,
  onDragCommit,
  onDragReset,
}: UseDragSceneEngineParams): UseDragSceneEngineResult {
  const lastPanBucketRef = useRef<number | null>(null);
  const lastRenderReleaseBucketRef = useRef<number | null>(null);
  const lastTimelineReleaseBucketRef = useRef<number | null>(null);
  const releaseTokenRef = useRef(0);
  const timelineReleaseControlsRef = useRef<{ stop: () => void } | null>(null);
  const renderReleaseControlsRef = useRef<{ stop: () => void } | null>(null);
  const activationSettleControlsRef = useRef<{ stop: () => void } | null>(null);
  const activeSettleKeyRef = useRef<string | null>(null);
  const latestReleaseElapsedRef = useRef(0);

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
    const ownTimelineDuration = getTimelineDuration();
    const pendingActivationProgress =
      globalDragTransitionSnapshot?.toScene === sceneIndex
        ? Math.max(0, Math.min(globalDragTransitionSnapshot.progressRatio, 1))
        : ownTimelineDuration > 0
          ? Math.max(0, Math.min(globalSharedElapsedMs / ownTimelineDuration, 1))
          : 0;
    const hasPendingActivation =
      isActive &&
      !globalIsDragging &&
      globalDragTransitionSnapshot?.toScene === sceneIndex &&
      pendingActivationProgress > 0.001 &&
      pendingActivationProgress < 0.999;
    const isTransitioning = globalIsDragging || absProgress > 0.001;
    const dragDirection = progress > 0 ? 'forward' : progress < 0 ? 'backward' : globalDirection;
    const isIncomingScene =
      (dragDirection === 'forward' && sceneOffset === 1) ||
      (dragDirection === 'backward' && sceneOffset === -1);

    const nextSceneState: SceneState = isActive
      ? isTransitioning
        ? 'exiting'
        : hasPendingActivation
          ? 'entering'
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
    globalDragTransitionSnapshot,
    globalSharedElapsedMs,
    sceneOffset,
    getTimelineDuration,
    globalDirection,
    setSceneState,
  ]);

  useEffect(() => {
    if (slideMode !== 'drag' || !isActive || globalIsDragging) return;
    const snapshot = globalDragTransitionSnapshot;
    if (!snapshot || snapshot.toScene !== sceneIndex) return;

    const timelineDuration = getTimelineDuration();
    const progressRatio = Math.max(0, Math.min(snapshot.progressRatio, 1));
    const sharedElapsedMs = Math.max(0, progressRatio * timelineDuration);
    if (sharedElapsedMs <= 0.001 || sharedElapsedMs >= timelineDuration - 0.001) return;
    const settleKey = [
      snapshot.fromScene,
      snapshot.toScene,
      snapshot.direction,
      Math.round(snapshot.sharedElapsedMs),
      Math.round(snapshot.sharedTimelineDurationMs),
      timelineDuration,
    ].join(':');

    if (activeSettleKeyRef.current === settleKey && activationSettleControlsRef.current) {
      if (isVerboseDragDebug()) {
        console.log(`🎬 [Scene ${sceneIndex}] activation settle skip (already owned)`, {
          settleKey,
          sharedElapsedMs: sharedElapsedMs.toFixed(1),
          timelineDuration,
          ownerScene: snapshot.toScene,
        });
      }
      return;
    }

    const remainingDuration = Math.max(timelineDuration - sharedElapsedMs, 0);

    activationSettleControlsRef.current?.stop();
    activeSettleKeyRef.current = settleKey;
    sharedElapsedMotion.set(sharedElapsedMs);
    onSharedElapsedMsChange?.(sharedElapsedMs);

    debugDrag(`🎬 [Scene ${sceneIndex}] activation settle timer`, {
      settleKey,
      snapshotFromScene: snapshot.fromScene,
      snapshotToScene: snapshot.toScene,
      snapshotElapsedMs: snapshot.sharedElapsedMs.toFixed(1),
      snapshotTimelineDurationMs: snapshot.sharedTimelineDurationMs,
      snapshotProgressRatio: progressRatio.toFixed(3),
      projectedSceneElapsedMs: sharedElapsedMs.toFixed(1),
      sharedElapsedMs: sharedElapsedMs.toFixed(1),
      remainingDurationMs: remainingDuration.toFixed(1),
      timelineDuration,
      sceneState,
    });

    activationSettleControlsRef.current = animate(sharedElapsedMotion, timelineDuration, {
      duration: remainingDuration / 1000,
      ease: 'linear',
      onUpdate: (latest) => {
        onSharedElapsedMsChange?.(latest);
      },
      onComplete: () => {
        debugDrag(`🎬 [Scene ${sceneIndex}] activation settle complete`, {
          settleKey,
          finalElapsedMs: timelineDuration.toFixed(1),
          timelineDuration,
        });
        activationSettleControlsRef.current = null;
        activeSettleKeyRef.current = null;
        onSharedElapsedMsChange?.(timelineDuration);
        onActivationComplete?.();
      },
    });

    return () => {
      if (globalDragTransitionSnapshot?.toScene !== sceneIndex) {
        debugDrag(`🎬 [Scene ${sceneIndex}] activation settle cleanup (ownership lost)`, {
          settleKey,
          latestSharedElapsedMs: globalSharedElapsedMs.toFixed(1),
          currentSnapshotToScene: globalDragTransitionSnapshot?.toScene ?? null,
        });
        activationSettleControlsRef.current?.stop();
        activationSettleControlsRef.current = null;
        activeSettleKeyRef.current = null;
      }
    };
  }, [
    slideMode,
    isActive,
    globalIsDragging,
    globalDragTransitionSnapshot,
    globalSharedElapsedMs,
    getTimelineDuration,
    onActivationComplete,
    onSharedElapsedMsChange,
    sceneIndex,
    sceneState,
    sharedElapsedMotion,
  ]);

  const handleDragStart = useCallback(() => {
    if (slideMode !== 'drag' || !isActive) return;

    const hasPendingSnapshot = !!globalDragTransitionSnapshot;
    const hasResidualElapsed = globalSharedElapsedMs > 0.001;

    if (hasPendingSnapshot || hasResidualElapsed) {
      const timelineDuration = getTimelineDuration();
      const completedElapsedMs =
        timelineDuration > 0 ? timelineDuration : Math.max(globalSharedElapsedMs, 0);

      activationSettleControlsRef.current?.stop();
      activationSettleControlsRef.current = null;
      activeSettleKeyRef.current = null;
      dragProgressMotion.set(0);
      sharedElapsedMotion.set(completedElapsedMs);
      onDragProgressChange?.(0);
      onDragTimelineProgressChange?.(0);
      onRenderProgressChange?.(0);
      onSharedElapsedMsChange?.(completedElapsedMs);
      onActivationComplete?.();

      debugDrag(`🧹 [Scene ${sceneIndex}] interrupt pending drag transition on new drag start`, {
        hadSnapshot: hasPendingSnapshot,
        residualElapsedMs: globalSharedElapsedMs.toFixed(1),
        completedElapsedMs: completedElapsedMs.toFixed(1),
        snapshotFromScene: globalDragTransitionSnapshot?.fromScene ?? null,
        snapshotToScene: globalDragTransitionSnapshot?.toScene ?? null,
      });
    }

    debugDrag(`🫳 [Scene ${sceneIndex}] drag start`, {
      currentSceneIndex,
      totalScenes,
      sharedElapsedMs: globalSharedElapsedMs.toFixed(1),
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
    globalSharedElapsedMs,
    globalDragProgress,
    globalDragTimelineProgress,
    globalDragTransitionSnapshot,
    onDragProgressChange,
    onDragTimelineProgressChange,
    onRenderProgressChange,
    onSharedElapsedMsChange,
    onActivationComplete,
    dragProgressMotion,
    sharedElapsedMotion,
    getTimelineDuration,
  ]);

  const handlePan = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (slideMode !== 'drag' || !isActive) return;

      const offset = slideDirection === 'y' ? info.offset.y : info.offset.x;
      const viewportSize = slideDirection === 'y' ? window.innerHeight : window.innerWidth;
      const progress = resolveDragProgress(-offset / viewportSize);
      const timelineDuration = getTimelineDuration();
      const sharedElapsedMs = Math.abs(progress) * timelineDuration;
      const timelineProgress = Math.abs(progress);

      onDragProgressChange?.(progress);
      onDragTimelineProgressChange?.(timelineProgress);
      onRenderProgressChange?.(progress);
      onSharedElapsedMsChange?.(sharedElapsedMs);
      onSharedTimelineDurationChange?.(timelineDuration);
      dragProgressMotion.set(progress);
      sharedElapsedMotion.set(sharedElapsedMs);

      if (isVerboseDragDebug()) {
        const bucket = Math.round(Math.abs(progress) * 10) / 10;
        if (lastPanBucketRef.current !== bucket) {
          lastPanBucketRef.current = bucket;
          console.log(`🫳 [Scene ${sceneIndex}] drag progress`, {
            progress: progress.toFixed(3),
            timelineProgress: timelineProgress.toFixed(3),
            sharedElapsedMs: sharedElapsedMs.toFixed(1),
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
      onSharedElapsedMsChange,
      onSharedTimelineDurationChange,
      dragProgressMotion,
      sharedElapsedMotion,
      resolveDragProgress,
      getTimelineDuration,
    ]
  );

  const handlePanEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (slideMode !== 'drag' || !isActive) return;

      releaseTokenRef.current += 1;
      timelineReleaseControlsRef.current?.stop();
      renderReleaseControlsRef.current?.stop();

      const currentProgress = dragProgressMotion.get();
      const timelineDuration = getTimelineDuration();
      const currentElapsedMs = Math.abs(currentProgress) * timelineDuration;
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

      if (resolveDragProgress(currentProgress) === 0 && currentProgress !== 0) {
        setIsAnimating(true);

        debugDrag(`🫳 [Scene ${sceneIndex}] drag end -> blocked by boundary, bounce reset`, {
          currentProgress: currentProgress.toFixed(3),
          velocity: velocity.toFixed(1),
        });

        animate(dragProgressMotion, 0, {
          duration: 0.15,
          ease: 'easeOut',
          onUpdate: (latest) => {
            const elapsedMs = Math.abs(latest) * timelineDuration;
            onDragProgressChange?.(latest);
            onDragTimelineProgressChange?.(Math.abs(latest));
            onRenderProgressChange?.(latest);
            onSharedElapsedMsChange?.(elapsedMs);
            sharedElapsedMotion.set(elapsedMs);
          },
          onComplete: () => {
            onDragProgressChange?.(0);
            onDragTimelineProgressChange?.(0);
            onRenderProgressChange?.(0);
            onSharedElapsedMsChange?.(0);
            dragProgressMotion.set(0);
            sharedElapsedMotion.set(0);
            onDragReset?.();
            onDraggingChange?.(false);
            setSceneState('active');
            setIsAnimating(false);
          },
        });
        return;
      }

      const direction: 'forward' | 'backward' = currentProgress > 0 ? 'forward' : 'backward';
      const threshold = completeReleaseImmediately ? 0.5 : calculateThreshold(velocity);

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
        currentElapsedMs: currentElapsedMs.toFixed(1),
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
          onDragCommit?.(direction, 1, timelineDuration, timelineDuration);
          setIsAnimating(false);
          return;
        }

        const releaseToken = ++releaseTokenRef.current;
        const targetProgress = direction === 'forward' ? 1 : -1;
        const remainingProgress = Math.abs(targetProgress - currentProgress);
        const sceneTravelDuration = remainingProgress * (slideDuration / 1000);
        const targetElapsedMs = timelineDuration;
        const remainingElapsedMs = Math.max(targetElapsedMs - currentElapsedMs, 0);
        const timelineRemainingDuration = remainingElapsedMs / 1000;

        debugDrag(`🫳 [Scene ${sceneIndex}] release scene-travel`, {
          releaseToken,
          fromProgress: currentProgress.toFixed(3),
          fromElapsedMs: currentElapsedMs.toFixed(1),
          sceneTravelDurationMs: (sceneTravelDuration * 1000).toFixed(1),
          timelineDuration,
          timelineRemainingDurationMs: (timelineRemainingDuration * 1000).toFixed(1),
        });

        latestReleaseElapsedRef.current = currentElapsedMs;
        timelineReleaseControlsRef.current = animate(sharedElapsedMotion, targetElapsedMs, {
          duration: timelineRemainingDuration,
          ease: 'linear',
          onUpdate: (latest) => {
            if (releaseTokenRef.current !== releaseToken) return;
            const normalizedProgress = timelineDuration > 0 ? latest / timelineDuration : 0;
            const signedTimelineProgress =
              direction === 'forward' ? normalizedProgress : -normalizedProgress;
            latestReleaseElapsedRef.current = latest;
            onDragProgressChange?.(signedTimelineProgress);
            onDragTimelineProgressChange?.(normalizedProgress);
            onSharedElapsedMsChange?.(latest);
            dragProgressMotion.set(signedTimelineProgress);
            if (isVerboseDragDebug()) {
              const bucket = Math.round(Math.abs(normalizedProgress) * 10) / 10;
              if (lastTimelineReleaseBucketRef.current !== bucket) {
                lastTimelineReleaseBucketRef.current = bucket;
                console.log(`🧵 [Scene ${sceneIndex}] release timeline tick`, {
                  releaseToken,
                  progress: normalizedProgress.toFixed(3),
                  sharedElapsedMs: latest.toFixed(1),
                  bucket: bucket.toFixed(1),
                  direction,
                });
              }
            }
          },
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
            if (releaseTokenRef.current !== releaseToken) return;
            timelineReleaseControlsRef.current?.stop();
            renderReleaseControlsRef.current?.stop();
            activationSettleControlsRef.current?.stop();
            activationSettleControlsRef.current = null;
            activeSettleKeyRef.current = null;
            const committedElapsedMs = Math.max(
              0,
              Math.min(latestReleaseElapsedRef.current, timelineDuration)
            );
            const committedProgress =
              timelineDuration > 0 ? committedElapsedMs / timelineDuration : 0;
            dragProgressMotion.set(targetProgress);
            sharedElapsedMotion.set(committedElapsedMs);
            debugDrag(`🫳 [Scene ${sceneIndex}] scene travel complete -> commit`, {
              releaseToken,
              committedElapsedMs: committedElapsedMs.toFixed(1),
              committedProgress: committedProgress.toFixed(3),
              direction,
              timelineDuration,
              renderProgressAtCommit: targetProgress.toFixed(3),
              latestTimelineElapsedMs: latestReleaseElapsedRef.current.toFixed(1),
              snapshotWillTransferToScene:
                direction === 'forward' ? sceneIndex + 1 : sceneIndex - 1,
            });
            onDragCommit?.(direction, committedProgress, committedElapsedMs, timelineDuration);
            onRenderProgressChange?.(0);
            setIsAnimating(false);
          },
        });
      } else {
        setIsAnimating(true);
        const duration = absFinalProgress * (timelineDuration / 1000) * 0.5;

        debugDrag(`🫳 [Scene ${sceneIndex}] release bounce-back`, {
          fromProgress: currentProgress.toFixed(3),
          fromElapsedMs: currentElapsedMs.toFixed(1),
          timelineDuration,
          durationMs: (duration * 1000).toFixed(1),
        });

        animate(dragProgressMotion, 0, {
          duration,
          ease: 'easeOut',
          onUpdate: (latest) => {
            const elapsedMs = Math.abs(latest) * timelineDuration;
            onDragProgressChange?.(latest);
            onDragTimelineProgressChange?.(Math.abs(latest));
            onRenderProgressChange?.(latest);
            onSharedElapsedMsChange?.(elapsedMs);
            sharedElapsedMotion.set(elapsedMs);
          },
          onComplete: () => {
            onDragProgressChange?.(0);
            onDragTimelineProgressChange?.(0);
            onRenderProgressChange?.(0);
            onSharedElapsedMsChange?.(0);
            dragProgressMotion.set(0);
            sharedElapsedMotion.set(0);
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
      slideDuration,
      dragProgressMotion,
      sharedElapsedMotion,
      onDragProgressChange,
      onDragTimelineProgressChange,
      onRenderProgressChange,
      onSharedElapsedMsChange,
      onDragCommit,
      onDragReset,
      onDraggingChange,
      resolveDragProgress,
      getTimelineDuration,
      sceneTransitionDuration,
      setIsAnimating,
      setSceneState,
      completeReleaseImmediately,
    ]
  );

  return {
    handleDragStart,
    handlePan,
    handlePanEnd,
  };
}
