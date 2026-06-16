/**
 * Animate Component - 统一入口，根据 mode 选择实现
 * drag 模式：使用 useAnimateDrag
 * scroll 模式：使用 useAnimateScroll
 */

import React, { useEffect, useRef, useState, useContext, createContext, useMemo } from 'react';
import { motion, MotionValue, useAnimation } from 'framer-motion';
import type {
  AnimateProps,
  ParsedAnimationVariant,
  ScrollMode,
  ScrollTimelineState,
} from '../../types';
import { DEFAULT_ANIMATION_DURATION } from '../../types';
import { parseAnimationSafely } from '../../utils/animationHelpers';
import { useAnimateDrag } from './useAnimateDrag';
import { useAnimateScroll } from './useAnimateScroll';
import type { DragTransitionSnapshot, ScrollTransitionSnapshot } from '../../hooks/useSceneManager';
import { useCineViewRuntimeContext } from '../CineView/runtimeContext';
import {
  SceneScrollRuntimeContext,
  SceneScrollTimelineContext,
  SceneScrollTakeoverContext,
} from '../Scene/sceneScrollRuntime';

interface AnimateLegacyCompatProps {
  enterDuration?: number;
  exitDuration?: number;
  delay?: number;
  waitFor?: string;
  scrollDriven?: boolean;
  scrollPhaseStart?: number;
  scrollPhaseEnd?: number;
}

export type AnimateInternalProps = AnimateProps & AnimateLegacyCompatProps;

export type SceneRuntimeState =
  | 'inactive'
  | 'entering'
  | 'active'
  | 'exiting'
  | 'covered'
  | 'parked';

// Scene Context
export interface SceneContextType {
  mode: ScrollMode;
  isActive: boolean;
  isVisible?: boolean;
  visibilityProgress?: number;
  runtimeState?: SceneRuntimeState;
  isSceneAnimating?: boolean;
  transitionDirection?: 'forward' | 'backward' | null;

  // drag 模式专用
  isDragging: boolean;
  dragProgressMotion: MotionValue<number>;
  dragTimelineProgress?: number;
  sharedElapsedMotion?: MotionValue<number>;
  renderProgress?: number;
  scrollProgress?: number;
  isScrolling?: boolean;
  scrollDirection?: 'forward' | 'backward' | null;
  scrollTimelineState?: ScrollTimelineState | null;
  scrollActiveSceneIndex?: number;

  // 场景状态机
  sceneState: 'initial' | 'entering' | 'active' | 'exiting';

  sceneOffset: number;
  dragTransitionSnapshot?: DragTransitionSnapshot | null;
  scrollTransitionSnapshot?: ScrollTransitionSnapshot | null;
  sharedElapsedMs?: number;
  sharedTimelineDurationMs?: number;
  sceneTransitionDuration: number; // 🎯 Task 1.10: 场景切换时长（ms）
  getTimelineDuration?: () => number;
  registerAnimate: (id: string, info: AnimateRegistrationInfo) => void;
  unregisterAnimate: (id: string) => void;
  getCalculatedDelay: (id: string) => number;
  enterDuration: number;
}

export interface AnimateRegistrationInfo {
  delay: number;
  duration: number;
  waitFor?: string;
}

export interface NormalizedAnimateTimeline {
  driver: 'auto' | 'scene' | 'scroll' | 'visibility';
  delay: number;
  waitFor?: string;
  zoneId?: string;
  phase?: {
    start?: number;
    end?: number;
  };
}

export interface NormalizedAnimateVisibility {
  replayOnReenter: boolean;
  enterWhen: 'fully-visible-bottom';
  exitWhen: 'leaving-top';
}

function normalizeAnimateSemantics({
  duration,
  timeline,
  visibility,
  enterDuration,
  exitDuration,
  delay,
  waitFor,
  scrollDriven,
  scrollPhaseStart,
  scrollPhaseEnd,
}: Pick<
  AnimateInternalProps,
  | 'duration'
  | 'timeline'
  | 'visibility'
  | 'enterDuration'
  | 'exitDuration'
  | 'delay'
  | 'waitFor'
  | 'scrollDriven'
  | 'scrollPhaseStart'
  | 'scrollPhaseEnd'
>): {
  duration: {
    enter: number;
    exit: number;
  };
  timeline: NormalizedAnimateTimeline;
  visibility: NormalizedAnimateVisibility;
} {
  const normalizedDriver =
    timeline?.driver ??
    (scrollDriven === undefined ? 'auto' : scrollDriven ? 'scroll' : 'visibility');

  return {
    duration: {
      enter: duration?.enter ?? enterDuration ?? DEFAULT_ANIMATION_DURATION,
      exit: duration?.exit ?? exitDuration ?? DEFAULT_ANIMATION_DURATION,
    },
    timeline: {
      driver: normalizedDriver,
      delay: timeline?.delay ?? delay ?? 0,
      waitFor: timeline?.waitFor ?? waitFor,
      zoneId: timeline?.zoneId,
      phase: {
        start: timeline?.phase?.start ?? scrollPhaseStart,
        end: timeline?.phase?.end ?? scrollPhaseEnd,
      },
    },
    visibility: {
      replayOnReenter: visibility?.replayOnReenter ?? true,
      enterWhen: visibility?.enterWhen ?? 'fully-visible-bottom',
      exitWhen: visibility?.exitWhen ?? 'leaving-top',
    },
  };
}

export const SceneContext = createContext<SceneContextType | null>(null);

let animateIdCounter = 0;

export const Animate: React.FC<AnimateInternalProps> = ({
  enterAnimation,
  exitAnimation,
  infiniteAnimation,
  animateId,
  duration,
  timeline,
  visibility,
  enterDuration,
  exitDuration,
  delay,
  waitFor,
  scrollDriven,
  scrollPhaseStart,
  scrollPhaseEnd,
  children,
}) => {
  const componentId = useRef(animateId || `animate-${++animateIdCounter}`);
  const id = componentId.current;
  const sceneContext = useContext(SceneContext);
  const cineViewRuntime = useCineViewRuntimeContext();
  const zoneRuntime = useContext(SceneScrollRuntimeContext);
  const zoneTimeline = useContext(SceneScrollTimelineContext);
  const inheritedZoneId = useContext(SceneScrollTakeoverContext);

  const [enterVariant, setEnterVariant] = useState<ParsedAnimationVariant | null>(null);
  const [exitVariant, setExitVariant] = useState<ParsedAnimationVariant | null>(null);
  const [infiniteVariant, setInfiniteVariant] = useState<ParsedAnimationVariant | null>(null);
  const dragInfiniteControls = useAnimation();
  const scrollInfiniteControls = useAnimation();
  const normalizedSemantics = normalizeAnimateSemantics({
    duration,
    timeline,
    visibility,
    enterDuration,
    exitDuration,
    delay,
    waitFor,
    scrollDriven,
    scrollPhaseStart,
    scrollPhaseEnd,
  });
  const mode = sceneContext?.mode ?? cineViewRuntime?.mode ?? 'drag';
  const resolvedTimeline = useMemo<NormalizedAnimateTimeline>(() => {
    if (mode !== 'scroll' || normalizedSemantics.timeline.driver !== 'auto') {
      return normalizedSemantics.timeline;
    }

    return {
      ...normalizedSemantics.timeline,
      driver: inheritedZoneId ? 'scroll' : 'visibility',
    };
  }, [inheritedZoneId, mode, normalizedSemantics.timeline]);
  const normalizedEnterDuration = normalizedSemantics.duration.enter;
  const normalizedExitDuration = normalizedSemantics.duration.exit;
  const normalizedDelay = resolvedTimeline.delay;
  const normalizedWaitFor = resolvedTimeline.waitFor;
  const resolvedZoneId = resolvedTimeline.zoneId ?? inheritedZoneId;
  const scrollZoneRuntime = useMemo(
    () =>
      zoneRuntime
        ? {
            ...zoneRuntime,
            version: zoneTimeline?.version ?? zoneRuntime.version,
            zoneStates: zoneTimeline?.zoneStates ?? zoneRuntime.zoneStates,
          }
        : null,
    [zoneRuntime, zoneTimeline]
  );

  useEffect(() => {
    if (!enterAnimation && !exitAnimation && !infiniteAnimation) {
      setEnterVariant((current) => (current === null ? current : null));
      setExitVariant((current) => (current === null ? current : null));
      setInfiniteVariant((current) => (current === null ? current : null));
      return;
    }

    let cancelled = false;

    const parseAnimations = async (): Promise<void> => {
      const [enter, exit, infinite] = await Promise.all([
        parseAnimationSafely(enterAnimation, id, 'enter'),
        parseAnimationSafely(exitAnimation, id, 'exit'),
        parseAnimationSafely(infiniteAnimation, id, 'infinite'),
      ]);

      if (cancelled) {
        return;
      }

      if (enter) setEnterVariant(enter as ParsedAnimationVariant);
      if (exit) setExitVariant(exit as ParsedAnimationVariant);
      if (infinite) setInfiniteVariant(infinite as ParsedAnimationVariant);
    };

    parseAnimations();

    return () => {
      cancelled = true;
    };
  }, [enterAnimation, exitAnimation, infiniteAnimation, id]);

  // drag 模式：使用 useAnimateDrag
  const dragResult = useAnimateDrag({
    sceneContext: mode === 'drag' ? sceneContext : null,
    enterVariant,
    exitVariant,
    componentId: id,
    delay: normalizedDelay,
    enterDuration: normalizedEnterDuration,
    exitDuration: normalizedExitDuration,
    waitFor: normalizedWaitFor,
  });

  const scrollResult = useAnimateScroll({
    sceneContext: mode === 'scroll' ? sceneContext : null,
    zoneRuntime: mode === 'scroll' ? scrollZoneRuntime : null,
    zoneId: resolvedZoneId,
    enterVariant,
    exitVariant,
    hasAuthoredEnterAnimation: Boolean(enterAnimation),
    hasAuthoredExitAnimation: Boolean(exitAnimation),
    componentId: id,
    duration: normalizedSemantics.duration,
    timeline: resolvedTimeline,
    visibility: normalizedSemantics.visibility,
  });

  useEffect(() => {
    if (mode !== 'drag' || !infiniteVariant) return;

    if (!dragResult.shouldRunInfinite) {
      dragInfiniteControls.stop();
      return;
    }

    dragInfiniteControls.start({
      ...(infiniteVariant.animate as Record<string, unknown>),
      transition: {
        ...(((infiniteVariant.animate as Record<string, unknown>).transition as Record<
          string,
          unknown
        >) || {}),
        repeat: Infinity,
      },
    } as never);
  }, [mode, infiniteVariant, dragResult.shouldRunInfinite, dragInfiniteControls]);

  useEffect(() => {
    if (mode !== 'scroll' || !infiniteVariant) return;

    if (!scrollResult.shouldRunInfinite) {
      scrollInfiniteControls.stop();
      return;
    }

    scrollInfiniteControls.start({
      ...(infiniteVariant.animate as Record<string, unknown>),
      transition: {
        ...(((infiniteVariant.animate as Record<string, unknown>).transition as Record<
          string,
          unknown
        >) || {}),
        repeat: Infinity,
      },
    } as never);
  }, [mode, infiniteVariant, scrollResult.shouldRunInfinite, scrollInfiniteControls]);

  if (!enterVariant && !exitVariant && !infiniteVariant) {
    return <>{children}</>;
  }

  if (mode === 'scroll') {
    if (infiniteVariant) {
      return (
        <div data-cineview-animate-host={id}>
          <motion.div
            style={scrollResult.style}
            className="cineview-animate"
            data-cineview-animate-id={id}
          >
            <motion.div animate={scrollInfiniteControls}>{children}</motion.div>
          </motion.div>
        </div>
      );
    }

    return (
      <div data-cineview-animate-host={id}>
        <motion.div
          style={scrollResult.style}
          className="cineview-animate"
          data-cineview-animate-id={id}
        >
          {children}
        </motion.div>
      </div>
    );
  }

  if (infiniteVariant) {
    return (
      <motion.div
        style={dragResult.style}
        className="cineview-animate"
        data-cineview-animate-id={id}
      >
        <motion.div animate={dragInfiniteControls}>{children}</motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div style={dragResult.style} className="cineview-animate" data-cineview-animate-id={id}>
      {children}
    </motion.div>
  );
};

Animate.displayName = 'Animate';

export default Animate;
