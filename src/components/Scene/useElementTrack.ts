import { useEffect, useRef } from 'react';
import { animate, type MotionValue } from 'framer-motion';
import type { ScrollMode } from '../../types';
import type { DragRelease } from '../../hooks/useSceneManager';

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
  /** Signed render position; its sign gives the live drag direction mid-drag. */
  globalRenderProgress: number;
  /** r — the drag timeline ratio in [0, 1] (abs of the drag fraction). */
  globalDragTimelineProgress: number;
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
  /** Registry-aware timeline duration trigger; re-fires the cold-start extend. */
  timelineDurationState: number;
  /**
   * Absolute follow-finger time scale: ms of element-timeline elapsed per 1% of
   * drag. The follow-finger write pegs the track to `r * 100 * dragTimeScale` (an
   * absolute clock) instead of `r * T_self`, decoupling drag speed from animation
   * length. Defaults to 100 (1% → 100ms; full drag → 10000ms). Settle continues
   * from the reached elapsed to T_self at the natural rate.
   */
  dragTimeScale?: number;
  /** Fired when the element track reaches T (settle / cold-start complete). */
  onSettleComplete?: () => void;
  onColdStartComplete?: () => void;
}

export function useElementTrack({
  slideMode,
  isActive,
  sceneIndex,
  sceneOffset,
  globalDirection,
  globalIsDragging,
  globalRenderProgress,
  globalDragTimelineProgress,
  dragRelease,
  firstSceneEnterReady,
  elementElapsedMotion,
  getTimelineDuration,
  timelineDurationState,
  dragTimeScale,
  onSettleComplete,
  onColdStartComplete,
}: UseElementTrackParams): void {
  // Absolute follow-finger time scale: drag percent -> element-track elapsed ms.
  // `dragTimeScale` is ms per 1% of drag (default 100 -> full drag 0..1 maps to
  // 0..10_000ms). This DECOUPLES the clock from the scene's own timeline T_self:
  // the finger advances the shared elapsed at a fixed authored rate, so short
  // elements no longer race to terminal just because the drag fraction is large.
  // Whether the animation fully plays out during the drag depends on this scale
  // vs the scene's T_self — if the scale's full span (100 * dragTimeScale) is
  // shorter than T_self the drag cannot finish it and settle continues the
  // remainder at real-time rate; if longer, it completes mid-drag and holds.
  // The default is resolved at the config entry (CineView.DEFAULT_DRAG_TIME_SCALE);
  // the `?? 100` here is a pure safety net for direct hook callers / tests that
  // omit the prop — it should never fire on the production config path.
  const dragTimeScalePer100 = Math.max(0, (dragTimeScale ?? 100) * 100);
  // The single in-flight element-track animation controls for THIS scene.
  // Whatever source is currently driving the track stores its controls here so
  // the next source (or a preempting drag) can stop it in place.
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  // What the current in-flight animation is doing. onSceneDidChange now fires at
  // the render commit, so a preempted settle has NO orphaned public callback to
  // fire — preempt just stops the track in place. This ref is now write-only
  // (kept for debug/clarity of which source last drove the track); no control
  // flow reads it anymore.
  const inFlightKindRef = useRef<'settle' | 'bounce' | 'cold-start' | null>(null);
  const releaseTokenRef = useRef(0);
  const lastHandledReleaseTokenRef = useRef<number | null>(null);
  const coldStartRanRef = useRef(false);
  const coldStartTargetRef = useRef(0);
  // True from the moment scene 0's cold-start launches until a gesture takes
  // ownership of the track. Extend-on-growth keys off THIS, not off a live
  // `controlsRef`: a warm-cache cold-start can finish (controlsRef → null) before
  // the waitFor-bearing Animate children register and grow T. The old guard
  // (`if (!controlsRef.current) return`) bailed in exactly that case, capping the
  // track below the cascaded delay so the dependent element never crossed its
  // gate. A gesture preempt clears this so a later drag-back can't resurrect it.
  const coldStartExtendableRef = useRef(false);

  // Stable refs for callbacks / functions so the token-keyed effects don't
  // re-run on identity churn (which would create a spurious second animate).
  const getTimelineDurationRef = useRef(getTimelineDuration);
  getTimelineDurationRef.current = getTimelineDuration;
  const onSettleCompleteRef = useRef(onSettleComplete);
  onSettleCompleteRef.current = onSettleComplete;
  const onColdStartCompleteRef = useRef(onColdStartComplete);
  onColdStartCompleteRef.current = onColdStartComplete;
  const elementMotionRef = useRef(elementElapsedMotion);
  elementMotionRef.current = elementElapsedMotion;
  // Stable ref for the follow-finger / settle effects so a config change does not
  // churn the token-keyed effects (which would spawn a spurious second animate).
  const dragTimeScalePer100Ref = useRef(dragTimeScalePer100);
  dragTimeScalePer100Ref.current = dragTimeScalePer100;
  // Latest drag timeline ratio r, read at release time. The follow-finger effect
  // pegs the track to r*T across the drag, but a release can land in the SAME
  // synchronous batch as the final pan (no intermediate render to run the
  // follow-finger effect). Reading r here guarantees the continuation starts
  // from the release elapsed (r*T) — never a replay from 0.
  const dragTimelineProgressRef = useRef(globalDragTimelineProgress);
  dragTimelineProgressRef.current = globalDragTimelineProgress;

  // Drag direction is self-contained: during a live drag the global `direction`
  // is still null (it is only set at commit), so derive it from the signed render
  // progress; fall back to globalDirection when render is at rest (e.g. just after
  // a release sets direction). This is the incoming-scene test the follow-finger
  // and (pre-release) reads rely on.
  const dragDirection: 'forward' | 'backward' | null =
    globalRenderProgress > 0.0001
      ? 'forward'
      : globalRenderProgress < -0.0001
        ? 'backward'
        : globalDirection;
  const isIncoming =
    (dragDirection === 'forward' && sceneOffset === 1) ||
    (dragDirection === 'backward' && sceneOffset === -1);

  // --- Follow-finger + H2 preempt ------------------------------------------
  // While dragging: stop any in-flight element animation IN PLACE (it is either
  // a settle from a previous release that is now being preempted, or a
  // cold-start the user grabbed mid-enter — either way leave the value where it
  // is, it is about to slide offscreen / be re-driven by the finger). Then, if
  // this scene is the incoming one, peg its element track to r * T.
  useEffect(() => {
    if (slideMode !== 'drag') return;
    if (!globalIsDragging) return;

    // H2: preempt the in-flight animation in place (no jump to terminal). The
    // public onSceneDidChange already fired at commit (the render lane), so a
    // preempted settle has NO orphaned public callback to fire — just stop the
    // visual continuation in place (the scene is sliding offscreen / about to be
    // re-driven by the finger). The superseded `dragRelease` is overwritten when
    // the new drag releases (publishDragRelease bumps the token) or cleared on a
    // bounce (resetDragInteraction), so no stray cleanup is needed here either.
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
      inFlightKindRef.current = null;
    }
    // The cold-start window is now owned by the gesture; no further extend.
    coldStartRanRef.current = true;
    coldStartExtendableRef.current = false;

    if (isIncoming) {
      // Absolute time scale (NOT r * T_self): drag percent maps to a fixed authored
      // ms rate so the clock advances independently of the scene's own timeline.
      // Clamp to T_self so the track never reports past its own terminal — short
      // elements settle early (accepted), but the shared clock itself stops at T.
      const tSelf = getTimelineDurationRef.current();
      const r = Math.max(0, Math.min(globalDragTimelineProgress, 1));
      const elapsed = Math.min(r * dragTimeScalePer100Ref.current, tSelf);
      elementElapsedMotion.set(elapsed);
    }
  }, [slideMode, globalIsDragging, isIncoming, globalDragTimelineProgress, elementElapsedMotion]);

  // --- Release (settle / bounce) -------------------------------------------
  // Reacts exactly once per release token. Created AT RELEASE (in parallel with
  // the render lane, before the commit). Continues from the current elapsed
  // (no replay from 0) toward T (settle) or 0 (bounce), at its own clock.
  useEffect(() => {
    if (slideMode !== 'drag') return;
    const release = dragRelease;
    if (!release) return;
    if (release.targetSceneIndex !== sceneIndex) return;
    if (lastHandledReleaseTokenRef.current === release.token) return;
    lastHandledReleaseTokenRef.current = release.token;

    const token = ++releaseTokenRef.current;
    // Stop any prior in-flight animation (follow-finger leaves none, but a
    // re-targeted release would).
    controlsRef.current?.stop();
    controlsRef.current = null;

    const motion = elementMotionRef.current;
    const tSelf = getTimelineDurationRef.current();
    // The release continuation begins at the elapsed the FINGER reached. Normally
    // the follow-finger effect already pegged the track to r * T; but when the
    // gesture's whole press/move/release lands in one synchronous batch (no
    // intervening commit of isDragging), that effect has not run yet, so the
    // track still reads 0 AND the render-synced ref still holds its pre-pan value
    // (also 0) — seeding from the ref alone replays from 0. The directive carries
    // the release ratio captured authoritatively at release time, so prefer it;
    // fall back to the render-synced ref only when the directive omits it (e.g.
    // hand-authored test directives). Seed from max(live track, r * T) so the
    // continuation always starts from the release elapsed — never a replay from 0.
    const releaseRatio =
      typeof release.progressRatio === 'number'
        ? release.progressRatio
        : dragTimelineProgressRef.current;
    // Same absolute time scale as the follow-finger write (r * dragTimeScalePer100,
    // clamped to tSelf), so the release instant is continuous with the last drag
    // frame — never a jump from a T_self-based ratio.
    const ratioElapsed = Math.min(
      Math.max(0, Math.min(releaseRatio, 1)) * dragTimeScalePer100Ref.current,
      tSelf
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
        motion.set(tSelf);
        onSettleCompleteRef.current?.();
        return;
      }
      inFlightKindRef.current = 'settle';
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
          motion.set(tSelf);
          onSettleCompleteRef.current?.();
        },
      });
    } else {
      // bounce: return the element track to 0 in parallel with the render
      // bounce. Non-commit, so no completion callback.
      if (current <= 0.001) {
        motion.set(0);
        return;
      }
      const durationMs = Math.min(Math.max(current, 0) * 0.5, 300);
      inFlightKindRef.current = 'bounce';
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
          motion.set(0);
        },
      });
    }
    // Only the release token gates this effect. Everything else is read through
    // refs so a re-render (e.g. the commit) cannot spawn a second pass.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideMode, dragRelease?.token, sceneIndex]);

  // --- Cold-start (scene 0 one-shot first-screen enter) --------------------
  // Drives 0 -> T at real-time rate once firstSceneEnterActive turns on. Because
  // T is local and always current, extend-on-growth is trivial: when the
  // registry duration grows, re-target from the current elapsed (never reset).
  useEffect(() => {
    if (slideMode !== 'drag') return;
    if (sceneIndex !== 0) return;
    if (!firstSceneEnterReady) return;
    if (globalIsDragging) return;

    const motion = elementMotionRef.current;
    const tSelf = getTimelineDurationRef.current();

    if (!coldStartRanRef.current) {
      coldStartRanRef.current = true;
      coldStartExtendableRef.current = true;
      coldStartTargetRef.current = tSelf;
      const current = Math.max(0, motion.get());
      const remainingMs = tSelf - current;
      if (remainingMs <= 0.001) {
        motion.set(tSelf);
        // Stay extendable: T may still grow once the waitFor-bearing children
        // register. The block below re-launches from here when that happens.
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

    // Extend-on-growth: the registry duration grew after the cold-start started.
    // Warm-cache ordering means this fires in TWO situations, and the guard must
    // cover both: (a) the cold-start tween is still in flight, or (b) it already
    // finished (controlsRef === null) because the priority asset settled and the
    // tween ran to its (then-small) T before the waitFor-bearing Animate children
    // registered their delay + duration. Keying off coldStartExtendableRef instead
    // of a live controlsRef handles (b): a finished cold-start must still grow the
    // track to the larger T, otherwise a waitFor element whose cascaded delay
    // exceeds the old T never crosses its gate and never enters. Only grow.
    if (!coldStartExtendableRef.current) return;
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
  }, [slideMode, sceneIndex, firstSceneEnterReady, globalIsDragging, timelineDurationState]);

  // Cleanup on unmount: stop whatever is in flight.
  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, []);

  void isActive;
}
