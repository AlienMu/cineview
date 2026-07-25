/**
 * Animate Component - 统一入口，根据 mode 选择实现
 * drag 模式：使用 useAnimateDrag
 * scroll 模式：使用 useAnimateScroll
 */

import React, {
  useEffect,
  useRef,
  useState,
  useContext,
  createContext,
  useMemo,
  isValidElement,
} from 'react';
import type { ReactElement } from 'react';
import { motion, MotionValue, useAnimation, useMotionValue } from 'framer-motion';
import type {
  AnimatePhase,
  AnimateTimeline,
  ParsedAnimationVariant,
  ScrollMode,
  ScrollTimelineState,
} from '../../types';
import type { AnimateRegistrationInfo } from '../../animations/registry';
import { parseAnimationSafely } from '../../utils/animationHelpers';
import { useAnimateDrag, type DragVisualState } from './useAnimateDrag';
import { useAnimateScroll } from './useAnimateScroll';
import {
  normalizeAnimateSemantics,
  type AnimateInternalProps,
  type ResolvedAnimateTimeline,
} from './animateSemantics';
import type { DragRelease, ScrollTransitionSnapshot } from '../../hooks/useSceneManager';
import { ScrollRenderBridge, DragRenderBridge } from './AnimateRenderBridge';
import {
  ScrollStagger,
  DragStagger,
  countStaggerItems,
  resolveStaggerTiming,
} from './StaggerContainer';
import {
  IDLE_RENDER_STATE,
  normalizeDragPhase,
  resolveScrollEnterProgress,
} from './animateRenderState';
import { AnimateTimelineProvider } from './animateTimeline';
import type { AnimateRenderState } from '../../types';
import { useCineViewRuntimeContext } from '../CineView/runtimeContext';
import {
  SceneScrollRuntimeContext,
  SceneScrollTakeoverContext,
  useSceneScrollTimeline,
} from '../Scene/sceneScrollRuntime';
import type { SceneScrollZoneRuntime } from '../Scene/sceneScrollRuntime';

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
  // Cold-start START trigger for the first mounted scene, mirrored from the
  // global useFirstSceneEnter gate. Three-state for the scroll visibility path:
  // `true` = first scene, assets ready, may play its enter; `false` = first
  // scene, held at initial (pre-load / preventDefault); `undefined` = not the
  // first scene, never gated by cold start.
  firstSceneEnterReady?: boolean;
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
  // Per-scene enter-phase bus for the visibility driver's waitFor. An element
  // marks itself entered/not-entered; a follower subscribes to its leader's
  // completion. This gives visibility (which has no shared timeline axis) a way
  // to start its own delay only AFTER the leader actually finished — instead of
  // re-waiting the whole calculatedDelay chain from its own gate-fire instant.
  markAnimateEntered?: (id: string, entered: boolean) => void;
  // Invokes cb once the leader is entered (immediately if already entered).
  // Returns an unsubscribe to drop the pending subscription on teardown/preempt.
  subscribeAnimateEntered?: (leaderId: string, cb: () => void) => () => void;
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
  scrollPhaseStart,
  scrollPhaseEnd,
  stagger,
  children,
}) => {
  const componentId = useRef(animateId || `animate-${++animateIdCounter}`);
  const id = componentId.current;
  const sceneContext = useContext(SceneContext);
  const cineViewRuntime = useCineViewRuntimeContext();
  const zoneRuntime = useContext(SceneScrollRuntimeContext);
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
    scrollPhaseStart,
    scrollPhaseEnd,
  });
  const mode = sceneContext?.mode ?? cineViewRuntime?.mode ?? 'drag';
  // Resolve sceneControlled + mode + inherited zoneId down to a concrete driver.
  // scroll driver only when: scroll mode, sceneControlled (default), and actually
  // inside a Scene.scroll zone. Everything else (drag mode, no zone, or explicit
  // sceneControlled:false) is the standalone visibility gate.
  const resolvedTimeline = useMemo<ResolvedAnimateTimeline>(() => {
    const { sceneControlled, ...rest } = normalizedSemantics.timeline;
    const isSceneScroll = mode === 'scroll' && sceneControlled && Boolean(inheritedZoneId);
    return { ...rest, driver: isSceneScroll ? 'scroll' : 'visibility' };
  }, [inheritedZoneId, mode, normalizedSemantics.timeline]);
  const liveZoneTimeline = useSceneScrollTimeline(resolvedTimeline.driver === 'scroll');
  const normalizedEnterDuration = normalizedSemantics.duration.enter;
  const normalizedExitDuration = normalizedSemantics.duration.exit;
  const normalizedDelay = resolvedTimeline.delay;
  const normalizedWaitFor = resolvedTimeline.waitFor;
  const resolvedZoneId = resolvedTimeline.zoneId ?? inheritedZoneId;
  const isRenderProp = typeof children === 'function';
  const staggerContainer =
    stagger && !isRenderProp && enterVariant && isValidElement(children)
      ? (children as ReactElement)
      : null;
  const staggerActive = Boolean(staggerContainer);
  const staggerEach = stagger?.each ?? 40;
  const staggerFrom = stagger?.from ?? 'first';
  const staggerTiming = useMemo(
    () =>
      staggerContainer && enterVariant
        ? resolveStaggerTiming(
            enterVariant,
            normalizedEnterDuration,
            staggerEach,
            staggerFrom,
            countStaggerItems(staggerContainer)
          )
        : null,
    [enterVariant, normalizedEnterDuration, staggerContainer, staggerEach, staggerFrom]
  );
  const staggerExitTiming = useMemo(
    () =>
      staggerContainer && exitVariant
        ? resolveStaggerTiming(
            exitVariant,
            normalizedExitDuration,
            staggerEach,
            staggerFrom,
            countStaggerItems(staggerContainer),
            'exit'
          )
        : null,
    [exitVariant, normalizedExitDuration, staggerContainer, staggerEach, staggerFrom]
  );
  const effectiveEnterDuration = staggerTiming?.effectiveDurationMs ?? normalizedEnterDuration;
  const effectiveExitDuration = staggerExitTiming?.effectiveDurationMs ?? normalizedExitDuration;
  const scrollZoneRuntime = useMemo<SceneScrollZoneRuntime | null>(
    () =>
      zoneRuntime
        ? {
            ...zoneRuntime,
            version: liveZoneTimeline?.version ?? 0,
            zoneStates: liveZoneTimeline?.zoneStates ?? {},
          }
        : null,
    [liveZoneTimeline, zoneRuntime]
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
    enterDuration: effectiveEnterDuration,
    exitDuration: effectiveExitDuration,
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
    duration: {
      enter: effectiveEnterDuration,
      exit: effectiveExitDuration,
    },
    timeline: resolvedTimeline,
    visibility: normalizedSemantics.visibility,
    globalEnterMargin: cineViewRuntime?.scrollEnterMargin,
    globalExitMargin: cineViewRuntime?.scrollExitMargin,
  });

  const publicProgress = useMotionValue(0);
  const publicSignedProgress = useMotionValue(0);
  const publicPhase = useMotionValue<AnimatePhase>('idle');

  useEffect(() => {
    if (mode === 'scroll') {
      const updateVisual = (signed: number): void => {
        publicSignedProgress.set(signed);
        publicProgress.set(resolveScrollEnterProgress(signed));
      };
      const updatePhase = (phase: AnimatePhase): void => {
        publicPhase.set(phase);
      };

      updateVisual(scrollResult.visualMotion.get());
      updatePhase(scrollResult.phaseMotion.get());
      const unsubscribeVisual = scrollResult.visualMotion.on('change', updateVisual);
      const unsubscribePhase = scrollResult.phaseMotion.on('change', updatePhase);
      return () => {
        unsubscribeVisual();
        unsubscribePhase();
      };
    }

    const updateDrag = (state: DragVisualState | null): void => {
      if (!state) {
        publicProgress.set(0);
        publicSignedProgress.set(0);
        publicPhase.set('idle');
        return;
      }

      const progress = Math.max(0, Math.min(1, state.localProgress));
      const signedProgress =
        state.mode === 'outgoing' ? (state.direction === 'forward' ? 1 : -1) * progress : progress;
      publicProgress.set(progress);
      publicSignedProgress.set(signedProgress);
      publicPhase.set(normalizeDragPhase(state.mode, progress));
    };

    updateDrag(dragResult.visualState.get());
    return dragResult.visualState.on('change', updateDrag);
  }, [
    dragResult.visualState,
    mode,
    publicPhase,
    publicProgress,
    publicSignedProgress,
    scrollResult.phaseMotion,
    scrollResult.visualMotion,
  ]);

  const publicTimeline = useMemo<AnimateTimeline>(
    () => ({
      driver: mode === 'scroll' ? resolvedTimeline.driver : 'drag',
      progress: publicProgress,
      signedProgress: publicSignedProgress,
      phase: publicPhase,
    }),
    [mode, publicPhase, publicProgress, publicSignedProgress, resolvedTimeline.driver]
  );

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

  // render-prop 桥接:children 为函数时,按当前 mode 挂对应 bridge 订阅进度/相位源;
  // 否则原样透传。非函数 children 零额外成本(不挂 bridge、不订阅)。
  const renderFn = isRenderProp
    ? (children as (state: AnimateRenderState) => React.ReactNode)
    : undefined;
  const plainChildren = isRenderProp ? null : (children as React.ReactNode);
  const bridgedChildren: React.ReactNode = !renderFn ? (
    plainChildren
  ) : mode === 'scroll' ? (
    <ScrollRenderBridge
      signedVisual={scrollResult.visualMotion}
      phaseMotion={scrollResult.phaseMotion}
      render={renderFn}
    />
  ) : (
    <DragRenderBridge visualState={dragResult.visualState} render={renderFn} />
  );

  // Tier 2 stagger:children 为单个有效元素容器 + 有 stagger + 有 enterVariant 时,
  // 子元素由 framer 原生 variant 传播错峰(方案B,绕白名单)。外层 motion.div 的视觉
  // style 中和(否则容器整体入场与子元素错峰双重动画),但 visualMotion 仍在内部跑作
  // 触发源供 stagger 订阅。render-prop 与 stagger 互斥(函数 children 无容器可拆)。
  const staggeredContent: React.ReactNode =
    staggerContainer && enterVariant ? (
      mode === 'scroll' ? (
        <ScrollStagger
          container={staggerContainer}
          variant={enterVariant}
          each={staggerEach}
          from={staggerFrom}
          itemDurationMs={staggerTiming?.itemDurationMs}
          exitVariant={exitVariant}
          exitItemDurationMs={staggerExitTiming?.itemDurationMs}
          signedVisual={scrollResult.visualMotion}
        />
      ) : (
        <DragStagger
          container={staggerContainer}
          variant={enterVariant}
          each={staggerEach}
          from={staggerFrom}
          itemDurationMs={staggerTiming?.itemDurationMs}
          exitVariant={exitVariant}
          exitItemDurationMs={staggerExitTiming?.itemDurationMs}
          visualState={dragResult.visualState}
        />
      )
    ) : null;
  const content = staggerActive ? staggeredContent : bridgedChildren;
  const providedContent = (
    <AnimateTimelineProvider value={publicTimeline}>{content}</AnimateTimelineProvider>
  );
  const scrollOuterStyle = staggerActive ? undefined : scrollResult.style;
  const dragOuterStyle = staggerActive ? undefined : dragResult.style;

  if (!enterVariant && !exitVariant && !infiniteVariant) {
    // 无动画早退:无进度可推,函数 children 直接给初始态(否则会渲染成 [object Function])。
    return (
      <AnimateTimelineProvider value={publicTimeline}>
        {renderFn ? renderFn(IDLE_RENDER_STATE) : plainChildren}
      </AnimateTimelineProvider>
    );
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
            <motion.div animate={scrollInfiniteControls}>{providedContent}</motion.div>
          </motion.div>
        </div>
      );
    }

    return (
      <div data-cineview-animate-host={id}>
        <motion.div
          style={scrollOuterStyle}
          className="cineview-animate"
          data-cineview-animate-id={id}
        >
          {providedContent}
        </motion.div>
      </div>
    );
  }

  if (infiniteVariant) {
    return (
      <motion.div style={dragOuterStyle} className="cineview-animate" data-cineview-animate-id={id}>
        <motion.div animate={dragInfiniteControls}>{providedContent}</motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div style={dragOuterStyle} className="cineview-animate" data-cineview-animate-id={id}>
      {providedContent}
    </motion.div>
  );
};

Animate.displayName = 'Animate';

export default Animate;
