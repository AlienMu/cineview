import React, {
  Children,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CineViewProvider } from '../../context/CineViewContext';
import { useImagePreloader } from '../../hooks/useImagePreloader';
import { useFirstSceneEnter } from '../../hooks/useFirstSceneEnter';
import { performanceMonitor } from '../../utils/performanceMonitor';
import { getScenePreloadImages, resolveScenePreloadTargetImages } from './preloadTargets';
import type {
  CineViewErrorCode,
  CineViewPreloadTarget,
  CineViewProps,
  CineViewRef,
  PerformanceMetrics,
  ScrollModeConfig,
} from '../../types';
import {
  CENTER_LOCK_BOUNDARY_EPSILON_PX,
  TAKEOVER_PROGRESS_SNAP_EPSILON_PX,
  areSceneLayoutsEqual,
  buildSceneTimelineState,
  clamp,
  createScrollbarCss,
  getRelativeOffset,
  getSceneTransitionConfig,
  isSceneElement,
  isScrollDebugEnabled,
  normalizeKeyboardDeltaPx,
  normalizeTouchDeltaPx,
  normalizeWheelDeltaPx,
  resolveDesignDimensions,
  resolveRootSceneStackMode,
  resolveScrollIntentOffset,
  resolveScrollSceneDeclaredSpan,
  resolveTakeoverSceneSpan,
  shouldIgnoreGlobalScrollKey,
  type CenterLockSegment,
  type SceneAuthoringCompatProps,
  type SceneLayoutInfo,
  type ScrollInputDirection,
} from './directScrollHelpers';
import { regroupCallbacks, type GroupedCallbacks } from './regroupCallbacks';
import { CineViewRuntimeContext, type CineViewRuntimeContextValue } from './runtimeContext';
import {
  SceneScrollRuntimeContext,
  SceneScrollTimelineContext,
  type SceneScrollRuntimeContextValue,
  type SceneScrollTimelineState,
} from '../Scene/sceneScrollRuntime';
import {
  areResolvedSceneScrollSequencesEqual,
  resolveSceneScrollAnimationBudgets,
  type SceneScrollAnimationRegistration,
} from '../Scene/sceneScrollBudget';

export const DirectScrollCineView = forwardRef<CineViewRef, CineViewProps>(
  function DirectScrollCineView(
    { children, config, modes, scrollbar, callbacks, performance },
    ref
  ) {
    const { designWidth, designHeight, unit } = resolveDesignDimensions(config);
    // Public callbacks are flat + mode-aware; regroup back into { common, drag,
    // scroll } so the read sites below stay grouped (mirrors CineView.tsx).
    const resolvedCallbacks = useMemo<GroupedCallbacks>(
      () => regroupCallbacks(callbacks),
      [callbacks]
    );
    const resolvedScrollConfig = useMemo<ScrollModeConfig>(
      () => ({
        direction: modes?.scroll?.direction ?? 'y',
        zoneTrigger: modes?.scroll?.zoneTrigger ?? 'center-lock',
        sceneSizing: modes?.scroll?.sceneSizing ?? 'content',
      }),
      [modes?.scroll]
    );
    const direction = resolvedScrollConfig.direction ?? 'y';
    const containerRef = useRef<HTMLDivElement>(null);
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);
    const scrollingIdleTimerRef = useRef<number | null>(null);
    // Synchronous truth for "is a scroll gesture in flight". Drives the
    // gesture-start layout measurement gate in syncNativeScrollState: layouts
    // are scroll-invariant (getRelativeOffset adds rootScroll back), so we
    // measure once per gesture burst instead of once per frame to avoid
    // per-frame layout thrashing. Mid-gesture content resizes are picked up on
    // the next gesture start.
    const isScrollingRef = useRef(false);
    const scrollOffsetFrameRef = useRef<number | null>(null);
    const pendingScrollOffsetRef = useRef<number | null>(null);
    const previousScrollOffsetRef = useRef(0);
    const lastReportedSceneRef = useRef(0);
    const previousZoneStatesRef = useRef<Record<string, SceneScrollTimelineState>>({});
    const sceneWrapperRefs = useRef<Array<HTMLDivElement | null>>([]);
    const zoneRegistryRef = useRef<
      Map<
        string,
        {
          sceneIndex: number;
          trigger: 'center-lock';
          element: HTMLElement | null;
        }
      >
    >(new Map());
    const zoneAnimationsRef = useRef<Map<string, Map<string, SceneScrollAnimationRegistration>>>(
      new Map()
    );
    const childrenArray = useMemo(() => Children.toArray(children), [children]);
    const scenes = useMemo(
      () =>
        childrenArray.filter((child): child is React.ReactElement<SceneAuthoringCompatProps> =>
          isSceneElement(child)
        ),
      [childrenArray]
    );
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
    const viewportSizeRef = useRef({ width: 0, height: 0 });
    const [sceneLayouts, setSceneLayouts] = useState<SceneLayoutInfo[]>([]);
    const sceneLayoutsRef = useRef<SceneLayoutInfo[]>([]);
    const [scrollOffset, setScrollOffset] = useState(0);
    const [scrollDirection, setScrollDirection] = useState<ScrollInputDirection | null>(null);
    const [isScrolling, setIsScrolling] = useState(false);
    const [activeSceneIndex, setActiveSceneIndex] = useState(0);
    const [scrollContentSpan, setScrollContentSpan] = useState(1);
    const [zoneStates, setZoneStates] = useState<Record<string, SceneScrollTimelineState>>({});
    const zoneStatesRef = useRef<Record<string, SceneScrollTimelineState>>({});
    const [zoneRuntimeVersion, setZoneRuntimeVersion] = useState(0);
    const zoneStateBySceneIndex = useMemo(() => {
      const nextMap = new Map<number, SceneScrollTimelineState>();
      Object.values(zoneStates).forEach((state) => {
        nextMap.set(state.sceneIndex, state);
      });
      return nextMap;
    }, [zoneStates]);
    const exposeTakeoverDebugData = isScrollDebugEnabled();

    const preloadImages = useMemo(
      () => Array.from(new Set(scenes.flatMap((scene) => getScenePreloadImages(scene.props)))),
      [scenes]
    );
    const [preloadState, preloadActions] = useImagePreloader({
      priorityUrls: preloadImages,
      backgroundUrls: [],
      onProgress: resolvedCallbacks.common?.onLoadProgress,
    });
    const startPreload = preloadActions.startPreload;

    // First-screen cold-start gate for the scroll path. scene 0's visibility
    // elements hold at their initial frame until first-screen priority assets
    // settle (firstSceneEnterReady). Without this the scroll root never lit the
    // ready signal and scene 0 stayed permanently at opacity 0. scroll uses the
    // `ready` trigger only; the (drag-only) `active` window is inert here.
    const preloadCountsRef = useRef({ loadedCount: 0, totalCount: 0 });
    preloadCountsRef.current = {
      loadedCount: preloadState.loadedCount,
      totalCount: preloadState.totalCount,
    };
    const emitRecoverableError = useCallback(
      (code: CineViewErrorCode, message: string, context?: Record<string, unknown>): boolean => {
        let defaultPrevented = false;
        resolvedCallbacks.common?.onError?.({
          code,
          message,
          context,
          preventDefault: () => {
            defaultPrevented = true;
          },
        });
        return defaultPrevented;
      },
      [resolvedCallbacks.common]
    );
    const getPreloadCounts = useCallback(
      () => ({
        loadedCount: preloadCountsRef.current.loadedCount,
        totalCount: preloadCountsRef.current.totalCount,
      }),
      []
    );
    const { firstSceneEnterReady } = useFirstSceneEnter({
      enabled: scenes.length > 0,
      hasFirstScene: Boolean(scenes[0]),
      priorityComplete: preloadState.priorityComplete,
      timeoutMs: Math.max(0, modes?.drag?.firstSceneTimeout ?? 3000),
      emitRecoverableError,
      getPreloadCounts,
    });
    const resolvedTargetPreloadImages = useCallback(
      (targets?: CineViewPreloadTarget[]): string[] =>
        resolveScenePreloadTargetImages(scenes, targets, { includeZoneIds: true }),
      [scenes]
    );

    useEffect(() => {
      if (preloadImages.length > 0) {
        void startPreload();
      }
    }, [preloadImages, startPreload]);

    const getViewportSpan = useCallback((): number => {
      const root = containerRef.current;
      const liveWidth = root?.clientWidth ?? viewportSizeRef.current.width;
      const liveHeight = root?.clientHeight ?? viewportSizeRef.current.height;
      return Math.max(direction === 'x' ? liveWidth : liveHeight, 1);
    }, [direction]);

    const updateViewportMetrics = useCallback(() => {
      const root = containerRef.current;
      if (!root) {
        return;
      }

      const nextWidth = root.clientWidth;
      const nextHeight = root.clientHeight;
      viewportSizeRef.current = { width: nextWidth, height: nextHeight };
      setViewportSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight }
      );
    }, []);

    const getZoneIdForScene = useCallback((sceneIndex: number): string | null => {
      for (const [zoneId, meta] of zoneRegistryRef.current.entries()) {
        if (meta.sceneIndex === sceneIndex) {
          return zoneId;
        }
      }

      return null;
    }, []);

    const getZoneDistance = useCallback(
      (sceneIndex: number): number => {
        const zoneId = getZoneIdForScene(sceneIndex);
        if (!zoneId) {
          return 0;
        }

        return zoneStatesRef.current[zoneId]?.totalBudgetPx ?? 0;
      },
      [getZoneIdForScene]
    );

    const measureSceneLayouts = useCallback((): SceneLayoutInfo[] => {
      const root = containerRef.current;
      if (!root) {
        return sceneLayoutsRef.current;
      }

      const viewportSpan = getViewportSpan();
      const nextLayouts = scenes.map((scene, index) => {
        const wrapper = sceneWrapperRefs.current[index];
        const sceneProps = scene.props;
        const transitionConfig = getSceneTransitionConfig(sceneProps);
        const isTakeoverScene = Boolean(sceneProps.scroll);
        const rawTakeoverSpan =
          direction === 'x'
            ? (sceneProps.layout?.width ?? sceneProps.sceneWidth)
            : (sceneProps.layout?.height ?? sceneProps.sceneHeight);
        const renderedTakeoverSpan = isTakeoverScene
          ? resolveTakeoverSceneSpan(
              rawTakeoverSpan,
              direction,
              root.clientWidth,
              root.clientHeight,
              designWidth,
              designHeight
            )
          : null;
        const zoneId = getZoneIdForScene(index);
        const zoneElement = zoneId ? zoneRegistryRef.current.get(zoneId)?.element : null;
        const declaredSpan = isTakeoverScene
          ? renderedTakeoverSpan
          : resolveScrollSceneDeclaredSpan(
              sceneProps,
              direction,
              root.clientWidth,
              root.clientHeight
            );
        const measuredSpan =
          direction === 'x'
            ? Math.max(
                isTakeoverScene ? (zoneElement?.offsetWidth ?? 0) : (wrapper?.offsetWidth ?? 0),
                isTakeoverScene ? (zoneElement?.clientWidth ?? 0) : (wrapper?.clientWidth ?? 0),
                0
              )
            : Math.max(
                isTakeoverScene ? (zoneElement?.offsetHeight ?? 0) : (wrapper?.offsetHeight ?? 0),
                isTakeoverScene ? (zoneElement?.clientHeight ?? 0) : (wrapper?.clientHeight ?? 0),
                0
              );
        const visualSpan = isTakeoverScene
          ? Math.max(renderedTakeoverSpan ?? measuredSpan, 1)
          : resolvedScrollConfig.sceneSizing === 'screen'
            ? Math.max(measuredSpan, declaredSpan ?? 0, viewportSpan, 1)
            : Math.max(measuredSpan, declaredSpan ?? 0, 1);
        const timelineDistancePx = isTakeoverScene ? getZoneDistance(index) : 0;
        const flowSpan = isTakeoverScene
          ? Math.max(visualSpan, viewportSpan) + timelineDistancePx
          : visualSpan;
        const sceneStart = wrapper ? getRelativeOffset(wrapper, root, direction) : 0;
        const sceneEnd = sceneStart + flowSpan;
        const centerLockOffset = Math.max(sceneStart + visualSpan / 2 - viewportSpan / 2, 0);
        const hasEnter = Boolean(
          transitionConfig.enterAnimation && transitionConfig.enterAnimation !== 'none' && index > 0
        );
        const hasExit = Boolean(
          transitionConfig.exitAnimation &&
          transitionConfig.exitAnimation !== 'none' &&
          index < scenes.length - 1
        );
        const requestedEnterLength = Math.max(
          0,
          transitionConfig.scrollEnterLength ??
            (hasEnter ? transitionConfig.transitionDurationMs : 0)
        );
        const requestedExitLength = Math.max(
          0,
          transitionConfig.scrollExitLength ?? (hasExit ? transitionConfig.transitionDurationMs : 0)
        );
        const maxPhaseLength = Math.max(Math.min(flowSpan, viewportSpan), 1);
        const enterLength = Math.min(requestedEnterLength, maxPhaseLength);
        const exitLength = Math.min(requestedExitLength, maxPhaseLength);

        return {
          sceneStart,
          sceneEnd,
          visualSpan,
          flowSpan,
          timelineDistancePx,
          centerLockOffset,
          segmentStart: centerLockOffset,
          segmentEnd: centerLockOffset + timelineDistancePx,
          enterLength,
          exitLength,
          stackMode: resolveRootSceneStackMode(sceneProps),
        };
      });

      sceneLayoutsRef.current = nextLayouts;
      setSceneLayouts((currentLayouts) =>
        areSceneLayoutsEqual(currentLayouts, nextLayouts) ? currentLayouts : nextLayouts
      );
      return nextLayouts;
    }, [
      designHeight,
      designWidth,
      direction,
      getViewportSpan,
      getZoneDistance,
      getZoneIdForScene,
      resolvedScrollConfig.sceneSizing,
      scenes,
    ]);

    const getMaxNativeOffset = useCallback((): number => {
      const root = containerRef.current;
      if (!root) {
        return 0;
      }

      const viewportSpan = getViewportSpan();
      const contentSpan = direction === 'x' ? root.scrollWidth : root.scrollHeight;
      return Math.max(contentSpan - viewportSpan, 0);
    }, [direction, getViewportSpan]);

    const getCenterLockSegments = useCallback((): CenterLockSegment[] => {
      return sceneLayoutsRef.current
        .filter(
          (layout) => layout.segmentEnd - layout.segmentStart > CENTER_LOCK_BOUNDARY_EPSILON_PX
        )
        .map((layout) => ({
          segmentStart: layout.segmentStart,
          segmentEnd: layout.segmentEnd,
        }))
        .sort((left, right) => left.segmentStart - right.segmentStart);
    }, []);

    const resolveNativeScrollIntent = useCallback(
      (currentOffset: number, deltaPx: number): number => {
        return resolveScrollIntentOffset({
          currentOffset,
          deltaPx,
          maxNativeOffset: getMaxNativeOffset(),
          segments: getCenterLockSegments(),
        });
      },
      [getCenterLockSegments, getMaxNativeOffset]
    );

    const setNativeOffset = useCallback(
      (offset: number): void => {
        const root = containerRef.current;
        if (!root) {
          return;
        }

        const clampedOffset = clamp(offset, 0, getMaxNativeOffset());
        if (direction === 'x') {
          if (typeof root.scrollTo === 'function') {
            root.scrollTo({ left: clampedOffset, behavior: 'auto' });
          } else {
            root.scrollLeft = clampedOffset;
          }
          return;
        }

        if (typeof root.scrollTo === 'function') {
          root.scrollTo({ top: clampedOffset, behavior: 'auto' });
        } else {
          root.scrollTop = clampedOffset;
        }
      },
      [direction, getMaxNativeOffset]
    );

    const scheduleScrollOffsetState = useCallback((offset: number) => {
      pendingScrollOffsetRef.current = offset;
      if (scrollOffsetFrameRef.current !== null) {
        return;
      }

      scrollOffsetFrameRef.current = window.requestAnimationFrame(() => {
        scrollOffsetFrameRef.current = null;
        const nextOffset = pendingScrollOffsetRef.current;
        pendingScrollOffsetRef.current = null;
        if (nextOffset === null) {
          return;
        }

        setScrollOffset((current) => (Math.abs(current - nextOffset) > 0.5 ? nextOffset : current));
      });
    }, []);

    const setZoneState = useCallback(
      (
        zoneId: string,
        updater: (current: SceneScrollTimelineState | undefined) => SceneScrollTimelineState | null
      ) => {
        const applyUpdate = (
          currentStates: Record<string, SceneScrollTimelineState>
        ): Record<string, SceneScrollTimelineState> => {
          const nextState = updater(currentStates[zoneId]);
          if (!nextState) {
            if (!(zoneId in currentStates)) {
              return currentStates;
            }

            const clone = { ...currentStates };
            delete clone[zoneId];
            return clone;
          }

          const previous = currentStates[zoneId];
          if (
            previous &&
            previous.progressPx === nextState.progressPx &&
            previous.totalBudgetPx === nextState.totalBudgetPx &&
            previous.active === nextState.active &&
            previous.direction === nextState.direction &&
            areResolvedSceneScrollSequencesEqual(previous.sequence, nextState.sequence)
          ) {
            return currentStates;
          }

          return {
            ...currentStates,
            [zoneId]: nextState,
          };
        };

        zoneStatesRef.current = applyUpdate(zoneStatesRef.current);
        setZoneStates((currentStates) => {
          const nextStates = applyUpdate(currentStates);
          zoneStatesRef.current = nextStates;
          return nextStates;
        });
      },
      []
    );

    const recomputeZoneSequence = useCallback(
      (zoneId: string) => {
        const meta = zoneRegistryRef.current.get(zoneId);
        if (!meta) {
          setZoneState(zoneId, () => null);
          return;
        }

        const registrations = zoneAnimationsRef.current.get(zoneId) ?? new Map();
        const sequence = resolveSceneScrollAnimationBudgets(registrations);
        setZoneState(zoneId, (current) => ({
          zoneId,
          sceneIndex: meta.sceneIndex,
          progressPx: clamp(current?.progressPx ?? 0, 0, sequence.totalBudgetPx),
          totalBudgetPx: sequence.totalBudgetPx,
          active: current?.active ?? false,
          direction: current?.direction ?? null,
          sequence,
        }));
        setZoneRuntimeVersion((version) => version + 1);
      },
      [setZoneState]
    );

    const emitZoneProgress = useCallback(
      (zoneId: string, state: SceneScrollTimelineState) => {
        const meta = zoneRegistryRef.current.get(zoneId);
        if (!meta) {
          return;
        }

        resolvedCallbacks.scroll?.onZoneProgress?.({
          zoneId,
          sceneIndex: meta.sceneIndex,
          progress:
            state.totalBudgetPx > 0 ? clamp(state.progressPx / state.totalBudgetPx, 0, 1) : 0,
        });
      },
      [resolvedCallbacks.scroll]
    );

    const updateActiveScene = useCallback(
      (nativeOffset: number) => {
        const layouts = sceneLayoutsRef.current;
        if (layouts.length === 0) {
          return;
        }

        const viewportCenter = nativeOffset + getViewportSpan() / 2;
        const containingIndex = layouts.findIndex(
          (layout) => viewportCenter >= layout.sceneStart && viewportCenter < layout.sceneEnd
        );
        const nearestIndex =
          containingIndex !== -1
            ? containingIndex
            : viewportCenter < layouts[0].sceneStart
              ? 0
              : layouts.length - 1;

        setActiveSceneIndex(nearestIndex);
        if (lastReportedSceneRef.current !== nearestIndex) {
          resolvedCallbacks.common?.onSceneWillChange?.({
            fromIndex: lastReportedSceneRef.current,
            toIndex: nearestIndex,
            direction: nearestIndex >= lastReportedSceneRef.current ? 'forward' : 'backward',
          });
          resolvedCallbacks.common?.onSceneDidChange?.({
            fromIndex: lastReportedSceneRef.current,
            toIndex: nearestIndex,
            direction: nearestIndex >= lastReportedSceneRef.current ? 'forward' : 'backward',
          });
          lastReportedSceneRef.current = nearestIndex;
        }
      },
      [resolvedCallbacks.common, getViewportSpan]
    );

    const syncZoneStatesFromNativeOffset = useCallback(
      (nativeOffset: number, inputDirection: ScrollInputDirection | null): void => {
        const previousStates = previousZoneStatesRef.current;
        const nextStates: Record<string, SceneScrollTimelineState> = {};

        Object.entries(zoneStatesRef.current).forEach(([zoneId, state]) => {
          const layout = sceneLayoutsRef.current[state.sceneIndex];
          if (!layout || state.totalBudgetPx <= 0) {
            nextStates[zoneId] = {
              ...state,
              progressPx: 0,
              active: false,
              direction: null,
            };
            return;
          }

          const rawProgressPx = clamp(nativeOffset - layout.segmentStart, 0, state.totalBudgetPx);
          const progressPx =
            rawProgressPx <= TAKEOVER_PROGRESS_SNAP_EPSILON_PX
              ? 0
              : state.totalBudgetPx - rawProgressPx <= TAKEOVER_PROGRESS_SNAP_EPSILON_PX
                ? state.totalBudgetPx
                : rawProgressPx;
          const active =
            nativeOffset > layout.segmentStart + 0.5 &&
            nativeOffset < layout.segmentEnd - 0.5 &&
            progressPx > 0.5 &&
            progressPx < state.totalBudgetPx - 0.5;
          nextStates[zoneId] = {
            ...state,
            progressPx,
            active,
            direction: active ? inputDirection : null,
          };
        });

        zoneStatesRef.current = nextStates;
        previousZoneStatesRef.current = nextStates;
        setZoneStates((currentStates) => {
          const currentEntries = Object.entries(currentStates);
          const nextEntries = Object.entries(nextStates);
          const unchanged =
            currentEntries.length === nextEntries.length &&
            nextEntries.every(([zoneId, nextState]) => {
              const currentState = currentStates[zoneId];
              return (
                currentState &&
                currentState.progressPx === nextState.progressPx &&
                currentState.active === nextState.active &&
                currentState.direction === nextState.direction &&
                currentState.totalBudgetPx === nextState.totalBudgetPx
              );
            });

          return unchanged ? currentStates : nextStates;
        });

        Object.entries(nextStates).forEach(([zoneId, state]) => {
          const previousState = previousStates[zoneId];
          const meta = zoneRegistryRef.current.get(zoneId);
          if (!meta) {
            return;
          }

          if (!previousState || Math.abs(previousState.progressPx - state.progressPx) > 0.5) {
            emitZoneProgress(zoneId, state);
          }

          if (!previousState?.active && state.active) {
            resolvedCallbacks.scroll?.onZoneEnter?.({
              zoneId,
              sceneIndex: meta.sceneIndex,
            });
          } else if (previousState?.active && !state.active) {
            resolvedCallbacks.scroll?.onZoneLeave?.({
              zoneId,
              sceneIndex: meta.sceneIndex,
            });
          }
        });
      },
      [resolvedCallbacks.scroll, emitZoneProgress]
    );

    const syncNativeScrollState = useCallback(
      (fromGesture = false) => {
        const root = containerRef.current;
        if (!root) {
          return;
        }

        // Layout outputs are scroll-invariant (getRelativeOffset adds rootScroll
        // back), so measuring every frame is pure layout thrashing. Measure once
        // per gesture burst: the first frame of a gesture re-measures, continuous
        // frames read the cached sceneLayoutsRef. Programmatic re-syncs
        // (mount / resize / refreshLayout) already measure before calling here and
        // must not flip the gesture flag, so they pass fromGesture=false.
        if (fromGesture) {
          if (!isScrollingRef.current) {
            updateViewportMetrics();
            measureSceneLayouts();
          }
          isScrollingRef.current = true;
        }
        const rawOffset = direction === 'x' ? root.scrollLeft : root.scrollTop;
        const previousOffset = previousScrollOffsetRef.current;
        const resolvedOffset = resolveNativeScrollIntent(
          previousOffset,
          rawOffset - previousOffset
        );
        if (Math.abs(resolvedOffset - rawOffset) > 0.5) {
          setNativeOffset(resolvedOffset);
        }
        const nextDirection =
          Math.abs(resolvedOffset - previousOffset) <= 0.5
            ? scrollDirection
            : resolvedOffset > previousOffset
              ? 'forward'
              : 'backward';

        previousScrollOffsetRef.current = resolvedOffset;
        scheduleScrollOffsetState(resolvedOffset);
        setScrollDirection((current) => (current === nextDirection ? current : nextDirection));
        setIsScrolling((current) => (current ? current : true));
        if (scrollingIdleTimerRef.current !== null) {
          window.clearTimeout(scrollingIdleTimerRef.current);
        }
        scrollingIdleTimerRef.current = window.setTimeout(() => {
          setIsScrolling(false);
          isScrollingRef.current = false;
          scrollingIdleTimerRef.current = null;
        }, 120);
        syncZoneStatesFromNativeOffset(resolvedOffset, nextDirection);
        updateActiveScene(resolvedOffset);
        const viewportSpan = getViewportSpan();
        const contentSpan = Math.max(
          direction === 'x' ? root.scrollWidth : root.scrollHeight,
          viewportSpan
        );
        setScrollContentSpan((current) =>
          Math.abs(current - contentSpan) <= 0.5 ? current : contentSpan
        );
      },
      [
        direction,
        getViewportSpan,
        measureSceneLayouts,
        resolveNativeScrollIntent,
        scheduleScrollOffsetState,
        scrollDirection,
        setNativeOffset,
        syncZoneStatesFromNativeOffset,
        updateActiveScene,
        updateViewportMetrics,
      ]
    );

    const applyNativeScrollDelta = useCallback(
      (deltaPx: number): boolean => {
        const root = containerRef.current;
        if (!root || deltaPx === 0) {
          return false;
        }

        const currentOffset = direction === 'x' ? root.scrollLeft : root.scrollTop;
        const clampedOffset = resolveNativeScrollIntent(currentOffset, deltaPx);
        if (Math.abs(clampedOffset - currentOffset) <= 0.5) {
          return false;
        }

        setNativeOffset(clampedOffset);
        syncNativeScrollState(true);
        return true;
      },
      [direction, resolveNativeScrollIntent, setNativeOffset, syncNativeScrollState]
    );

    const goToScrollZone = useCallback(
      (zoneId: string, options?: { animated?: boolean }): void => {
        const root = containerRef.current;
        const state = zoneStatesRef.current[zoneId];
        const layout = state ? sceneLayoutsRef.current[state.sceneIndex] : null;
        if (!root || !layout) {
          return;
        }

        root.scrollTo({
          top: direction === 'x' ? undefined : layout.centerLockOffset,
          left: direction === 'x' ? layout.centerLockOffset : undefined,
          behavior: options?.animated === false ? 'auto' : 'smooth',
        });
        previousScrollOffsetRef.current = layout.centerLockOffset;
        scheduleScrollOffsetState(layout.centerLockOffset);
        syncZoneStatesFromNativeOffset(layout.centerLockOffset, null);
        updateActiveScene(layout.centerLockOffset);
      },
      [direction, scheduleScrollOffsetState, syncZoneStatesFromNativeOffset, updateActiveScene]
    );

    const registerZone = useCallback(
      (
        zoneId: string,
        config: {
          sceneIndex: number;
          trigger: 'center-lock';
        }
      ) => {
        zoneRegistryRef.current.set(zoneId, {
          ...config,
          element: zoneRegistryRef.current.get(zoneId)?.element ?? null,
        });
        recomputeZoneSequence(zoneId);
      },
      [recomputeZoneSequence]
    );

    const unregisterZone = useCallback(
      (zoneId: string) => {
        zoneRegistryRef.current.delete(zoneId);
        zoneAnimationsRef.current.delete(zoneId);
        setZoneState(zoneId, () => null);
        setZoneRuntimeVersion((version) => version + 1);
      },
      [setZoneState]
    );

    const setZoneElement = useCallback(
      (zoneId: string, element: HTMLElement | null) => {
        const meta = zoneRegistryRef.current.get(zoneId);
        zoneRegistryRef.current.set(zoneId, {
          sceneIndex: meta?.sceneIndex ?? 0,
          trigger: meta?.trigger ?? 'center-lock',
          element,
        });
        measureSceneLayouts();
      },
      [measureSceneLayouts]
    );

    const registerZoneAnimation = useCallback(
      (zoneId: string, animation: SceneScrollAnimationRegistration) => {
        const existing = zoneAnimationsRef.current.get(zoneId) ?? new Map();
        existing.set(animation.animateId, animation);
        zoneAnimationsRef.current.set(zoneId, existing);
        recomputeZoneSequence(zoneId);
      },
      [recomputeZoneSequence]
    );

    const unregisterZoneAnimation = useCallback(
      (zoneId: string, animateId: string) => {
        const existing = zoneAnimationsRef.current.get(zoneId);
        if (!existing) {
          return;
        }

        existing.delete(animateId);
        zoneAnimationsRef.current.set(zoneId, existing);
        recomputeZoneSequence(zoneId);
      },
      [recomputeZoneSequence]
    );

    // Runtime context carries only the stable registration API. Live zone
    // state (version / zoneStates) flows through the separately-memoized
    // timeline context below, so this value's identity only changes when a
    // registration callback identity changes (effectively never). Consumers
    // (every Scene via useSceneScrollTakeover) therefore do not re-render on
    // scroll frames.
    const zoneRuntimeValue = useMemo<SceneScrollRuntimeContextValue>(
      () => ({
        registerZone,
        unregisterZone,
        setZoneElement,
        registerZoneAnimation,
        unregisterZoneAnimation,
      }),
      [registerZone, unregisterZone, setZoneElement, registerZoneAnimation, unregisterZoneAnimation]
    );
    const zoneTimelineValue = useMemo(
      () => ({
        version: zoneRuntimeVersion,
        zoneStates,
      }),
      [zoneRuntimeVersion, zoneStates]
    );

    useEffect(() => {
      if (!performance?.monitor) {
        return;
      }

      performanceMonitor.start();
      return (): void => {
        performanceMonitor.stop();
      };
    }, [performance?.monitor]);

    useEffect(() => {
      return (): void => {
        if (scrollOffsetFrameRef.current !== null) {
          window.cancelAnimationFrame(scrollOffsetFrameRef.current);
          scrollOffsetFrameRef.current = null;
        }
        if (scrollingIdleTimerRef.current !== null) {
          window.clearTimeout(scrollingIdleTimerRef.current);
          scrollingIdleTimerRef.current = null;
        }
      };
    }, []);

    useEffect(() => {
      updateViewportMetrics();
      measureSceneLayouts();
      syncNativeScrollState();
    }, [measureSceneLayouts, syncNativeScrollState, updateViewportMetrics, zoneRuntimeVersion]);

    useEffect(() => {
      if (typeof window === 'undefined') {
        return;
      }

      const handleResize = (): void => {
        updateViewportMetrics();
        measureSceneLayouts();
        syncNativeScrollState();
      };

      window.addEventListener('resize', handleResize);
      return (): void => {
        window.removeEventListener('resize', handleResize);
      };
    }, [measureSceneLayouts, syncNativeScrollState, updateViewportMetrics]);

    useEffect(() => {
      const root = containerRef.current;
      if (!root) {
        return;
      }

      const handleWheel = (event: WheelEvent): void => {
        const delta = direction === 'x' ? event.deltaX : event.deltaY;
        const normalizedDelta = normalizeWheelDeltaPx(delta, event.deltaMode, getViewportSpan());
        if (normalizedDelta === 0) {
          return;
        }

        if (applyNativeScrollDelta(normalizedDelta) && event.cancelable) {
          event.preventDefault();
        }
      };

      const handleTouchStart = (event: TouchEvent): void => {
        const touch = event.touches[0];
        if (!touch) {
          return;
        }

        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      };

      const handleTouchMove = (event: TouchEvent): void => {
        const touch = event.touches[0];
        if (!touch || !touchStartRef.current) {
          return;
        }

        const rawDelta =
          direction === 'x'
            ? touchStartRef.current.x - touch.clientX
            : touchStartRef.current.y - touch.clientY;
        const normalizedDelta = normalizeTouchDeltaPx(rawDelta);
        if (normalizedDelta !== 0 && applyNativeScrollDelta(normalizedDelta)) {
          if (event.cancelable) {
            event.preventDefault();
          }
          touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        }
      };

      const clearTouch = (): void => {
        touchStartRef.current = null;
      };

      root.addEventListener('wheel', handleWheel, { capture: true, passive: false });
      root.addEventListener('touchstart', handleTouchStart, { passive: true });
      root.addEventListener('touchmove', handleTouchMove, { passive: false });
      root.addEventListener('touchend', clearTouch);
      root.addEventListener('touchcancel', clearTouch);

      return (): void => {
        root.removeEventListener('wheel', handleWheel, { capture: true });
        root.removeEventListener('touchstart', handleTouchStart);
        root.removeEventListener('touchmove', handleTouchMove);
        root.removeEventListener('touchend', clearTouch);
        root.removeEventListener('touchcancel', clearTouch);
      };
    }, [applyNativeScrollDelta, direction, getViewportSpan]);

    useEffect(() => {
      if (typeof window === 'undefined') {
        return;
      }

      const handleKeyDown = (event: KeyboardEvent): void => {
        if (shouldIgnoreGlobalScrollKey(event)) {
          return;
        }

        const normalizedDelta = normalizeKeyboardDeltaPx(
          event.key,
          event.shiftKey,
          getViewportSpan()
        );
        if (normalizedDelta === 0) {
          return;
        }

        const activeElement = document.activeElement;
        const shouldForwardToContainer =
          activeElement === document.body || activeElement === document.documentElement;
        if (
          shouldForwardToContainer &&
          applyNativeScrollDelta(normalizedDelta) &&
          event.cancelable
        ) {
          event.preventDefault();
        }
      };

      window.addEventListener('keydown', handleKeyDown, true);
      return (): void => {
        window.removeEventListener('keydown', handleKeyDown, true);
      };
    }, [applyNativeScrollDelta, getViewportSpan]);

    const getRuntimeApi = useCallback(
      (): CineViewRef => ({
        goToScene: (index: number, animated = true): void => {
          const root = containerRef.current;
          const wrapper = sceneWrapperRefs.current[index];
          if (!root || !wrapper) {
            return;
          }

          const offset = getRelativeOffset(wrapper, root, direction);
          root.scrollTo({
            top: direction === 'x' ? undefined : offset,
            left: direction === 'x' ? offset : undefined,
            behavior: animated ? 'smooth' : 'auto',
          });
        },
        goToZone: (zoneId: string, options): void => {
          goToScrollZone(zoneId, options);
        },
        refreshLayout: (): void => {
          updateViewportMetrics();
          measureSceneLayouts();
          syncNativeScrollState();
        },
        preload: async (targets?: CineViewPreloadTarget[]): Promise<void> => {
          const targetImages = resolvedTargetPreloadImages(targets);
          if (targetImages.length > 0) {
            preloadActions.addUrls(targetImages, true);
          }

          await startPreload();
        },
        getCurrentScene: () => activeSceneIndex,
        getPerformanceMetrics: (): PerformanceMetrics => {
          const metrics = performanceMonitor.getMetrics();
          return {
            fps: metrics.fps,
            avgFrameTime: metrics.avgFrameTime,
            memoryUsage: metrics.memoryUsage,
            bundleSize: metrics.bundleSize,
          };
        },
      }),
      [
        activeSceneIndex,
        direction,
        goToScrollZone,
        measureSceneLayouts,
        preloadActions,
        resolvedTargetPreloadImages,
        startPreload,
        syncNativeScrollState,
        updateViewportMetrics,
      ]
    );

    // onReady must fire exactly once after mount, mirroring the drag root
    // (CineView.tsx). getRuntimeApi changes identity on every activeSceneIndex
    // change, so depending on it here would re-fire onReady on each scene
    // change. Hold the latest api in a ref and fire once on mount instead.
    const getRuntimeApiRef = useRef(getRuntimeApi);
    getRuntimeApiRef.current = getRuntimeApi;
    const onReadyRef = useRef(resolvedCallbacks.common?.onReady);
    onReadyRef.current = resolvedCallbacks.common?.onReady;

    useEffect(() => {
      onReadyRef.current?.(getRuntimeApiRef.current());
    }, []);

    useImperativeHandle(ref, getRuntimeApi, [getRuntimeApi]);

    const sceneTimelineStates = useMemo(
      () =>
        sceneLayouts.map((layout) =>
          buildSceneTimelineState(layout, scrollOffset, getViewportSpan())
        ),
      [getViewportSpan, sceneLayouts, scrollOffset]
    );

    const scrollBackdropSceneIndex = useMemo(() => {
      const activeLayout = sceneLayouts[activeSceneIndex];
      if (!activeLayout || activeLayout.stackMode !== 'cover') {
        return null;
      }
      return activeSceneIndex > 0 ? activeSceneIndex - 1 : null;
    }, [activeSceneIndex, sceneLayouts]);

    const renderedChildren = useMemo(() => {
      let sceneIndex = 0;
      const viewportSpan = Math.max(
        direction === 'x' ? viewportSize.width : viewportSize.height,
        1
      );

      return childrenArray.map((child, childIndex) => {
        if (!isSceneElement(child)) {
          return <React.Fragment key={`flow-${childIndex}`}>{child}</React.Fragment>;
        }

        const currentSceneIndex = sceneIndex++;
        const isTakeoverScene = Boolean(child.props.scroll);
        const sceneLayout = sceneLayouts[currentSceneIndex] ?? null;
        const sceneZoneState = zoneStateBySceneIndex.get(currentSceneIndex);
        const isCurrent = currentSceneIndex === activeSceneIndex || Boolean(sceneZoneState?.active);
        const isBackdropActive = scrollBackdropSceneIndex === currentSceneIndex;
        const visualViewportOffset =
          isTakeoverScene && sceneZoneState?.active && sceneLayout
            ? sceneLayout.centerLockOffset
            : scrollOffset;
        const sceneTimelineState =
          visualViewportOffset !== scrollOffset && sceneLayout
            ? buildSceneTimelineState(sceneLayout, visualViewportOffset, viewportSpan)
            : (sceneTimelineStates[currentSceneIndex] ?? null);
        const rawTakeoverSpan =
          direction === 'x'
            ? (child.props.layout?.width ?? child.props.sceneWidth)
            : (child.props.layout?.height ?? child.props.sceneHeight);
        const takeoverSceneSpan = isTakeoverScene
          ? resolveTakeoverSceneSpan(
              rawTakeoverSpan,
              direction,
              viewportSize.width,
              viewportSize.height,
              designWidth,
              designHeight
            )
          : null;
        const cloned = React.cloneElement(
          child as unknown as React.ReactElement<Record<string, unknown>>,
          {
            layout:
              isTakeoverScene && takeoverSceneSpan !== null
                ? {
                    ...child.props.layout,
                    ...(direction === 'x'
                      ? { width: takeoverSceneSpan }
                      : { height: takeoverSceneSpan }),
                  }
                : child.props.layout,
            callbacks: {
              ...child.props.callbacks,
              onVisibilityChange: (detail: {
                visible: boolean;
                progress: number;
                sceneIndex?: number;
              }) => {
                child.props.callbacks?.onVisibilityChange?.(detail);
                resolvedCallbacks.scroll?.onSceneVisibilityChange?.(detail);
              },
            },
            sceneRuntime: {
              mode: 'scroll',
              direction,
              isActive: isCurrent,
              sceneIndex: currentSceneIndex,
              totalScenes: scenes.length,
              currentSceneIndex: activeSceneIndex,
              transitionDirection: scrollDirection,
              isSceneAnimating: isScrolling,
              sharedElapsedMs: 0,
              sharedTimelineDurationMs: 0,
              viewportWidth: viewportSize.width,
              viewportHeight: viewportSize.height,
              firstSceneEnterReady,
            },
            scrollRuntime: {
              progress: sceneTimelineState?.sceneProgress ?? 0,
              isScrolling,
              direction: scrollDirection,
              transitionSnapshot: null,
              backdropActive: isBackdropActive,
              timelineState: sceneTimelineState,
              activeSceneIndex,
              viewportOffset: visualViewportOffset,
              onProgressChange: undefined,
              onDirectionChange: undefined,
              onScrollingChange: undefined,
              onCommit: undefined,
              onReset: undefined,
            },
          }
        );
        const sceneNeedsViewportSpan =
          resolvedScrollConfig.sceneSizing === 'screen' && !isTakeoverScene;
        const flowSpan = sceneLayout?.flowSpan;
        const visualSpan = sceneLayout?.visualSpan ?? takeoverSceneSpan ?? viewportSpan;

        return (
          <div
            key={child.key ?? `scene-${currentSceneIndex}`}
            ref={(node) => {
              sceneWrapperRefs.current[currentSceneIndex] = node;
            }}
            data-scene-index={currentSceneIndex}
            style={{
              position: 'relative',
              width:
                isTakeoverScene && typeof flowSpan === 'number' && direction === 'x'
                  ? flowSpan
                  : '100%',
              minHeight: direction === 'y' && sceneNeedsViewportSpan ? '100vh' : undefined,
              minWidth: direction === 'x' && sceneNeedsViewportSpan ? '100vw' : undefined,
              ...(isTakeoverScene && typeof flowSpan === 'number'
                ? direction === 'x'
                  ? {}
                  : { height: flowSpan }
                : {}),
            }}
          >
            {isTakeoverScene ? (
              <div
                data-cineview-takeover-shell={currentSceneIndex}
                {...(exposeTakeoverDebugData
                  ? {
                      'data-cineview-takeover-active-zone': sceneZoneState?.active
                        ? sceneZoneState.zoneId
                        : '',
                      'data-cineview-takeover-progress-px': sceneZoneState?.progressPx ?? '',
                      'data-cineview-takeover-total-distance-px':
                        sceneZoneState?.totalBudgetPx ?? '',
                      'data-cineview-takeover-center-lock-offset':
                        sceneLayout?.centerLockOffset ?? '',
                      'data-cineview-takeover-segment-start': sceneLayout?.segmentStart ?? '',
                      'data-cineview-takeover-segment-end': sceneLayout?.segmentEnd ?? '',
                      'data-cineview-takeover-viewport-offset': visualViewportOffset,
                    }
                  : {})}
                style={
                  direction === 'x'
                    ? {
                        position: 'sticky',
                        left: 0,
                        width: visualSpan,
                        maxWidth: '100vw',
                        height: '100%',
                        overflow: 'hidden',
                        zIndex: sceneZoneState?.active ? 30 : undefined,
                      }
                    : {
                        position: 'sticky',
                        top: 0,
                        width: '100%',
                        height: visualSpan,
                        maxHeight: '100vh',
                        overflow: 'hidden',
                        zIndex: sceneZoneState?.active ? 30 : undefined,
                      }
                }
              >
                {cloned}
              </div>
            ) : (
              cloned
            )}
          </div>
        );
      });
    }, [
      activeSceneIndex,
      resolvedCallbacks.scroll,
      childrenArray,
      designHeight,
      designWidth,
      direction,
      firstSceneEnterReady,
      isScrolling,
      resolvedScrollConfig.sceneSizing,
      scrollBackdropSceneIndex,
      exposeTakeoverDebugData,
      sceneLayouts,
      sceneTimelineStates,
      scenes.length,
      scrollDirection,
      scrollOffset,
      viewportSize.height,
      viewportSize.width,
      zoneStateBySceneIndex,
    ]);

    const containerStyle: React.CSSProperties = {
      position: 'relative',
      width: '100%',
      height: '100vh',
      minHeight: '100vh',
      overflowX: direction === 'x' ? 'scroll' : 'hidden',
      overflowY: direction === 'x' ? 'hidden' : 'scroll',
      overscrollBehavior: 'contain',
      WebkitOverflowScrolling: 'touch',
      scrollbarGutter: scrollbar !== false && scrollbar?.enabled !== false ? 'auto' : 'stable',
      background: '#ffffff',
    };
    const resolvedScrollbarConfig = typeof scrollbar === 'object' ? scrollbar : {};
    const scrollbarAutoHide = resolvedScrollbarConfig.autoHide ?? false;
    const viewportSpanForScrollbar = Math.max(
      direction === 'x' ? viewportSize.width : viewportSize.height,
      1
    );
    const scrollbarThickness = Math.max(resolvedScrollbarConfig.width ?? 16, 10);
    const scrollbarInset = Math.max(resolvedScrollbarConfig.inset ?? 2, 0);
    const scrollbarTrackColor = resolvedScrollbarConfig.trackColor ?? 'rgba(80, 102, 142, 0.3)';
    const scrollbarThumbColor = resolvedScrollbarConfig.thumbColor ?? 'rgba(52, 79, 132, 0.94)';
    const scrollbarThumbBorder =
      resolvedScrollbarConfig.thumbHoverColor ?? 'rgba(255, 255, 255, 0.92)';
    const isScrollbarEnabled = scrollbar !== false && scrollbar?.enabled !== false;
    const nativeScrollableSpan = Math.max(scrollContentSpan - viewportSpanForScrollbar, 0);
    const currentNativeScrollOffset = clamp(scrollOffset, 0, nativeScrollableSpan);
    const effectiveContentSpan = nativeScrollableSpan + viewportSpanForScrollbar;
    const showScrollbarOverlay = isScrollbarEnabled && nativeScrollableSpan > 1;
    const railLength = Math.max(viewportSpanForScrollbar - scrollbarInset * 2, 1);
    const thumbLength =
      nativeScrollableSpan > 0
        ? clamp(
            (viewportSpanForScrollbar / Math.max(effectiveContentSpan, viewportSpanForScrollbar)) *
              railLength,
            Math.min(40, railLength),
            railLength
          )
        : railLength;
    const thumbTravel = Math.max(railLength - thumbLength, 0);
    const thumbOffset =
      nativeScrollableSpan > 0
        ? clamp((currentNativeScrollOffset / nativeScrollableSpan) * thumbTravel, 0, thumbTravel)
        : 0;

    const applyNativeScrollbarOffset = useCallback(
      (targetOffset: number): void => {
        const root = containerRef.current;
        const currentOffset = root
          ? direction === 'x'
            ? root.scrollLeft
            : root.scrollTop
          : scrollOffset;
        const resolvedOffset = resolveNativeScrollIntent(
          currentOffset,
          targetOffset - currentOffset
        );
        setNativeOffset(resolvedOffset);
        syncNativeScrollState(true);
      },
      [direction, resolveNativeScrollIntent, scrollOffset, setNativeOffset, syncNativeScrollState]
    );

    const scrollbarDragCleanupRef = useRef<(() => void) | null>(null);

    const handleScrollbarMouseDown = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        if (nativeScrollableSpan <= 0 || typeof window === 'undefined') {
          return;
        }

        event.preventDefault();

        const railRect = event.currentTarget.getBoundingClientRect();
        const trackLength = direction === 'x' ? railRect.width : railRect.height;
        const trackStart = direction === 'x' ? railRect.left : railRect.top;
        const pointer = direction === 'x' ? event.clientX : event.clientY;
        const currentThumbOffset =
          nativeScrollableSpan > 0
            ? clamp(
                (currentNativeScrollOffset / nativeScrollableSpan) *
                  Math.max(trackLength - thumbLength, 0),
                0,
                Math.max(trackLength - thumbLength, 0)
              )
            : 0;
        const localPointer = pointer - trackStart;
        const startedOnThumb =
          localPointer >= currentThumbOffset && localPointer <= currentThumbOffset + thumbLength;
        const pointerOffsetWithinThumb = startedOnThumb
          ? localPointer - currentThumbOffset
          : thumbLength / 2;

        const commitPointer = (clientPosition: number): void => {
          const thumbTravelDistance = Math.max(trackLength - thumbLength, 0);
          const localThumbOffset = clamp(
            clientPosition - trackStart - pointerOffsetWithinThumb,
            0,
            thumbTravelDistance
          );
          const ratio = thumbTravelDistance > 0 ? localThumbOffset / thumbTravelDistance : 0;
          applyNativeScrollbarOffset(ratio * nativeScrollableSpan);
        };

        commitPointer(pointer);

        if (!startedOnThumb) {
          return;
        }

        const handleMove = (moveEvent: MouseEvent): void => {
          commitPointer(direction === 'x' ? moveEvent.clientX : moveEvent.clientY);
        };

        const handleUp = (): void => {
          window.removeEventListener('mousemove', handleMove);
          window.removeEventListener('mouseup', handleUp);
          scrollbarDragCleanupRef.current = null;
        };

        // Tear down any drag still attached from a prior mousedown that never
        // received its mouseup, then track this drag's cleanup so an unmount
        // mid-drag does not leak the window listeners.
        scrollbarDragCleanupRef.current?.();
        scrollbarDragCleanupRef.current = handleUp;
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
      },
      [
        applyNativeScrollbarOffset,
        currentNativeScrollOffset,
        direction,
        nativeScrollableSpan,
        thumbLength,
      ]
    );

    useEffect(
      () => (): void => {
        scrollbarDragCleanupRef.current?.();
      },
      []
    );

    const runtimeContextValue = useMemo<CineViewRuntimeContextValue>(
      () => ({
        mode: 'scroll',
        reportError: (detail): void => {
          resolvedCallbacks.common?.onError?.({
            ...detail,
            code: detail.code as CineViewErrorCode,
          });
        },
      }),
      [resolvedCallbacks.common]
    );

    return (
      <CineViewProvider designWidth={designWidth} designHeight={designHeight} unit={unit}>
        <CineViewRuntimeContext.Provider value={runtimeContextValue}>
          <SceneScrollRuntimeContext.Provider value={zoneRuntimeValue}>
            <SceneScrollTimelineContext.Provider value={zoneTimelineValue}>
              {isScrollbarEnabled && <style>{createScrollbarCss()}</style>}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100vh',
                  minHeight: '100vh',
                }}
              >
                <div
                  ref={containerRef}
                  style={containerStyle}
                  className="cineview-container"
                  data-cineview-container="true"
                  data-cineview-scrollbar-autohide={String(scrollbarAutoHide)}
                  tabIndex={0}
                  onScroll={() => syncNativeScrollState(true)}
                  onKeyDownCapture={(event) => {
                    if (event.defaultPrevented) {
                      return;
                    }

                    const normalizedDelta = normalizeKeyboardDeltaPx(
                      event.key,
                      event.shiftKey,
                      getViewportSpan()
                    );
                    if (normalizedDelta !== 0 && applyNativeScrollDelta(normalizedDelta)) {
                      event.preventDefault();
                    }
                  }}
                >
                  {renderedChildren}
                </div>
                {showScrollbarOverlay && (
                  <div
                    aria-hidden="true"
                    data-cineview-scrollbar-overlay="true"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      zIndex: 80,
                      pointerEvents: 'none',
                    }}
                  >
                    <div
                      data-cineview-scrollbar-rail="true"
                      onMouseDown={handleScrollbarMouseDown}
                      style={
                        direction === 'x'
                          ? {
                              position: 'absolute',
                              left: scrollbarInset,
                              top: Math.max(
                                viewportSpanForScrollbar - scrollbarThickness - scrollbarInset,
                                0
                              ),
                              width: railLength,
                              height: scrollbarThickness,
                              borderRadius: scrollbarThickness,
                              background: scrollbarTrackColor,
                              boxShadow:
                                '0 0 0 1px rgba(255, 255, 255, 0.78), 0 10px 24px rgba(53, 74, 116, 0.14)',
                              pointerEvents: 'auto',
                              cursor: 'pointer',
                              opacity: scrollbarAutoHide ? 0.56 : 1,
                            }
                          : {
                              position: 'absolute',
                              top: scrollbarInset,
                              right: scrollbarInset,
                              width: scrollbarThickness,
                              height: railLength,
                              borderRadius: scrollbarThickness,
                              background: scrollbarTrackColor,
                              boxShadow:
                                '0 0 0 1px rgba(255, 255, 255, 0.78), 0 10px 24px rgba(53, 74, 116, 0.14)',
                              pointerEvents: 'auto',
                              cursor: 'pointer',
                              opacity: scrollbarAutoHide ? 0.56 : 1,
                            }
                      }
                    >
                      <div
                        data-cineview-scrollbar-thumb="true"
                        style={
                          direction === 'x'
                            ? {
                                position: 'absolute',
                                left: thumbOffset,
                                top: 0,
                                width: thumbLength,
                                height: scrollbarThickness,
                                borderRadius: scrollbarThickness,
                                background: scrollbarThumbColor,
                                boxShadow: `0 0 0 1px ${scrollbarThumbBorder}, 0 10px 24px rgba(53, 74, 116, 0.16)`,
                                cursor: 'grab',
                              }
                            : {
                                position: 'absolute',
                                top: thumbOffset,
                                left: 0,
                                width: scrollbarThickness,
                                height: thumbLength,
                                borderRadius: scrollbarThickness,
                                background: scrollbarThumbColor,
                                boxShadow: `0 0 0 1px ${scrollbarThumbBorder}, 0 10px 24px rgba(53, 74, 116, 0.16)`,
                                cursor: 'grab',
                              }
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </SceneScrollTimelineContext.Provider>
          </SceneScrollRuntimeContext.Provider>
        </CineViewRuntimeContext.Provider>
      </CineViewProvider>
    );
  }
);

DirectScrollCineView.displayName = 'DirectScrollCineView';
