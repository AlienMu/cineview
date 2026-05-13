import type { MutableRefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { MotionValue, animate, useMotionValue, useTransform } from 'framer-motion';
import type { ParsedAnimationVariant } from '../../types';
import type {
  NormalizedAnimateTimeline,
  NormalizedAnimateVisibility,
  SceneContextType,
} from './Animate';
import type { ScrollZoneRuntimeContextValue } from '../ScrollZone';

interface UseAnimateScrollParams {
  sceneContext: SceneContextType | null;
  zoneRuntime: ScrollZoneRuntimeContextValue | null;
  zoneId: string | null;
  enterVariant: ParsedAnimationVariant | null;
  exitVariant: ParsedAnimationVariant | null;
  componentId: string;
  duration: {
    enter: number;
    exit: number;
  };
  timeline: NormalizedAnimateTimeline;
  visibility: NormalizedAnimateVisibility;
}

interface UseAnimateScrollReturn {
  style: Record<string, MotionValue<number> | MotionValue<string> | MotionValue<number | string>>;
  shouldRunInfinite: boolean;
}

type AnimatedProperty =
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function lerpValue(start: TransformValue, end: TransformValue, progress: number): TransformValue {
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

function resolvePhaseBoundaryPx(
  phase: number | undefined,
  fallbackPx: number,
  windowStartPx: number,
  windowEndPx: number
): number {
  if (phase === undefined) {
    return fallbackPx;
  }

  const clampedPhase = clamp(phase, 0, 1);
  return windowStartPx + (windowEndPx - windowStartPx) * clampedPhase;
}

function getDefaultValue(
  property: AnimatedProperty,
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
  property: AnimatedProperty,
  fallback: T
): T {
  const value = record[property];
  return value === undefined ? fallback : (value as T);
}

function hasExitAnimation(
  exitVariant: ParsedAnimationVariant | null,
  exitDuration: number
): boolean {
  return Boolean(
    exitDuration > 0 &&
    exitVariant?.exit &&
    Object.keys(exitVariant.exit as Record<string, unknown>).length > 0
  );
}

function resolveWarmupProgress(
  hostElement: HTMLElement | null,
  sceneContext: SceneContextType | null,
  hasExplicitEnter: boolean
): number {
  if (
    !hostElement ||
    !sceneContext?.isVisible ||
    !hasExplicitEnter ||
    typeof window === 'undefined'
  ) {
    return 0;
  }

  const rect = hostElement.getBoundingClientRect();
  const viewportHeight = Math.max(window.innerHeight || 0, 1);
  const overlap = Math.max(Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0), 0);
  const visibleRatio = clamp(
    overlap / Math.max(Math.min(rect.height || viewportHeight, viewportHeight), 1),
    0,
    1
  );
  const sceneVisibility = clamp(
    sceneContext.visibilityProgress ?? (sceneContext.isVisible ? 1 : 0),
    0,
    1
  );
  const activeWeight = sceneContext.isActive ? 1 : 0.72;
  const warmup = Math.max(visibleRatio * 0.5, sceneVisibility * 0.35) * activeWeight;

  return clamp(warmup * 0.18, 0, 0.18);
}

function useMixedValue(
  visualMotion: MotionValue<number>,
  variantsRef: MutableRefObject<{
    enterInitial: VariantRecord;
    enterAnimate: VariantRecord;
    exitTarget: VariantRecord;
  }>,
  property: AnimatedProperty
): MotionValue<number | string> {
  return useTransform(visualMotion, (progress) => {
    const variants = variantsRef.current;
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

    if (progress >= 0) {
      return lerpValue(initialValue, animateValue, progress);
    }

    return lerpValue(animateValue, exitValue, Math.abs(progress));
  });
}

function useNumericValue(
  visualMotion: MotionValue<number>,
  variantsRef: MutableRefObject<{
    enterInitial: VariantRecord;
    enterAnimate: VariantRecord;
    exitTarget: VariantRecord;
  }>,
  property: AnimatedProperty
): MotionValue<number> {
  return useTransform(visualMotion, (progress) => {
    const variants = variantsRef.current;
    const fallback = parseNumericValue(getDefaultValue(property, 'animate'), 0);
    const initialValue = parseNumericValue(
      getVariantValue(variants.enterInitial, property, getDefaultValue(property, 'initial')),
      fallback
    );
    const animateValue = parseNumericValue(
      getVariantValue(variants.enterAnimate, property, getDefaultValue(property, 'animate')),
      fallback
    );
    const exitValue = parseNumericValue(
      getVariantValue(variants.exitTarget, property, getDefaultValue(property, 'exit')),
      fallback
    );

    if (progress >= 0) {
      return lerp(initialValue, animateValue, progress);
    }

    return lerp(animateValue, exitValue, Math.abs(progress));
  });
}

export function useAnimateScroll({
  sceneContext,
  zoneRuntime,
  zoneId,
  enterVariant,
  exitVariant,
  componentId,
  duration,
  timeline,
  visibility,
}: UseAnimateScrollParams): UseAnimateScrollReturn {
  const enterDuration = duration.enter;
  const exitDuration = duration.exit;
  const delay = timeline.delay;
  const waitFor = timeline.waitFor;
  const isScrollDriven = timeline.driver === 'scroll';
  const phaseStart = timeline.phase?.start;
  const phaseEnd = timeline.phase?.end;
  const enterWhen = visibility.enterWhen;
  const exitWhen = visibility.exitWhen;
  const replayOnReenter = visibility.replayOnReenter;
  const calculatedDelayRef = useRef(0);
  const variantsRef = useRef({
    enterInitial: {} as VariantRecord,
    enterAnimate: {} as VariantRecord,
    exitTarget: {} as VariantRecord,
  });
  const visualMotion = useMotionValue(0);
  const [shouldRunInfiniteState, setShouldRunInfiniteState] = useState(false);
  const hostRef = useRef<HTMLElement | null>(null);
  const [hostVersion, setHostVersion] = useState(0);
  const hasWarnedOrphanRef = useRef(false);
  const previousRectTopRef = useRef<number | null>(null);
  const autoLifecycleRef = useRef({
    hasEntered: false,
    hasExited: false,
  });
  const hasExplicitEnter = Boolean(
    enterVariant?.animate && Object.keys(enterVariant.animate as Record<string, unknown>).length > 0
  );
  const hasExplicitExit = hasExitAnimation(exitVariant, exitDuration);

  useEffect(() => {
    variantsRef.current = {
      enterInitial: (enterVariant?.initial as VariantRecord) || {},
      enterAnimate: (enterVariant?.animate as VariantRecord) || {},
      exitTarget: (exitVariant?.exit as VariantRecord) || {},
    };
  }, [enterVariant, exitVariant]);

  useEffect(() => {
    if (
      !sceneContext?.registerAnimate ||
      !sceneContext?.unregisterAnimate ||
      !sceneContext?.getCalculatedDelay ||
      (!enterVariant && !exitVariant)
    ) {
      return;
    }

    sceneContext.registerAnimate(componentId, {
      delay,
      duration: hasExplicitEnter ? enterDuration : exitDuration,
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
    exitVariant,
    componentId,
    delay,
    enterDuration,
    exitDuration,
    waitFor,
    hasExplicitEnter,
  ]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const element = document.querySelector(`[data-cineview-animate-id="${componentId}"]`);
    if (element instanceof HTMLElement) {
      if (hostRef.current !== element) {
        hostRef.current = element;
        setHostVersion((version) => version + 1);
      }
    }
  }, [
    componentId,
    zoneRuntime?.version,
    sceneContext?.scrollProgress,
    sceneContext?.scrollTimelineState,
  ]);

  useEffect(() => {
    if (!isScrollDriven || !zoneRuntime || !zoneId || (!enterVariant && !exitVariant)) {
      return;
    }

    zoneRuntime.registerZoneAnimation(zoneId, {
      animateId: componentId,
      delay,
      enterDuration,
      exitDuration: hasExplicitExit ? exitDuration : 0,
      waitFor,
    });

    return () => {
      zoneRuntime.unregisterZoneAnimation(zoneId, componentId);
    };
  }, [
    zoneRuntime,
    componentId,
    delay,
    enterDuration,
    enterVariant,
    exitVariant,
    exitDuration,
    hasExplicitExit,
    isScrollDriven,
    zoneId,
    waitFor,
    zoneRuntime?.registerZoneAnimation,
    zoneRuntime?.unregisterZoneAnimation,
  ]);

  useEffect(() => {
    if (!sceneContext) return;

    if (isScrollDriven) {
      if (!zoneRuntime || !zoneId) {
        if (!hasWarnedOrphanRef.current && process.env.NODE_ENV === 'development') {
          console.warn(
            `[CineView Warning] scroll-driven Animate "${componentId}" must be wrapped by <ScrollZone>.`
          );
          hasWarnedOrphanRef.current = true;
        }
        visualMotion.set(0);
        return;
      }

      const zoneState = zoneRuntime.zoneStates[zoneId];
      const budget = zoneState?.sequence.budgets[componentId];
      const warmupProgress = resolveWarmupProgress(hostRef.current, sceneContext, hasExplicitEnter);

      if (!zoneState || !budget) {
        visualMotion.set(warmupProgress);
        return;
      }

      const progressPx = clamp(zoneState.progressPx, 0, zoneState.totalBudgetPx);
      const fallbackStartPx = budget.enterStartPx;
      const fallbackEndPx = Math.max(budget.enterEndPx, budget.enterStartPx + 1);
      const phaseStartPx = resolvePhaseBoundaryPx(
        phaseStart,
        fallbackStartPx,
        fallbackStartPx,
        fallbackEndPx
      );
      const phaseEndPx = Math.max(
        resolvePhaseBoundaryPx(phaseEnd, fallbackEndPx, fallbackStartPx, fallbackEndPx),
        phaseStartPx + 1
      );

      if (progressPx <= phaseStartPx) {
        visualMotion.set(warmupProgress);
        return;
      }

      if (!budget.hasExit) {
        if (progressPx >= phaseEndPx) {
          visualMotion.set(1);
          return;
        }

        visualMotion.set(
          clamp((progressPx - phaseStartPx) / Math.max(phaseEndPx - phaseStartPx, 1), 0, 1)
        );
        return;
      }

      const exitStartPx = budget.exitStartPx ?? phaseEndPx;
      const exitEndPx = budget.exitEndPx ?? exitStartPx + 1;

      if (progressPx <= phaseEndPx) {
        visualMotion.set(
          clamp((progressPx - phaseStartPx) / Math.max(phaseEndPx - phaseStartPx, 1), 0, 1)
        );
        return;
      }

      if (progressPx <= exitStartPx) {
        visualMotion.set(1);
        return;
      }

      if (progressPx >= exitEndPx) {
        visualMotion.set(-1);
        return;
      }

      visualMotion.set(
        -clamp((progressPx - exitStartPx) / Math.max(exitEndPx - exitStartPx, 1), 0, 1)
      );
      return;
    }

    const hostElement = hostRef.current;
    if (!(hostElement instanceof HTMLElement)) {
      return;
    }

    const rect = hostElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight || 1;
    const previousTop = previousRectTopRef.current;
    previousRectTopRef.current = rect.top;
    const movingForward =
      sceneContext.scrollDirection === 'forward' || previousTop === null || rect.top < previousTop;
    const fullyOutOfView = rect.bottom <= 0 || rect.top >= viewportHeight;
    const fullyVisible =
      enterWhen === 'fully-visible-bottom'
        ? rect.top >= 0 && rect.bottom <= viewportHeight
        : rect.top < viewportHeight;
    const leavingFromTop = exitWhen === 'leaving-top' ? rect.top <= 0 : rect.bottom <= 0;

    if (fullyOutOfView) {
      autoLifecycleRef.current = replayOnReenter
        ? { hasEntered: false, hasExited: false }
        : { ...autoLifecycleRef.current, hasExited: true };
      visualMotion.set(0);
      return;
    }

    if (!hasExplicitEnter) {
      if (
        hasExplicitExit &&
        !autoLifecycleRef.current.hasExited &&
        leavingFromTop &&
        movingForward
      ) {
        autoLifecycleRef.current.hasEntered = true;
        autoLifecycleRef.current.hasExited = true;
        const controls = animate(visualMotion, -1, {
          duration: Math.max(exitDuration, 1) / 1000,
          ease: 'easeOut',
        });
        return () => controls.stop();
      }

      autoLifecycleRef.current.hasEntered = true;
      autoLifecycleRef.current.hasExited = false;
      visualMotion.set(1);
      return;
    }

    if (!autoLifecycleRef.current.hasEntered && fullyVisible) {
      autoLifecycleRef.current.hasEntered = true;
      autoLifecycleRef.current.hasExited = false;
      const controls = animate(visualMotion, 1, {
        duration: Math.max(enterDuration, 1) / 1000,
        ease: 'easeOut',
      });
      return () => controls.stop();
    }

    if (
      autoLifecycleRef.current.hasEntered &&
      !autoLifecycleRef.current.hasExited &&
      hasExplicitExit &&
      leavingFromTop &&
      movingForward
    ) {
      autoLifecycleRef.current.hasExited = true;
      const controls = animate(visualMotion, -1, {
        duration: Math.max(exitDuration, 1) / 1000,
        ease: 'easeOut',
      });
      return () => controls.stop();
    }

    if (autoLifecycleRef.current.hasEntered && !autoLifecycleRef.current.hasExited) {
      visualMotion.set(1);
    }
  }, [
    sceneContext,
    zoneRuntime,
    zoneId,
    componentId,
    isScrollDriven,
    visualMotion,
    enterDuration,
    exitDuration,
    phaseStart,
    phaseEnd,
    hasExplicitEnter,
    hasExplicitExit,
    enterWhen,
    exitWhen,
    replayOnReenter,
    sceneContext?.scrollProgress,
    sceneContext?.scrollTimelineState,
    zoneRuntime?.version,
    hostVersion,
  ]);

  useEffect(() => {
    if (!sceneContext) {
      setShouldRunInfiniteState(false);
      return;
    }

    if (isScrollDriven) {
      if (!zoneRuntime || !zoneId) {
        setShouldRunInfiniteState(false);
        return;
      }

      const zoneState = zoneRuntime.zoneStates[zoneId];
      setShouldRunInfiniteState(Boolean(zoneState?.active));
      return;
    }

    setShouldRunInfiniteState(
      autoLifecycleRef.current.hasEntered && !autoLifecycleRef.current.hasExited
    );
  }, [sceneContext, isScrollDriven, zoneId, zoneRuntime, zoneRuntime?.version]);

  const opacity = useNumericValue(visualMotion, variantsRef, 'opacity');
  const x = useMixedValue(visualMotion, variantsRef, 'x');
  const y = useMixedValue(visualMotion, variantsRef, 'y');
  const scale = useNumericValue(visualMotion, variantsRef, 'scale');
  const rotate = useMixedValue(visualMotion, variantsRef, 'rotate');
  const rotateX = useMixedValue(visualMotion, variantsRef, 'rotateX');
  const rotateY = useMixedValue(visualMotion, variantsRef, 'rotateY');
  const skewX = useMixedValue(visualMotion, variantsRef, 'skewX');
  const skewY = useMixedValue(visualMotion, variantsRef, 'skewY');
  const filter = useMixedValue(visualMotion, variantsRef, 'filter');

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
    shouldRunInfinite: shouldRunInfiniteState,
  };
}
