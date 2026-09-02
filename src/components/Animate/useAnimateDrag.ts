import { useEffect, useRef, useState } from 'react';
import { MotionValue, useMotionValue } from 'framer-motion';
import type { ParsedAnimationVariant } from '../../types';
import type { SceneContextType } from './Animate';
import type { PreparedSceneSnapshot } from '../Scene/dragPreparedState';
import { type SceneVariantRecords, type VariantRecord } from './animateInterpolation';
import { useAnimatedPropertyLanes } from './useAnimatedPropertyLanes';
import {
  resolveDragPropertyValue,
  resolveEnterLocalProgress,
  resolvePlaybackSnapshot,
  resolvePlaybackVisualState,
  resolveRenderProgress,
  type DragVisualState,
} from './dragVisualState';
import { devWarn } from '../../utils/devLog';

// Re-exported so existing consumers keep importing from the hook module: the
// N6 batch-A split is an internal file boundary, not a public API change.
export { resolveEnterLocalProgress };
export type { DragVisualState };

interface UseAnimateDragParams {
  sceneContext: SceneContextType | null;
  enterVariant: ParsedAnimationVariant | null;
  exitVariant: ParsedAnimationVariant | null;
  componentId: string;
  delay: number;
  enterDuration: number;
  exitDuration: number;
  after?: string;
  /** An enter/infinite animation was authored but its variants have not parsed
   *  yet (async preset import). Hold the initial frame instead of resolving to
   *  the rest frame, which would paint the element fully visible for a frame and
   *  then snap it back — the refresh flash. */
  variantsPending?: boolean;
}

interface UseAnimateDragReturn {
  style: Record<string, DragMotionValue>;
  opacity: MotionValue<number>;
  x: MotionValue<number | string>;
  y: MotionValue<number | string>;
  scale: MotionValue<number>;
  rotate: MotionValue<number | string>;
  useInteractiveStyles: boolean;
  shouldRunInfinite: boolean;
  visualState: MotionValue<DragVisualState | null>;
}

type DragMotionValue = MotionValue<number> | MotionValue<string> | MotionValue<number | string>;

const EPSILON = 0.001;

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

export function useAnimateDrag({
  sceneContext,
  enterVariant,
  exitVariant,
  componentId,
  delay,
  enterDuration,
  exitDuration,
  after,
  variantsPending = false,
}: UseAnimateDragParams): UseAnimateDragReturn {
  const playbackSnapshot = sceneContext ? resolvePlaybackSnapshot(sceneContext) : null;
  const frozenRegistration = playbackSnapshot?.registrySnapshot.registrations.get(componentId);
  const frozenEnterVariant = playbackSnapshot?.enterVariantsByAnimateId.get(componentId) ?? null;
  const isExcludedFromPlayback = Boolean(
    playbackSnapshot && (!frozenRegistration || !frozenEnterVariant)
  );
  const playbackEnterDuration = frozenRegistration?.duration ?? enterDuration;
  const playbackCalculatedDelay =
    playbackSnapshot?.registrySnapshot.calculatedDelays.get(componentId) ?? 0;
  const resolvedEnterVariant = frozenEnterVariant ?? enterVariant;
  const calculatedDelayRef = useRef(playbackCalculatedDelay);
  // The transaction view updates its release seed while the finger moves. Keep
  // registration lifetime independent from that view identity: the live registry
  // compiles the NEXT prepared snapshot and must not unregister/re-register every
  // drag frame merely because the current immutable transaction view advanced.
  const playbackSnapshotRef = useRef(playbackSnapshot);
  playbackSnapshotRef.current = playbackSnapshot;
  const variantsRef = useRef<SceneVariantRecords>({
    enterInitial: (resolvedEnterVariant?.initial as VariantRecord) || {},
    enterAnimate: (resolvedEnterVariant?.animate as VariantRecord) || {},
    exitTarget: (exitVariant?.exit as VariantRecord) || {},
  });

  // Compute the initial visual motion value synchronously during render
  // to prevent a one-frame flash where Animate elements show initial (0%)
  // state before the useEffect-based updateVisualMotion runs after paint.
  // This is critical for drag mode scene transitions where a newly-activated
  // scene's Animate elements must appear at their correct visual position
  // on the very first frame. The seed replicates updateVisualMotion's own
  // first-frame derivation so the very first commit matches the post-effect
  // value (rest -> localProgress 1, settling/incoming -> in-progress
  // localProgress, outgoing -> signed localProgress). When sceneContext is
  // null the effect early-returns and the transforms ignore visualMotion, so
  // a seed of 0 is correct in that case.
  const initialVisualState = sceneContext
    ? resolvePlaybackVisualState(
        sceneContext,
        calculatedDelayRef.current,
        playbackEnterDuration,
        exitDuration,
        isExcludedFromPlayback,
        variantsPending
      )
    : null;
  const initialVisualMotion = initialVisualState
    ? initialVisualState.mode === 'outgoing'
      ? (initialVisualState.direction === 'forward' ? 1 : -1) * initialVisualState.localProgress
      : initialVisualState.localProgress
    : 0;
  const visualMotion = useMotionValue(initialVisualMotion);
  // Shared per-frame resolved state. updateVisualMotion below resolves once and
  // writes it here; the 10 property transforms read it instead of each
  // re-running resolveVisualState (was 11 resolves/frame -> 1). This is a plain
  // MotionValue written by the same effect that drives visualMotion (NOT a
  // useTransform chained off visualMotion — that broke update propagation,
  // leaving properties stuck on the render-time seed).
  const visualState = useMotionValue<DragVisualState | null>(initialVisualState);
  const [shouldRunInfiniteState, setShouldRunInfiniteState] = useState(false);
  const lastDebugBucketRef = useRef<string | null>(null);
  const lastModeRef = useRef<string | null>(null);
  const lastDelayPhaseRef = useRef<string | null>(null);
  const playbackWarningRef = useRef<{
    identity: symbol | PreparedSceneSnapshot | null;
    categories: Set<'dynamic-mount' | 'mutation'>;
  }>({ identity: null, categories: new Set() });

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || !playbackSnapshot) return;

    const identity =
      'transactionId' in playbackSnapshot ? playbackSnapshot.transactionId : playbackSnapshot;
    if (playbackWarningRef.current.identity !== identity) {
      playbackWarningRef.current = { identity, categories: new Set() };
    }

    const warnOnce = (category: 'dynamic-mount' | 'mutation', message: string): void => {
      if (playbackWarningRef.current.categories.has(category)) return;
      playbackWarningRef.current.categories.add(category);
      devWarn(message);
    };

    if (isExcludedFromPlayback && sceneContext?.isActive && sceneContext.sceneOffset === 0) {
      warnOnce(
        'dynamic-mount',
        `Animate "${componentId}" mounted after the active Scene playback snapshot was captured. ` +
          'It remains at its authored terminal state for this activation and will join the next activation.'
      );
      return;
    }

    if (!frozenRegistration || !frozenEnterVariant || !enterVariant) return;
    const orchestrationChanged =
      frozenRegistration.delay !== delay ||
      frozenRegistration.duration !== enterDuration ||
      frozenRegistration.after !== after ||
      frozenRegistration.lane !== 'drag';
    const enterVisualChanged = frozenEnterVariant !== enterVariant;
    if (orchestrationChanged || enterVisualChanged) {
      warnOnce(
        'mutation',
        `Animate "${componentId}" changed its drag choreography or enter visual during an active transaction. ` +
          'The current transaction remains frozen; the new values take effect on the next activation.'
      );
    }
  }, [
    componentId,
    delay,
    enterDuration,
    enterVariant,
    frozenEnterVariant,
    frozenRegistration,
    isExcludedFromPlayback,
    playbackSnapshot,
    sceneContext?.isActive,
    sceneContext?.sceneOffset,
    after,
  ]);

  useEffect(() => {
    variantsRef.current = {
      enterInitial: (resolvedEnterVariant?.initial as VariantRecord) || {},
      enterAnimate: (resolvedEnterVariant?.animate as VariantRecord) || {},
      // Exit remains render-lane authored data; the prepared snapshot freezes the
      // enter timeline that the element track actually drives.
      exitTarget: (exitVariant?.exit as VariantRecord) || {},
    };
    if (playbackSnapshot) {
      calculatedDelayRef.current = playbackCalculatedDelay;
    }
  }, [exitVariant, playbackCalculatedDelay, playbackSnapshot, resolvedEnterVariant]);

  useEffect(() => {
    const registerAnimate = sceneContext?.registerAnimate;
    const unregisterAnimate = sceneContext?.unregisterAnimate;
    const getCalculatedDelay = sceneContext?.getCalculatedDelay;
    if (!registerAnimate || !getCalculatedDelay || !enterVariant) {
      return;
    }

    const lease = registerAnimate(componentId, {
      delay,
      duration: enterDuration,
      after,
      lane: 'drag',
    });
    lease?.setEnterVariant?.(enterVariant);

    if (!playbackSnapshotRef.current) {
      calculatedDelayRef.current = lease?.getCalculatedDelay?.() ?? getCalculatedDelay(componentId);
    }

    return () => {
      if (lease?.dispose) {
        lease.dispose();
      } else {
        unregisterAnimate?.(componentId);
      }
    };
  }, [
    sceneContext?.registerAnimate,
    sceneContext?.unregisterAnimate,
    sceneContext?.getCalculatedDelay,
    enterVariant,
    componentId,
    delay,
    enterDuration,
    after,
  ]);

  useEffect(() => {
    if (!sceneContext) return;

    const updateVisualMotion = (): void => {
      // During playback the prepared snapshot is the sole orchestration source.
      // Live registry reads are allowed only while compiling the next snapshot.
      if (playbackSnapshot) {
        calculatedDelayRef.current = playbackCalculatedDelay;
      } else {
        const liveDelay = sceneContext.getCalculatedDelay?.(componentId);
        if (typeof liveDelay === 'number') {
          calculatedDelayRef.current = liveDelay;
        }
      }
      const state = resolvePlaybackVisualState(
        sceneContext,
        calculatedDelayRef.current,
        playbackEnterDuration,
        exitDuration,
        isExcludedFromPlayback,
        variantsPending
      );
      const nextValue =
        state.mode === 'outgoing'
          ? (state.direction === 'forward' ? 1 : -1) * state.localProgress
          : state.localProgress;

      const modeKey = [
        state.mode,
        state.direction,
        sceneContext.sceneOffset,
        sceneContext.isActive ? 'active' : 'inactive',
        sceneContext.isDragging ? 'dragging' : 'idle',
      ].join(':');
      const modeChanged = lastModeRef.current !== modeKey;

      visualMotion.set(nextValue);
      visualState.set(state);
      lastModeRef.current = modeKey;

      if (modeChanged) {
        debugDrag(`🧭 [Animate ${componentId}] mode handoff`, {
          mode: state.mode,
          direction: state.direction,
          sceneOffset: sceneContext.sceneOffset,
          isActive: sceneContext.isActive,
          isDragging: sceneContext.isDragging,
          sceneState: sceneContext.sceneState,
          renderProgress: resolveRenderProgress(sceneContext).toFixed(3),
          transitionProgress: state.transitionProgress.toFixed(3),
          sharedElapsedMs: state.sharedElapsedMs.toFixed(1),
          projectedSceneElapsedMs: state.projectedSceneElapsedMs.toFixed(1),
          sharedTimelineDurationMs: state.sharedTimelineDurationMs,
          sceneTimelineDurationMs: state.sceneTimelineDurationMs,
          localProgress: state.localProgress.toFixed(3),
          calculatedDelay: calculatedDelayRef.current,
          enterDuration,
          exitDuration,
        });
      }

      const shouldTraceDelay = state.mode === 'enter';
      if (shouldTraceDelay) {
        const delayPhase =
          state.localProgress <= EPSILON
            ? 'before-delay'
            : state.localProgress >= 1 - EPSILON
              ? 'enter-complete'
              : 'enter-active';

        if (lastDelayPhaseRef.current !== `${state.mode}:${delayPhase}`) {
          debugDrag(`⏱️ [Animate ${componentId}] delay gate`, {
            mode: state.mode,
            delayPhase,
            sharedElapsedMs: state.sharedElapsedMs.toFixed(1),
            projectedSceneElapsedMs: state.projectedSceneElapsedMs.toFixed(1),
            sharedTimelineDurationMs: state.sharedTimelineDurationMs,
            sceneTimelineDurationMs: state.sceneTimelineDurationMs,
            transitionProgress: state.transitionProgress.toFixed(3),
            calculatedDelay: calculatedDelayRef.current,
            enterDuration,
            exitDuration,
            localProgress: state.localProgress.toFixed(3),
            renderProgress: resolveRenderProgress(sceneContext).toFixed(3),
            sceneOffset: sceneContext.sceneOffset,
          });
          lastDelayPhaseRef.current = `${state.mode}:${delayPhase}`;
        }
      }

      if (isVerboseDragDebug()) {
        const bucket = `${state.mode}:${Math.round(state.localProgress * 10) / 10}`;
        if (lastDebugBucketRef.current !== bucket) {
          lastDebugBucketRef.current = bucket;
          console.log(`🔎 [Animate ${componentId}] state snapshot`, {
            mode: state.mode,
            direction: state.direction,
            localProgress: state.localProgress.toFixed(3),
            transitionProgress: state.transitionProgress.toFixed(3),
            sharedElapsedMs: state.sharedElapsedMs.toFixed(1),
            projectedSceneElapsedMs: state.projectedSceneElapsedMs.toFixed(1),
            sharedTimelineDurationMs: state.sharedTimelineDurationMs,
            sceneTimelineDurationMs: state.sceneTimelineDurationMs,
            renderProgress: resolveRenderProgress(sceneContext).toFixed(3),
            calculatedDelay: calculatedDelayRef.current,
            enterDuration,
            exitDuration,
            isActive: sceneContext.isActive,
            isDragging: sceneContext.isDragging,
            sceneOffset: sceneContext.sceneOffset,
            sceneState: sceneContext.sceneState,
          });
        }
      }
    };

    updateVisualMotion();
    const unsubscribes = [
      sceneContext.sharedElapsedMotion?.on('change', updateVisualMotion),
      sceneContext.renderProgressMotion?.on('change', updateVisualMotion),
    ].filter((unsubscribe): unsubscribe is () => void => typeof unsubscribe === 'function');
    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [
    sceneContext,
    visualMotion,
    visualState,
    componentId,
    enterDuration,
    exitDuration,
    isExcludedFromPlayback,
    variantsPending,
    playbackCalculatedDelay,
    playbackEnterDuration,
    playbackSnapshot,
    sceneContext?.renderProgressMotion,
    sceneContext?.renderProgress,
    sceneContext?.isDragging,
    sceneContext?.isActive,
    sceneContext?.sceneOffset,
    sceneContext?.sceneState,
    sceneContext?.dragRelease,
    sceneContext?.firstSceneEnterActive,
  ]);

  const lanes = useAnimatedPropertyLanes(visualState, variantsRef, resolveDragPropertyValue);

  useEffect(() => {
    if (!sceneContext) {
      setShouldRunInfiniteState(false);
      return;
    }

    const update = (): void => {
      const state = resolvePlaybackVisualState(
        sceneContext,
        calculatedDelayRef.current,
        playbackEnterDuration,
        exitDuration,
        isExcludedFromPlayback,
        variantsPending
      );
      const shouldRun =
        sceneContext.isActive &&
        sceneContext.sceneOffset === 0 &&
        !sceneContext.isDragging &&
        (state.mode === 'rest' || state.mode === 'enter') &&
        state.localProgress >= 1 - EPSILON;
      setShouldRunInfiniteState(shouldRun);
    };

    update();
    const unsubscribes = [
      sceneContext.sharedElapsedMotion?.on('change', update),
      sceneContext.renderProgressMotion?.on('change', update),
    ].filter((unsubscribe): unsubscribe is () => void => typeof unsubscribe === 'function');
    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [
    sceneContext,
    playbackEnterDuration,
    isExcludedFromPlayback,
    variantsPending,
    exitDuration,
    sceneContext?.isActive,
    sceneContext?.sceneOffset,
    sceneContext?.isDragging,
    sceneContext?.renderProgressMotion,
    sceneContext?.renderProgress,
    sceneContext?.dragRelease,
    sceneContext?.firstSceneEnterActive,
  ]);

  return {
    style: lanes.style,
    opacity: lanes.opacity,
    x: lanes.x,
    y: lanes.y,
    scale: lanes.scale,
    rotate: lanes.rotate,
    useInteractiveStyles: true,
    shouldRunInfinite: shouldRunInfiniteState,
    // Observable source for the render-prop bridge. visualState carries mode +
    // localProgress; the bridge derives AnimateRenderState from it.
    visualState,
  };
}
