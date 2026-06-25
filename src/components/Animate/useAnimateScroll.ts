import type { MutableRefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MotionValue, useMotionValue, useTransform } from 'framer-motion';
import type { ParsedAnimationVariant } from '../../types';
import type { SceneContextType } from './Animate';
import type { NormalizedAnimateTimeline, NormalizedAnimateVisibility } from './animateSemantics';
import type { SceneScrollRuntimeContextValue } from '../Scene/sceneScrollRuntime';

interface UseAnimateScrollParams {
  sceneContext: SceneContextType | null;
  zoneRuntime: SceneScrollRuntimeContextValue | null;
  zoneId: string | null;
  enterVariant: ParsedAnimationVariant | null;
  exitVariant: ParsedAnimationVariant | null;
  hasAuthoredEnterAnimation?: boolean;
  hasAuthoredExitAnimation?: boolean;
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
const DEFAULT_VISIBILITY_PX_PER_MS = 0.18;
const VISIBILITY_EXIT_EPSILON = 1e-6;

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

function resolveVisibilityDelayPx(
  delayMs: number,
  waitFor: string | undefined,
  calculatedDelayMs: number
): number {
  const sourceMs = waitFor ? calculatedDelayMs : delayMs;
  return Math.max(sourceMs, 0) * DEFAULT_VISIBILITY_PX_PER_MS;
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
  hasAuthoredEnterAnimation,
  hasAuthoredExitAnimation,
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
  const registerZoneAnimation = zoneRuntime?.registerZoneAnimation;
  const unregisterZoneAnimation = zoneRuntime?.unregisterZoneAnimation;
  const zoneRuntimeVersion = zoneRuntime?.version;
  const hasParsedEnter = Boolean(
    enterVariant?.animate && Object.keys(enterVariant.animate as Record<string, unknown>).length > 0
  );
  const hasExplicitEnter = hasParsedEnter || Boolean(hasAuthoredEnterAnimation);
  const hasExplicitExit =
    hasExitAnimation(exitVariant, exitDuration) || Boolean(hasAuthoredExitAnimation);

  useEffect(() => {
    variantsRef.current = {
      enterInitial: (enterVariant?.initial as VariantRecord) || {},
      enterAnimate: (enterVariant?.animate as VariantRecord) || {},
      exitTarget: (exitVariant?.exit as VariantRecord) || {},
    };
  }, [enterVariant, exitVariant]);

  const runVisibilityUpdate = useCallback(() => {
    if (isScrollDriven) {
      return;
    }

    const hostElement = hostRef.current;
    if (!(hostElement instanceof HTMLElement)) {
      return;
    }

    const rect = hostElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight || 1;
    const hasMeasurableBox = rect.width > 0 || rect.height > 0 || rect.bottom !== rect.top;
    const aboveViewport = rect.bottom <= 0;
    const belowViewport = rect.top >= viewportHeight;
    const isIntersecting = !hasMeasurableBox || (rect.bottom > 0 && rect.top < viewportHeight);

    if (belowViewport) {
      visualMotion.set(0);
      setShouldRunInfiniteState(false);
      return;
    }

    const measurableHeight = Math.max(rect.height, rect.bottom - rect.top, 1);
    const viewportCenter = viewportHeight / 2;
    const centerTop = viewportCenter - measurableHeight / 2;
    const enterWindowPx = Math.max(viewportHeight - centerTop, 1);
    const exitEndTop = exitWhen === 'leaving-top' ? -measurableHeight : 0;
    const exitWindowPx = Math.max(centerTop - exitEndTop, 1);
    const travelPx = Math.max(viewportHeight - rect.top, 0);
    const delayPx = resolveVisibilityDelayPx(delay, waitFor, calculatedDelayRef.current);
    const clampedDelayPx = Math.min(delayPx, Math.max(enterWindowPx - 1, 0));
    const enterStartTravelPx = waitFor ? delayPx : clampedDelayPx;
    const enterEndTravelPx = waitFor ? delayPx + enterWindowPx : enterWindowPx;
    const enterProgress = hasExplicitEnter
      ? clamp(
          (travelPx - enterStartTravelPx) / Math.max(enterEndTravelPx - enterStartTravelPx, 1),
          0,
          1
        )
      : isIntersecting || aboveViewport
        ? 1
        : 0;

    if (!hasExplicitExit) {
      const nextMotion =
        aboveViewport && replayOnReenter ? 0 : isIntersecting || aboveViewport ? enterProgress : 0;
      visualMotion.set(nextMotion);
      setShouldRunInfiniteState(nextMotion >= 1);
      return;
    }

    const exitStartTravelPx = Math.max(enterWindowPx, waitFor ? enterEndTravelPx : enterWindowPx);
    if (travelPx <= exitStartTravelPx) {
      visualMotion.set(enterProgress);
      setShouldRunInfiniteState(enterProgress >= 1);
      return;
    }

    const exitProgress = clamp((travelPx - exitStartTravelPx) / Math.max(exitWindowPx, 1), 0, 1);
    visualMotion.set(exitProgress > 0 ? -exitProgress : -VISIBILITY_EXIT_EPSILON);
    setShouldRunInfiniteState(false);
  }, [
    delay,
    exitWhen,
    hasExplicitEnter,
    hasExplicitExit,
    isScrollDriven,
    replayOnReenter,
    waitFor,
    visualMotion,
  ]);

  useEffect(() => {
    if (
      !sceneContext?.registerAnimate ||
      !sceneContext?.unregisterAnimate ||
      !sceneContext?.getCalculatedDelay ||
      (!hasExplicitEnter && !hasExplicitExit)
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
    componentId,
    delay,
    enterDuration,
    exitDuration,
    waitFor,
    hasExplicitEnter,
    hasExplicitExit,
  ]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (hostRef.current?.isConnected) return;

    const element =
      document.querySelector(`[data-cineview-animate-host="${componentId}"]`) ??
      document.querySelector(`[data-cineview-animate-id="${componentId}"]`);
    if (element instanceof HTMLElement) {
      if (hostRef.current !== element) {
        hostRef.current = element;
        setHostVersion((version) => version + 1);
      }
    }
  }, [componentId, enterVariant, exitVariant]);

  useEffect(() => {
    if (
      !isScrollDriven ||
      !registerZoneAnimation ||
      !unregisterZoneAnimation ||
      !zoneId ||
      (!hasExplicitEnter && !hasExplicitExit)
    ) {
      return;
    }

    registerZoneAnimation(zoneId, {
      animateId: componentId,
      delay,
      enterDuration,
      exitDuration: hasExplicitExit ? exitDuration : 0,
      waitFor,
      ...(phaseStart !== undefined || phaseEnd !== undefined
        ? {
            phase: {
              start: phaseStart,
              end: phaseEnd,
            },
          }
        : {}),
    });

    return () => {
      unregisterZoneAnimation(zoneId, componentId);
    };
  }, [
    componentId,
    delay,
    enterDuration,
    exitDuration,
    hasExplicitExit,
    hasExplicitEnter,
    isScrollDriven,
    phaseEnd,
    phaseStart,
    zoneId,
    waitFor,
    registerZoneAnimation,
    unregisterZoneAnimation,
  ]);

  useEffect(() => {
    if (isScrollDriven) {
      if (!zoneRuntime || !zoneId) {
        if (!hasWarnedOrphanRef.current && process.env.NODE_ENV === 'development') {
          console.warn(
            `[CineView Warning] scroll-driven Animate "${componentId}" must be placed inside a Scene with a scroll takeover config.`
          );
          hasWarnedOrphanRef.current = true;
        }
        visualMotion.set(0);
        return;
      }

      const zoneState = zoneRuntime.zoneStates[zoneId];
      const budget = zoneState?.sequence.budgets[componentId];
      if (!zoneState || !budget) {
        visualMotion.set(0);
        return;
      }

      const progressPx = clamp(zoneState.progressPx, 0, zoneState.totalBudgetPx);
      const fallbackStartPx = budget.enterStartPx;
      const fallbackEndPx = Math.max(budget.enterEndPx, budget.enterStartPx + 1);
      const phaseStartPx =
        typeof budget.phaseStartPx === 'number'
          ? budget.phaseStartPx
          : resolvePhaseBoundaryPx(phaseStart, fallbackStartPx, fallbackStartPx, fallbackEndPx);
      const phaseEndPx = Math.max(
        typeof budget.phaseEndPx === 'number'
          ? budget.phaseEndPx
          : resolvePhaseBoundaryPx(phaseEnd, fallbackEndPx, fallbackStartPx, fallbackEndPx),
        phaseStartPx + 1
      );

      if (progressPx <= phaseStartPx) {
        visualMotion.set(0);
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

    runVisibilityUpdate();
  }, [
    zoneRuntime,
    zoneId,
    componentId,
    isScrollDriven,
    visualMotion,
    enterDuration,
    phaseStart,
    phaseEnd,
    hasExplicitEnter,
    hasExplicitExit,
    exitWhen,
    replayOnReenter,
    sceneContext?.scrollProgress,
    sceneContext?.scrollTimelineState,
    zoneRuntimeVersion,
    hostVersion,
    runVisibilityUpdate,
  ]);

  useEffect(() => {
    if (isScrollDriven) {
      return;
    }

    const hostElement = hostRef.current;
    if (!(hostElement instanceof HTMLElement) || typeof window === 'undefined') {
      return;
    }

    const scrollRoot =
      hostElement.closest<HTMLElement>('[data-cineview-container="true"]') ?? window;
    let animationFrame: number | null = null;
    const requestFrame =
      window.requestAnimationFrame?.bind(window) ??
      ((callback: FrameRequestCallback): number =>
        window.setTimeout(() => callback(Date.now()), 16));
    const cancelFrame =
      window.cancelAnimationFrame?.bind(window) ??
      ((handle: number): void => window.clearTimeout(handle));
    const scheduleVisibilityUpdate = (): void => {
      if (animationFrame !== null) {
        return;
      }

      animationFrame = requestFrame(() => {
        animationFrame = null;
        runVisibilityUpdate();
      });
    };

    scrollRoot.addEventListener('scroll', scheduleVisibilityUpdate, { passive: true });
    window.addEventListener('resize', scheduleVisibilityUpdate, { passive: true });

    return () => {
      if (animationFrame !== null) {
        cancelFrame(animationFrame);
      }
      scrollRoot.removeEventListener('scroll', scheduleVisibilityUpdate);
      window.removeEventListener('resize', scheduleVisibilityUpdate);
    };
  }, [hostVersion, isScrollDriven, runVisibilityUpdate]);

  useEffect(() => {
    if (isScrollDriven) {
      if (!zoneRuntime || !zoneId) {
        setShouldRunInfiniteState(false);
        return;
      }

      const zoneState = zoneRuntime.zoneStates[zoneId];
      const budget = zoneState?.sequence.budgets[componentId];
      const runtimeState = sceneContext?.runtimeState;
      const runtimeAllowsInfinite =
        runtimeState === undefined ||
        (runtimeState !== 'covered' &&
          runtimeState !== 'inactive' &&
          runtimeState !== 'parked' &&
          runtimeState !== 'exiting');

      if (!zoneState || !budget || !runtimeAllowsInfinite) {
        setShouldRunInfiniteState(false);
        return;
      }

      const progressPx = clamp(zoneState.progressPx, 0, zoneState.totalBudgetPx);
      const fallbackStartPx = budget.enterStartPx;
      const fallbackEndPx = Math.max(budget.enterEndPx, budget.enterStartPx + 1);
      const phaseStartPx =
        typeof budget.phaseStartPx === 'number'
          ? budget.phaseStartPx
          : resolvePhaseBoundaryPx(phaseStart, fallbackStartPx, fallbackStartPx, fallbackEndPx);
      const phaseEndPx = Math.max(
        typeof budget.phaseEndPx === 'number'
          ? budget.phaseEndPx
          : resolvePhaseBoundaryPx(phaseEnd, fallbackEndPx, fallbackStartPx, fallbackEndPx),
        phaseStartPx + 1
      );
      const hasEntered = hasExplicitEnter ? progressPx >= phaseEndPx - 0.5 : progressPx > 0.5;
      const beforeExit =
        !budget.hasExit || budget.exitStartPx === null || progressPx <= budget.exitStartPx + 0.5;

      setShouldRunInfiniteState(hasEntered && beforeExit);
      return;
    }
  }, [
    componentId,
    hasExplicitEnter,
    isScrollDriven,
    phaseEnd,
    phaseStart,
    sceneContext?.runtimeState,
    zoneId,
    zoneRuntime,
    zoneRuntime?.version,
  ]);

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
