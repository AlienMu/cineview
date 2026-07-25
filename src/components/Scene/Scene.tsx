/**
 * Scene Component
 * 表示一个全屏场景，管理场景内的动画和滑动行为
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, useAnimation, useMotionValue } from 'framer-motion';
import { SceneContext, type SceneContextType } from '../Animate/Animate';
import { useCineViewContext } from '../../context/CineViewContext';
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
import { SceneFixedLayer } from './SceneFixedLayer';
import { useSceneAnimationRegistry } from './useSceneAnimationRegistry';
import { useSceneScrollTakeover } from './useSceneScrollTakeover';
import { useScenePointerInput } from './useScenePointerInput';
import {
  emitSceneVisibility,
  getFixedLayerMetrics,
  getSceneVisibilityProgress,
  normalizeSceneProps,
  resolveDragTouchAction,
  resolveSceneAnchor,
  resolveScrollSceneAnchor,
} from './helpers';

export const SceneIdentityContext = React.createContext<number | null>(null);

const INTERNAL_SCENE_PROPS = new Set([
  'children',
  'sceneId',
  'layout',
  'stack',
  'transition',
  'assets',
  'scroll',
  'callbacks',
  'runtimeMode',
  'runtimeDirection',
  'isActive',
  'sceneIndex',
  'totalScenes',
  'currentSceneIndex',
  'sceneRuntime',
  'dragRuntime',
  'scrollRuntime',
  'onDragCommit',
  'onDragReset',
  'onActivationComplete',
  'onDragProgressChange',
  'onRenderProgressChange',
  'onDragTimelineProgressChange',
  'onSharedElapsedMsChange',
  'onDraggingChange',
  'onSharedTimelineDurationChange',
  'onDragRelease',
  'onScrollProgressChange',
  'onScrollDirectionChange',
  'onScrollingChange',
  'onScrollCommit',
  'onScrollReset',
  'onSceneChange',
  'mode',
  'slideDirection',
  'slideDuration',
  'sceneTransitionDuration',
  'enterAnimation',
  'exitAnimation',
  'exitDuration',
  'sceneWidth',
  'sceneHeight',
  'sceneAnchor',
  'sceneZIndex',
  'sceneOverflow',
  'sceneStackMode',
  'scrollSpeed',
  'scrollControlled',
  'scrollCommitThreshold',
  'scrollReleaseDuration',
  'scrollLockToSingleScene',
  'scrollEnterLength',
  'scrollHoldLength',
  'scrollExitLength',
  'onVisibilityChange',
  'preloadImages',
]);

const SceneImpl = React.forwardRef<HTMLDivElement, SceneInternalProps>(
  function SceneImpl(props, forwardedRef) {
    const {
      children,
      className,
      style,
      onPointerDown: authoredPointerDown,
      onPointerMove: authoredPointerMove,
      onPointerUp: authoredPointerUp,
      onPointerCancel: authoredPointerCancel,
    } = props;
    const {
      effectiveMode,
      effectiveDirection,
      isActive,
      sceneIndex,
      totalScenes,
      currentSceneIndex,
      globalDirection,
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
    const currentRenderProgress = hasExternalDragRuntime
      ? globalRenderProgress
      : localRenderProgress;
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

    const {
      timelineDuration: timelineDurationState,
      registerAnimate,
      unregisterAnimate,
      getCalculatedDelay,
      markAnimateEntered,
      subscribeAnimateEntered,
      getTimelineDuration,
    } = useSceneAnimationRegistry({
      sceneIndex,
      baseDuration: resolvedSceneTransitionDuration,
      reportError: cineViewRuntime?.reportError,
    });

    const containerRef = useRef<HTMLDivElement | null>(null);
    const setContainerRef = useCallback(
      (node: HTMLDivElement | null): void => {
        containerRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [forwardedRef]
    );
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
            `  <CineView mode="drag" config={{ size: 750 }}>\n` +
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

      return (): void => {
        cancelled = true;
      };
    }, [resolvedEnterAnimation, resolvedExitAnimation, sceneIndex]);

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
    const legacyVisibilityCallbackRef = useRef(onVisibilityChange);
    const sceneVisibilityCallbackRef = useRef(sceneVisibilityCallback);

    useEffect(() => {
      legacyVisibilityCallbackRef.current = onVisibilityChange;
      sceneVisibilityCallbackRef.current = sceneVisibilityCallback;
    }, [onVisibilityChange, sceneVisibilityCallback]);

    useEffect(() => {
      emitSceneVisibility({
        onVisibilityChange: legacyVisibilityCallbackRef.current,
        sceneVisibilityCallback: sceneVisibilityCallbackRef.current,
        sceneIndex,
        visible: sceneIsVisible,
        progress: sceneVisibilityProgress,
      });
    }, [sceneIndex, sceneIsVisible, sceneVisibilityProgress]);

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

    const sceneBaseContextValue = useMemo<SceneContextType>(() => {
      return {
        mode: effectiveMode,
        isActive,
        isDragging: false,
        dragProgressMotion,
        runtimeState,
        sceneState,
        sceneOffset,
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
    }, [
      effectiveMode,
      getCalculatedDelay,
      getTimelineDuration,
      globalFirstSceneEnterReady,
      isActive,
      dragProgressMotion,
      markAnimateEntered,
      registerAnimate,
      resolvedSceneTransitionDuration,
      sceneIndex,
      sceneOffset,
      sceneState,
      slideDuration,
      subscribeAnimateEntered,
      unregisterAnimate,
      runtimeState,
    ]);

    const sceneDragContextValue = useMemo<SceneContextType>(
      () => ({
        ...sceneBaseContextValue,
        isDragging,
        dragProgressMotion,
        dragTimelineProgress: currentDragTimelineProgress,
        sharedElapsedMotion: elementElapsedMotion,
        renderProgress: currentRenderProgress,
        dragRelease: currentDragRelease,
        sharedTimelineDurationMs: currentSharedTimelineDurationMs,
        firstSceneEnterActive: globalFirstSceneEnterActive,
      }),
      [
        currentDragRelease,
        currentDragTimelineProgress,
        currentRenderProgress,
        currentSharedTimelineDurationMs,
        dragProgressMotion,
        elementElapsedMotion,
        globalFirstSceneEnterActive,
        isDragging,
        sceneBaseContextValue,
      ]
    );

    const sceneContextValue =
      effectiveMode === 'drag' ? sceneDragContextValue : sceneBaseContextValue;

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

    const {
      onPointerDown: handleScenePointerDown,
      onPointerMove: handleScenePointerMove,
      onPointerUp: handleScenePointerUp,
      onPointerCancel: handleScenePointerCancel,
      onFramerPanStart: handleFramerPanStart,
      onFramerPan: handleFramerPan,
      onFramerPanEnd: handleFramerPanEnd,
    } = useScenePointerInput({
      enabled: effectiveMode === 'drag' && isActive,
      onDragStart: handleDragStart,
      onPan: handlePan,
      onPanEnd: handlePanEnd,
      authoredPointerDown,
      authoredPointerMove,
      authoredPointerUp,
      authoredPointerCancel,
    });

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
        userSelect: effectiveMode === 'drag' && isDragging ? 'none' : undefined,
        WebkitUserSelect: effectiveMode === 'drag' && isDragging ? 'none' : undefined,
        touchAction: resolveDragTouchAction(effectiveMode, effectiveDirection),
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
        effectiveDirection,
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
                ref={setContainerRef}
                data-cineview-scroll-zone={
                  effectiveMode === 'scroll'
                    ? (sceneZoneId ?? props.sceneId ?? undefined)
                    : undefined
                }
                initial={initialVariant as never}
                animate={controls}
                {...Object.fromEntries(
                  Object.entries(props).filter(([key]) => !INTERNAL_SCENE_PROPS.has(key))
                )}
                className={className}
                style={{ ...style, ...sceneStyle } as never}
                onPanStart={effectiveMode === 'drag' && isActive ? handleFramerPanStart : undefined}
                onPan={effectiveMode === 'drag' && isActive ? handleFramerPan : undefined}
                onPanEnd={effectiveMode === 'drag' && isActive ? handleFramerPanEnd : undefined}
                onPointerDown={
                  effectiveMode === 'drag' && isActive
                    ? handleScenePointerDown
                    : authoredPointerDown
                }
                onPointerMove={
                  effectiveMode === 'drag' && isActive
                    ? handleScenePointerMove
                    : authoredPointerMove
                }
                onPointerUp={
                  effectiveMode === 'drag' && isActive ? handleScenePointerUp : authoredPointerUp
                }
                onPointerCancel={
                  effectiveMode === 'drag' && isActive
                    ? handleScenePointerCancel
                    : authoredPointerCancel
                }
              >
                {effectiveMode === 'scroll' ? (
                  <SceneFixedLayer
                    sceneIndex={sceneIndex}
                    metrics={fixedLayerMetrics}
                    setHostRef={handleFixedLayerHostRef}
                  />
                ) : null}
                {children}
              </motion.div>
            </SceneScrollTakeoverContext.Provider>
          </SceneFixedLayerContext.Provider>
        </SceneContext.Provider>
      </SceneIdentityContext.Provider>
    );
  }
);

export const Scene = Object.assign(SceneImpl, { cineViewScene: true as const });
export const SceneInternal = Scene;
Scene.displayName = 'Scene';

export default Scene;
