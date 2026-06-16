/**
 * Scene Component
 * 表示一个全屏场景，管理场景内的动画和滑动行为
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, useAnimation, useMotionValue } from 'framer-motion';
import { SceneContext, type SceneContextType } from '../Animate/Animate';
import { useCineViewContext } from '../../context/CineViewContext';
import type { AnimateRegistrationInfo } from '../Animate/Animate';
import type { PresetAnimation } from '../../animations/presets';
import { parseAnimationSafely } from '../../utils/animationHelpers';
import type { SceneInternalProps, SceneState } from './types';
import { useSceneRuntimeState } from './useSceneRuntimeState';
import { useScrollSceneEngine } from './useScrollSceneEngine';
import { useDragSceneEngine } from './useDragSceneEngine';
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
    globalSharedElapsedMs,
    globalSharedTimelineDurationMs,
    globalViewportWidth,
    globalViewportHeight,
    globalDragProgress,
    globalRenderProgress,
    globalDragTimelineProgress,
    globalIsDragging,
    globalDragTransitionSnapshot,
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
    onSharedElapsedMsChange,
    onDraggingChange,
    onSharedTimelineDurationChange,
    onDragCommit,
    onDragReset,
    slideDuration,
    compatFields,
  } = normalizeSceneProps(props);
  const cineViewContext = useCineViewContext();
  const controls = useAnimation();

  const [enterVariant, setEnterVariant] = useState<PresetAnimation | null>(null);
  const [exitVariant, setExitVariant] = useState<PresetAnimation | null>(null);
  const hasExternalDragRuntime = Boolean(
    dragRuntime ||
    props.globalDragProgress !== undefined ||
    props.globalRenderProgress !== undefined ||
    props.globalDragTimelineProgress !== undefined ||
    props.globalIsDragging !== undefined ||
    props.globalSharedElapsedMs !== undefined ||
    props.globalSharedTimelineDurationMs !== undefined ||
    props.globalDragTransitionSnapshot !== undefined ||
    props.onDragProgressChange ||
    props.onRenderProgressChange ||
    props.onDragTimelineProgressChange ||
    props.onSharedElapsedMsChange ||
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
  const [localSharedElapsedMs, setLocalSharedElapsedMs] = useState(globalSharedElapsedMs);
  const [localSharedTimelineDurationMs, setLocalSharedTimelineDurationMs] = useState(
    globalSharedTimelineDurationMs
  );
  const [localDragTransitionSnapshot, setLocalDragTransitionSnapshot] = useState(
    globalDragTransitionSnapshot
  );
  const currentDragProgress = hasExternalDragRuntime ? globalDragProgress : localDragProgress;
  const currentRenderProgress = hasExternalDragRuntime ? globalRenderProgress : localRenderProgress;
  const currentDragTimelineProgress = hasExternalDragRuntime
    ? globalDragTimelineProgress
    : localDragTimelineProgress;
  const currentIsDragging = hasExternalDragRuntime ? globalIsDragging : localIsDragging;
  const currentSharedElapsedMs = hasExternalDragRuntime
    ? globalSharedElapsedMs
    : localSharedElapsedMs;
  const currentSharedTimelineDurationMs = hasExternalDragRuntime
    ? globalSharedTimelineDurationMs
    : localSharedTimelineDurationMs;
  const currentDragTransitionSnapshot = hasExternalDragRuntime
    ? globalDragTransitionSnapshot
    : localDragTransitionSnapshot;
  const isDragging = currentIsDragging;

  const dragProgressMotion = useMotionValue(currentDragProgress);
  const sharedElapsedMotion = useMotionValue(currentSharedElapsedMs);

  const [sceneState, setSceneState] = useState<SceneState>('initial');
  const sceneOffset = sceneIndex - currentSceneIndex;
  const [isAnimating, setIsAnimating] = useState(false);

  const animateRegistry = useRef<Map<string, AnimateRegistrationInfo>>(new Map());
  const animateRegistrySet = useRef<Set<string>>(new Set());
  const delayCache = useRef<Map<string, number>>(new Map());
  const timelineDurationRef = useRef<number>(resolvedSceneTransitionDuration);

  const containerRef = useRef<HTMLDivElement>(null);
  const [fixedLayerElement, setFixedLayerElement] = useState<HTMLElement | null>(null);
  const scrollSettleTimerRef = useRef<number | null>(null);
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

  useEffect(() => {
    sharedElapsedMotion.set(currentSharedElapsedMs);
  }, [currentSharedElapsedMs, sharedElapsedMotion]);

  useEffect(() => {
    if (!hasExternalDragRuntime) {
      return;
    }

    setLocalDragProgress(globalDragProgress);
    setLocalRenderProgress(globalRenderProgress);
    setLocalDragTimelineProgress(globalDragTimelineProgress);
    setLocalIsDragging(globalIsDragging);
    setLocalSharedElapsedMs(globalSharedElapsedMs);
    setLocalSharedTimelineDurationMs(globalSharedTimelineDurationMs);
    setLocalDragTransitionSnapshot(globalDragTransitionSnapshot);
  }, [
    hasExternalDragRuntime,
    globalDragProgress,
    globalRenderProgress,
    globalDragTimelineProgress,
    globalIsDragging,
    globalSharedElapsedMs,
    globalSharedTimelineDurationMs,
    globalDragTransitionSnapshot,
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
          `  <CineView mode="drag" config={{ width: 750, height: 1334, unit: 'px' }}>\n` +
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

  const calculateDelayForComponent = useCallback(
    (id: string, info: AnimateRegistrationInfo): number => {
      let totalDelay = info.delay;

      if (info.waitFor) {
        const cachedWaitForDelay = delayCache.current.get(info.waitFor);
        if (cachedWaitForDelay !== undefined) {
          const waitForInfo = animateRegistry.current.get(info.waitFor);
          if (waitForInfo) {
            totalDelay += cachedWaitForDelay + waitForInfo.duration;
          }
        } else {
          const waitForInfo = animateRegistry.current.get(info.waitFor);
          if (waitForInfo) {
            const waitForDelay = calculateDelayForComponent(info.waitFor, waitForInfo);
            delayCache.current.set(info.waitFor, waitForDelay);
            totalDelay += waitForDelay + waitForInfo.duration;
          } else if (process.env.NODE_ENV === 'development') {
            console.warn(
              `[CineView Warning] Animation dependency error in Scene ${sceneIndex}.\n\n` +
                `Problem: Animate component "${id}" references non-existent component "${info.waitFor}" via waitFor.\n` +
                `Fix: Ensure the waitFor component ID matches an existing Animate component's animateId prop.\n`
            );
          }
        }
      }

      return totalDelay;
    },
    [sceneIndex]
  );

  const registerAnimate = useCallback(
    (id: string, info: AnimateRegistrationInfo) => {
      animateRegistry.current.set(id, info);
      animateRegistrySet.current.add(id);

      const calculatedDelay = calculateDelayForComponent(id, info);
      delayCache.current.set(id, calculatedDelay);
      timelineDurationRef.current = Math.max(
        resolvedSceneTransitionDuration,
        calculatedDelay + info.duration
      );

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
    [sceneIndex, calculateDelayForComponent, resolvedSceneTransitionDuration]
  );

  const unregisterAnimate = useCallback(
    (id: string) => {
      animateRegistry.current.delete(id);
      animateRegistrySet.current.delete(id);
      delayCache.current.delete(id);
      let nextTimelineDuration = resolvedSceneTransitionDuration;
      animateRegistry.current.forEach((info, animateId) => {
        const calculatedDelay = delayCache.current.get(animateId) ?? 0;
        nextTimelineDuration = Math.max(nextTimelineDuration, calculatedDelay + info.duration);
      });
      timelineDurationRef.current = nextTimelineDuration;
    },
    [resolvedSceneTransitionDuration]
  );

  const getCalculatedDelay = useCallback(
    (animateId: string): number => {
      const cachedDelay = delayCache.current.get(animateId);
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
      sharedElapsedMotion,
      renderProgress: currentRenderProgress,
      scrollProgress: globalScrollProgress,
      isScrolling: globalIsScrolling,
      scrollDirection: globalScrollDirection,
      scrollTimelineState: globalScrollTimelineState,
      scrollActiveSceneIndex: globalScrollActiveSceneIndex,
      sceneState,
      sceneOffset,
      dragTransitionSnapshot: currentDragTransitionSnapshot,
      scrollTransitionSnapshot: globalScrollTransitionSnapshot,
      sharedElapsedMs: currentSharedElapsedMs,
      sharedTimelineDurationMs: currentSharedTimelineDurationMs,
      sceneTransitionDuration: resolvedSceneTransitionDuration,
      getTimelineDuration,
      registerAnimate,
      unregisterAnimate,
      getCalculatedDelay,
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
        dragTransitionSnapshot: contextValue.dragTransitionSnapshot,
        sharedElapsedMs: contextValue.sharedElapsedMs,
        dragTimelineProgress: contextValue.dragTimelineProgress?.toFixed(3),
        scrollProgress: contextValue.scrollProgress?.toFixed(3),
        sharedTimelineDurationMs: contextValue.sharedTimelineDurationMs,
        timelineDuration: contextValue.getTimelineDuration(),
        enterDuration: slideDuration,
        renderProgress: contextValue.renderProgress.toFixed(3),
        sharedElapsedMsDebug: sharedElapsedMotion.get().toFixed(1),
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
    sharedElapsedMotion,
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
    currentDragTransitionSnapshot,
    globalScrollTransitionSnapshot,
    currentSharedElapsedMs,
    currentSharedTimelineDurationMs,
    resolvedSceneTransitionDuration,
    getTimelineDuration,
    registerAnimate,
    unregisterAnimate,
    getCalculatedDelay,
    slideDuration,
    sceneIndex,
  ]);

  // Legacy compat fields kept in the public/test surface while Phase 2 migration is in progress.
  void compatFields;

  useScrollSceneEngine({
    slideMode: effectiveMode,
    isActive,
    sceneIndex,
    totalScenes,
    sceneOffset,
    slideDirection: effectiveDirection,
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
    containerRef,
    scrollSettleTimerRef,
    setSceneState,
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
    globalSharedElapsedMs: currentSharedElapsedMs,
    globalDragTimelineProgress: currentDragTimelineProgress,
    globalDragTransitionSnapshot: currentDragTransitionSnapshot,
    controls,
    dragProgressMotion,
    sharedElapsedMotion,
    setSceneState,
    setIsAnimating,
    resolveDragProgress,
    getTimelineDuration,
    onActivationComplete: dragRuntime?.onActivationComplete ?? onActivationComplete,
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
    onSharedElapsedMsChange:
      dragRuntime?.onSharedElapsedMsChange ??
      onSharedElapsedMsChange ??
      (hasExternalDragRuntime ? undefined : setLocalSharedElapsedMs),
    onDraggingChange:
      dragRuntime?.onDraggingChange ??
      onDraggingChange ??
      (hasExternalDragRuntime ? undefined : setLocalIsDragging),
    onSharedTimelineDurationChange:
      dragRuntime?.onSharedTimelineDurationChange ??
      onSharedTimelineDurationChange ??
      (hasExternalDragRuntime ? undefined : setLocalSharedTimelineDurationMs),
    completeReleaseImmediately: !hasExternalDragRuntime,
    onDragCommit:
      dragRuntime?.onCommit ??
      onDragCommit ??
      (hasExternalDragRuntime
        ? undefined
        : (direction, _progressRatio, _elapsedMs, timelineDuration): void => {
            setLocalDragProgress(0);
            setLocalRenderProgress(0);
            setLocalDragTimelineProgress(0);
            setLocalIsDragging(false);
            setLocalSharedElapsedMs(0);
            setLocalSharedTimelineDurationMs(timelineDuration ?? 0);
            setLocalDragTransitionSnapshot(null);
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
            setLocalSharedElapsedMs(0);
            setLocalDragTransitionSnapshot(null);
          }),
  });

  useEffect(() => {
    const registry = animateRegistry.current;
    const registrySet = animateRegistrySet.current;
    const cache = delayCache.current;

    return (): void => {
      registry.clear();
      registrySet.clear();
      cache.clear();
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
                effectiveMode === 'scroll' ? sceneZoneId ?? props.sceneId ?? undefined : undefined
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
                    height: fixedLayerMetrics.clipHeight > 0 ? fixedLayerMetrics.clipHeight : '100%',
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
                        pointerEvents: 'auto',
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
