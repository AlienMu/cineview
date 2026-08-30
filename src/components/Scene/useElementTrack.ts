import { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { animate, type MotionValue } from 'framer-motion';
import type { ScrollMode } from '../../types';
import type { DragRelease } from '../../hooks/useSceneManager';
import {
  DEFAULT_DRAG_TIMELINE_CONFIG,
  mapDragPercentToElapsed,
  type ResolvedDragTimelineConfig,
} from '../../utils/dragTimelineMapping';
import type { DragSceneTransaction, PreparedSceneSnapshot } from './dragPreparedState';
import type { DragTakeoverSnapshot } from './types';

/**
 * useElementTrack — the per-scene element-timeline driver (two-track model,
 * 2026-06-25).
 *
 * SINGLE WRITER invariant: the scene's element track (`elementElapsedMotion`,
 * elapsed ms of ITS OWN enter timeline T = delay + duration) is written ONLY by
 * this hook, for this scene. There is no global element scalar and no cross-scene
 * write path. Across a drag commit the Scene instance is stable (`key={index}`,
 * window current±1), so an in-flight `animate()` on the track survives the commit
 * and continues uninterrupted — continuous completion, never a replay, never a
 * freeze.
 *
 * Four driver sources, mutually exclusive in time, all routed through one
 * controls ref so a new source preempts the previous one:
 *  - follow-finger: while dragging and this scene is incoming, elapsed = r * T.
 *  - release-settle: on a switch release targeting this scene, continue
 *    current -> T at NATURAL rate, in PARALLEL with the render lane.
 *  - release-bounce: on a non-switch release targeting this scene, return -> 0.
 *  - cold-start: scene 0's one-shot first-screen enter, 0 -> T at real-time rate,
 *    with extend-on-growth as the local registry duration grows.
 *
 * StrictMode/double-invoke safe: every animate()/stop() is token-guarded via
 * `releaseTokenRef`, and the cold-start runs at most once via `coldStartRanRef`.
 */

interface UseElementTrackParams {
  slideMode: ScrollMode;
  isActive: boolean;
  sceneIndex: number;
  sceneOffset: number;
  globalDirection: 'forward' | 'backward' | null;
  globalIsDragging: boolean;
  /** Internal re-grab candidate hold; no public drag session exists yet. */
  candidateSuspended?: boolean;
  /** Signed render position; its sign gives the live drag direction mid-drag. */
  globalRenderProgress: number;
  renderProgressMotion?: MotionValue<number>;
  /** r — the drag timeline ratio in [0, 1] (abs of the drag fraction). */
  globalDragTimelineProgress: number;
  dragTimelineProgressMotion?: MotionValue<number>;
  /** The single read-only release directive published by the outgoing scene. */
  dragRelease: DragRelease | null;
  /**
   * Cold-start START trigger for scene 0: turns true once first-screen priority
   * assets are ready (or are forced ready). Distinct from the window flag
   * `firstSceneEnterActive` (which holds the scene at its initial frame and is
   * read by useAnimateDrag): a true window with a false ready means "held at
   * initial, not yet entering" (pre-load and the preventDefault path).
   */
  firstSceneEnterReady: boolean;
  elementElapsedMotion: MotionValue<number>;
  getTimelineDuration: () => number;
  /** Registry-aware timeline duration trigger; retained for legacy direct hook callers. */
  timelineDurationState: number;
  /** CineView-owned immutable playback transaction for this target scene. */
  dragTransaction?: DragSceneTransaction | null;
  /** Latest stable local snapshot; captured once for cold-start/standalone playback. */
  preparedSnapshot?: PreparedSceneSnapshot | null;
  /** Scene calls require a prepared snapshot; direct legacy tests may omit it. */
  requirePreparedSnapshot?: boolean;
  /** Legacy mapping fallback used only when no frozen playback source exists. */
  dragMappingConfig?: ResolvedDragTimelineConfig;
  /** Authoritative rush re-grab baseline written synchronously at ownership. */
  takeoverSnapshot?: MutableRefObject<DragTakeoverSnapshot | null>;
  /** Synchronously reports whether a settle/bounce continuation can be suspended. */
  onElementContinuationChange?: (active: boolean) => void;
  /** Fired when the element track reaches T (settle / cold-start complete). */
  onSettleComplete?: () => void;
  onColdStartComplete?: () => void;
}

export interface ElementTrackCommands {
  completeImmediately: () => void;
  resetImmediately: () => void;
}

export function useElementTrack({
  slideMode,
  isActive,
  sceneIndex,
  sceneOffset,
  globalDirection,
  globalIsDragging,
  candidateSuspended = false,
  globalRenderProgress,
  globalDragTimelineProgress,
  renderProgressMotion,
  dragTimelineProgressMotion,
  dragRelease,
  firstSceneEnterReady,
  elementElapsedMotion,
  getTimelineDuration,
  timelineDurationState,
  dragTransaction,
  preparedSnapshot,
  requirePreparedSnapshot = false,
  dragMappingConfig,
  takeoverSnapshot,
  onElementContinuationChange,
  onSettleComplete,
  onColdStartComplete,
}: UseElementTrackParams): ElementTrackCommands {
  // The single in-flight element-track animation controls for THIS scene.
  // Whatever source is currently driving the track stores its controls here so
  // the next source (or a preempting drag) can stop it in place.
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  // What the current in-flight animation is doing. onSceneLeave now fires at
  // the render commit, so a preempted settle has NO orphaned public callback to
  // fire — preempt just stops the track in place. This ref is now write-only
  // (kept for debug/clarity of which source last drove the track); no control
  // flow reads it anymore.
  const inFlightKindRef = useRef<'settle' | 'bounce' | 'cold-start' | null>(null);
  const releaseTokenRef = useRef(0);
  const lastHandledReleaseTokenRef = useRef<number | null>(null);
  // Release token whose settle completion already fired. Lets the
  // orphaned-settle resume effect (D-F1) distinguish "settle COMPLETED, join
  // waiting on the render arm" from "settle PREEMPTED mid-flight" — both leave
  // the directive live with no in-flight controls, but only the latter must be
  // resumed (re-firing completion for the former would be redundant).
  const settleCompletedTokenRef = useRef<number | null>(null);
  const coldStartRanRef = useRef(false);
  const coldStartTargetRef = useRef(0);
  // True from the moment scene 0's cold-start launches until a gesture takes
  // ownership of the track. Extend-on-growth keys off THIS, not off a live
  // `controlsRef`: a warm-cache cold-start can finish (controlsRef → null) before
  // the after-bearing Animate children register and grow T. The old guard
  // (`if (!controlsRef.current) return`) bailed in exactly that case, capping the
  // track below the cascaded delay so the dependent element never crossed its
  // gate. A gesture preempt clears this so a later drag-back can't resurrect it.
  const coldStartExtendableRef = useRef(false);

  // Stable refs for callbacks / functions so the token-keyed effects don't
  // re-run on identity churn (which would create a spurious second animate).
  const getTimelineDurationRef = useRef(getTimelineDuration);
  getTimelineDurationRef.current = getTimelineDuration;
  const dragTransactionRef = useRef(dragTransaction);
  dragTransactionRef.current = dragTransaction;
  const preparedSnapshotRef = useRef(preparedSnapshot);
  preparedSnapshotRef.current = preparedSnapshot;
  const requirePreparedSnapshotRef = useRef(requirePreparedSnapshot);
  requirePreparedSnapshotRef.current = requirePreparedSnapshot;
  const coldStartSnapshotRef = useRef<PreparedSceneSnapshot | null>(null);
  const resolveGesturePlayback = (): DragSceneTransaction | PreparedSceneSnapshot | null => {
    const transaction = dragTransactionRef.current;
    if (transaction) return transaction;
    if (requirePreparedSnapshotRef.current) return null;
    return preparedSnapshotRef.current ?? null;
  };
  const getPlaybackTimelineDuration = (
    playback: DragSceneTransaction | PreparedSceneSnapshot | null
  ): number => playback?.registrySnapshot.timelineDuration ?? getTimelineDurationRef.current();
  const getPlaybackMapping = (
    playback: DragSceneTransaction | PreparedSceneSnapshot | null
  ): ResolvedDragTimelineConfig => playback?.mapping ?? dragMappingConfigRef.current;
  const onSettleCompleteRef = useRef(onSettleComplete);
  onSettleCompleteRef.current = onSettleComplete;
  const onColdStartCompleteRef = useRef(onColdStartComplete);
  onColdStartCompleteRef.current = onColdStartComplete;
  const onElementContinuationChangeRef = useRef(onElementContinuationChange);
  onElementContinuationChangeRef.current = onElementContinuationChange;
  const elementContinuationActiveRef = useRef(false);
  const setElementContinuationActive = (active: boolean): void => {
    if (elementContinuationActiveRef.current === active) return;
    elementContinuationActiveRef.current = active;
    onElementContinuationChangeRef.current?.(active);
  };
  const elementMotionRef = useRef(elementElapsedMotion);
  elementMotionRef.current = elementElapsedMotion;
  // Rush re-grab takeover is incremental, not an absolute remap. Candidate-down
  // freezes the continuation's exact elapsed frame. CineView then writes the
  // authoritative render base synchronously at ownership, before React can publish
  // isDragging with a stale timeline ratio. The token also lets us ignore exactly
  // that one split-commit frame without swallowing a later real scrub to the same ratio.
  const takeoverFrozenElapsedRef = useRef<number | null>(null);
  const takeoverRatioBaselineRef = useRef<number | null>(null);
  const takeoverTokenRef = useRef<number | null>(null);
  const ignoredStaleTokenRef = useRef<number | null>(null);
  // Stable ref for the follow-finger / settle effects so a config change does not
  // churn the token-keyed effects (which would spawn a spurious second animate).
  const dragMappingConfigRef = useRef<ResolvedDragTimelineConfig>(
    dragMappingConfig ?? DEFAULT_DRAG_TIMELINE_CONFIG
  );
  dragMappingConfigRef.current = dragMappingConfig ?? DEFAULT_DRAG_TIMELINE_CONFIG;
  // Latest drag timeline ratio r, read at release time. The follow-finger effect
  // pegs the track to r*T across the drag, but a release can land in the SAME
  // synchronous batch as the final pan (no intermediate render to run the
  // follow-finger effect). Reading r here guarantees the continuation starts
  // from the release elapsed (r*T) — never a replay from 0.
  const dragTimelineProgressRef = useRef(
    dragTimelineProgressMotion?.get() ?? globalDragTimelineProgress
  );
  dragTimelineProgressRef.current = dragTimelineProgressMotion?.get() ?? globalDragTimelineProgress;

  // Candidate hold is reversible and exists before public drag ownership. Stop
  // the active element continuation in place without consuming its release token;
  // the continuation effect below resumes only after the hold is released.
  useEffect(() => {
    if (slideMode !== 'drag' || !candidateSuspended) return;
    if (controlsRef.current) {
      // Only a real settle/bounce continuation participates in an incremental
      // rush re-grab. A globally-held candidate may coexist with unrelated
      // cold-start controls in another Scene; those must not seed this takeover.
      if (elementContinuationActiveRef.current) {
        takeoverFrozenElapsedRef.current = Math.max(0, elementMotionRef.current.get());
        const snapshot = takeoverSnapshot?.current;
        const ownsSnapshot = snapshot?.sceneIndices.includes(sceneIndex) ?? false;
        takeoverTokenRef.current = ownsSnapshot ? snapshot!.token : null;
        takeoverRatioBaselineRef.current = ownsSnapshot ? snapshot!.baseRatio : null;
        ignoredStaleTokenRef.current = null;
      }
      releaseTokenRef.current += 1;
      controlsRef.current.stop();
      controlsRef.current = null;
      inFlightKindRef.current = null;
    }
  }, [candidateSuspended, sceneIndex, slideMode, takeoverSnapshot]);

  // A candidate that is released/rejected without taking ownership must not leave
  // its frozen frame armed for a later unrelated drag. The owned path keeps the
  // baseline while `globalIsDragging` is true and clears it when that session ends.
  useEffect(() => {
    if (candidateSuspended || globalIsDragging) return;
    const token = takeoverTokenRef.current;
    const snapshot = takeoverSnapshot?.current;
    const ownershipIsCommitting =
      token !== null && snapshot?.token === token && snapshot.baseRatio !== null;
    if (ownershipIsCommitting) return;
    takeoverFrozenElapsedRef.current = null;
    takeoverRatioBaselineRef.current = null;
    takeoverTokenRef.current = null;
    ignoredStaleTokenRef.current = null;
  }, [candidateSuspended, globalIsDragging, takeoverSnapshot]);

  // --- Follow-finger + H2 preempt ------------------------------------------
  // While dragging: stop any in-flight element animation IN PLACE, then peg the
  // incoming scene's element track to the shared ratio MotionValue. React only
  // publishes the structural ownership boundary; pointer-move frames stay out
  // of the render pipeline.
  useEffect(() => {
    if (slideMode !== 'drag') return;
    if (!globalIsDragging) return;

    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
      inFlightKindRef.current = null;
    }
    // Ownership permanently preempts a reversible release continuation.
    setElementContinuationActive(false);
    coldStartRanRef.current = true;
    coldStartExtendableRef.current = false;

    const applyFollowFinger = (rawRatio: number): void => {
      dragTimelineProgressRef.current = rawRatio;
      const renderProgress = renderProgressMotion?.get() ?? globalRenderProgress;
      const dragDirection: 'forward' | 'backward' | null =
        renderProgress > 0.0001
          ? 'forward'
          : renderProgress < -0.0001
            ? 'backward'
            : globalDirection;
      const isIncoming =
        (dragDirection === 'forward' && sceneOffset === 1) ||
        (dragDirection === 'backward' && sceneOffset === -1);
      if (!isIncoming) return;

      const playback = resolveGesturePlayback();
      if (requirePreparedSnapshotRef.current && !playback) return;
      const tSelf = getPlaybackTimelineDuration(playback);
      const ratio = Math.max(0, Math.min(rawRatio, 1));
      const mapping = getPlaybackMapping(playback);
      const frozenElapsed = takeoverFrozenElapsedRef.current;

      if (frozenElapsed !== null) {
        const snapshot = takeoverSnapshot?.current;
        const token = takeoverTokenRef.current;
        const ownsSnapshot =
          token !== null &&
          snapshot?.token === token &&
          snapshot.sceneIndices.includes(sceneIndex) &&
          snapshot.baseRatio !== null;

        if (ownsSnapshot) {
          const baseline = snapshot.baseRatio as number;
          takeoverRatioBaselineRef.current = baseline;
          const renderRatio = Math.abs(renderProgress);
          const isSplitCommitStaleFrame =
            ignoredStaleTokenRef.current !== token &&
            Math.abs(renderRatio - baseline) <= 1e-6 &&
            Math.abs(ratio - snapshot.staleRatio) <= 1e-6 &&
            Math.abs(ratio - baseline) > 1e-6;

          if (isSplitCommitStaleFrame) {
            ignoredStaleTokenRef.current = token;
            return;
          }

          const baselineElapsed = mapDragPercentToElapsed(mapping, tSelf, baseline * 100);
          const currentElapsed = mapDragPercentToElapsed(mapping, tSelf, ratio * 100);
          elementMotionRef.current.set(
            Math.max(0, Math.min(tSelf, frozenElapsed + currentElapsed - baselineElapsed))
          );
          return;
        }

        // Standalone Scene compatibility: without a CineView-owned synchronous
        // snapshot, retain the original first-owned-frame baseline behavior.
        const baseline = takeoverRatioBaselineRef.current;
        if (baseline === null) {
          takeoverRatioBaselineRef.current = ratio;
          return;
        }
        const baselineElapsed = mapDragPercentToElapsed(mapping, tSelf, baseline * 100);
        const currentElapsed = mapDragPercentToElapsed(mapping, tSelf, ratio * 100);
        elementMotionRef.current.set(
          Math.max(0, Math.min(tSelf, frozenElapsed + currentElapsed - baselineElapsed))
        );
        return;
      }

      elementMotionRef.current.set(mapDragPercentToElapsed(mapping, tSelf, ratio * 100));
    };

    applyFollowFinger(dragTimelineProgressMotion?.get() ?? globalDragTimelineProgress);
    if (dragTimelineProgressMotion) {
      return dragTimelineProgressMotion.on('change', applyFollowFinger);
    }
    return undefined;
  }, [
    slideMode,
    globalIsDragging,
    globalDragTimelineProgress,
    globalRenderProgress,
    dragTimelineProgressMotion,
    renderProgressMotion,
    globalDirection,
    sceneOffset,
    sceneIndex,
    takeoverSnapshot,
    dragTransaction?.transactionId,
  ]);

  // --- Release (settle / bounce) -------------------------------------------
  // Reacts exactly once per release token. Created AT RELEASE (in parallel with
  // the render lane, before the commit). Continues from the current elapsed
  // (no replay from 0) toward T (settle) or 0 (bounce), at its own clock.
  useEffect(() => {
    if (slideMode !== 'drag') return;
    if (candidateSuspended) return;
    const release = dragRelease;
    if (!release) return;
    if (release.targetSceneIndex !== sceneIndex) return;

    const playback = resolveGesturePlayback();
    // A CineView Scene never consumes the release token before its matching
    // immutable transaction arrives. The effect re-runs when transactionId is
    // published, preserving the directive for the frozen playback pass.
    if (requirePreparedSnapshotRef.current && !playback) return;
    if (lastHandledReleaseTokenRef.current === release.token) return;
    lastHandledReleaseTokenRef.current = release.token;

    const token = ++releaseTokenRef.current;
    // Stop any prior in-flight animation (follow-finger leaves none, but a
    // re-targeted release would).
    controlsRef.current?.stop();
    controlsRef.current = null;
    setElementContinuationActive(false);

    const motion = elementMotionRef.current;
    const tSelf = getPlaybackTimelineDuration(playback);
    // A transaction's seed is authoritative. Legacy/direct hook callers without
    // a transaction retain the release-ratio fallback for compatibility.
    const releaseRatio =
      typeof release.progressRatio === 'number'
        ? release.progressRatio
        : dragTimelineProgressRef.current;
    const ratioElapsed =
      playback && 'releaseSeed' in playback
        ? playback.releaseSeed.elapsedMs
        : mapDragPercentToElapsed(
            getPlaybackMapping(playback),
            tSelf,
            Math.max(0, Math.min(releaseRatio, 1)) * 100
          );
    const current = Math.max(0, motion.get(), ratioElapsed);
    if (current > motion.get()) {
      motion.set(current);
    }

    if (release.mode === 'enter') {
      // Programmatic navigation (ref.goToScene / nextScene / prevScene). Unlike a
      // gesture settle (which CONTINUES from the release elapsed), this is a fresh
      // enter: replay 0 -> T at natural rate so the destination scene plays its
      // full element-timeline enter with per-element delay sequencing. It is NOT
      // part of the gesture join — no onSettleComplete — so it cannot corrupt a
      // later commit's settleArrived bookkeeping; CineView's animated-settle timer
      // drives completion (setAnimating(false) -> onAfterChange).
      motion.set(0);
      if (tSelf <= 0.001) {
        motion.set(tSelf);
        return;
      }
      // 'cold-start' kind (not 'settle'): a drag that preempts this mid-enter
      // must stop the track in place WITHOUT firing onSettleComplete (the H2
      // preempt only fires it for the 'settle' kind). Programmatic enter is not
      // part of the join, so a spurious completion must never reach it.
      inFlightKindRef.current = 'cold-start';
      controlsRef.current = animate(motion, tSelf, {
        duration: tSelf / 1000,
        ease: 'linear',
        onUpdate: (latest) => {
          if (releaseTokenRef.current !== token) return;
          motion.set(latest);
        },
        onComplete: () => {
          if (releaseTokenRef.current !== token) return;
          controlsRef.current = null;
          inFlightKindRef.current = null;
          motion.set(tSelf);
        },
      });
    } else if (release.mode === 'settle') {
      const remainingMs = tSelf - current;
      if (remainingMs <= 0.001) {
        // Clean commit: already at (or past) T. Snap and complete immediately.
        setElementContinuationActive(false);
        motion.set(tSelf);
        settleCompletedTokenRef.current = release.token;
        onSettleCompleteRef.current?.();
        return;
      }
      inFlightKindRef.current = 'settle';
      setElementContinuationActive(true);
      controlsRef.current = animate(motion, tSelf, {
        duration: remainingMs / 1000,
        ease: 'linear',
        onUpdate: (latest) => {
          if (releaseTokenRef.current !== token) return;
          motion.set(latest);
        },
        onComplete: () => {
          if (releaseTokenRef.current !== token) return;
          controlsRef.current = null;
          inFlightKindRef.current = null;
          setElementContinuationActive(false);
          motion.set(tSelf);
          settleCompletedTokenRef.current = release.token;
          onSettleCompleteRef.current?.();
        },
      });
    } else {
      // bounce: return the element track to 0 in parallel with the render
      // bounce. Non-commit, so no completion callback.
      if (current <= 0.001) {
        setElementContinuationActive(false);
        motion.set(0);
        return;
      }
      const durationMs = Math.min(Math.max(current, 0) * 0.5, 300);
      inFlightKindRef.current = 'bounce';
      setElementContinuationActive(true);
      controlsRef.current = animate(motion, 0, {
        duration: durationMs / 1000,
        ease: 'easeOut',
        onUpdate: (latest) => {
          if (releaseTokenRef.current !== token) return;
          motion.set(latest);
        },
        onComplete: () => {
          if (releaseTokenRef.current !== token) return;
          controlsRef.current = null;
          inFlightKindRef.current = null;
          setElementContinuationActive(false);
          motion.set(0);
        },
      });
    }
    // Only the release token gates this effect. Everything else is read through
    // refs so a re-render (e.g. the commit) cannot spawn a second pass.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideMode, dragRelease?.token, sceneIndex, dragTransaction?.transactionId]);

  // --- Suspended/orphaned release resume (D-F1) -----------------------------
  // Candidate pointer-down stops the live element continuation without granting
  // drag ownership. While the candidate is held, NOTHING may restart it. Tap,
  // cancel, or a rejected direction clears the hold and resumes the same release
  // token from the frozen elapsed value. The same path also repairs an orphaned
  // post-commit settle after an owned gesture ends without superseding it.
  useEffect(() => {
    if (slideMode !== 'drag') return;
    if (candidateSuspended || globalIsDragging) return;
    const release = dragRelease;
    if (!release || release.mode === 'enter') return;
    if (release.targetSceneIndex !== sceneIndex) return;
    if (lastHandledReleaseTokenRef.current !== release.token) return;
    if (release.mode === 'settle' && settleCompletedTokenRef.current === release.token) return;
    if (controlsRef.current) return;

    const playback = resolveGesturePlayback();
    if (requirePreparedSnapshotRef.current && !playback) return;
    const motion = elementMotionRef.current;
    const current = Math.max(0, motion.get());

    if (release.mode === 'bounce') {
      if (current <= 0.001) {
        setElementContinuationActive(false);
        motion.set(0);
        return;
      }
      const token = ++releaseTokenRef.current;
      inFlightKindRef.current = 'bounce';
      setElementContinuationActive(true);
      controlsRef.current = animate(motion, 0, {
        duration: Math.min(current * 0.5, 300) / 1000,
        ease: 'easeOut',
        onUpdate: (latest) => {
          if (releaseTokenRef.current !== token) return;
          motion.set(latest);
        },
        onComplete: () => {
          if (releaseTokenRef.current !== token) return;
          controlsRef.current = null;
          inFlightKindRef.current = null;
          setElementContinuationActive(false);
          motion.set(0);
        },
      });
      return;
    }

    const tSelf = getPlaybackTimelineDuration(playback);
    const remainingMs = tSelf - current;
    if (remainingMs <= 0.001) {
      setElementContinuationActive(false);
      motion.set(tSelf);
      settleCompletedTokenRef.current = release.token;
      onSettleCompleteRef.current?.();
      return;
    }
    const token = ++releaseTokenRef.current;
    inFlightKindRef.current = 'settle';
    setElementContinuationActive(true);
    controlsRef.current = animate(motion, tSelf, {
      duration: remainingMs / 1000,
      ease: 'linear',
      onUpdate: (latest) => {
        if (releaseTokenRef.current !== token) return;
        motion.set(latest);
      },
      onComplete: () => {
        if (releaseTokenRef.current !== token) return;
        controlsRef.current = null;
        inFlightKindRef.current = null;
        setElementContinuationActive(false);
        motion.set(tSelf);
        settleCompletedTokenRef.current = release.token;
        onSettleCompleteRef.current?.();
      },
    });
    // The remaining values are read through refs to avoid identity-driven restarts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideMode, candidateSuspended, globalIsDragging, dragRelease?.token, sceneIndex]);

  // --- Cold-start (scene 0 one-shot first-screen enter) --------------------
  // A Scene playback captures the first stable prepared snapshot and never
  // extends from later live-registry growth. Direct legacy hook callers without
  // a prepared snapshot keep the historical extend-on-growth behavior.
  useEffect(() => {
    if (slideMode !== 'drag') return;
    if (sceneIndex !== 0) return;
    if (!firstSceneEnterReady) return;
    if (globalIsDragging) return;

    const motion = elementMotionRef.current;

    if (!coldStartRanRef.current) {
      const snapshot = preparedSnapshotRef.current ?? null;
      if (requirePreparedSnapshotRef.current && !snapshot) return;
      coldStartSnapshotRef.current = snapshot;
      const tSelf = getPlaybackTimelineDuration(snapshot);

      coldStartRanRef.current = true;
      // Only direct legacy callers without a prepared snapshot may extend from
      // live registry growth. Scene playback is immutable for this activation.
      coldStartExtendableRef.current = snapshot === null;
      coldStartTargetRef.current = tSelf;
      const current = Math.max(0, motion.get());
      const remainingMs = tSelf - current;
      if (remainingMs <= 0.001) {
        motion.set(tSelf);
        onColdStartCompleteRef.current?.();
        return;
      }
      const token = ++releaseTokenRef.current;
      inFlightKindRef.current = 'cold-start';
      controlsRef.current = animate(motion, tSelf, {
        duration: remainingMs / 1000,
        ease: 'linear',
        onUpdate: (latest) => {
          if (releaseTokenRef.current !== token) return;
          motion.set(latest);
        },
        onComplete: () => {
          if (releaseTokenRef.current !== token) return;
          controlsRef.current = null;
          inFlightKindRef.current = null;
          motion.set(coldStartTargetRef.current);
          onColdStartCompleteRef.current?.();
        },
      });
      return;
    }

    if (!coldStartExtendableRef.current || coldStartSnapshotRef.current) return;
    const tSelf = getTimelineDurationRef.current();
    if (tSelf <= coldStartTargetRef.current + 0.001) return;
    controlsRef.current?.stop();
    coldStartTargetRef.current = tSelf;
    const current = Math.max(0, motion.get());
    const remainingMs = tSelf - current;
    if (remainingMs <= 0.001) {
      motion.set(tSelf);
      controlsRef.current = null;
      inFlightKindRef.current = null;
      onColdStartCompleteRef.current?.();
      return;
    }
    const token = ++releaseTokenRef.current;
    inFlightKindRef.current = 'cold-start';
    controlsRef.current = animate(motion, tSelf, {
      duration: remainingMs / 1000,
      ease: 'linear',
      onUpdate: (latest) => {
        if (releaseTokenRef.current !== token) return;
        motion.set(latest);
      },
      onComplete: () => {
        if (releaseTokenRef.current !== token) return;
        controlsRef.current = null;
        inFlightKindRef.current = null;
        motion.set(coldStartTargetRef.current);
        onColdStartCompleteRef.current?.();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    slideMode,
    sceneIndex,
    firstSceneEnterReady,
    globalIsDragging,
    timelineDurationState,
    preparedSnapshot?.revision,
  ]);

  // Cleanup on unmount: stop whatever is in flight and synchronously remove this
  // Scene from the root's resumable-continuation directory.
  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
      setElementContinuationActive(false);
    };
  }, []);

  void isActive;
  const completeImmediately = useCallback((): void => {
    releaseTokenRef.current += 1;
    controlsRef.current?.stop();
    controlsRef.current = null;
    inFlightKindRef.current = null;
    setElementContinuationActive(false);
    elementMotionRef.current.set(getTimelineDurationRef.current());
  }, []);
  const resetImmediately = useCallback((): void => {
    releaseTokenRef.current += 1;
    controlsRef.current?.stop();
    controlsRef.current = null;
    inFlightKindRef.current = null;
    setElementContinuationActive(false);
    elementMotionRef.current.set(0);
  }, []);

  return { completeImmediately, resetImmediately };
}
