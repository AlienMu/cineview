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
  mode: 'rest' | 'outgoing' | 'incoming' | 'settling' | 'hidden';
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
  if (sceneContext.dragTransitionSnapshot?.direction) {
    return sceneContext.dragTransitionSnapshot.direction;
  }
  return (sceneContext.renderProgress ?? 0) >= 0 ? 'forward' : 'backward';
}

function resolveSharedElapsed(sceneContext: SceneContextType): number {
  return Math.max(0, sceneContext.sharedElapsedMotion?.get() ?? sceneContext.sharedElapsedMs ?? 0);
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

  if (sceneContext.dragTransitionSnapshot) {
    return clamp(sceneContext.dragTransitionSnapshot.progressRatio, 0, 1);
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

function easeOutQuad(progress: number): number {
  const normalizedProgress = clamp(progress, 0, 1);
  return 1 - (1 - normalizedProgress) * (1 - normalizedProgress);
}

function resolveVisualTimelineProgress(
  sceneContext: SceneContextType,
  transitionProgress: number,
  renderProgress: number
): number {
  const timelineProgress = clamp(transitionProgress, 0, 1);
  const renderTimelineProgress = easeOutQuad(Math.abs(renderProgress));

  if (sceneContext.isDragging) {
    return Math.max(timelineProgress, renderTimelineProgress);
  }

  return timelineProgress;
}

function resolveVisualState(
  sceneContext: SceneContextType,
  calculatedDelay: number,
  enterDuration: number,
  exitDuration: number
): DragVisualState {
  const direction = resolveDirection(sceneContext);
  const sharedElapsedMs = resolveSharedElapsed(sceneContext);
  const transitionProgress = resolveTransitionProgress(sceneContext);
  const sharedTimelineDurationMs = resolveSharedTimelineDuration(sceneContext);
  const sceneTimelineDurationMs = resolveSceneTimelineDuration(sceneContext);
  const renderProgress = Math.abs(resolveRenderProgress(sceneContext));
  const visualTimelineProgress = resolveVisualTimelineProgress(
    sceneContext,
    transitionProgress,
    renderProgress
  );
  const projectedSceneElapsedMs = visualTimelineProgress * sceneTimelineDurationMs;
  const dragLocalProgress = resolveEnterLocalProgress(
    projectedSceneElapsedMs,
    calculatedDelay,
    enterDuration
  );
  const isSettlingIncoming =
    sceneContext.isActive &&
    !sceneContext.isDragging &&
    !!sceneContext.dragTransitionSnapshot &&
    sceneContext.sceneOffset === 0 &&
    transitionProgress > EPSILON &&
    transitionProgress < 1 - EPSILON;

  if (sceneContext.sceneOffset === 0 && sceneContext.isActive) {
    if (sceneContext.isDragging || renderProgress > EPSILON) {
      const outgoingDuration = Math.max(exitDuration, 1);
      const renderElapsedMs = renderProgress * sceneContext.sceneTransitionDuration;
      return {
        mode: 'outgoing',
        direction,
        transitionProgress,
        sharedElapsedMs,
        projectedSceneElapsedMs,
        sharedTimelineDurationMs,
        sceneTimelineDurationMs,
        localProgress: clamp(renderElapsedMs / outgoingDuration, 0, 1),
        sceneOffset: sceneContext.sceneOffset,
      };
    }

    if (isSettlingIncoming) {
      const settlingElapsedMs = Math.max(sharedElapsedMs, projectedSceneElapsedMs);
      const settlingLocalProgress = resolveEnterLocalProgress(
        settlingElapsedMs,
        calculatedDelay,
        enterDuration
      );
      return {
        mode: 'settling',
        direction,
        transitionProgress,
        sharedElapsedMs: settlingElapsedMs,
        projectedSceneElapsedMs: settlingElapsedMs,
        sharedTimelineDurationMs,
        sceneTimelineDurationMs,
        localProgress: settlingLocalProgress,
        sceneOffset: sceneContext.sceneOffset,
      };
    }

    return {
      mode: 'rest',
      direction,
      transitionProgress,
      sharedElapsedMs,
      projectedSceneElapsedMs: sceneTimelineDurationMs,
      sharedTimelineDurationMs,
      sceneTimelineDurationMs,
      localProgress: 1,
      sceneOffset: sceneContext.sceneOffset,
    };
  }

  const isIncoming =
    (direction === 'forward' && sceneContext.sceneOffset === 1) ||
    (direction === 'backward' && sceneContext.sceneOffset === -1);

  if (
    isIncoming &&
    (sceneContext.isDragging || Math.abs(resolveRenderProgress(sceneContext)) > EPSILON)
  ) {
    return {
      mode: 'incoming',
      direction,
      transitionProgress,
      sharedElapsedMs,
      projectedSceneElapsedMs,
      sharedTimelineDurationMs,
      sceneTimelineDurationMs,
      localProgress: dragLocalProgress,
      sceneOffset: sceneContext.sceneOffset,
    };
  }

  return {
    mode: 'hidden',
    direction,
    transitionProgress,
    sharedElapsedMs,
    projectedSceneElapsedMs: 0,
    sharedTimelineDurationMs,
    sceneTimelineDurationMs,
    localProgress: 0,
    sceneOffset: sceneContext.sceneOffset,
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
    case 'incoming':
    case 'settling':
      return lerpStringValue(initialValue, animateValue, state.localProgress);
    case 'outgoing':
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
    const resolved = sceneContext
      ? resolvePropertyValue(
          resolveVisualState(sceneContext, calculatedDelayRef.current, enterDuration, exitDuration),
          variants,
          property
        )
      : getVariantValue(variants.enterAnimate, property, fallback);

    return parseNumericValue(resolved, fallback);
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

    return resolvePropertyValue(
      resolveVisualState(sceneContext, calculatedDelayRef.current, enterDuration, exitDuration),
      variants,
      property
    );
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
  // on the very first frame.
  const visualMotion = useMotionValue(0);
  const [shouldRunInfiniteState, setShouldRunInfiniteState] = useState(false);
  const lastDebugBucketRef = useRef<string | null>(null);
  const lastModeRef = useRef<string | null>(null);
  const lastDelayPhaseRef = useRef<string | null>(null);

  useEffect(() => {
    variantsRef.current = {
      enterInitial: (enterVariant?.initial as VariantRecord) || {},
      enterAnimate: (enterVariant?.animate as VariantRecord) || {},
      // When no explicit exitAnimation is authored, derive exit from the same
      // preset. The preset definitions include exit keyframes (e.g. slide-up
      // exits to y: '-100%'). Without this, exitTarget is {} and position
      // properties fall back to numeric 0, causing lerpStringValue to produce
      // '0%' — freezing the position while only opacity animates during exit.
      exitTarget:
        (exitVariant?.exit as VariantRecord) ||
        (enterVariant?.exit as VariantRecord) ||
        {},
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
      visualMotion.set(nextValue);

      const modeKey = [
        state.mode,
        state.direction,
        sceneContext.sceneOffset,
        sceneContext.isActive ? 'active' : 'inactive',
        sceneContext.isDragging ? 'dragging' : 'idle',
      ].join(':');

      if (lastModeRef.current !== modeKey) {
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
        lastModeRef.current = modeKey;
      }

      const shouldTraceDelay = state.mode === 'incoming' || state.mode === 'settling';
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
    sceneContext?.dragTransitionSnapshot,
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
        (state.mode === 'rest' || state.mode === 'settling') &&
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
    sceneContext?.dragTransitionSnapshot,
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
