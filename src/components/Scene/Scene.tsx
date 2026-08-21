/**
 * Scene Component
 * 表示一个全屏场景，管理场景内的动画和滑动行为
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, useAnimation, useMotionValue } from 'framer-motion';
import { SceneContext, type SceneContextType } from '../Animate/Animate';
import { useCineViewContext } from '../../context/CineViewContext';
import type { PresetAnimation } from '../../animations/presets';
import type { FrozenAnimationRegistrySnapshot } from '../../animations/registry';
import type { ParsedAnimationVariant } from '../../types';
import { parseAnimationSafely, type AnimationParseFailure } from '../../utils/animationHelpers';
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
import { useStructurallyStableValue } from '../../utils/useStructurallyStableValue';
import { resolveDragTimelineConfig } from '../../utils/dragTimelineMapping';
import { createPreparedSceneSnapshot, type PreparedSceneSnapshot } from './dragPreparedState';
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
  'drag',
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
      globalActivationToken,
      globalActivationKind,
      globalFirstSceneEnterGateKnown,
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
    const scrollFrameStore = props.scrollRuntime?.frameStore;
    const scrollFrameSceneIndex = props.scrollRuntime?.sceneIndex ?? sceneIndex;
    const cineViewContext = useCineViewContext();
    const cineViewRuntime = useCineViewRuntimeContext();
    const reportRuntimeError = cineViewRuntime?.reportError;
    const controls = useAnimation();

    const [enterVariant, setEnterVariant] = useState<PresetAnimation | null>(null);
    const [exitVariant, setExitVariant] = useState<PresetAnimation | null>(null);
    const transitionParseGenerationRef = useRef(0);
    const dragTransitionWarningRef = useRef<string | null>(null);
    const stableEnterAnimation = useStructurallyStableValue(resolvedEnterAnimation);
    const stableExitAnimation = useStructurallyStableValue(resolvedExitAnimation);
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

    const localDragProgressMotion = useMotionValue(currentDragProgress);
    const dragProgressMotion = dragRuntime?.renderProgressMotion ?? localDragProgressMotion;
    const localDragTimelineProgressMotion = useMotionValue(currentDragTimelineProgress);
    const dragTimelineProgressMotion =
      dragRuntime?.timelineProgressMotion ?? localDragTimelineProgressMotion;
    // Two-track model: the element track is scene-OWNED. It starts at 0 (never
    // seeded from a global scalar) and is written ONLY by this scene's
    // useElementTrack. The old global-sync effect is deleted.
    const elementElapsedMotion = useMotionValue(0);

    const [sceneState, setSceneState] = useState<SceneState>('initial');
    const sceneOffset = sceneIndex - currentSceneIndex;
    const [isAnimating, setIsAnimating] = useState(false);
    const sceneInstanceIdRef = useRef(Symbol(`scene:${sceneIndex}`));
    const lastPreparedRef = useRef<PreparedSceneSnapshot | null>(null);
    const preparedInvalidationRef = useRef(dragRuntime?.onPreparedInvalidated);
    preparedInvalidationRef.current = dragRuntime?.onPreparedInvalidated;
    const [preparedSnapshot, setPreparedSnapshot] = useState<PreparedSceneSnapshot | null>(null);
    const preparedMapping = useMemo(
      () => dragRuntime?.dragMappingConfig ?? resolveDragTimelineConfig(undefined, props.drag),
      [dragRuntime?.dragMappingConfig, props.drag]
    );
    const handleStableRegistrySnapshot = useCallback(
      (
        registrySnapshot: FrozenAnimationRegistrySnapshot,
        revision: number,
        enterVariantsByAnimateId: ReadonlyMap<string, ParsedAnimationVariant>
      ): void => {
        if (effectiveMode !== 'drag') return;
        const snapshot = createPreparedSceneSnapshot({
          sceneIndex,
          instanceId: sceneInstanceIdRef.current,
          revision,
          enabled: props.drag?.enabled !== false,
          mapping: preparedMapping,
          registrySnapshot,
          enterVariantsByAnimateId,
        });
        lastPreparedRef.current = snapshot;
        setPreparedSnapshot(snapshot);
        dragRuntime?.onPrepared?.(snapshot);
      },
      [dragRuntime, effectiveMode, preparedMapping, props.drag?.enabled, sceneIndex]
    );

    const {
      timelineDuration: timelineDurationState,
      beginPreparation,
      registerAnimate,
      declareAnimateDriver,
      unregisterAnimate,
      getCalculatedDelay,
      getTimelineDuration,
    } = useSceneAnimationRegistry({
      sceneIndex,
      baseDuration: effectiveMode === 'drag' ? 0 : resolvedSceneTransitionDuration,
      reportError: cineViewRuntime?.reportError,
      onStableSnapshot: handleStableRegistrySnapshot,
    });

    useEffect(() => {
      return (): void => {
        const snapshot = lastPreparedRef.current;
        if (!snapshot) return;
        preparedInvalidationRef.current?.({
          sceneIndex: snapshot.sceneIndex,
          instanceId: snapshot.instanceId,
          revision: snapshot.revision,
        });
      };
    }, []);

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
      if (!dragRuntime?.renderProgressMotion) {
        localDragProgressMotion.set(currentDragProgress);
      }
    }, [currentDragProgress, dragRuntime?.renderProgressMotion, localDragProgressMotion]);
    useEffect(() => {
      if (!dragRuntime?.timelineProgressMotion) {
        localDragTimelineProgressMotion.set(currentDragTimelineProgress);
      }
    }, [
      currentDragTimelineProgress,
      dragRuntime?.timelineProgressMotion,
      localDragTimelineProgressMotion,
    ]);

    // NOTE: the element track (elementElapsedMotion) is NOT synced from any global
    // elapsed scalar — it is owned and driven solely by this scene's useElementTrack.

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
        if (effectiveMode !== 'drag') return 0;

        if (!hasExternalDragRuntime && totalScenes <= 1) {
          return Math.max(-1, Math.min(1, rawProgress));
        }

        // D-F1/D-F7: boundary clamping keys off the ACTIVE scene index, not
        // this scene's own index. A gesture can run on a non-active scene's
        // engine (a rush re-grab takeover accepted by the incoming scene, or a
        // gesture continuing after its own commit deactivated this scene), and
        // its pans must be clamped against the CURRENTLY active scene's
        // boundaries. While this scene IS active the two indices coincide, so
        // behaviour is unchanged. The engine gates callers by gesture
        // ownership, so no isActive guard is needed here.
        const isFirstScene = currentSceneIndex === 0;
        const isLastScene = currentSceneIndex === totalScenes - 1;

        if ((isFirstScene && rawProgress < 0) || (isLastScene && rawProgress > 0)) {
          return 0;
        }

        return Math.max(-1, Math.min(1, rawProgress));
      },
      [effectiveMode, hasExternalDragRuntime, currentSceneIndex, totalScenes]
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
      const generation = ++transitionParseGenerationRef.current;
      const isCurrentGeneration = (): boolean =>
        transitionParseGenerationRef.current === generation;
      const reportFailure = (failure: AnimationParseFailure): void => {
        if (!isCurrentGeneration()) return;
        reportRuntimeError?.(failure);
      };

      setEnterVariant(null);
      setExitVariant(null);

      // Scene-level transitions belong to scroll. Drag uses the page render lane
      // plus child Animate element tracks and must not load these preset assets.
      if (effectiveMode !== 'scroll') {
        if (stableEnterAnimation || stableExitAnimation) {
          const ignoredFields = [
            stableEnterAnimation ? 'enterAnimation' : null,
            stableExitAnimation ? 'exitAnimation' : null,
          ].filter(Boolean) as string[];
          const warningKey = ignoredFields.join(',');
          if (
            process.env.NODE_ENV === 'development' &&
            dragTransitionWarningRef.current !== warningKey
          ) {
            dragTransitionWarningRef.current = warningKey;
            console.warn(
              `[CineView] Scene ${sceneIndex} ignores ${ignoredFields.join(
                ' and '
              )} in drag mode. Use child <Animate> components for element animations.`
            );
          }
        }
        return (): void => {
          if (isCurrentGeneration()) transitionParseGenerationRef.current += 1;
        };
      }

      if (!stableEnterAnimation && !stableExitAnimation) {
        return (): void => {
          if (isCurrentGeneration()) transitionParseGenerationRef.current += 1;
        };
      }

      const parseAnimations = async (): Promise<void> => {
        const [enter, exit] = await Promise.all([
          parseAnimationSafely(stableEnterAnimation, `Scene ${sceneIndex}`, 'enter', reportFailure),
          parseAnimationSafely(stableExitAnimation, `Scene ${sceneIndex}`, 'exit', reportFailure),
        ]);

        if (!isCurrentGeneration()) return;
        setEnterVariant((enter as PresetAnimation) ?? null);
        setExitVariant((exit as PresetAnimation) ?? null);
      };

      void parseAnimations();

      return (): void => {
        if (isCurrentGeneration()) transitionParseGenerationRef.current += 1;
      };
    }, [effectiveMode, reportRuntimeError, sceneIndex, stableEnterAnimation, stableExitAnimation]);

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
      if (effectiveMode === 'scroll' && scrollFrameStore) return;
      emitSceneVisibility({
        onVisibilityChange: legacyVisibilityCallbackRef.current,
        sceneVisibilityCallback: sceneVisibilityCallbackRef.current,
        sceneIndex,
        visible: sceneIsVisible,
        progress: sceneVisibilityProgress,
      });
    }, [effectiveMode, sceneIndex, sceneIsVisible, sceneVisibilityProgress, scrollFrameStore]);

    // Continuous visibility progress follows the imperative frame lane. This
    // preserves the callback contract without making the Scene subtree render
    // once per native scroll pixel.
    useEffect(() => {
      if (effectiveMode !== 'scroll' || !scrollFrameStore) return undefined;

      const emitFrameVisibility = (): void => {
        const frame = scrollFrameStore.getKeySnapshot(scrollFrameSceneIndex) ?? null;
        const progress = getSceneVisibilityProgress({
          effectiveMode,
          isActive: frame?.isCurrent ?? isActive,
          globalScrollTimelineState: frame?.timelineState ?? null,
          hasExitAnimation: Boolean(resolvedExitAnimation),
        });
        emitSceneVisibility({
          onVisibilityChange: legacyVisibilityCallbackRef.current,
          sceneVisibilityCallback: sceneVisibilityCallbackRef.current,
          sceneIndex,
          visible: progress > 0.001,
          progress,
        });
      };

      emitFrameVisibility();
      return scrollFrameStore.subscribeKey(scrollFrameSceneIndex, emitFrameVisibility);
    }, [
      effectiveMode,
      scrollFrameStore,
      isActive,
      resolvedExitAnimation,
      sceneIndex,
      sceneVisibilityCallback,
      scrollFrameSceneIndex,
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

    // Only drag playback requires an immutable prepared snapshot. Scroll's first
    // screen is driven by the visibility gate and never creates a drag snapshot;
    // coupling it to `preparedSnapshot` pins every authored enter at its initial
    // frame forever (an all-blank first screen).
    const firstScenePlaybackReady =
      effectiveMode === 'drag'
        ? globalFirstSceneEnterReady && preparedSnapshot !== null
        : globalFirstSceneEnterReady;
    const sceneBaseContextValue = useMemo<SceneContextType>(() => {
      return {
        mode: effectiveMode,
        isActive,
        isDragging: false,
        dragProgressMotion,
        runtimeState,
        sceneState,
        sceneOffset,
        activationToken: globalActivationToken,
        activationKind: globalActivationKind,
        firstSceneEnterGateKnown: sceneIndex === 0 ? globalFirstSceneEnterGateKnown : undefined,
        firstSceneEnterActive: sceneIndex === 0 ? globalFirstSceneEnterActive : undefined,
        firstSceneEnterReady: sceneIndex === 0 ? firstScenePlaybackReady : undefined,
        sceneTransitionDuration: resolvedSceneTransitionDuration,
        getTimelineDuration,
        beginPreparation,
        registerAnimate,
        declareAnimateDriver,
        unregisterAnimate,
        getCalculatedDelay,
        enterDuration: slideDuration,
      };
    }, [
      beginPreparation,
      declareAnimateDriver,
      effectiveMode,
      firstScenePlaybackReady,
      getCalculatedDelay,
      globalActivationKind,
      globalActivationToken,
      globalFirstSceneEnterActive,
      globalFirstSceneEnterGateKnown,
      getTimelineDuration,
      isActive,
      dragProgressMotion,
      registerAnimate,
      resolvedSceneTransitionDuration,
      sceneIndex,
      sceneOffset,
      sceneState,
      slideDuration,
      unregisterAnimate,
      runtimeState,
    ]);

    const sceneDragContextValue = useMemo<SceneContextType>(
      () => ({
        ...sceneBaseContextValue,
        isDragging,
        dragProgressMotion,
        renderProgressMotion: dragProgressMotion,
        dragTransaction: dragRuntime?.transaction ?? null,
        preparedSnapshot,
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
        dragRuntime?.transaction,
        elementElapsedMotion,
        globalFirstSceneEnterActive,
        isDragging,
        preparedSnapshot,
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
      scrollFrameStore,
      scrollFrameSceneIndex,
      setSceneState,
    });
    // Two-track element driver (single writer = this scene). Owns
    // elementElapsedMotion across follow-finger, release continuation, H2 preempt
    // and the scene-0 cold-start. onSettleComplete / onColdStartComplete both wire
    // to completeDragTransition (via onActivationComplete), fired when this scene's
    // element track reaches T — which now drives state CLEANUP only (the public
    // onSceneDidChange fires earlier, at the render commit).
    const elementTrackCommands = useElementTrack({
      slideMode: effectiveMode,
      isActive,
      sceneIndex,
      sceneOffset,
      globalDirection,
      globalRenderProgress: currentRenderProgress,
      renderProgressMotion: dragProgressMotion,
      globalIsDragging: currentIsDragging,
      candidateSuspended: dragRuntime?.candidateSuspended ?? false,
      globalDragTimelineProgress: currentDragTimelineProgress,
      dragTimelineProgressMotion,
      dragRelease: currentDragRelease,
      firstSceneEnterReady: globalFirstSceneEnterReady,
      elementElapsedMotion,
      getTimelineDuration,
      timelineDurationState,
      dragTransaction: dragRuntime?.transaction ?? null,
      preparedSnapshot,
      requirePreparedSnapshot: hasExternalDragRuntime,
      dragMappingConfig: dragRuntime?.dragMappingConfig,
      takeoverSnapshot: dragRuntime?.takeoverSnapshot,
      onElementContinuationChange: dragRuntime?.onElementContinuationChange,
      onSettleComplete: dragRuntime?.onActivationComplete ?? onActivationComplete,
      onColdStartComplete: dragRuntime?.onActivationComplete ?? onActivationComplete,
    });

    const {
      handleCandidateSuspend,
      handleCandidateResume,
      handleDragStart,
      handlePan,
      handlePanEnd,
    } = useDragSceneEngine({
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
      onOwnershipRequest: dragRuntime?.onOwnershipRequest,
      onCandidateSuspensionChange: dragRuntime?.onCandidateSuspensionChange,
      takeoverSnapshot: dragRuntime?.takeoverSnapshot,
      onDragProgressChange: dragRuntime?.onProgressChange ?? onDragProgressChange,
      onRenderProgressChange: dragRuntime?.onRenderProgressChange ?? onRenderProgressChange,
      onDragTimelineProgressChange:
        dragRuntime?.onTimelineProgressChange ??
        onDragTimelineProgressChange ??
        (hasExternalDragRuntime
          ? undefined
          : (progress): void => localDragTimelineProgressMotion.set(progress)),
      onDraggingChange:
        dragRuntime?.onDraggingChange ??
        onDraggingChange ??
        (hasExternalDragRuntime ? undefined : setLocalIsDragging),
      onDragRelease:
        dragRuntime?.onRelease ??
        onDragRelease ??
        (hasExternalDragRuntime ? undefined : setLocalDragReleaseInput),
      renderLaneRef: dragRuntime?.renderLane,
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
              elementTrackCommands.completeImmediately();
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
              elementTrackCommands.resetImmediately();
            }),
    });

    const dragPointerEnabled =
      effectiveMode === 'drag' &&
      (isActive || Boolean(dragRuntime?.renderLane?.current) || Boolean(currentDragRelease));

    const {
      onPointerDown: handleScenePointerDown,
      onPointerMove: handleScenePointerMove,
      onPointerUp: handleScenePointerUp,
      onPointerCancel: handleScenePointerCancel,
      onFramerPanStart: handleFramerPanStart,
      onFramerPan: handleFramerPan,
      onFramerPanEnd: handleFramerPanEnd,
    } = useScenePointerInput({
      axis: effectiveDirection,
      // D-F7: a gesture may START on the active scene OR, mid-transition, on
      // whichever scene the pointer physically lands on while a render lane is
      // in flight (a rush re-grab usually hits the INCOMING scene — the
      // outgoing one has mostly slid away). The engine's handleDragStart
      // re-checks acceptance (isActive || in-flight lane) at event time; this
      // render-time gate only needs to let the pointerdown claim through. At
      // rest, inactive scenes stay rejected.
      enabled: dragPointerEnabled,
      onCandidateStart: handleCandidateSuspend,
      onCandidateEnd: handleCandidateResume,
      onPointerSessionStart: dragRuntime?.onPointerSessionStart,
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
          !dragPointerEnabled &&
          (runtimeState === 'covered' || runtimeState === 'parked' || runtimeState === 'inactive')
            ? 'none'
            : 'auto',
        ...(effectiveMode === 'scroll' ? scrollSceneAnchorStyle : sceneAnchorStyle),
      }),
      [
        isAnimating,
        isDragging,
        globalIsScrolling,
        dragPointerEnabled,
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
                // D-F1: pointer/pan handlers stay bound for ALL drag scenes (not
                // only the active one). A scene can deactivate mid-gesture (its
                // own release commits), while the pointer capture keeps the
                // pointermove/up stream targeting THIS element — it must keep
                // reaching the gesture layer. Gesture START is gated by
                // useScenePointerInput `enabled` + handleDragStart acceptance
                // (active scene, or any scene while a render lane is in flight
                // — the D-F7 rush re-grab takeover); inactive scenes at rest
                // cannot begin a drag.
                onPanStart={effectiveMode === 'drag' ? handleFramerPanStart : undefined}
                onPan={effectiveMode === 'drag' ? handleFramerPan : undefined}
                onPanEnd={effectiveMode === 'drag' ? handleFramerPanEnd : undefined}
                onPointerDown={
                  effectiveMode === 'drag' ? handleScenePointerDown : authoredPointerDown
                }
                onPointerMove={
                  effectiveMode === 'drag' ? handleScenePointerMove : authoredPointerMove
                }
                onPointerUp={effectiveMode === 'drag' ? handleScenePointerUp : authoredPointerUp}
                onPointerCancel={
                  effectiveMode === 'drag' ? handleScenePointerCancel : authoredPointerCancel
                }
              >
                {effectiveMode === 'scroll' ? (
                  <SceneFixedLayer
                    sceneIndex={sceneIndex}
                    metrics={fixedLayerMetrics}
                    setHostRef={handleFixedLayerHostRef}
                    frameStore={scrollFrameStore}
                    direction={effectiveDirection}
                    viewportWidth={globalViewportWidth}
                    viewportHeight={globalViewportHeight}
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
