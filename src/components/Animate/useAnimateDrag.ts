import { useEffect, useRef, useState } from 'react';
import { MotionValue, useMotionValue } from 'framer-motion';
import type { ParsedAnimationVariant } from '../../types';
import type { SceneContextType } from './Animate';
import type { DragSceneTransaction, PreparedSceneSnapshot } from '../Scene/dragPreparedState';
import {
  clamp,
  getDefaultValue,
  getVariantTerminalValue,
  interpolateVariantValue,
  type AnimatableProperty,
  type SceneVariantRecords,
  type TransformValue,
  type VariantRecord,
} from './animateInterpolation';
import { useAnimatedPropertyLanes } from './useAnimatedPropertyLanes';
import { devWarn } from '../../utils/devLog';

interface UseAnimateDragParams {
  sceneContext: SceneContextType | null;
  enterVariant: ParsedAnimationVariant | null;
  exitVariant: ParsedAnimationVariant | null;
  componentId: string;
  delay: number;
  enterDuration: number;
  exitDuration: number;
  waitFor?: string;
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

export interface DragVisualState {
  // Two-track model (2026-06-25): the enter source is unified to ONE per-scene
  // element track (sceneContext.sharedElapsedMotion). incoming, active-settle and
  // cold-start all read the same track via the `enter` mode. Outgoing follows the
  // render position for exit. The old `settling`/snapshot/cold-start split is gone.
  mode: 'rest' | 'outgoing' | 'enter' | 'hidden';
  direction: 'forward' | 'backward';
  transitionProgress: number;
  sharedElapsedMs: number;
  projectedSceneElapsedMs: number;
  sharedTimelineDurationMs: number;
  sceneTimelineDurationMs: number;
  localProgress: number;
  sceneOffset: number;
}

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

function resolveDirection(sceneContext: SceneContextType): 'forward' | 'backward' {
  // Direction is only needed for the outgoing/exit lerp. The enter source is the
  // element track (elapsed ms) which is direction-agnostic, so derive it from the
  // React-owned signed render snapshot.
  return resolveRenderProgress(sceneContext) >= 0 ? 'forward' : 'backward';
}

function resolveElementElapsed(sceneContext: SceneContextType): number {
  return Math.max(0, sceneContext.sharedElapsedMotion?.get() ?? 0);
}

function resolveRenderProgress(sceneContext: SceneContextType): number {
  return sceneContext.renderProgressMotion?.get() ?? sceneContext.renderProgress ?? 0;
}

function resolvePlaybackSnapshot(
  sceneContext: SceneContextType
): DragSceneTransaction | PreparedSceneSnapshot | null {
  if (sceneContext.dragTransaction) return sceneContext.dragTransaction;
  if (sceneContext.firstSceneEnterActive === true) {
    return sceneContext.preparedSnapshot ?? null;
  }
  return null;
}

function resolveSceneTimelineDuration(sceneContext: SceneContextType): number {
  return (
    resolvePlaybackSnapshot(sceneContext)?.registrySnapshot.timelineDuration ??
    sceneContext.getTimelineDuration?.() ??
    sceneContext.sceneTransitionDuration
  );
}

function resolveTransitionProgress(sceneContext: SceneContextType): number {
  const fromContext = sceneContext.dragTimelineProgress;
  if (typeof fromContext === 'number') {
    return clamp(fromContext, 0, 1);
  }

  return clamp(Math.abs(resolveRenderProgress(sceneContext)), 0, 1);
}

function resolveSharedTimelineDuration(sceneContext: SceneContextType): number {
  const own = resolveSceneTimelineDuration(sceneContext);
  if (resolvePlaybackSnapshot(sceneContext)) return own;

  const shared = sceneContext.sharedTimelineDurationMs ?? 0;
  return shared > 0 ? shared : own;
}

// Enter local progress — SINGLE shared timeline (restored 2026-06-30).
//
// The per-scene element track `elementElapsedMotion` runs as a single shared
// elapsed-ms clock. EVERY element reads the SAME `m` and gates on its OWN
// `calculatedDelay` / `enterDuration`:
//
//   localProgress = clamp((m - calculatedDelay) / enterDuration, 0, 1)
//
// waitFor / delay sequencing is correct for free: `calculatedDelay` already folds
// in the waitFor target's full delay+duration at registration (registry.ts), so a
// chain member B gates at A's completion — B cannot start until A has played out.
// This is the original two-track (2026-06-25) behaviour. SHORT elements settle
// EARLY (a 200ms element reaches 1 while the shared clock is only part-way to
// T_self) — this is ACCEPTED: the user trades early settle for correct waitFor
// serialisation, and decouples drag SPEED from the clock via the resolved `time`
// mapping scale (the follow-finger write maps drag % to absolute milliseconds, not
// to T_self), so the clock advances slowly enough that early settle is gentle.
//
// The same formula serves all drivers (follow-finger, settle, cold-start,
// programmatic) — they differ only in HOW `m` is advanced, never in how it is read.
export function resolveEnterLocalProgress(
  sceneElapsedMs: number,
  calculatedDelay: number,
  enterDuration: number
): number {
  if (enterDuration <= 0) {
    return sceneElapsedMs >= calculatedDelay - EPSILON ? 1 : 0;
  }
  if (sceneElapsedMs <= calculatedDelay) {
    return 0;
  }
  return clamp((sceneElapsedMs - calculatedDelay) / enterDuration, 0, 1);
}

function resolveVisualState(
  sceneContext: SceneContextType,
  calculatedDelay: number,
  enterDuration: number,
  exitDuration: number
): DragVisualState {
  const direction = resolveDirection(sceneContext);
  // UNIFIED enter source (two-track model): the element track elapsed ms, owned
  // and driven by THIS scene's useElementTrack. incoming, active-settle and
  // cold-start all read this one value — no snapshot, no projected-from-ratio.
  const elementElapsedMs = resolveElementElapsed(sceneContext);
  const transitionProgress = resolveTransitionProgress(sceneContext);
  const sharedTimelineDurationMs = resolveSharedTimelineDuration(sceneContext);
  const sceneTimelineDurationMs = resolveSceneTimelineDuration(sceneContext);
  const renderProgress = Math.abs(resolveRenderProgress(sceneContext));
  // Single shared timeline: every element reads the same elapsed `m` and gates on
  // its own calculatedDelay/enterDuration. waitFor/delay sequencing is correct via
  // calculatedDelay; short elements settle early (accepted). The drivers differ only
  // in how `m` advances (follow-finger uses the resolved mapping scale).
  const enterLocalProgress = resolveEnterLocalProgress(
    elementElapsedMs,
    calculatedDelay,
    enterDuration
  );

  const baseState = {
    direction,
    transitionProgress,
    sharedElapsedMs: elementElapsedMs,
    projectedSceneElapsedMs: elementElapsedMs,
    sharedTimelineDurationMs,
    sceneTimelineDurationMs,
    sceneOffset: sceneContext.sceneOffset,
  };

  if (sceneContext.sceneOffset === 0 && sceneContext.isActive) {
    // An enter can be genuinely in flight for this active scene: the
    // first-screen cold-start window, a settle continuation that crossed the
    // commit and is still running on this (now active) scene, or a programmatic
    // 'enter' replay (goToScene). All are reachable only for the sole offset-0
    // scene, so a mode check suffices (no index compare).
    const coldStartActive = sceneContext.firstSceneEnterActive === true;
    const settlePending = sceneContext.dragRelease?.mode === 'settle';
    const programmaticEnterPending = sceneContext.dragRelease?.mode === 'enter';
    const enterInFlight = coldStartActive || settlePending || programmaticEnterPending;

    // Active scene that is sliding away (drag or release render travel): exit
    // follows the render position, unchanged from the prior model.
    if (sceneContext.isDragging || renderProgress > EPSILON) {
      // D-F1: a rush re-grab holds the pointer down while the render lane is
      // still at 0 and this scene's enter continuation is live (its settle was
      // preempted in place by H2). Until the finger actually MOVES the render
      // lane, keep reading the enter track (frozen at the preempt point)
      // instead of flashing to the outgoing resolution (which sits at the
      // terminal animate values at renderProgress 0). The first real movement
      // hands off to the outgoing exit scrub as before. For a scene at rest
      // (no enter in flight) this branch is unreachable, so plain drags are
      // untouched.
      if (renderProgress <= EPSILON && enterInFlight) {
        return {
          ...baseState,
          mode: 'enter',
          localProgress: enterLocalProgress,
        };
      }
      const outgoingDuration = Math.max(exitDuration, 1);
      const renderElapsedMs = renderProgress * sceneContext.sceneTransitionDuration;
      return {
        ...baseState,
        mode: 'outgoing',
        localProgress: clamp(renderElapsedMs / outgoingDuration, 0, 1),
      };
    }

    // Idle active scene. Read the element track ONLY while an enter is genuinely
    // in flight for this scene. Otherwise the scene is at rest. The track value
    // itself stays continuous across the commit (same per-scene MotionValue), so
    // this is the continuous-completion read — never a replay. For the
    // programmatic 'enter' directive, reading the track (instead of snapping to
    // rest) lets ref-driven goToScene/nextScene/prevScene play the authored
    // enter timeline.
    if (enterInFlight) {
      return {
        ...baseState,
        mode: 'enter',
        localProgress: enterLocalProgress,
      };
    }

    return {
      ...baseState,
      mode: 'rest',
      projectedSceneElapsedMs: sceneTimelineDurationMs,
      localProgress: 1,
    };
  }

  const isIncoming =
    (direction === 'forward' && sceneContext.sceneOffset === 1) ||
    (direction === 'backward' && sceneContext.sceneOffset === -1);

  if (isIncoming && (sceneContext.isDragging || renderProgress > EPSILON)) {
    return {
      ...baseState,
      mode: 'enter',
      localProgress: enterLocalProgress,
    };
  }

  return {
    ...baseState,
    mode: 'hidden',
    projectedSceneElapsedMs: 0,
    localProgress: 0,
  };
}

function resolvePlaybackVisualState(
  sceneContext: SceneContextType,
  calculatedDelay: number,
  enterDuration: number,
  exitDuration: number,
  excludedFromPlayback: boolean,
  variantsPending: boolean
): DragVisualState {
  const state = resolveVisualState(sceneContext, calculatedDelay, enterDuration, exitDuration);
  // Authored-but-unparsed: every mode would otherwise resolve through the empty
  // variant records, whose `animate` defaults are the VISIBLE frame (opacity 1).
  // Holding the initial frame keeps the element hidden until its real variants
  // land, so the parse boundary is invisible instead of a flash.
  if (variantsPending) {
    return { ...state, mode: 'hidden', localProgress: 0, projectedSceneElapsedMs: 0 };
  }
  if (!excludedFromPlayback) return state;

  // An Animate mounted after the immutable playback snapshot was captured is
  // deliberately excluded from this activation. Render its authored terminal
  // state without adding it to, or extending, the in-flight timeline.
  return {
    ...state,
    mode: 'rest',
    localProgress: 1,
    projectedSceneElapsedMs: state.sceneTimelineDurationMs,
  };
}

function resolvePropertyValue(
  state: DragVisualState,
  variants: SceneVariantRecords,
  property: AnimatableProperty
): TransformValue {
  const initialValue = getVariantTerminalValue(
    variants.enterInitial,
    property,
    getDefaultValue(property, 'initial')
  );
  const animateValue = getVariantTerminalValue(
    variants.enterAnimate,
    property,
    getDefaultValue(property, 'animate')
  );

  switch (state.mode) {
    case 'rest':
      return animateValue;
    case 'hidden':
      return initialValue;
    case 'enter':
      return interpolateVariantValue(
        initialValue,
        variants.enterAnimate,
        property,
        getDefaultValue(property, 'animate'),
        state.localProgress
      );
    case 'outgoing':
      // When no exitAnimation is authored, exitTarget is {} — skip all
      // exit animation and keep the element at its animate state.
      if (Object.keys(variants.exitTarget).length === 0) {
        return animateValue;
      }
      if (state.direction === 'forward') {
        return interpolateVariantValue(
          animateValue,
          variants.exitTarget,
          property,
          getDefaultValue(property, 'exit'),
          state.localProgress
        );
      }
      return interpolateVariantValue(
        initialValue,
        variants.enterAnimate,
        property,
        getDefaultValue(property, 'animate'),
        1 - state.localProgress
      );
    default:
      return animateValue;
  }
}

// Property lanes derive from the shared visualState MotionValue (resolved once
// per frame in the hook body) instead of each re-running resolveVisualState
// off the raw visualMotion. A null state means no sceneContext — fall back to
// the animate (rest) terminal value. Injected into useAnimatedPropertyLanes;
// the numeric lanes' parse wrapper is value-identical for opacity/scale because
// getDefaultValue(p, 'animate') is 1 and parseNumericValue(1, 0) === 1.
function resolveDragPropertyValue(
  state: DragVisualState | null,
  variants: SceneVariantRecords,
  property: AnimatableProperty
): TransformValue {
  if (!state) {
    return getVariantTerminalValue(
      variants.enterAnimate,
      property,
      getDefaultValue(property, 'animate')
    );
  }
  return resolvePropertyValue(state, variants, property);
}

export function useAnimateDrag({
  sceneContext,
  enterVariant,
  exitVariant,
  componentId,
  delay,
  enterDuration,
  exitDuration,
  waitFor,
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
      frozenRegistration.waitFor !== waitFor ||
      frozenRegistration.driver !== 'drag';
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
    waitFor,
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
      waitFor,
      driver: 'drag',
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
    waitFor,
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
