/**
 * Pure visual-state resolution for the drag driver.
 *
 * Split out of `useAnimateDrag.ts` (task-flow 2026-09-01, N6 batch A). Everything
 * here is a top-level function over its arguments: no hooks, no DOM reads, no
 * module state. `SceneContextType` is a PARAMETER, not a captured closure — which
 * is what makes the split behaviour-preserving rather than a re-plumbing.
 *
 * The hook keeps the parts that are genuinely stateful (MotionValue lanes, the
 * per-frame subscription, the debug channel); this file keeps the arithmetic.
 */
import type { SceneContextType } from './Animate';
import {
  clamp,
  getDefaultValue,
  getVariantTerminalValue,
  interpolateVariantValue,
  type AnimatableProperty,
  type SceneVariantRecords,
  type TransformValue,
} from './animateInterpolation';
import type { DragSceneTransaction, PreparedSceneSnapshot } from '../Scene/dragPreparedState';

const EPSILON = 0.001;

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

export function resolveDirection(sceneContext: SceneContextType): 'forward' | 'backward' {
  // Direction is only needed for the outgoing/exit lerp. The enter source is the
  // element track (elapsed ms) which is direction-agnostic, so derive it from the
  // React-owned signed render snapshot.
  return resolveRenderProgress(sceneContext) >= 0 ? 'forward' : 'backward';
}

export function resolveElementElapsed(sceneContext: SceneContextType): number {
  return Math.max(0, sceneContext.sharedElapsedMotion?.get() ?? 0);
}

export function resolveRenderProgress(sceneContext: SceneContextType): number {
  return sceneContext.renderProgressMotion?.get() ?? sceneContext.renderProgress ?? 0;
}

export function resolvePlaybackSnapshot(
  sceneContext: SceneContextType
): DragSceneTransaction | PreparedSceneSnapshot | null {
  if (sceneContext.dragTransaction) return sceneContext.dragTransaction;
  if (sceneContext.firstSceneEnterActive === true) {
    return sceneContext.preparedSnapshot ?? null;
  }
  return null;
}

export function resolveSceneTimelineDuration(sceneContext: SceneContextType): number {
  return (
    resolvePlaybackSnapshot(sceneContext)?.registrySnapshot.timelineDuration ??
    sceneContext.getTimelineDuration?.() ??
    sceneContext.sceneTransitionDuration
  );
}

export function resolveTransitionProgress(sceneContext: SceneContextType): number {
  const fromContext = sceneContext.dragTimelineProgress;
  if (typeof fromContext === 'number') {
    return clamp(fromContext, 0, 1);
  }

  return clamp(Math.abs(resolveRenderProgress(sceneContext)), 0, 1);
}

export function resolveSharedTimelineDuration(sceneContext: SceneContextType): number {
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
// after / delay sequencing is correct for free: `calculatedDelay` already folds
// in the after target's full delay+duration at registration (registry.ts), so a
// chain member B gates at A's completion — B cannot start until A has played out.
// This is the original two-track (2026-06-25) behaviour. SHORT elements settle
// EARLY (a 200ms element reaches 1 while the shared clock is only part-way to
// T_self) — this is ACCEPTED: the user trades early settle for correct after
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

export function resolveVisualState(
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
  // its own calculatedDelay/enterDuration. after/delay sequencing is correct via
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

export function resolvePlaybackVisualState(
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

export function resolvePropertyValue(
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
export function resolveDragPropertyValue(
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
