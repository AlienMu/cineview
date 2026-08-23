import React, {
  Children,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { CineViewProvider } from '../../context/CineViewContext';
import { useImagePreloader } from '../../hooks/useImagePreloader';
import { useFirstSceneEnter } from '../../hooks/useFirstSceneEnter';
import { acquirePerformanceMonitoring, performanceMonitor } from '../../utils/performanceMonitor';
import { getScenePreloadImages, resolveScenePreloadTargetImages } from './preloadTargets';
import { devError } from '../../utils/devLog';
import type {
  CineViewErrorCode,
  CineViewPreloadTarget,
  CineViewProps,
  CineViewRef,
  PerformanceMetrics,
  ScrollModeConfig,
} from '../../types';
import {
  createScrollbarCss,
  getRelativeOffset,
  isEditableOrInteractiveScrollKeyTarget,
  isLegacyDisplayNameSceneElement,
  isSceneElement,
  isScrollDebugEnabled,
  normalizeKeyboardDeltaPx,
  resolveDesignDimensions,
  shouldDeferToNestedScrollable,
  type SceneAuthoringCompatProps,
  type ScrollInputDirection,
} from './directScrollHelpers';
import { regroupCallbacks, type GroupedCallbacks } from './regroupCallbacks';
import { ScrollbarOverlay } from './ScrollbarOverlay';
import { createScrollExternalStore } from '../runtime/scrollExternalStore';
import { ScrollSceneStack } from './ScrollSceneStack';
import { useNativeScrollController } from './useNativeScrollController';
import { useScrollSceneLayout } from './useScrollSceneLayout';
import { useScrollSceneSnapshots } from './useScrollSceneSnapshots';
import { useScrollViewport } from './useScrollViewport';
import { useScrollZoneRegistry } from './useScrollZoneRegistry';
import {
  CineViewRuntimeContext,
  type CineViewRuntimeContextValue,
} from '../runtime/runtimeContext';
import { SceneScrollRuntimeContext, SceneScrollTimelineContext } from '../Scene/sceneScrollRuntime';

export const DirectScrollCineView = forwardRef<CineViewRef, CineViewProps>(
  function DirectScrollCineView(
    { children, config, modes, scrollbar, callbacks, performance },
    ref
  ) {
    const { designSize } = resolveDesignDimensions(config);
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
    const scrollOffsetRef = useRef(0);
    const scrollOffsetStoreRef = useRef(createScrollExternalStore(0));
    const measureSceneLayoutsRef = useRef<(() => void) | null>(null);
    const updateSceneRenderSnapshotsRef = useRef<(nativeOffset: number) => void>(() => undefined);
    const activeSceneIndexRef = useRef(0);
    const scrollDirectionRef = useRef<ScrollInputDirection | null>(null);
    const [childrenArray, scenes, duplicateScrollZones, hasLegacyDisplayNameScene] = useMemo(() => {
      const owners = new Map<string, number>();
      const duplicates: Array<readonly [zoneId: string, ownerSceneIndex: number]> = [];
      const sceneElements: React.ReactElement<SceneAuthoringCompatProps>[] = [];
      let hasLegacyScene = false;
      const sanitizedChildren = Children.toArray(children).map((child) => {
        hasLegacyScene ||=
          process.env.NODE_ENV === 'development' && isLegacyDisplayNameSceneElement(child);
        if (!isSceneElement(child)) return child;
        const currentSceneIndex = sceneElements.length;
        const scene = child as React.ReactElement<SceneAuthoringCompatProps>;
        let sanitizedScene = scene;
        if (scene.props.scroll) {
          const authoredZoneId = scene.props.scroll.zoneId ?? scene.props.sceneId;
          if (authoredZoneId !== undefined) {
            const ownerSceneIndex = owners.get(authoredZoneId);
            if (ownerSceneIndex === undefined) {
              owners.set(authoredZoneId, currentSceneIndex);
            } else {
              duplicates[currentSceneIndex] = [authoredZoneId, ownerSceneIndex];
              sanitizedScene = React.cloneElement(scene, { scroll: undefined });
            }
          }
        }
        sceneElements.push(sanitizedScene);
        return sanitizedScene;
      });

      return [sanitizedChildren, sceneElements, duplicates, hasLegacyScene] as const;
    }, [children]);
    const { viewportSize, viewportSizeRef, getViewportSpan, updateViewportMetrics } =
      useScrollViewport({ rootRef: containerRef, direction });
    const {
      zoneRegistryRef,
      zoneStatesRef,
      timelineStoreRef,
      zoneRuntimeVersion,
      getZoneIdForScene,
      getZoneDistance,
      zoneRuntimeValue,
      zoneTimelineValue,
    } = useScrollZoneRegistry({
      scrollOffsetRef,
      measureSceneLayoutsRef,
      updateSceneRenderSnapshotsRef,
    });
    const { sceneLayoutsRef, sceneWrapperRefs, measureSceneLayouts, setSceneWrapperRef } =
      useScrollSceneLayout({
        rootRef: containerRef,
        direction,
        scenes,
        sceneSizing: resolvedScrollConfig.sceneSizing,
        getViewportSpan,
        getZoneIdForScene,
        getZoneDistance,
        zoneRegistryRef,
        scrollOffsetRef,
        updateSceneRenderSnapshotsRef,
      });
    const isScrollingStateRef = useRef(false);
    const exposeTakeoverDebugData = isScrollDebugEnabled();

    const preloadPlan = useMemo(() => {
      const firstSceneImages = getScenePreloadImages(scenes[0]?.props ?? {});
      const prioritySet = new Set(firstSceneImages);
      const backgroundImages = Array.from(
        new Set(
          scenes.flatMap((scene) =>
            getScenePreloadImages(scene.props).filter((url) => !prioritySet.has(url))
          )
        )
      );
      return { priorityImages: firstSceneImages, backgroundImages };
    }, [scenes]);
    const [preloadState, preloadActions] = useImagePreloader({
      priorityUrls: preloadPlan.priorityImages,
      backgroundUrls: preloadPlan.backgroundImages,
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
    // Mirrors the drag root (CineView.tsx): an empty scroll root is a
    // recoverable authoring error, not a silent blank page.
    const totalScenes = scenes.length;
    useEffect(() => {
      if (totalScenes === 0) {
        emitRecoverableError('NO_SCENES', 'CineView requires at least one Scene child.', {
          mode: 'scroll',
        });
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            '[CineView] NO_SCENES: the scroll root has no Scene children; nothing will render.'
          );
        }
      }
    }, [emitRecoverableError, totalScenes]);
    const reportedDuplicateScrollZonesRef = useRef<typeof duplicateScrollZones>();
    useEffect(() => {
      if (reportedDuplicateScrollZonesRef.current === duplicateScrollZones) return;
      reportedDuplicateScrollZonesRef.current = duplicateScrollZones;
      duplicateScrollZones.forEach(([zoneId, ownerSceneIndex], rejectedSceneIndex) => {
        const message = `Duplicate scroll zone id "${zoneId}".`;
        emitRecoverableError('INVALID_COMPONENT_HIERARCHY', message, {
          reason: 'duplicate-scroll-zone',
          zoneId,
          ownerSceneIndex,
          rejectedSceneIndex,
        });
        devError(`INVALID_COMPONENT_HIERARCHY: ${message}`);
      });
    }, [duplicateScrollZones, emitRecoverableError]);

    const getPreloadCounts = useCallback(
      () => ({
        loadedCount: preloadCountsRef.current.loadedCount,
        totalCount: preloadCountsRef.current.totalCount,
      }),
      []
    );
    const { firstSceneEnterActive, firstSceneEnterReady } = useFirstSceneEnter({
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

    // Always kick the preload run, even with zero priority images. startPreload
    // owns the only call to setPriorityComplete(true) — including its zero-image
    // fast path (initialTotal === 0 → immediate completion). Guarding this on
    // preloadImages.length > 0 meant a scroll root with no first-screen images
    // never ran it, so priorityComplete (and thus firstSceneEnterReady) stayed
    // false forever and the first scene's enter animations were pinned at their
    // initial frame. Drag mode (CineView.tsx) already calls it unconditionally;
    // this matches that contract.
    useEffect(() => {
      void startPreload();
    }, [preloadPlan, startPreload]);

    const { store: sceneRenderStore, frameStore: sceneFrameStore } = useScrollSceneSnapshots({
      scenes,
      sceneLayoutsRef,
      timelineStoreRef,
      viewportSizeRef,
      activeSceneIndexRef,
      scrollDirectionRef,
      isScrollingStateRef,
      direction,
      sceneSizing: resolvedScrollConfig.sceneSizing,
      firstSceneEnterActive,
      firstSceneEnterReady,
      exposeTakeoverDebugData,
      scrollOffsetRef,
      updateSceneRenderSnapshotsRef,
    });
    measureSceneLayoutsRef.current = measureSceneLayouts;

    const {
      isScrolling,
      scrollContentSpan,
      syncNativeScrollState,
      applyNativeScrollDelta,
      applyNativeScrollbarOffset,
      goToScrollZone,
      beginProgrammaticScroll,
    } = useNativeScrollController({
      rootRef: containerRef,
      direction,
      getViewportSpan,
      updateViewportMetrics,
      measureSceneLayouts,
      sceneLayoutsRef,
      zoneRegistryRef,
      zoneStatesRef,
      timelineStoreRef,
      scrollOffsetRef,
      scrollOffsetStore: scrollOffsetStoreRef.current,
      activeSceneIndexRef,
      scrollDirectionRef,
      isScrollingStateRef,
      updateSceneRenderSnapshotsRef,
      callbacks: resolvedCallbacks,
      zoneRuntimeVersion,
    });

    // S-F4 (DESIGN measurement rule #3): async images/fonts growing a scene
    // used to leave every sceneStart/segmentStart stale until the next
    // gesture's first frame re-measured. Observe the scene wrappers; on a size
    // change outside a gesture, re-measure and programmatically resync
    // (fromGesture=false). Mid-gesture changes are deferred to gesture end to
    // keep the "measure once at gesture start" invariant — no per-frame
    // measurement is added to the scroll hot path. The rAF merge coalesces
    // bursts and keeps layout reads/writes out of the observer callback
    // (avoids ResizeObserver loop errors).
    const pendingContentRemeasureRef = useRef(false);
    const contentRemeasureFrameRef = useRef<number | null>(null);
    const runContentRemeasure = useCallback((): void => {
      pendingContentRemeasureRef.current = false;
      updateViewportMetrics();
      measureSceneLayouts();
      syncNativeScrollState();
    }, [measureSceneLayouts, syncNativeScrollState, updateViewportMetrics]);

    useEffect(() => {
      if (typeof ResizeObserver === 'undefined') {
        return undefined;
      }

      const observer = new ResizeObserver(() => {
        if (contentRemeasureFrameRef.current !== null) {
          return;
        }
        contentRemeasureFrameRef.current = window.requestAnimationFrame(() => {
          contentRemeasureFrameRef.current = null;
          if (isScrollingStateRef.current) {
            pendingContentRemeasureRef.current = true;
            return;
          }
          runContentRemeasure();
        });
      });
      sceneWrapperRefs.current.forEach((wrapper) => {
        if (wrapper) observer.observe(wrapper);
      });

      return (): void => {
        if (contentRemeasureFrameRef.current !== null) {
          window.cancelAnimationFrame(contentRemeasureFrameRef.current);
          contentRemeasureFrameRef.current = null;
        }
        observer.disconnect();
      };
    }, [runContentRemeasure, sceneWrapperRefs, scenes]);

    // Gesture-deferred remeasure: the controller flips isScrolling false
    // ~120ms after the last input frame; flush any resize captured mid-gesture
    // then.
    useEffect(() => {
      if (isScrolling || !pendingContentRemeasureRef.current) {
        return;
      }
      runContentRemeasure();
    }, [isScrolling, runContentRemeasure]);

    useEffect(() => {
      if (!performance?.monitor) {
        return;
      }

      return acquirePerformanceMonitoring();
    }, [performance?.monitor]);

    useEffect(() => {
      if (process.env.NODE_ENV !== 'development' || !hasLegacyDisplayNameScene) {
        return;
      }

      console.warn(
        '[CineView] A child component uses displayName="Scene" but is not the exported CineView Scene. Scene discovery now uses the internal cineViewScene marker; import { Scene } from "cineview" or wrap the exported Scene instead of spoofing displayName.'
      );
    }, [hasLegacyDisplayNameScene]);

    const getRuntimeApi = useCallback(
      (): CineViewRef => ({
        goToScene: (index: number, animated = true): void => {
          if (index < 0 || index >= scenes.length) {
            // Mirror the drag side (useSceneManager) instead of a silent no-op.
            if (process.env.NODE_ENV !== 'production') {
              console.warn(
                `[CineView] Invalid scene index: ${index}. Must be between 0 and ${scenes.length - 1}`
              );
            }
            return;
          }

          const root = containerRef.current;
          const wrapper = sceneWrapperRefs.current[index];
          if (!root || !wrapper) {
            return;
          }

          const offset = getRelativeOffset(wrapper, root, direction);
          // S-F2: goToScene is self-issued navigation — mark it programmatic
          // so its scroll frames crossing a takeover segment aren't treated as
          // a user gesture and clamped to the segment boundary (the corrective
          // auto scrollTo would abort a smooth animation mid-way).
          beginProgrammaticScroll(offset);
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
        getCurrentScene: () => activeSceneIndexRef.current,
        getPerformanceMetrics: (): PerformanceMetrics => performanceMonitor.getMetrics(),
      }),
      [
        beginProgrammaticScroll,
        direction,
        goToScrollZone,
        measureSceneLayouts,
        preloadActions,
        resolvedTargetPreloadImages,
        scenes.length,
        sceneWrapperRefs,
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

    const resolvedScrollbarConfig = typeof scrollbar === 'object' ? scrollbar : {};
    const scrollbarAutoHide = resolvedScrollbarConfig.autoHide ?? true;
    const isScrollbarEnabled = typeof scrollbar === 'object' && scrollbar.enabled !== false;
    const containerStyle: React.CSSProperties = {
      position: 'relative',
      width: '100%',
      height: '100vh',
      minHeight: '100vh',
      overflowX: direction === 'x' ? 'scroll' : 'hidden',
      overflowY: direction === 'x' ? 'hidden' : 'scroll',
      overscrollBehavior: 'contain',
      WebkitOverflowScrolling: 'touch',
      scrollbarGutter: isScrollbarEnabled ? 'auto' : 'stable',
      background: '#ffffff',
    };

    const runtimeContextValue = useMemo<CineViewRuntimeContextValue>(
      () => ({
        mode: 'scroll',
        scrollEnterMargin: modes?.scroll?.enterMargin,
        scrollExitMargin: modes?.scroll?.exitMargin,
        reportError: (detail): void => {
          resolvedCallbacks.common?.onError?.({
            ...detail,
            code: detail.code as CineViewErrorCode,
          });
        },
      }),
      [modes?.scroll?.enterMargin, modes?.scroll?.exitMargin, resolvedCallbacks.common]
    );

    return (
      <CineViewProvider designSize={designSize}>
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
                    if (
                      event.defaultPrevented ||
                      !(event.target instanceof Element) ||
                      event.target.closest('[data-cineview-container="true"]') !==
                        event.currentTarget
                    ) {
                      return;
                    }

                    // Focus can legitimately live inside the container (unlike
                    // the window-level handler, no activeElement === body
                    // requirement here). Release scroll keys to editable and
                    // interactive targets — otherwise Space / arrows typed into
                    // an input/textarea/select/contentEditable get swallowed by
                    // preventDefault below.
                    if (isEditableOrInteractiveScrollKeyTarget(event.target, event.key)) {
                      return;
                    }

                    const normalizedDelta = normalizeKeyboardDeltaPx(
                      event.key,
                      event.shiftKey,
                      getViewportSpan()
                    );
                    if (
                      normalizedDelta !== 0 &&
                      !shouldDeferToNestedScrollable(
                        event.target,
                        event.currentTarget,
                        direction,
                        normalizedDelta
                      ) &&
                      applyNativeScrollDelta(normalizedDelta)
                    ) {
                      event.preventDefault();
                    }
                  }}
                >
                  <ScrollSceneStack
                    childrenArray={childrenArray}
                    store={sceneRenderStore}
                    frameStore={sceneFrameStore}
                    setWrapperRef={setSceneWrapperRef}
                    scrollCallbacks={resolvedCallbacks.scroll}
                  />
                </div>
                {isScrollbarEnabled && (
                  <ScrollbarOverlay
                    direction={direction}
                    scrollContentSpan={scrollContentSpan}
                    viewportSpan={Math.max(
                      direction === 'x' ? viewportSize.width : viewportSize.height,
                      1
                    )}
                    scrollOffset={scrollOffsetRef.current}
                    scrollOffsetStore={scrollOffsetStoreRef.current}
                    isScrolling={isScrolling}
                    config={resolvedScrollbarConfig}
                    onScrollToOffset={applyNativeScrollbarOffset}
                  />
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
