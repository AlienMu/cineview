/**
 * Animate Component - 统一入口，根据 mode 选择实现
 * snap 模式：使用 useAnimateSnap
 * drag 模式：使用 useAnimateDrag
 */

import React, { useEffect, useRef, useState, useContext, createContext } from 'react';
import { motion, MotionValue, useAnimation } from 'framer-motion';
import type {
  AnimateProps,
  ParsedAnimationVariant,
  ScrollMode,
  ScrollTimelineState,
} from '../../types';
import { DEFAULT_ANIMATION_DURATION } from '../../types';
import { parseAnimationSafely } from '../../utils/animationHelpers';
import { useAnimateSnap } from './useAnimateSnap';
import { useAnimateDrag } from './useAnimateDrag';
import { useAnimateScroll } from './useAnimateScroll';
import type { DragTransitionSnapshot, ScrollTransitionSnapshot } from '../../hooks/useSceneManager';
import { ScrollZoneContext, ScrollZoneRuntimeContext } from '../ScrollZone';

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

  // snap 模式专用
  sceneEnterCompleted: boolean; // Scene 入场动画是否完成

  // 场景状态机
  sceneState: 'initial' | 'entering' | 'active' | 'exiting';

  sceneOffset: number;
  activationVersion?: number;
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
  const zoneRuntime = useContext(ScrollZoneRuntimeContext);
  const zoneId = useContext(ScrollZoneContext);

  const [enterVariant, setEnterVariant] = useState<ParsedAnimationVariant | null>(null);
  const [exitVariant, setExitVariant] = useState<ParsedAnimationVariant | null>(null);
  const [infiniteVariant, setInfiniteVariant] = useState<ParsedAnimationVariant | null>(null);
  const snapInfiniteControls = useAnimation();
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
  const normalizedEnterDuration = normalizedSemantics.duration.enter;
  const normalizedDelay = normalizedSemantics.timeline.delay;
  const normalizedWaitFor = normalizedSemantics.timeline.waitFor;

  useEffect(() => {
    if (!sceneContext && process.env.NODE_ENV === 'development') {
      console.error(
        `[CineView Error] Animate component "${id}" must be used within a Scene component.`
      );
    }
  }, [sceneContext, id]);

  useEffect(() => {
    const parseAnimations = async (): Promise<void> => {
      const [enter, exit, infinite] = await Promise.all([
        parseAnimationSafely(enterAnimation, id, 'enter'),
        parseAnimationSafely(exitAnimation, id, 'exit'),
        parseAnimationSafely(infiniteAnimation, id, 'infinite'),
      ]);

      if (enter) setEnterVariant(enter as ParsedAnimationVariant);
      if (exit) setExitVariant(exit as ParsedAnimationVariant);
      if (infinite) setInfiniteVariant(infinite as ParsedAnimationVariant);
    };

    parseAnimations();
  }, [enterAnimation, exitAnimation, infiniteAnimation, id]);

  // 🎯 根据 mode 选择使用哪个实现
  const mode = sceneContext?.mode || 'snap';

  // snap 模式：使用 useAnimateSnap
  const snapResult = useAnimateSnap({
    sceneContext: mode === 'snap' ? sceneContext : null,
    enterVariant,
    exitVariant,
    componentId: id,
    delay: normalizedDelay,
    enterDuration: normalizedEnterDuration,
    waitFor: normalizedWaitFor,
  });

  // drag 模式：使用 useAnimateDrag
  const dragResult = useAnimateDrag({
    sceneContext: mode === 'drag' ? sceneContext : null,
    enterVariant,
    exitVariant,
    componentId: id,
    delay: normalizedDelay,
    enterDuration: normalizedEnterDuration,
    waitFor: normalizedWaitFor,
  });

  const scrollResult = useAnimateScroll({
    sceneContext: mode === 'scroll' ? sceneContext : null,
    zoneRuntime: mode === 'scroll' ? zoneRuntime : null,
    zoneId,
    enterVariant,
    exitVariant,
    componentId: id,
    duration: normalizedSemantics.duration,
    timeline: normalizedSemantics.timeline,
    visibility: normalizedSemantics.visibility,
  });

  useEffect(() => {
    if (mode !== 'snap' || !infiniteVariant) return;

    if (!snapResult.shouldRunInfinite) {
      snapInfiniteControls.stop();
      return;
    }

    snapInfiniteControls.start({
      ...(infiniteVariant.animate as Record<string, unknown>),
      transition: {
        ...(((infiniteVariant.animate as Record<string, unknown>).transition as Record<
          string,
          unknown
        >) || {}),
        repeat: Infinity,
      },
    } as never);
  }, [mode, infiniteVariant, snapResult.shouldRunInfinite, snapInfiniteControls]);

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

  // snap 模式渲染
  if (mode === 'snap') {
    if (infiniteVariant) {
      return (
        <motion.div animate={snapResult.controls} className="cineview-animate">
          <motion.div data-cineview-animate-id={id}>
            <motion.div animate={snapInfiniteControls}>{children}</motion.div>
          </motion.div>
        </motion.div>
      );
    }

    return (
      <motion.div
        animate={snapResult.controls}
        className="cineview-animate"
        data-cineview-animate-id={id}
      >
        {children}
      </motion.div>
    );
  }

  // drag 模式渲染
  if (mode === 'scroll') {
    if (infiniteVariant) {
      return (
        <motion.div
          style={scrollResult.style}
          className="cineview-animate"
          data-cineview-animate-id={id}
        >
          <motion.div animate={scrollInfiniteControls}>{children}</motion.div>
        </motion.div>
      );
    }

    return (
      <motion.div
        style={scrollResult.style}
        className="cineview-animate"
        data-cineview-animate-id={id}
      >
        {children}
      </motion.div>
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
