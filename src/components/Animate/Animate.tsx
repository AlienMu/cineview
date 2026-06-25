/**
 * Animate Component - 统一入口，根据 mode 选择实现
 * drag 模式：使用 useAnimateDrag
 * scroll 模式：使用 useAnimateScroll
 */

import React, { useEffect, useRef, useState, useContext, createContext, useMemo } from 'react';
import { motion, MotionValue, useAnimation } from 'framer-motion';
import type { ParsedAnimationVariant, ScrollMode, ScrollTimelineState } from '../../types';
import type { AnimateRegistrationInfo } from '../../animations/registry';
import { parseAnimationSafely } from '../../utils/animationHelpers';
import { useAnimateDrag } from './useAnimateDrag';
import { useAnimateScroll } from './useAnimateScroll';
import {
  normalizeAnimateSemantics,
  type AnimateInternalProps,
  type NormalizedAnimateTimeline,
} from './animateSemantics';
import type { DragRelease, ScrollTransitionSnapshot } from '../../hooks/useSceneManager';
import { useCineViewRuntimeContext } from '../CineView/runtimeContext';
import {
  SceneScrollRuntimeContext,
  SceneScrollTimelineContext,
  SceneScrollTakeoverContext,
} from '../Scene/sceneScrollRuntime';

export type SceneRuntimeState =
  | 'inactive'
  | 'entering'
  | 'active'
  | 'exiting'
  | 'covered'
  | 'parked';

// Scene Context
export interface SceneBaseRuntimeContext {
  mode: ScrollMode;
  isActive: boolean;
  isVisible?: boolean;
  visibilityProgress?: number;
  runtimeState?: SceneRuntimeState;
  isSceneAnimating?: boolean;
  transitionDirection?: 'forward' | 'backward' | null;
  sceneState: 'initial' | 'entering' | 'active' | 'exiting';
  sceneOffset: number;
  sceneTransitionDuration: number;
  getTimelineDuration?: () => number;
  enterDuration: number;
}

export interface SceneDragRuntimeContext {
  isDragging: boolean;
  dragProgressMotion: MotionValue<number>;
  dragTimelineProgress?: number;
  // The per-scene element track (elapsed ms of THIS scene's enter timeline),
  // owned and driven by the scene's own useElementTrack. This is the UNIFIED
  // enter source read by useAnimateDrag (incoming / active-settle / cold-start).
  sharedElapsedMotion?: MotionValue<number>;
  renderProgress?: number;
  // Read-only release directive (two-track model). useAnimateDrag reads only its
  // `mode` to decide whether the post-commit active scene is still entering.
  dragRelease?: DragRelease | null;
  sharedTimelineDurationMs?: number;
  // True only while the first mounted scene is playing its one-shot cold-start
  // enter animation, driven by the scene's own element track once first-screen
  // priority images are ready. Lets the active offset-0 scene resolve through the
  // enter lerp path instead of snapping straight to rest.
  firstSceneEnterActive?: boolean;
}

export interface SceneScrollRuntimeBridgeContext {
  scrollProgress?: number;
  isScrolling?: boolean;
  scrollDirection?: 'forward' | 'backward' | null;
  scrollTimelineState?: ScrollTimelineState | null;
  scrollActiveSceneIndex?: number;
  scrollTransitionSnapshot?: ScrollTransitionSnapshot | null;
}

export interface SceneAnimationRegistryContext {
  registerAnimate: (id: string, info: AnimateRegistrationInfo) => void;
  unregisterAnimate: (id: string) => void;
  getCalculatedDelay: (id: string) => number;
}

export type SceneContextType = SceneBaseRuntimeContext &
  SceneDragRuntimeContext &
  SceneScrollRuntimeBridgeContext &
  SceneAnimationRegistryContext;

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
