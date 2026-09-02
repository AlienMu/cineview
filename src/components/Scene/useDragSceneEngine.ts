import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { animate, type AnimationControls, type MotionValue, type PanInfo } from 'framer-motion';
import type { DragReleaseInput } from '../../hooks/useSceneManager';
import type { DragThresholdConfig, ScrollMode } from '../../types';
import type { DragRenderLane, DragTakeoverSnapshot, SceneState } from './types';

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
  /**
   * Synchronous candidate preflight. The owner must atomically validate the
   * direction and establish any frozen transaction before returning true.
   */
  onOwnershipRequest?: (direction: 'forward' | 'backward') => boolean;
  /** Internal-only reversible candidate suspension state. Returns whether an element continuation exists. */
  onCandidateSuspensionChange?: (suspended: boolean) => boolean;
  /** Authoritative rush re-grab baseline shared with the target element track. */
  takeoverSnapshot?: MutableRefObject<DragTakeoverSnapshot | null>;
  onDraggingChange?: (dragging: boolean) => void;
  // Two-track model: the outgoing scene's release publishes ONE read-only release
  // directive. Each incoming Scene's useElementTrack reacts to it.
  onDragRelease?: (release: DragReleaseInput | null) => void;
  /**
   * CineView-owned shared render-lane slot (D-F1/D-F7). When provided, the
   * settle page-slide / bounce tween this engine creates is registered globally
   * so a NEW gesture starting on any other scene's engine can take it over (a
   * rush re-grab mid-slide lands the pointerdown on whichever scene covers the
   * touch point — usually the INCOMING one — which is a different engine than
   * the one that owns the in-flight lane). Falls back to an engine-local slot
   * for standalone scenes.
   */
  renderLaneRef?: MutableRefObject<DragRenderLane | null>;
  completeReleaseImmediately?: boolean;
  onDragEnd?: (
    direction: 'forward' | 'backward',
    progressRatio: number,
    elapsedMs: number,
    timelineDuration?: number
  ) => void;
  onDragReset?: () => void;
}

interface UseDragSceneEngineResult {
  handleCandidateSuspend: () => boolean;
  handleCandidateResume: () => void;
  handleDragStart: (direction: 'forward' | 'backward') => boolean;
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
  onOwnershipRequest,
  onCandidateSuspensionChange,
  takeoverSnapshot,
  onDraggingChange,
  onDragRelease,
  renderLaneRef,
  completeReleaseImmediately = false,
  onDragEnd,
  onDragReset,
  thresholdConfig,
}: UseDragSceneEngineParams): UseDragSceneEngineResult {
  const lastPanBucketRef = useRef<number | null>(null);
  const lastRenderReleaseBucketRef = useRef<number | null>(null);
  const releaseTokenRef = useRef(0);
  // Single render-lane slot: shared (CineView) when provided, local otherwise.
  const localRenderLaneRef = useRef<DragRenderLane | null>(null);
  const laneRef = renderLaneRef ?? localRenderLaneRef;
  // D-F1: gesture OWNERSHIP, not isActive, gates handlePan/handlePanEnd. A
  // rush re-grab is accepted by whichever scene's engine the pointerdown lands
  // on (possibly a non-active incoming scene mid-transition, D-F7) — the
  // pointer-captured gesture must keep driving the global render lane
  // regardless of this scene's active flag (fresh currentSceneIndex arrives
  // through re-rendered closures).
  const ownsGestureRef = useRef(false);
  // D-F7: rush re-grab takeover. A pointerdown while a render lane is in
  // flight STOPS the lane where it is and continues the gesture from the
  // frozen render position — never a flush-commit (which teleports the whole
  // stack by the remaining progress in one frame) and never a dead grab (which
  // snaps the accumulated offset in one frame at the natural commit). The
  // frozen position is the pan baseline: progress = base + finger delta.
  const gestureBaseProgressRef = useRef(0);
  // Native/Framer pointer candidates suspend before requesting ownership. Keep
  // that distinction explicit: a real candidate must seed from the lane's
  // synchronous frozen value, while legacy/direct hook callers that invoke
  // handleDragStart without the candidate phase retain the latest React render
  // snapshot as their baseline.
  const candidateRenderSuspendedRef = useRef(false);
  // True while the current gesture took over an in-flight transition; the
  // tiny-progress release path uses it to publish the bounce rewind for the
  // abandoned transition (a takeover scrubbed back to exactly 0).
  const gestureTookOverRef = useRef(false);
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
  // The lane is only torn down when THIS engine created it — the slot is
  // shared, and an unrelated engine's in-flight lane must survive this
  // scene's unmount (window pruning at offset ±2).
  useEffect(() => {
    return (): void => {
      releaseTokenRef.current += 1;
      const lane = laneRef.current;
      if (lane && lane.ownerSceneIndex === sceneIndex) {
        lane.stop();
        laneRef.current = null;
      }
      ownsGestureRef.current = false;
      candidateRenderSuspendedRef.current = false;
    };
  }, [laneRef, sceneIndex]);

  const handleCandidateSuspend = useCallback((): boolean => {
    if (slideMode !== 'drag') return false;
    const lane = laneRef.current;
    const renderSuspended = Boolean(lane?.suspend);
    candidateRenderSuspendedRef.current = renderSuspended;
    lane?.suspend?.();
    const elementSuspended = onCandidateSuspensionChange?.(true) ?? false;
    return renderSuspended || elementSuspended;
  }, [laneRef, onCandidateSuspensionChange, slideMode]);

  const handleCandidateResume = useCallback((): void => {
    laneRef.current?.resume?.();
    candidateRenderSuspendedRef.current = false;
    onCandidateSuspensionChange?.(false);
  }, [laneRef, onCandidateSuspensionChange]);

  const handleDragStart = useCallback(
    (direction: 'forward' | 'backward'): boolean => {
      if (slideMode !== 'drag') return false;
      // Acceptance (D-F7): the active scene always accepts; a NON-active scene
      // accepts only while a render lane is in flight — a rush re-grab
      // mid-transition physically lands on whichever scene covers the touch
      // point (usually the incoming one), and that grab must take over the
      // transition instead of dying. At rest, inactive scenes still reject.
      const lane = laneRef.current;
      if (!isActive && !lane) return false;

      // Candidate preflight is deliberately before every ownership side effect:
      // a rejected direction must not stop an in-flight lane, seed progress,
      // set global dragging, or suppress the originating tap/click.
      if (onOwnershipRequest && !onOwnershipRequest(direction)) return false;

      const base = lane
        ? candidateRenderSuspendedRef.current
          ? (lane.getCurrent?.() ?? globalRenderProgress)
          : globalRenderProgress
        : globalRenderProgress;
      const snapshot = takeoverSnapshot?.current;
      if (snapshot && snapshot.baseRatio === null) {
        takeoverSnapshot.current = { ...snapshot, baseRatio: Math.abs(base) };
      }

      // Ownership is the irreversible boundary for BOTH render-lane and
      // element-only holds. Publish the authoritative cross-lane base above
      // before clearing the reversible candidate state: React may commit
      // isDragging before the base ratio state update reaches the target Scene.
      onCandidateSuspensionChange?.(false);

      if (lane) {
        // Ownership is the irreversible boundary. Pointer-down only suspended
        // this continuation; a successful directional gate now permanently
        // preempts it and transfers the frozen frame to the finger.
        if (lane.preempt) lane.preempt();
        else lane.stop();
        laneRef.current = null;
        candidateRenderSuspendedRef.current = false;
        gestureBaseProgressRef.current = base;
        gestureTookOverRef.current = true;
        dragProgressMotion.set(base);
        onDragProgressChange?.(base);
        onDragTimelineProgressChange?.(Math.abs(base));
        /* @__PURE__ */ debugDrag(
          `🫳 [Scene ${sceneIndex}] take over in-flight ${lane.kind} lane`,
          {
            base: base.toFixed(3),
          }
        );
      } else {
        gestureBaseProgressRef.current = 0;
        gestureTookOverRef.current = false;
      }

      // From here the gesture belongs to THIS engine until handlePanEnd (or
      // unmount) — even if this scene deactivates mid-gesture.
      ownsGestureRef.current = true;

      /* @__PURE__ */ debugDrag(`🫳 [Scene ${sceneIndex}] drag start`, {
        direction,
        currentSceneIndex,
        totalScenes,
        dragProgress: globalDragProgress.toFixed(3),
        dragTimelineProgress: globalDragTimelineProgress.toFixed(3),
      });
      onDraggingChange?.(true);
      return true;
    },
    [
      slideMode,
      isActive,
      laneRef,
      onOwnershipRequest,
      dragProgressMotion,
      onDragProgressChange,
      onDragTimelineProgressChange,
      onDraggingChange,
      sceneIndex,
      currentSceneIndex,
      totalScenes,
      globalDragProgress,
      globalDragTimelineProgress,
      globalRenderProgress,
      onCandidateSuspensionChange,
      takeoverSnapshot,
    ]
  );

  const handlePan = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (slideMode !== 'drag') return;
      // Ownership OR isActive: a gesture continued past a flush-commit keeps
      // panning through this (now inactive) engine; a plain active scene keeps
      // the historical isActive gate (direct hook callers / framer path).
      if (!isActive && !ownsGestureRef.current) return;

      const offset = slideDirection === 'y' ? info.offset.y : info.offset.x;
      const viewportSize = slideDirection === 'y' ? window.innerHeight : window.innerWidth;
      // D-F7: the gesture baseline is the frozen render position of a
      // taken-over transition (0 for a normal from-rest drag) — the pan
      // continues from where the page visually froze, never from a fresh 0.
      const progress = resolveDragProgress(gestureBaseProgressRef.current - offset / viewportSize);
      const timelineProgress = Math.abs(progress);

      // Render lane only: page translate + the drag ratio. The element timeline is
      // NOT written here — the incoming scene's useElementTrack pegs its own track
      // to r * T_self off `dragTimelineProgress`. Single writer per track.
      dragProgressMotion.set(progress);
      onDragProgressChange?.(progress);
      onDragTimelineProgressChange?.(timelineProgress);
      onRenderProgressChange?.(progress);

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
      dragProgressMotion,
      resolveDragProgress,
    ]
  );

  const handlePanEnd = useCallback(
    (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (slideMode !== 'drag') return;
      if (!isActive && !ownsGestureRef.current) return;
      ownsGestureRef.current = false;

      // D-F5: pointercancel is a SYSTEM interruption (incoming call, browser
      // gesture takeover, notification shade) — the user did not release with
      // intent. Cancel semantics: never run the threshold decision / commit;
      // force the bounce-back path so both tracks return to rest and the
      // onDragCancel callback fires (via the bounce release -> onDragReset).
      const isPointerCancel = event.type === 'pointercancel';

      releaseTokenRef.current += 1;
      laneRef.current?.stop();
      laneRef.current = null;

      const currentProgress = dragProgressMotion.get();
      const timelineDuration = getTimelineDuration();
      const signedProgressVelocity = resolveProgressVelocity(slideDirection, info);
      const velocity = Math.abs(signedProgressVelocity);
      const absFinalProgress = Math.abs(currentProgress);

      const launchRenderBounce = (duration: number, onComplete: () => void): void => {
        let bounceControls: { stop: () => void } | null = null;
        let laneProgress = dragProgressMotion.get();
        let laneArm = 0;
        let suspended = false;
        let preempted = false;
        const secondsPerProgress = duration / Math.max(Math.abs(laneProgress), 0.000001);

        const completeBounce = (): void => {
          if (preempted || suspended || laneRef.current !== bounceLane) return;
          laneRef.current = null;
          bounceControls?.stop();
          laneProgress = 0;
          dragProgressMotion.set(0);
          onDragProgressChange?.(0);
          onDragTimelineProgressChange?.(0);
          onRenderProgressChange?.(0);
          onComplete();
        };

        const startBounceArm = (): void => {
          if (preempted || suspended || laneRef.current !== bounceLane) return;
          const remainingDuration = Math.abs(laneProgress) * secondsPerProgress;
          if (remainingDuration <= 0.000001) {
            completeBounce();
            return;
          }
          const arm = ++laneArm;
          bounceControls = animate(dragProgressMotion, 0, {
            duration: remainingDuration,
            ease: 'easeOut',
            onUpdate: (latest) => {
              if (arm !== laneArm || preempted || suspended) return;
              laneProgress = latest;
              dragProgressMotion.set(latest);
              onDragProgressChange?.(latest);
              onDragTimelineProgressChange?.(Math.abs(latest));
              onRenderProgressChange?.(latest);
            },
            onComplete: () => {
              if (arm !== laneArm) return;
              laneProgress = 0;
              completeBounce();
            },
          });
        };

        const permanentlyStopBounce = (): void => {
          preempted = true;
          suspended = false;
          laneArm += 1;
          bounceControls?.stop();
        };
        const bounceLane: DragRenderLane = {
          kind: 'bounce',
          ownerSceneIndex: sceneIndex,
          stop: permanentlyStopBounce,
          suspend: () => {
            if (preempted || suspended) return;
            laneProgress = dragProgressMotion.get();
            suspended = true;
            laneArm += 1;
            bounceControls?.stop();
          },
          resume: () => {
            if (preempted || !suspended) return;
            laneProgress = dragProgressMotion.get();
            suspended = false;
            startBounceArm();
          },
          preempt: permanentlyStopBounce,
          getCurrent: () => laneProgress,
        };

        laneRef.current = bounceLane;
        startBounceArm();
      };

      if (absFinalProgress < 0.001) {
        /* @__PURE__ */ debugDrag(`🫳 [Scene ${sceneIndex}] drag end -> reset (tiny progress)`, {
          currentProgress: currentProgress.toFixed(3),
        });
        // D-F1: onDragReset maps to resetDragInteraction, which PRESERVES an
        // unfinished POST-COMMIT settle join (live `dragRelease` + join refs)
        // — a tap after the commit must not snap the mid-enter continuation
        // to terminal.
        // D-F7: a takeover gesture that scrubbed the page back to exactly 0
        // ABANDONS the taken-over transition pre-commit. Publish the bounce
        // rewind so the would-be incoming scene's element track returns to 0
        // (its enter continuation was preempted mid-way and has no other
        // writer left).
        //
        // Ordering matters and is the REVERSE of the normal bounce path. There,
        // the reset runs in the bounce tween's onComplete — a later batch — so
        // publish-then-reset is safe. Here both land in ONE synchronous batch:
        // this is an ABANDON (no commit happened, so resetDragInteraction sees
        // no outstanding settle join) and it therefore clears `dragRelease`.
        // Publishing first would have that clear swallow the rewind and leave
        // the incoming elements frozen mid-enter. Resetting FIRST lets the
        // rewind be the batch's final value.
        onDragReset?.();
        if (gestureTookOverRef.current) {
          const abandonedDirection: 'forward' | 'backward' =
            gestureBaseProgressRef.current >= 0 ? 'forward' : 'backward';
          onDragRelease?.({
            mode: 'bounce',
            direction: abandonedDirection,
            targetSceneIndex:
              abandonedDirection === 'forward' ? currentSceneIndex + 1 : currentSceneIndex - 1,
          });
        }
        onDraggingChange?.(false);
        // Only stamp the state when this scene is still the active one — a
        // continued gesture ends on an already-deactivated engine (the
        // drag-mode sync effect owns that scene's state).
        if (isActive) {
          setSceneState('active');
        }
        return;
      }

      const direction: 'forward' | 'backward' = currentProgress > 0 ? 'forward' : 'backward';
      const targetSceneIndex =
        direction === 'forward' ? currentSceneIndex + 1 : currentSceneIndex - 1;

      if (resolveDragProgress(currentProgress) === 0 && currentProgress !== 0) {
        setIsAnimating(true);

        /* @__PURE__ */ debugDrag(
          `🫳 [Scene ${sceneIndex}] drag end -> blocked by boundary, bounce reset`,
          {
            currentProgress: currentProgress.toFixed(3),
            velocity: velocity.toFixed(1),
          }
        );

        // Pointer ownership ends at release, not when the bounce animation ends.
        // Keeping globalIsDragging true through the bounce prevents a candidate tap
        // from resuming a reversibly-suspended element continuation: the render lane
        // resumes directly, while useElementTrack correctly refuses to restart under
        // an allegedly live gesture. Clear the gesture owner before publishing the
        // two-track bounce; the public cancel still fires from onDragReset at rest.
        onDraggingChange?.(false);
        // Bounce both tracks back to 0 in parallel (I1). The render lane returns
        // via dragProgressMotion; the (would-be) incoming scene's element track
        // returns via the bounce release directive.
        onDragRelease?.({ mode: 'bounce', direction, targetSceneIndex });
        launchRenderBounce(0.15, () => {
          onDragReset?.();
          setSceneState('active');
          setIsAnimating(false);
        });
        return;
      }

      const threshold = completeReleaseImmediately
        ? 0.5
        : calculateThreshold(velocity, thresholdConfig);

      /* @__PURE__ */ debugDrag(`🎯 [Scene ${sceneIndex}] Threshold:`, {
        velocity: velocity.toFixed(1),
        threshold: threshold.toFixed(3),
        progress: absFinalProgress.toFixed(3),
        shouldSwitch: absFinalProgress > threshold,
      });

      const hasDirectionReversal =
        absFinalProgress > 0.001 && currentProgress * signedProgressVelocity < 0 && velocity > 600;
      // A cancelled pointer never commits, regardless of progress/velocity.
      const shouldSwitch =
        !isPointerCancel &&
        absFinalProgress > threshold &&
        (completeReleaseImmediately || !hasDirectionReversal);

      /* @__PURE__ */ debugDrag(`🫳 [Scene ${sceneIndex}] drag end decision`, {
        currentProgress: currentProgress.toFixed(3),
        absFinalProgress: absFinalProgress.toFixed(3),
        direction,
        threshold: threshold.toFixed(3),
        velocity: velocity.toFixed(1),
        signedProgressVelocity: signedProgressVelocity.toFixed(1),
        hasDirectionReversal,
        isPointerCancel,
        shouldSwitch,
        sceneTransitionDuration,
      });

      if (shouldSwitch) {
        setIsAnimating(true);
        onDraggingChange?.(false);
        if (completeReleaseImmediately) {
          // Standalone mode: no incoming-scene coordination. Commit at 100%
          // immediately (the local onDragEnd closure rests the element track).
          onDragEnd?.(direction, 1, timelineDuration, timelineDuration);
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

        let settleControls: { stop: () => void } | null = null;
        let laneProgress = currentProgress;
        let laneArm = 0;
        let suspended = false;
        let preempted = false;

        const commitRelease = (): void => {
          // Keep the same lane object across suspend/resume. A superseding
          // gesture clears the slot; a candidate suspension deliberately does not.
          if (preempted || suspended || laneRef.current !== settleLane) return;
          laneRef.current = null;
          settleControls?.stop();

          /* @__PURE__ */ debugDrag(
            `🫳 [Scene ${sceneIndex}] release page-slide complete -> commit`,
            {
              releaseToken,
              committedProgress: committedProgress.toFixed(3),
              direction,
              sceneTravelDurationMs: (sceneTravelDuration * 1000).toFixed(1),
            }
          );
          onDragEnd?.(
            direction,
            committedProgress,
            committedProgress * timelineDuration,
            timelineDuration
          );
          onRenderProgressChange?.(0);
          setIsAnimating(false);
        };

        const startSettleArm = (): void => {
          if (preempted || suspended || laneRef.current !== settleLane) return;
          const remainingDuration =
            Math.abs(targetProgress - laneProgress) * (slideDuration / 1000);
          if (remainingDuration <= 0.000001) {
            commitRelease();
            return;
          }
          const arm = ++laneArm;
          settleControls = animate(laneProgress, targetProgress, {
            duration: remainingDuration,
            ease: 'easeOut',
            onUpdate: (latest) => {
              if (
                arm !== laneArm ||
                preempted ||
                suspended ||
                releaseTokenRef.current !== releaseToken
              ) {
                return;
              }
              laneProgress = latest;
              if (Math.abs(latest - targetProgress) > 0.000001) {
                dragProgressMotion.set(latest);
              }
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
              if (arm !== laneArm) return;
              laneProgress = targetProgress;
              commitRelease();
            },
          });
        };

        const permanentlyStopSettle = (): void => {
          preempted = true;
          suspended = false;
          laneArm += 1;
          settleControls?.stop();
        };
        const settleLane: DragRenderLane = {
          kind: 'settle',
          ownerSceneIndex: sceneIndex,
          stop: permanentlyStopSettle,
          suspend: () => {
            if (preempted || suspended) return;
            suspended = true;
            laneArm += 1;
            settleControls?.stop();
          },
          resume: () => {
            if (preempted || !suspended) return;
            suspended = false;
            startSettleArm();
          },
          preempt: permanentlyStopSettle,
          getCurrent: () => laneProgress,
        };

        /* @__PURE__ */ debugDrag(`🫳 [Scene ${sceneIndex}] release scene-travel`, {
          releaseToken,
          fromProgress: currentProgress.toFixed(3),
          sceneTravelDurationMs: (sceneTravelDuration * 1000).toFixed(1),
          committedProgress: committedProgress.toFixed(3),
          timelineDuration,
        });

        // Keep this object in the shared slot for its whole suspend/resume life.
        laneRef.current = settleLane;
        startSettleArm();
      } else {
        setIsAnimating(true);
        // D-F2: the render-lane bounce runs on the SCENE-TRANSITION timescale
        // (same slideDuration source as the settle path), NOT the element
        // timeline T_self — a long authored timeline (site T_self ≈ 6.5s) must
        // not stretch the page bounce. Capped at 300ms to stay in sync with the
        // element track's bounce cap (useElementTrack release-bounce branch).
        const duration = Math.min(absFinalProgress * slideDuration, 300) / 1000;

        /* @__PURE__ */ debugDrag(`🫳 [Scene ${sceneIndex}] release bounce-back`, {
          fromProgress: currentProgress.toFixed(3),
          slideDuration,
          durationMs: (duration * 1000).toFixed(1),
        });

        // The pointer session has ended even though its visual rollback remains in
        // flight. Release gesture ownership now so a candidate tap can suspend and
        // resume BOTH bounce lanes; onDragReset still emits the terminal cancel only
        // after the rollback reaches rest.
        onDraggingChange?.(false);
        // Bounce both tracks back to 0 in parallel (I1).
        onDragRelease?.({ mode: 'bounce', direction, targetSceneIndex });
        launchRenderBounce(duration, () => {
          onDragReset?.();
          setIsAnimating(false);
        });
      }
    },
    [
      slideMode,
      isActive,
      laneRef,
      slideDirection,
      sceneIndex,
      currentSceneIndex,
      slideDuration,
      dragProgressMotion,
      onDragProgressChange,
      onDragTimelineProgressChange,
      onRenderProgressChange,
      onDragRelease,
      onDragEnd,
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
    handleCandidateSuspend,
    handleCandidateResume,
    handleDragStart,
    handlePan,
    handlePanEnd,
  };
}
