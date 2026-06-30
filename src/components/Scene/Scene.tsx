/**
 * Scene Component
 * 表示一个全屏场景，管理场景内的动画和滑动行为
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, useAnimation, useMotionValue } from 'framer-motion';
import { SceneContext, type SceneContextType } from '../Animate/Animate';
import { useCineViewContext } from '../../context/CineViewContext';
import {
  buildAnimationRegistrySnapshot,
  type AnimateRegistrationInfo,
  type AnimationRegistryIssue,
  type AnimationRegistrySnapshot,
} from '../../animations/registry';
import type { PresetAnimation } from '../../animations/presets';
import { parseAnimationSafely } from '../../utils/animationHelpers';
import type { SceneInternalProps, SceneState } from './types';
import type { DragReleaseInput } from '../../hooks/useSceneManager';
import { useSceneRuntimeState } from './useSceneRuntimeState';
import { useScrollSceneEngine } from './useScrollSceneEngine';
import { useDragSceneEngine } from './useDragSceneEngine';
import { useElementTrack } from './useElementTrack';
import { useCineViewRuntimeContext } from '../CineView/runtimeContext';
import { SceneFixedLayerContext } from '../Position/Position';
import { SceneScrollTakeoverContext } from './sceneScrollRuntime';
import { useSceneScrollTakeover } from './useSceneScrollTakeover';
import {
  emitSceneVisibility,
  getFixedLayerMetrics,
  getSceneVisibilityProgress,
  normalizeSceneProps,
  resolveSceneAnchor,
  resolveScrollSceneAnchor,
} from './helpers';

export const SceneIdentityContext = React.createContext<number | null>(null);

const SceneImpl: React.FC<SceneInternalProps> = (props) => {
  const { children } = props;
  const {
    effectiveMode,
    effectiveDirection,
    isActive,
    sceneIndex,
    totalScenes,
    currentSceneIndex,
    globalDirection,
    globalIsSceneAnimating,
    globalSharedTimelineDurationMs,
    globalFirstSceneEnterActive,
    globalFirstSceneEnterReady,
    globalViewportWidth,
    globalViewportHeight,
    globalDragProgress,
    globalRenderProgress,
    globalDragTimelineProgress,
    globalIsDragging,
    globalDragRelease,
    globalScrollProgress,
    globalIsScrolling,
    globalScrollDirection,
    globalScrollTransitionSnapshot,
    globalScrollBackdropActive,
    globalScrollTimelineState,
    globalScrollActiveSceneIndex,
    globalScrollViewportOffset,
    resolvedSceneWidth,
    resolvedSceneHeight,
    resolvedSceneAnchor,
    resolvedSceneOverflow,
    resolvedSceneZIndex,
    effectiveSceneStackMode,
    resolvedSceneTransitionDuration,
    resolvedEnterAnimation,
    resolvedExitAnimation,
    sceneVisibilityCallback,
    onVisibilityChange,
    onSceneChange,
    dragRuntime,
    onActivationComplete,
    onDragProgressChange,
    onRenderProgressChange,
    onDragTimelineProgressChange,
    onDraggingChange,
    onSharedTimelineDurationChange,
    onDragRelease,
    onDragCommit,
    onDragReset,
    slideDuration,
    compatFields,
  } = normalizeSceneProps(props);
  const cineViewContext = useCineViewContext();
  const cineViewRuntime = useCineViewRuntimeContext();
  const controls = useAnimation();

  const [enterVariant, setEnterVariant] = useState<PresetAnimation | null>(null);
  const [exitVariant, setExitVariant] = useState<PresetAnimation | null>(null);
  const hasExternalDragRuntime = Boolean(
    dragRuntime ||
    props.onDragProgressChange ||
    props.onRenderProgressChange ||
    props.onDragTimelineProgressChange ||
    props.onDraggingChange ||
    props.onSharedTimelineDurationChange ||
    props.onDragCommit ||
    props.onDragReset
  );
  const [localDragProgress, setLocalDragProgress] = useState(globalDragProgress);
  const [localRenderProgress, setLocalRenderProgress] = useState(globalRenderProgress);
  const [localDragTimelineProgress, setLocalDragTimelineProgress] = useState(
    globalDragTimelineProgress
  );
  const [localIsDragging, setLocalIsDragging] = useState(globalIsDragging);
  const [localSharedTimelineDurationMs, setLocalSharedTimelineDurationMs] = useState(
    globalSharedTimelineDurationMs
  );
  const [localDragRelease, setLocalDragRelease] = useState(globalDragRelease);
  const localDragReleaseTokenRef = useRef(0);
  // Standalone (no CineView) release sink: injects a monotonic token so the
  // shape matches the global DragRelease the element track reacts to.
  const setLocalDragReleaseInput = useCallback((release: DragReleaseInput | null) => {
    if (release === null) {
      setLocalDragRelease(null);
      return;
    }
    localDragReleaseTokenRef.current += 1;
    setLocalDragRelease({ ...release, token: localDragReleaseTokenRef.current });
  }, []);
  const currentDragProgress = hasExternalDragRuntime ? globalDragProgress : localDragProgress;
  const currentRenderProgress = hasExternalDragRuntime ? globalRenderProgress : localRenderProgress;
  const currentDragTimelineProgress = hasExternalDragRuntime
    ? globalDragTimelineProgress
    : localDragTimelineProgress;
  const currentIsDragging = hasExternalDragRuntime ? globalIsDragging : localIsDragging;
  const currentSharedTimelineDurationMs = hasExternalDragRuntime
    ? globalSharedTimelineDurationMs
    : localSharedTimelineDurationMs;
  const currentDragRelease = hasExternalDragRuntime ? globalDragRelease : localDragRelease;
  const isDragging = currentIsDragging;

  const dragProgressMotion = useMotionValue(currentDragProgress);
  // Two-track model: the element track is scene-OWNED. It starts at 0 (never
  // seeded from a global scalar) and is written ONLY by this scene's
  // useElementTrack. The old global-sync effect is deleted.
  const elementElapsedMotion = useMotionValue(0);

  const [sceneState, setSceneState] = useState<SceneState>('initial');
  const sceneOffset = sceneIndex - currentSceneIndex;
  const [isAnimating, setIsAnimating] = useState(false);

  const animateRegistry = useRef<Map<string, AnimateRegistrationInfo>>(new Map());
  const duplicateAnimateIds = useRef<Set<string>>(new Set());
  const registrySnapshot = useRef<AnimationRegistrySnapshot>(
    buildAnimationRegistrySnapshot({
      baseDuration: resolvedSceneTransitionDuration,
      registrations: animateRegistry.current,
    })
  );
  const reportedRegistryIssues = useRef<Set<string>>(new Set());
  // Per-scene enter-completion bus. A visibility-driven Animate with a waitFor
  // subscribes to its leader's completion here instead of re-deriving the delay
  // from calculatedDelay (which is a shared-clock offset that double-counts the
  // leader's playback time when each element enters on its own viewport gate).
  // enteredAnimates holds the ids currently in the entered phase; enterWaitSubs
  // maps a leader id → one-shot callbacks to fire the instant it enters.
  const enteredAnimates = useRef<Set<string>>(new Set());
  const enterWaitSubs = useRef<Map<string, Set<() => void>>>(new Map());
  // Stable ref to the consumer-facing error channel so reportRegistryIssues can
  // route validation issues to onError in production too, without taking the
  // runtime value as a callback dependency.
  const reportRuntimeErrorRef = useRef(cineViewRuntime?.reportError);
  reportRuntimeErrorRef.current = cineViewRuntime?.reportError;
  const timelineDurationRef = useRef<number>(resolvedSceneTransitionDuration);
  // State mirror of the registry-computed timeline duration. The ref above is
  // read synchronously by the drag/release lanes, but the duration only grows
  // once Animate children register (after their async variant parse), which
  // mutates a ref and does NOT re-render. Without a state bump the report
  // effect below keeps publishing the stale base duration to CineView, so the
  // first-scene cold-start driver under-drives the timeline (delay+duration is
  // never reached). Bumping this on every rebuild re-fires the report.
  const [timelineDurationState, setTimelineDurationState] = useState<number>(
    resolvedSceneTransitionDuration
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [fixedLayerElement, setFixedLayerElement] = useState<HTMLElement | null>(null);
  const handleFixedLayerHostRef = useCallback((node: HTMLDivElement | null) => {
    setFixedLayerElement((previous) => (previous === node ? previous : node));
  }, []);
  const sceneZoneId = useSceneScrollTakeover({
    sceneId: props.sceneId,
    sceneIndex,
    mode: effectiveMode,
    scroll: props.scroll,
    elementRef: containerRef,
  });

  useEffect(() => {
    dragProgressMotion.set(currentDragProgress);
  }, [currentDragProgress, dragProgressMotion]);

  // NOTE: the element track (elementElapsedMotion) is NOT synced from any global
  // value — it is owned and driven solely by this scene's useElementTrack
  // (single-writer). Only dragProgressMotion mirrors the render-side drag value.

  useEffect(() => {
    if (!hasExternalDragRuntime) {
      return;
    }

    setLocalDragProgress(globalDragProgress);
    setLocalRenderProgress(globalRenderProgress);
    setLocalDragTimelineProgress(globalDragTimelineProgress);
    setLocalIsDragging(globalIsDragging);
    setLocalSharedTimelineDurationMs(globalSharedTimelineDurationMs);
    setLocalDragRelease(globalDragRelease);
  }, [
    hasExternalDragRuntime,
    globalDragProgress,
    globalRenderProgress,
    globalDragTimelineProgress,
    globalIsDragging,
    globalSharedTimelineDurationMs,
    globalDragRelease,
  ]);

  const resolveDragProgress = useCallback(
    (rawProgress: number): number => {
      if (effectiveMode !== 'drag' || !isActive) return 0;

      if (!hasExternalDragRuntime && totalScenes <= 1) {
        return Math.max(-1, Math.min(1, rawProgress));
      }

      const isFirstScene = sceneIndex === 0;
      const isLastScene = sceneIndex === totalScenes - 1;

      if ((isFirstScene && rawProgress < 0) || (isLastScene && rawProgress > 0)) {
        return 0;
      }

      return Math.max(-1, Math.min(1, rawProgress));
    },
    [effectiveMode, hasExternalDragRuntime, isActive, sceneIndex, totalScenes]
  );

  useEffect(() => {
    if (!cineViewContext && process.env.NODE_ENV === 'development') {
      console.error(
        `[CineView Error] Scene component must be used within a CineView component.\n\n` +
          `Problem: Scene component at index ${sceneIndex} is not wrapped by CineView.\n` +
          `Fix: Wrap your Scene components inside a <CineView> component:\n\n` +
          `  <CineView mode="drag" config={{ width: 750, height: 1334 }}>\n` +
          `    <Scene>...</Scene>\n` +
          `  </CineView>\n`
      );
    }
  }, [cineViewContext, sceneIndex]);

  useEffect(() => {
    if (effectiveMode !== 'scroll') {
      setFixedLayerElement(null);
    }
  }, [effectiveMode]);

  useEffect(() => {
    if (!resolvedEnterAnimation && !resolvedExitAnimation) {
      setEnterVariant((current) => (current === null ? current : null));
      setExitVariant((current) => (current === null ? current : null));
      return;
    }

    let cancelled = false;

    const parseAnimations = async (): Promise<void> => {
      const [enter, exit] = await Promise.all([
        parseAnimationSafely(resolvedEnterAnimation, `Scene ${sceneIndex}`, 'enter'),
        parseAnimationSafely(resolvedExitAnimation, `Scene ${sceneIndex}`, 'exit'),
      ]);

      if (cancelled) {
        return;
      }

      setEnterVariant((enter as PresetAnimation) ?? null);
      setExitVariant((exit as PresetAnimation) ?? null);
    };

    parseAnimations();

    return () => {
      cancelled = true;
    };
  }, [resolvedEnterAnimation, resolvedExitAnimation, sceneIndex]);

  const getIssueKey = useCallback((issue: AnimationRegistryIssue): string => {
    switch (issue.type) {
      case 'missing-dependency':
        return `${issue.type}:${issue.animateId}:${issue.waitFor}`;
      case 'circular-dependency':
        return `${issue.type}:${issue.animateId}:${issue.cycle.join('>')}`;
      case 'duplicate-id':
        return `${issue.type}:${issue.animateId}`;
    }
  }, []);

  const reportRegistryIssues = useCallback(
    (issues: AnimationRegistryIssue[]): void => {
      const isDev = process.env.NODE_ENV === 'development';

      issues.forEach((issue) => {
        const key = getIssueKey(issue);
        if (reportedRegistryIssues.current.has(key)) {
          return;
        }
        reportedRegistryIssues.current.add(key);

        let code: string;
        let message: string;
        let devWarning: string;

        if (issue.type === 'missing-dependency') {
          code = 'INVALID_ANIMATION';
          message = `Animate "${issue.animateId}" references non-existent component "${issue.waitFor}" via waitFor in Scene ${sceneIndex}.`;
          devWarning =
            `[CineView Warning] Animation dependency error in Scene ${sceneIndex}.\n\n` +
            `Problem: Animate component "${issue.animateId}" references non-existent component "${issue.waitFor}" via waitFor.\n` +
            `Fix: Ensure the waitFor component ID matches an existing Animate component's animateId prop.\n`;
        } else if (issue.type === 'circular-dependency') {
          code = 'CIRCULAR_DEPENDENCY';
          message = `Animate waitFor chain contains a cycle in Scene ${sceneIndex}: ${issue.cycle.join(' -> ')}.`;
          devWarning =
            `[CineView Warning] Animation dependency cycle in Scene ${sceneIndex}.\n\n` +
            `Problem: Animate waitFor chain contains a cycle: ${issue.cycle.join(' -> ')}.\n` +
            `Fix: Remove the circular waitFor reference so each Animate starts after an earlier independent animation.\n`;
        } else {
          code = 'INVALID_COMPONENT_HIERARCHY';
          message = `More than one Animate component registered animateId "${issue.animateId}" in Scene ${sceneIndex}.`;
          devWarning =
            `[CineView Warning] Duplicate Animate id in Scene ${sceneIndex}.\n\n` +
            `Problem: More than one Animate component registered animateId "${issue.animateId}".\n` +
            `Fix: Give each Animate component in a Scene a unique animateId.\n`;
        }

        // Route to the consumer's onError in ALL environments (previously this
        // surfaced only via the dev-only console.warn below and was silent in
        // production builds, leaving a typo'd waitFor undetectable).
        reportRuntimeErrorRef.current?.({ code, message, context: { sceneIndex } });

        if (isDev) {
          console.warn(devWarning);
        }
      });
    },
    [getIssueKey, sceneIndex]
  );

  const rebuildRegistrySnapshot = useCallback((): AnimationRegistrySnapshot => {
    const snapshot = buildAnimationRegistrySnapshot({
      baseDuration: resolvedSceneTransitionDuration,
      registrations: animateRegistry.current,
      duplicateIds: duplicateAnimateIds.current,
    });
    registrySnapshot.current = snapshot;
    timelineDurationRef.current = snapshot.timelineDuration;
    setTimelineDurationState((previous) =>
      previous === snapshot.timelineDuration ? previous : snapshot.timelineDuration
    );
    reportRegistryIssues(snapshot.issues);
    return snapshot;
  }, [reportRegistryIssues, resolvedSceneTransitionDuration]);

  const registerAnimate = useCallback(
    (id: string, info: AnimateRegistrationInfo) => {
      if (animateRegistry.current.has(id)) {
        duplicateAnimateIds.current.add(id);
      }
      animateRegistry.current.set(id, info);

      const snapshot = rebuildRegistrySnapshot();
      const calculatedDelay = snapshot.calculatedDelays.get(id) ?? info.delay;

      if (
        process.env.NODE_ENV === 'development' &&
        typeof window !== 'undefined' &&
        (window as Window & { __CINEVIEW_DRAG_DEBUG__?: boolean }).__CINEVIEW_DRAG_DEBUG__
      ) {
        console.log(
          `[Scene ${sceneIndex}] Registered ${id}: delay=${info.delay}ms, calculated=${calculatedDelay}ms, duration=${info.duration}ms`
        );
        console.log(`[Scene ${sceneIndex}] Timeline duration: ${timelineDurationRef.current}ms`);
      }

      const MAX_ANIMATE_COMPONENTS = 100;
      if (
        animateRegistry.current.size > MAX_ANIMATE_COMPONENTS &&
        process.env.NODE_ENV === 'development'
      ) {
        console.warn(
          `[CineView Warning] Scene ${sceneIndex} has ${animateRegistry.current.size} Animate components.\n\n` +
            `Recommendation: Consider reducing the number of animated elements or splitting into multiple scenes.`
        );
      }
    },
    [sceneIndex, rebuildRegistrySnapshot]
  );

  const unregisterAnimate = useCallback(
    (id: string) => {
      animateRegistry.current.delete(id);
      duplicateAnimateIds.current.delete(id);
      rebuildRegistrySnapshot();
    },
    [rebuildRegistrySnapshot]
  );

  const getCalculatedDelay = useCallback(
    (animateId: string): number => {
      const cachedDelay = registrySnapshot.current.calculatedDelays.get(animateId);
      if (cachedDelay !== undefined) {
        return cachedDelay;
      }

      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `[CineView Warning] Delay cache miss for "${animateId}" in Scene ${sceneIndex}.`
        );
      }
      return 0;
    },
    [sceneIndex]
  );

  const markAnimateEntered = useCallback((id: string, entered: boolean): void => {
    if (!entered) {
      enteredAnimates.current.delete(id);
      return;
    }
    enteredAnimates.current.add(id);
    const subs = enterWaitSubs.current.get(id);
    if (subs) {
      // One-shot: snapshot then clear before firing so a callback that
      // re-subscribes (e.g. a replay) lands in a fresh set, not this batch.
      enterWaitSubs.current.delete(id);
      subs.forEach((cb) => cb());
    }
  }, []);

  const subscribeAnimateEntered = useCallback((leaderId: string, cb: () => void): (() => void) => {
    // Leader already entered → fire immediately, nothing to unsubscribe.
    if (enteredAnimates.current.has(leaderId)) {
      cb();
      return () => {};
    }
    let subs = enterWaitSubs.current.get(leaderId);
    if (!subs) {
      subs = new Set();
      enterWaitSubs.current.set(leaderId, subs);
    }
    subs.add(cb);
    return () => {
      subs?.delete(cb);
    };
  }, []);

  const getTimelineDuration = useCallback((): number => {
    return timelineDurationRef.current;
  }, []);

  const runtimeState = useSceneRuntimeState({
    slideMode: effectiveMode,
    sceneState,
    isActive,
    sceneOffset,
    globalScrollProgress,
    globalScrollDirection,
    globalIsScrolling,
    globalScrollBackdropActive,
    hasExitAnimation: !!resolvedExitAnimation,
    scrollTimelineState: globalScrollTimelineState,
  });

  const sceneVisibilityProgress = useMemo(() => {
    return getSceneVisibilityProgress({
      effectiveMode,
      isActive,
      globalScrollTimelineState,
      hasExitAnimation: !!resolvedExitAnimation,
    });
  }, [effectiveMode, isActive, globalScrollTimelineState, resolvedExitAnimation]);

  const sceneIsVisible = sceneVisibilityProgress > 0.001;

  useEffect(() => {
    emitSceneVisibility({
      onVisibilityChange,
      sceneVisibilityCallback,
      sceneIndex,
      visible: sceneIsVisible,
      progress: sceneVisibilityProgress,
    });
  }, [
    onVisibilityChange,
    sceneVisibilityCallback,
    sceneIndex,
    sceneIsVisible,
    sceneVisibilityProgress,
  ]);

  useEffect(() => {
    if (effectiveMode !== 'drag' || !isActive) return;
    (dragRuntime?.onSharedTimelineDurationChange ?? onSharedTimelineDurationChange)?.(
      getTimelineDuration()
    );
    if (!hasExternalDragRuntime) {
      setLocalSharedTimelineDurationMs(getTimelineDuration());
    }
  }, [
    effectiveMode,
    isActive,
    getTimelineDuration,
    timelineDurationState,
    dragRuntime,
    onSharedTimelineDurationChange,
    sceneState,
    hasExternalDragRuntime,
  ]);

  const sceneContextValue = useMemo<SceneContextType>(() => {
    const contextValue = {
      mode: effectiveMode,
      isActive,
      isVisible: sceneIsVisible,
      visibilityProgress: sceneVisibilityProgress,
      runtimeState,
      isSceneAnimating: globalIsSceneAnimating,
      transitionDirection: globalDirection,
      isDragging,
      dragProgressMotion,
      dragTimelineProgress: currentDragTimelineProgress,
      // Context FIELD name stays `sharedElapsedMotion` (useAnimateDrag reads it);
      // the local var is the scene-owned element track.
      sharedElapsedMotion: elementElapsedMotion,
      renderProgress: currentRenderProgress,
      scrollProgress: globalScrollProgress,
      isScrolling: globalIsScrolling,
      scrollDirection: globalScrollDirection,
      scrollTimelineState: globalScrollTimelineState,
      scrollActiveSceneIndex: globalScrollActiveSceneIndex,
      sceneState,
      sceneOffset,
      dragRelease: currentDragRelease,
      scrollTransitionSnapshot: globalScrollTransitionSnapshot,
      sharedTimelineDurationMs: currentSharedTimelineDurationMs,
      firstSceneEnterActive: globalFirstSceneEnterActive,
      // Three-state for the scroll visibility path: scene 0 forwards the real
      // ready bolean (held until priority assets settle); non-first scenes pass
      // `undefined` = NOT gated (so their elements fire on their own viewport
      // gates rather than being frozen waiting on a ready signal that is scoped
      // to scene 0). drag's useElementTrack reads the CineView-level flag, not
      // this field, so this conversion only affects the scroll path.
      firstSceneEnterReady: sceneIndex === 0 ? globalFirstSceneEnterReady : undefined,
      sceneTransitionDuration: resolvedSceneTransitionDuration,
      getTimelineDuration,
      registerAnimate,
      unregisterAnimate,
      getCalculatedDelay,
      markAnimateEntered,
      subscribeAnimateEntered,
      enterDuration: slideDuration,
    };

    if (
      process.env.NODE_ENV === 'development' &&
      typeof window !== 'undefined' &&
      (window as Window & { __CINEVIEW_DRAG_DEBUG__?: boolean }).__CINEVIEW_DRAG_DEBUG__
    ) {
      console.log(`🎬 [Scene ${sceneIndex}] Context updated:`, {
        effectiveMode,
        isActive,
        runtimeState,
        isSceneAnimating: globalIsSceneAnimating,
        transitionDirection: globalDirection,
        isDragging,
        isScrolling: contextValue.isScrolling,
        sceneState,
        sceneOffset: contextValue.sceneOffset,
        sceneTransitionDuration: resolvedSceneTransitionDuration,
        dragRelease: contextValue.dragRelease,
        dragTimelineProgress: contextValue.dragTimelineProgress?.toFixed(3),
        scrollProgress: contextValue.scrollProgress?.toFixed(3),
        sharedTimelineDurationMs: contextValue.sharedTimelineDurationMs,
        timelineDuration: contextValue.getTimelineDuration(),
        enterDuration: slideDuration,
        renderProgress: contextValue.renderProgress.toFixed(3),
        elementElapsedMsDebug: elementElapsedMotion.get().toFixed(1),
      });
    }

    return contextValue;
  }, [
    effectiveMode,
    isActive,
    sceneIsVisible,
    sceneVisibilityProgress,
    runtimeState,
    isDragging,
    dragProgressMotion,
    elementElapsedMotion,
    currentRenderProgress,
    currentDragTimelineProgress,
    globalScrollProgress,
    globalIsScrolling,
    globalScrollDirection,
    globalScrollTimelineState,
    globalScrollActiveSceneIndex,
    globalIsSceneAnimating,
    globalDirection,
    sceneState,
    sceneOffset,
    currentDragRelease,
    globalScrollTransitionSnapshot,
    currentSharedTimelineDurationMs,
    globalFirstSceneEnterActive,
    globalFirstSceneEnterReady,
    resolvedSceneTransitionDuration,
    getTimelineDuration,
    registerAnimate,
    unregisterAnimate,
    getCalculatedDelay,
    markAnimateEntered,
    subscribeAnimateEntered,
    slideDuration,
    sceneIndex,
  ]);

  // Legacy compat fields kept in the public/test surface while Phase 2 migration is in progress.
  void compatFields;

  useScrollSceneEngine({
    slideMode: effectiveMode,
    isActive,
    sceneOffset,
    sceneStackMode: effectiveSceneStackMode,
    controls,
    enterVariant,
    exitVariant,
    globalIsScrolling,
    globalScrollProgress,
    globalScrollDirection,
    globalScrollTransitionSnapshot,
    globalScrollBackdropActive,
    globalScrollTimelineState,
    setSceneState,
  });
  // Two-track element driver (single writer = this scene). Owns
  // elementElapsedMotion across follow-finger, release continuation, H2 preempt
  // and the scene-0 cold-start. onSettleComplete / onColdStartComplete both wire
  // to completeDragTransition (via onActivationComplete), fired when this scene's
  // element track reaches T — which now drives state CLEANUP only (the public
  // onSceneDidChange fires earlier, at the render commit).
  useElementTrack({
    slideMode: effectiveMode,
    isActive,
    sceneIndex,
    sceneOffset,
    globalDirection,
    globalRenderProgress: currentRenderProgress,
    globalIsDragging: currentIsDragging,
    globalDragTimelineProgress: currentDragTimelineProgress,
    dragRelease: currentDragRelease,
    firstSceneEnterReady: globalFirstSceneEnterReady,
    elementElapsedMotion,
    getTimelineDuration,
    timelineDurationState,
    dragTimeScale: dragRuntime?.dragTimeScale,
    onSettleComplete: dragRuntime?.onActivationComplete ?? onActivationComplete,
    onColdStartComplete: dragRuntime?.onActivationComplete ?? onActivationComplete,
  });

  const { handleDragStart, handlePan, handlePanEnd } = useDragSceneEngine({
    slideMode: effectiveMode,
    isActive,
    sceneIndex,
    currentSceneIndex,
    totalScenes,
    slideDirection: effectiveDirection,
    slideDuration,
    sceneTransitionDuration: resolvedSceneTransitionDuration,
    sceneOffset,
    sceneState,
    globalDirection,
    globalRenderProgress: currentRenderProgress,
    globalIsDragging: currentIsDragging,
    globalDragProgress: currentDragProgress,
    globalDragTimelineProgress: currentDragTimelineProgress,
    controls,
    dragProgressMotion,
    setSceneState,
    setIsAnimating,
    resolveDragProgress,
    getTimelineDuration,
    onDragProgressChange:
      dragRuntime?.onProgressChange ??
      onDragProgressChange ??
      (hasExternalDragRuntime ? undefined : setLocalDragProgress),
    onRenderProgressChange:
      dragRuntime?.onRenderProgressChange ??
      onRenderProgressChange ??
      (hasExternalDragRuntime ? undefined : setLocalRenderProgress),
    onDragTimelineProgressChange:
      dragRuntime?.onTimelineProgressChange ??
      onDragTimelineProgressChange ??
      (hasExternalDragRuntime ? undefined : setLocalDragTimelineProgress),
    onDraggingChange:
      dragRuntime?.onDraggingChange ??
      onDraggingChange ??
      (hasExternalDragRuntime ? undefined : setLocalIsDragging),
    onSharedTimelineDurationChange:
      dragRuntime?.onSharedTimelineDurationChange ??
      onSharedTimelineDurationChange ??
      (hasExternalDragRuntime ? undefined : setLocalSharedTimelineDurationMs),
    onDragRelease:
      dragRuntime?.onRelease ??
      onDragRelease ??
      (hasExternalDragRuntime ? undefined : setLocalDragReleaseInput),
    completeReleaseImmediately: !hasExternalDragRuntime,
    thresholdConfig: dragRuntime?.threshold,
    onDragCommit:
      dragRuntime?.onCommit ??
      onDragCommit ??
      (hasExternalDragRuntime
        ? undefined
        : (direction, _progressRatio, _elapsedMs, timelineDuration): void => {
            // Standalone (no CineView): commit at 100% immediately. There is no
            // incoming-scene coordination, so just rest the element track at T
            // and clear the drag interaction.
            setLocalDragProgress(0);
            setLocalRenderProgress(0);
            setLocalDragTimelineProgress(0);
            setLocalIsDragging(false);
            setLocalSharedTimelineDurationMs(timelineDuration ?? 0);
            setLocalDragRelease(null);
            elementElapsedMotion.set(getTimelineDuration());
            onSceneChange?.(direction);
          }),
    onDragReset:
      dragRuntime?.onReset ??
      onDragReset ??
      (hasExternalDragRuntime
        ? undefined
        : (): void => {
            setLocalDragProgress(0);
            setLocalRenderProgress(0);
            setLocalDragTimelineProgress(0);
            setLocalIsDragging(false);
            setLocalDragRelease(null);
            elementElapsedMotion.set(0);
          }),
  });

  useEffect(() => {
    const registry = animateRegistry.current;
    const duplicates = duplicateAnimateIds.current;
    const reportedIssues = reportedRegistryIssues.current;

    return (): void => {
      registry.clear();
      duplicates.clear();
      reportedIssues.clear();
    };
  }, []);

  const initialVariant = useMemo(() => {
    if (effectiveMode === 'drag') {
      return { opacity: 1 };
    }

    if (enterVariant) return enterVariant.initial;
    return { opacity: 1 };
  }, [enterVariant, effectiveMode]);

  const sceneTransform = useMemo(
    () => (effectiveMode === 'drag' ? 'none' : 'translateZ(0)'),
    [effectiveMode]
  );
  const sceneAnchorStyle = useMemo(
    () => resolveSceneAnchor(resolvedSceneAnchor),
    [resolvedSceneAnchor]
  );
  const scrollSceneAnchorStyle = useMemo(
    () => resolveScrollSceneAnchor(resolvedSceneAnchor),
    [resolvedSceneAnchor]
  );

  const fixedLayerMetrics = useMemo(() => {
    return getFixedLayerMetrics({
      effectiveMode,
      effectiveDirection,
      globalScrollTimelineState,
      globalScrollViewportOffset,
      globalViewportWidth,
      globalViewportHeight,
    });
  }, [
    effectiveMode,
    effectiveDirection,
    globalScrollTimelineState,
    globalScrollViewportOffset,
    globalViewportWidth,
    globalViewportHeight,
  ]);

  const sceneStyle = useMemo(
    () => ({
      width: resolvedSceneWidth,
      height: resolvedSceneHeight,
      position: effectiveMode === 'scroll' ? 'relative' : 'absolute',
      overflow: resolvedSceneOverflow,
      willChange: isAnimating || isDragging || globalIsScrolling ? 'transform, opacity' : 'auto',
      contain: effectiveMode === 'drag' ? 'layout style' : 'layout style paint',
      transform: sceneTransform,
      userSelect: 'none',
      WebkitUserSelect: 'none',
      touchAction: effectiveMode === 'drag' || effectiveMode === 'scroll' ? 'none' : 'auto',
      zIndex: resolvedSceneZIndex,
      pointerEvents:
        runtimeState === 'covered' || runtimeState === 'parked' || runtimeState === 'inactive'
          ? 'none'
          : 'auto',
      ...(effectiveMode === 'scroll' ? scrollSceneAnchorStyle : sceneAnchorStyle),
    }),
    [
      isAnimating,
      isDragging,
      globalIsScrolling,
      sceneTransform,
      effectiveMode,
      resolvedSceneWidth,
      resolvedSceneHeight,
      resolvedSceneOverflow,
      resolvedSceneZIndex,
      runtimeState,
      scrollSceneAnchorStyle,
      sceneAnchorStyle,
    ]
  );

  return (
    <SceneIdentityContext.Provider value={sceneIndex}>
      <SceneContext.Provider value={sceneContextValue}>
        <SceneFixedLayerContext.Provider
          value={effectiveMode === 'scroll' ? fixedLayerElement : null}
        >
          <SceneScrollTakeoverContext.Provider
            value={effectiveMode === 'scroll' ? sceneZoneId : null}
          >
            <motion.div
              ref={containerRef}
              data-cineview-scroll-zone={
                effectiveMode === 'scroll' ? (sceneZoneId ?? props.sceneId ?? undefined) : undefined
              }
              initial={initialVariant as never}
              animate={controls}
              style={sceneStyle as never}
              onPanStart={effectiveMode === 'drag' && isActive ? handleDragStart : undefined}
              onPan={effectiveMode === 'drag' && isActive ? handlePan : undefined}
              onPanEnd={effectiveMode === 'drag' && isActive ? handlePanEnd : undefined}
            >
              {effectiveMode === 'scroll' ? (
                <div
                  data-scene-fixed-layer={sceneIndex}
                  data-scene-fixed-role="clip"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: fixedLayerMetrics.clipWidth > 0 ? fixedLayerMetrics.clipWidth : '100%',
                    height:
                      fixedLayerMetrics.clipHeight > 0 ? fixedLayerMetrics.clipHeight : '100%',
                    overflow: 'hidden',
                    pointerEvents: 'none',
                    opacity: fixedLayerMetrics.visible ? 1 : 0,
                    visibility: fixedLayerMetrics.visible ? 'visible' : 'hidden',
                    zIndex: 20,
                  }}
                >
                  <div
                    data-scene-fixed-layer={sceneIndex}
                    data-scene-fixed-role="frame"
                    style={{
                      position: 'absolute',
                      top: fixedLayerMetrics.isHorizontal ? 0 : fixedLayerMetrics.hostOffset,
                      left: fixedLayerMetrics.isHorizontal ? fixedLayerMetrics.hostOffset : 0,
                      width: fixedLayerMetrics.isHorizontal
                        ? fixedLayerMetrics.hostSpan > 0
                          ? fixedLayerMetrics.hostSpan
                          : '100%'
                        : '100%',
                      height: fixedLayerMetrics.isHorizontal
                        ? '100%'
                        : fixedLayerMetrics.hostSpan > 0
                          ? fixedLayerMetrics.hostSpan
                          : '100%',
                      pointerEvents: 'none',
                    }}
                  >
                    <div
                      ref={handleFixedLayerHostRef}
                      data-scene-fixed-layer={sceneIndex}
                      data-scene-fixed-host={sceneIndex}
                      data-scene-fixed-role="host"
                      style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        // Host is the portal landing for `Position fixed` content.
                        // When empty it must NOT eat pointer events — a full-size
                        // pe:auto host (z-index 20) sat above scene children and
                        // swallowed every click on otherwise-interactive content
                        // (e.g. a hero with buttons but no fixed Position). Portaled
                        // fixed nodes carry their own pe:auto (Position.tsx), so
                        // they stay clickable through this pe:none parent.
                        pointerEvents: 'none',
                      }}
                    />
                  </div>
                </div>
              ) : null}
              {children}
            </motion.div>
          </SceneScrollTakeoverContext.Provider>
        </SceneFixedLayerContext.Provider>
      </SceneContext.Provider>
    </SceneIdentityContext.Provider>
  );
};

export const Scene: React.FC<SceneInternalProps> = SceneImpl;
export const SceneInternal = SceneImpl;
Scene.displayName = 'Scene';

export default Scene;
