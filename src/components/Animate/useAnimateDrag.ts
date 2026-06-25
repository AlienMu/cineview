import { useEffect, useRef, useState } from 'react';
import { MotionValue, useMotionValue, useTransform } from 'framer-motion';
import type { ParsedAnimationVariant } from '../../types';
import type { SceneContextType } from './Animate';

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
}

type DragProperty =
  | 'opacity'
  | 'x'
  | 'y'
  | 'scale'
  | 'rotate'
  | 'rotateX'
  | 'rotateY'
  | 'skewX'
  | 'skewY'
  | 'filter';
type VariantRecord = Record<string, unknown>;
type TransformValue = number | string;
type DragMotionValue = MotionValue<number> | MotionValue<string> | MotionValue<number | string>;

interface CachedVariants {
  enterInitial: VariantRecord;
  enterAnimate: VariantRecord;
  exitTarget: VariantRecord;
}

interface DragVisualState {
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function lerpStringValue(
  start: TransformValue,
  end: TransformValue,
  progress: number
): TransformValue {
  if (typeof start === 'number' && typeof end === 'number') {
    return lerp(start, end, progress);
  }

  const startStr = String(start);
  const endStr = String(end);
  const startMatch = startStr.match(/^([-\d.]+)(.*)$/);
  const endMatch = endStr.match(/^([-\d.]+)(.*)$/);

  if (startMatch && endMatch) {
    const startNum = parseFloat(startMatch[1]);
    const endNum = parseFloat(endMatch[1]);
    const unit = endMatch[2] || startMatch[2] || '';
    const interpolated = lerp(startNum, endNum, progress);
    return unit ? `${interpolated}${unit}` : interpolated;
  }

  const startFuncMatch = startStr.match(/^([a-zA-Z]+)\(([-\d.]+)(.*)\)$/);
  const endFuncMatch = endStr.match(/^([a-zA-Z]+)\(([-\d.]+)(.*)\)$/);

  if (startFuncMatch && endFuncMatch && startFuncMatch[1] === endFuncMatch[1]) {
    const startNum = parseFloat(startFuncMatch[2]);
    const endNum = parseFloat(endFuncMatch[2]);
    const unit = endFuncMatch[3] || startFuncMatch[3] || '';
    const interpolated = lerp(startNum, endNum, progress);
    return `${endFuncMatch[1]}(${interpolated}${unit})`;
  }

  return progress >= 1 ? end : start;
}

function parseNumericValue(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function getDefaultValue(
  property: DragProperty,
  phase: 'initial' | 'animate' | 'exit'
): TransformValue {
  switch (property) {
    case 'opacity':
      return phase === 'initial' || phase === 'exit' ? 0 : 1;
    case 'scale':
      return 1;
    case 'filter':
      return 'none';
    default:
      return 0;
  }
}

function getVariantValue<T extends TransformValue>(
  record: VariantRecord,
  property: DragProperty,
  fallback: T
): T {
  const value = record[property];
  return value === undefined ? fallback : (value as T);
}

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

function resolveEnterLocalProgress(
  sharedElapsedMs: number,
  calculatedDelay: number,
  enterDuration: number
): number {
  if (sharedElapsedMs <= calculatedDelay) {
    return 0;
  }
  if (enterDuration <= 0) {
    return 1;
  }
  return clamp((sharedElapsedMs - calculatedDelay) / enterDuration, 0, 1);
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
  // Element enter progress: a pure function of the per-scene track elapsed,
  // gated by the element's own (calculated) delay. Direction-agnostic — the
  // lerp is always initial -> animate.
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
    if (coldStartActive || settlePending) {
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
  property: DragProperty
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
      return lerpStringValue(initialValue, animateValue, state.localProgress);
    case 'outgoing':
      // When no exitAnimation is authored, exitTarget is {} — skip all
      // exit animation and keep the element at its animate state.
      if (Object.keys(variants.exitTarget).length === 0) {
        return animateValue;
      }
      return lerpStringValue(
        animateValue,
        state.direction === 'forward' ? exitValue : initialValue,
        state.localProgress
      );
    default:
      return animateValue;
  }
}

function useNumericValue(
  visualMotion: MotionValue<number>,
  sceneContext: SceneContextType | null,
  variantsRef: React.MutableRefObject<CachedVariants>,
  calculatedDelayRef: React.MutableRefObject<number>,
  enterDuration: number,
  exitDuration: number,
  property: DragProperty
): MotionValue<number> {
  return useTransform(visualMotion, () => {
    const variants = variantsRef.current;
    const fallback = parseNumericValue(getDefaultValue(property, 'animate'), 0);
    if (!sceneContext) {
      return parseNumericValue(
        getVariantValue(variants.enterAnimate, property, fallback),
        fallback
      );
    }
    const vs = resolveVisualState(
      sceneContext,
      calculatedDelayRef.current,
      enterDuration,
      exitDuration
    );
    return parseNumericValue(resolvePropertyValue(vs, variants, property), fallback);
  });
}

function useMixedValue(
  visualMotion: MotionValue<number>,
  sceneContext: SceneContextType | null,
  variantsRef: React.MutableRefObject<CachedVariants>,
  calculatedDelayRef: React.MutableRefObject<number>,
  enterDuration: number,
  exitDuration: number,
  property: DragProperty
): MotionValue<number | string> {
  return useTransform(visualMotion, () => {
    const variants = variantsRef.current;
    if (!sceneContext) {
      return getVariantValue(variants.enterAnimate, property, getDefaultValue(property, 'animate'));
    }
    const vs = resolveVisualState(
      sceneContext,
      calculatedDelayRef.current,
      enterDuration,
      exitDuration
    );
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
  const initialVisualMotion = (() => {
    if (!sceneContext) return 0;
    const state = resolveVisualState(
      sceneContext,
      calculatedDelayRef.current,
      enterDuration,
      exitDuration
    );
    return state.mode === 'outgoing'
      ? (state.direction === 'forward' ? 1 : -1) * state.localProgress
      : state.localProgress;
  })();
  const visualMotion = useMotionValue(initialVisualMotion);
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

  const opacity = useNumericValue(
    visualMotion,
    sceneContext,
    variantsRef,
    calculatedDelayRef,
    enterDuration,
    exitDuration,
    'opacity'
  );
  const x = useMixedValue(
    visualMotion,
    sceneContext,
    variantsRef,
    calculatedDelayRef,
    enterDuration,
    exitDuration,
    'x'
  );
  const y = useMixedValue(
    visualMotion,
    sceneContext,
    variantsRef,
    calculatedDelayRef,
    enterDuration,
    exitDuration,
    'y'
  );
  const scale = useNumericValue(
    visualMotion,
    sceneContext,
    variantsRef,
    calculatedDelayRef,
    enterDuration,
    exitDuration,
    'scale'
  );
  const rotate = useMixedValue(
    visualMotion,
    sceneContext,
    variantsRef,
    calculatedDelayRef,
    enterDuration,
    exitDuration,
    'rotate'
  );
  const rotateX = useMixedValue(
    visualMotion,
    sceneContext,
    variantsRef,
    calculatedDelayRef,
    enterDuration,
    exitDuration,
    'rotateX'
  );
  const rotateY = useMixedValue(
    visualMotion,
    sceneContext,
    variantsRef,
    calculatedDelayRef,
    enterDuration,
    exitDuration,
    'rotateY'
  );
  const skewX = useMixedValue(
    visualMotion,
    sceneContext,
    variantsRef,
    calculatedDelayRef,
    enterDuration,
    exitDuration,
    'skewX'
  );
  const skewY = useMixedValue(
    visualMotion,
    sceneContext,
    variantsRef,
    calculatedDelayRef,
    enterDuration,
    exitDuration,
    'skewY'
  );
  const filter = useMixedValue(
    visualMotion,
    sceneContext,
    variantsRef,
    calculatedDelayRef,
    enterDuration,
    exitDuration,
    'filter'
  );

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
  };
}
