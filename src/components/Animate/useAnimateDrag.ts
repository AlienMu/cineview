import { useEffect, useRef, useState } from 'react';
import { MotionValue, useMotionValue, useTransform } from 'framer-motion';
import type { ParsedAnimationVariant } from '../../types';
import type { SceneContextType } from './Animate';
import {
  clamp,
  getDefaultValue,
  getVariantValue,
  lerpTransformValue,
  parseNumericValue,
  type AnimatableProperty,
  type TransformValue,
  type VariantRecord,
} from './animateInterpolation';

interface UseAnimateDragParams {
  sceneContext: SceneContextType | null;
  enterVariant: ParsedAnimationVariant | null;
  exitVariant: ParsedAnimationVariant | null;
  componentId: string;
  delay: number;
  enterDuration: number;
  exitDuration: number;
  waitFor?: string;
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

interface CachedVariants {
  enterInitial: VariantRecord;
  enterAnimate: VariantRecord;
  exitTarget: VariantRecord;
}

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
  // element track (elapsed ms) which is direction-agnostic, so we derive from the
  // render position sign. (The old snapshot-direction read is deleted — the global
  // snapshot no longer exists.)
  return (sceneContext.renderProgress ?? 0) >= 0 ? 'forward' : 'backward';
}

function resolveElementElapsed(sceneContext: SceneContextType): number {
  return Math.max(0, sceneContext.sharedElapsedMotion?.get() ?? 0);
}

function resolveRenderProgress(sceneContext: SceneContextType): number {
  return sceneContext.renderProgress ?? 0;
}

function resolveSceneTimelineDuration(sceneContext: SceneContextType): number {
  return sceneContext.getTimelineDuration?.() ?? sceneContext.sceneTransitionDuration;
}

function resolveTransitionProgress(sceneContext: SceneContextType): number {
  const fromContext = sceneContext.dragTimelineProgress;
  if (typeof fromContext === 'number') {
    return clamp(fromContext, 0, 1);
  }

  return clamp(Math.abs(resolveRenderProgress(sceneContext)), 0, 1);
}

function resolveSharedTimelineDuration(sceneContext: SceneContextType): number {
  const shared = sceneContext.sharedTimelineDurationMs ?? 0;
  const own = resolveSceneTimelineDuration(sceneContext);
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
// serialisation, and decouples drag SPEED from the clock via `dragTimeScale` (the
// follow-finger write in useElementTrack maps drag % to an absolute ms scale, not
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
  // in how `m` advances (follow-finger uses the dragTimeScale absolute clock).
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
    // Active scene that is sliding away (drag or release render travel): exit
    // follows the render position, unchanged from the prior model.
    if (sceneContext.isDragging || renderProgress > EPSILON) {
      const outgoingDuration = Math.max(exitDuration, 1);
      const renderElapsedMs = renderProgress * sceneContext.sceneTransitionDuration;
      return {
        ...baseState,
        mode: 'outgoing',
        localProgress: clamp(renderElapsedMs / outgoingDuration, 0, 1),
      };
    }

    // Idle active scene. Read the element track ONLY while an enter is genuinely
    // in flight for this scene: the first-screen cold-start window, or a settle
    // continuation that crossed the commit and is still running on this (now
    // active) scene. Otherwise the scene is at rest. The track value itself stays
    // continuous across the commit (same per-scene MotionValue), so this is the
    // continuous-completion read — never a replay. settlePending is reachable in
    // this idle-active state only for the post-commit target scene (the sole
    // offset-0 scene), so a mode check is sufficient.
    const coldStartActive = sceneContext.firstSceneEnterActive === true;
    const settlePending = sceneContext.dragRelease?.mode === 'settle';
    // Programmatic navigation publishes an 'enter' directive whose target is the
    // now-active scene; its element track replays 0->T. This idle-active branch
    // is only reachable for the sole offset-0 scene, which IS that target, so a
    // mode check suffices (no index compare). Read the track for the enter lerp
    // instead of snapping to rest, so ref-driven goToScene/nextScene/prevScene
    // plays the authored enter timeline.
    const programmaticEnterPending = sceneContext.dragRelease?.mode === 'enter';
    if (coldStartActive || settlePending || programmaticEnterPending) {
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

function resolvePropertyValue(
  state: DragVisualState,
  variants: CachedVariants,
  property: AnimatableProperty
): TransformValue {
  const initialValue = getVariantValue(
    variants.enterInitial,
    property,
    getDefaultValue(property, 'initial')
  );
  const animateValue = getVariantValue(
    variants.enterAnimate,
    property,
    getDefaultValue(property, 'animate')
  );
  const exitValue = getVariantValue(
    variants.exitTarget,
    property,
    getDefaultValue(property, 'exit')
  );

  switch (state.mode) {
    case 'rest':
      return animateValue;
    case 'hidden':
      return initialValue;
    case 'enter':
      return lerpTransformValue(initialValue, animateValue, state.localProgress);
    case 'outgoing':
      // When no exitAnimation is authored, exitTarget is {} — skip all
      // exit animation and keep the element at its animate state.
      if (Object.keys(variants.exitTarget).length === 0) {
        return animateValue;
      }
      return lerpTransformValue(
        animateValue,
        state.direction === 'forward' ? exitValue : initialValue,
        state.localProgress
      );
    default:
      return animateValue;
  }
}

// Property transforms derive from the shared visualState MotionValue (resolved
// once per frame in the hook body) instead of each re-running resolveVisualState
// off the raw visualMotion. A null state means no sceneContext — fall back to the
// animate (rest) value, matching the prior per-helper guard.
function useNumericValue(
  visualState: MotionValue<DragVisualState | null>,
  variantsRef: React.MutableRefObject<CachedVariants>,
  property: AnimatableProperty
): MotionValue<number> {
  return useTransform(visualState, (vs) => {
    const variants = variantsRef.current;
    const fallback = parseNumericValue(getDefaultValue(property, 'animate'), 0);
    if (!vs) {
      return parseNumericValue(
        getVariantValue(variants.enterAnimate, property, fallback),
        fallback
      );
    }
    return parseNumericValue(resolvePropertyValue(vs, variants, property), fallback);
  });
}

function useMixedValue(
  visualState: MotionValue<DragVisualState | null>,
  variantsRef: React.MutableRefObject<CachedVariants>,
  property: AnimatableProperty
): MotionValue<number | string> {
  return useTransform(visualState, (vs) => {
    const variants = variantsRef.current;
    if (!vs) {
      return getVariantValue(variants.enterAnimate, property, getDefaultValue(property, 'animate'));
    }
    return resolvePropertyValue(vs, variants, property);
  });
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
}: UseAnimateDragParams): UseAnimateDragReturn {
  const calculatedDelayRef = useRef(0);
  const variantsRef = useRef<CachedVariants>({
    enterInitial: {},
    enterAnimate: {},
    exitTarget: {},
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
    ? resolveVisualState(sceneContext, calculatedDelayRef.current, enterDuration, exitDuration)
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

  useEffect(() => {
    variantsRef.current = {
      enterInitial: (enterVariant?.initial as VariantRecord) || {},
      enterAnimate: (enterVariant?.animate as VariantRecord) || {},
      // When no explicit exitAnimation is authored, derive exit from the same
      exitTarget: (exitVariant?.exit as VariantRecord) || {},
    };
  }, [enterVariant, exitVariant]);

  useEffect(() => {
    if (
      !sceneContext?.registerAnimate ||
      !sceneContext?.unregisterAnimate ||
      !sceneContext?.getCalculatedDelay ||
      !enterVariant
    ) {
      return;
    }

    sceneContext.registerAnimate(componentId, {
      delay,
      duration: enterDuration,
      waitFor,
    });

    calculatedDelayRef.current = sceneContext.getCalculatedDelay(componentId);

    return () => {
      sceneContext.unregisterAnimate(componentId);
    };
  }, [
    sceneContext,
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
      // Live-refresh the cascaded delay. The registration effect seeds this once,
      // but the registry recomputes whenever ANOTHER Animate registers — and a
      // waitFor target commonly registers AFTER its dependent (async variant parse
      // order is non-deterministic). The first read can therefore be a stale
      // pre-dependency value (the missing-dependency branch in registry.ts drops
      // the cascade, leaving only the element's own delay). Re-reading here, on
      // every element-track change, lets the gate use the final cascaded delay.
      const liveDelay = sceneContext.getCalculatedDelay?.(componentId);
      if (typeof liveDelay === 'number') {
        calculatedDelayRef.current = liveDelay;
      }
      const state = resolveVisualState(
        sceneContext,
        calculatedDelayRef.current,
        enterDuration,
        exitDuration
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
    if (!sceneContext.sharedElapsedMotion) {
      return;
    }

    const unsubscribe = sceneContext.sharedElapsedMotion.on('change', () => updateVisualMotion());
    return () => {
      unsubscribe();
    };
  }, [
    sceneContext,
    visualMotion,
    visualState,
    componentId,
    enterDuration,
    exitDuration,
    sceneContext?.renderProgress,
    sceneContext?.isDragging,
    sceneContext?.isActive,
    sceneContext?.sceneOffset,
    sceneContext?.sceneState,
    sceneContext?.dragRelease,
    sceneContext?.firstSceneEnterActive,
  ]);

  const opacity = useNumericValue(visualState, variantsRef, 'opacity');
  const x = useMixedValue(visualState, variantsRef, 'x');
  const y = useMixedValue(visualState, variantsRef, 'y');
  const scale = useNumericValue(visualState, variantsRef, 'scale');
  const rotate = useMixedValue(visualState, variantsRef, 'rotate');
  const rotateX = useMixedValue(visualState, variantsRef, 'rotateX');
  const rotateY = useMixedValue(visualState, variantsRef, 'rotateY');
  const skewX = useMixedValue(visualState, variantsRef, 'skewX');
  const skewY = useMixedValue(visualState, variantsRef, 'skewY');
  const filter = useMixedValue(visualState, variantsRef, 'filter');

  useEffect(() => {
    if (!sceneContext) {
      setShouldRunInfiniteState(false);
      return;
    }

    const update = (): void => {
      const state = resolveVisualState(
        sceneContext,
        calculatedDelayRef.current,
        enterDuration,
        exitDuration
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
    if (!sceneContext.sharedElapsedMotion) {
      return;
    }

    const unsubscribe = sceneContext.sharedElapsedMotion.on('change', update);
    return () => {
      unsubscribe();
    };
  }, [
    sceneContext,
    enterDuration,
    exitDuration,
    sceneContext?.isActive,
    sceneContext?.sceneOffset,
    sceneContext?.isDragging,
    sceneContext?.renderProgress,
    sceneContext?.dragRelease,
    sceneContext?.firstSceneEnterActive,
  ]);

  return {
    style: {
      opacity,
      x,
      y,
      scale,
      rotate,
      rotateX,
      rotateY,
      skewX,
      skewY,
      filter,
    },
    opacity,
    x,
    y,
    scale,
    rotate,
    useInteractiveStyles: true,
    shouldRunInfinite: shouldRunInfiniteState,
    // Observable source for the render-prop bridge. visualState carries mode +
    // localProgress; the bridge derives AnimateRenderState from it.
    visualState,
  };
}
