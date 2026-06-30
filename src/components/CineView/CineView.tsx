/**
 * CineView 容器组件
 * 提供全局配置上下文，管理响应式尺寸换算、场景切换、事件系统和图片预加载
 */

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  Children,
} from 'react';
import { CineViewProvider } from '../../context/CineViewContext';
import { useSceneManager } from '../../hooks/useSceneManager';
import { useImagePreloader } from '../../hooks/useImagePreloader';
import { useFirstSceneEnter } from '../../hooks/useFirstSceneEnter';
import { performanceMonitor } from '../../utils/performanceMonitor';
import { DirectScrollCineView } from './DirectScrollCineView';
import { resolveDesignDimensions, isSceneElement } from './directScrollHelpers';
import { getScenePreloadImages, resolveScenePreloadTargetImages } from './preloadTargets';
import { regroupCallbacks, type GroupedCallbacks } from './regroupCallbacks';
import { CineViewRuntimeContext, type CineViewRuntimeContextValue } from './runtimeContext';
import type {
  AnimationType,
  CineViewErrorCode,
  CineViewPreloadTarget,
  CineViewProps,
  CineViewRef,
  CineViewPerformanceConfig,
  PerformanceMetrics,
  SceneChangeDetail,
  SceneProps,
  ScrollMode,
} from '../../types';

type SceneAuthoringCompatProps = SceneProps & {
  mode?: ScrollMode;
  slideDirection?: 'x' | 'y';
  slideDuration?: number;
  sceneTransitionDuration?: number;
  enterAnimation?: AnimationType;
  exitAnimation?: AnimationType;
  exitDuration?: number;
  sceneWidth?: number | string;
  sceneHeight?: number | string;
  sceneZIndex?: number;
  sceneStackMode?: 'replace' | 'cover';
  scrollEnterLength?: number;
  scrollExitLength?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Default drag time scale: ms per 1% of drag. Full drag (100%) advances the
// element clock by `100 * DEFAULT_DRAG_TIME_SCALE` ms (= 10000ms), independent of
// the scene's authored animation length. Override via `modes.drag.dragTimeScale`.
const DEFAULT_DRAG_TIME_SCALE = 10;

function createScrollbarCss(): string {
  return `
    [data-cineview-container="true"] {
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    [data-cineview-container="true"]::-webkit-scrollbar {
      width: 0;
      height: 0;
      display: none;
    }
  `;
}

export function resolveRootMode(mode: ScrollMode | undefined): ScrollMode {
  return mode ?? 'drag';
}

function getSceneSettleDuration(
  sceneProps: SceneAuthoringCompatProps,
  rootMode: ScrollMode,
  modes: CineViewProps['modes'] | undefined
): number {
  if (rootMode === 'drag') {
    return Math.max(
      modes?.drag?.transitionDuration ?? sceneProps.sceneTransitionDuration ?? 500,
      0
    );
  }

  return Math.max(sceneProps.sceneTransitionDuration ?? 500, 0);
}

function collectScenePreloadPlan(
  scenes: JSX.Element[],
  activeSceneIndex: number,
  mode: ScrollMode
): { priorityImages: string[]; backgroundImages: string[] } {
  if (mode === 'scroll') {
    return {
      priorityImages: Array.from(
        new Set(
          scenes.flatMap((scene) => getScenePreloadImages(scene.props as SceneAuthoringCompatProps))
        )
      ),
      backgroundImages: [],
    };
  }

  const prioritySceneIndices = new Set<number>();
  const normalizedActiveScene = clamp(activeSceneIndex, 0, Math.max(scenes.length - 1, 0));

  prioritySceneIndices.add(normalizedActiveScene);
  if (normalizedActiveScene > 0) {
    prioritySceneIndices.add(normalizedActiveScene - 1);
  }
  if (normalizedActiveScene < scenes.length - 1) {
    prioritySceneIndices.add(normalizedActiveScene + 1);
  }

  const priority: string[] = [];
  scenes.forEach((scene, index) => {
    const sceneProps = scene.props as SceneAuthoringCompatProps;
    const images = getScenePreloadImages(sceneProps);
    if (images.length === 0 || !prioritySceneIndices.has(index)) {
      return;
    }

    priority.push(...images);
  });

  return {
    priorityImages: Array.from(new Set(priority)),
    backgroundImages: [],
  };
}

export function resolveRootSceneStackMode(
  sceneProps: Pick<SceneAuthoringCompatProps, 'stack' | 'sceneStackMode'>,
  rootMode: ScrollMode
): 'replace' | 'cover' {
  return sceneProps.stack?.mode ?? (rootMode === 'scroll' ? 'cover' : 'replace');
}

/**
 * CineView 组件实现
 */
const DragCineViewComponent = forwardRef<CineViewRef, CineViewProps>((props, ref) => {
  const { config, mode, modes, scrollbar, callbacks, performance, children } = props;

  const { designWidth, designHeight } = resolveDesignDimensions(config);

  // 场景引用存储（使用 WeakMap 避免内存泄漏）
  // Validates Requirement 26.2: Use WeakMap to store component references
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneWrapperRefs = useRef<Array<HTMLDivElement | null>>([]);
  const currentSceneRef = useRef(0);
  const lastSceneWillChangeFromRef = useRef<number | null>(null);
  const scenesRef = useRef<React.ReactElement[]>([]);
  const measureViewportRef = useRef<(() => void) | null>(null);
  const measureSceneHeightsRef = useRef<(() => void) | null>(null);

  // Track cleanup timers to clear on unmount
  // Validates Requirement 26.5: Clean up timers on unmount
  const cleanupTimersRef = useRef<Set<NodeJS.Timeout>>(new Set());

  // 收集所有 Scene 子组件
  const scenes = useMemo(() => {
    const sceneArray: React.ReactElement[] = [];
    Children.forEach(children, (child) => {
      if (isSceneElement(child)) {
        sceneArray.push(child);
      }
    });
    return sceneArray;
  }, [children]);

  const totalScenes = scenes.length;
  const resolvedRootMode = useMemo<ScrollMode>(() => resolveRootMode(mode), [mode]);
  // The public callbacks prop is now FLAT (mode-aware). Regroup it back into the
  // internal { common, drag, scroll } shape so the ~21 nested read sites below
  // stay unchanged.
  const resolvedCallbacks = useMemo<GroupedCallbacks>(
    () => regroupCallbacks(callbacks),
    [callbacks]
  );
  const resolvedCallbacksRef = useRef(resolvedCallbacks);
  const dragSessionActiveRef = useRef(false);
  const lastDragProgressRef = useRef(0);
  const hasSyncedAdjacentPreloadRef = useRef(false);
  const lastAdjacentPreloadSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    resolvedCallbacksRef.current = resolvedCallbacks;
  }, [resolvedCallbacks]);

  const emitError = useCallback(
    (code: CineViewErrorCode, message: string, context?: Record<string, unknown>): void => {
      resolvedCallbacksRef.current.common?.onError?.({
        code,
        message,
        context,
      });
    },
    []
  );

  // Like emitError, but the detail carries preventDefault(). Returns true when
  // the consumer called it (i.e. took over handling), so the caller can skip
  // its default fallback. Used by the first-scene timeout path.
  const emitRecoverableError = useCallback(
    (code: CineViewErrorCode, message: string, context?: Record<string, unknown>): boolean => {
      let defaultPrevented = false;
      resolvedCallbacksRef.current.common?.onError?.({
        code,
        message,
        context,
        preventDefault: () => {
          defaultPrevented = true;
        },
      });
      return defaultPrevented;
    },
    []
  );

  const handlePreloadProgress = useCallback((progress: number): void => {
    resolvedCallbacksRef.current.common?.onLoadProgress?.(progress);
  }, []);

  useEffect(() => {
    if (totalScenes === 0) {
      emitError('NO_SCENES', 'CineView requires at least one Scene child.', {
        mode: resolvedRootMode,
      });
    }
  }, [emitError, resolvedRootMode, totalScenes]);

  const resolvedPerformance = useMemo<CineViewPerformanceConfig>(
    () => ({
      ...performance,
    }),
    [performance]
  );
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const emitSceneWillChange = useCallback(
    (fromIndex: number, toIndex: number): void => {
      lastSceneWillChangeFromRef.current = fromIndex;
      const detail = {
        fromIndex,
        toIndex,
        direction: toIndex > fromIndex ? 'forward' : toIndex < fromIndex ? 'backward' : null,
      } satisfies SceneChangeDetail;
      resolvedCallbacks.common?.onSceneWillChange?.(detail);
    },
    [resolvedCallbacks]
  );

  const emitSceneDidChange = useCallback(
    (sceneIndex: number, previousIndex?: number): void => {
      const resolvedPreviousIndex =
        previousIndex ?? lastSceneWillChangeFromRef.current ?? sceneIndex;
      lastSceneWillChangeFromRef.current = null;
      const detail = {
        fromIndex: resolvedPreviousIndex,
        toIndex: sceneIndex,
        direction:
          resolvedPreviousIndex === sceneIndex
            ? null
            : sceneIndex > resolvedPreviousIndex
              ? 'forward'
              : sceneIndex < resolvedPreviousIndex
                ? 'backward'
                : null,
      } satisfies SceneChangeDetail;
      resolvedCallbacks.common?.onSceneDidChange?.(detail);
    },
    [resolvedCallbacks]
  );

  // 场景管理
  const [sceneState, sceneActions] = useSceneManager({
    totalScenes,
    initialScene: 0,
    mode: resolvedRootMode,
    onBeforeChange: emitSceneWillChange,
    onAfterChange: (sceneIndex, previousIndex) => {
      emitSceneDidChange(sceneIndex, previousIndex ?? currentSceneRef.current);
    },
  });

  const {
    currentScene,
    isAnimating,
    direction,
    dragProgress,
    dragTimelineProgress,
    renderProgress,
    isDragging,
    sharedTimelineDurationMs,
    dragRelease,
  } = sceneState;

  currentSceneRef.current = currentScene;
  scenesRef.current = scenes;

  // 监听场景切换，在动画完成后调用 setAnimating(false)
  useEffect(() => {
    if (!isAnimating) return;

    // 获取当前场景的动画持续时间
    const currentSceneElement = scenes[currentScene];
    if (!currentSceneElement) return;

    const sceneProps = currentSceneElement.props as SceneAuthoringCompatProps;
    const duration = getSceneSettleDuration(sceneProps, resolvedRootMode, modes);

    // 等待动画完成后通知 scene manager
    const timer = setTimeout(() => {
      sceneActions.setAnimating(false);
    }, duration);

    // Track timer for cleanup
    const timersRef = cleanupTimersRef.current;
    timersRef.add(timer);

    return (): void => {
      clearTimeout(timer);
      timersRef.delete(timer);
    };
  }, [isAnimating, currentScene, scenes, sceneActions, resolvedRootMode, modes]);

  useEffect(() => {
    if (resolvedRootMode !== 'drag') {
      dragSessionActiveRef.current = false;
      lastDragProgressRef.current = 0;
      return;
    }

    const activeSceneIndex = currentScene;
    const resolvedDirection = dragProgress === 0 ? null : dragProgress > 0 ? 'forward' : 'backward';
    const normalizedProgress = Math.min(Math.abs(dragProgress), 1);

    if (isDragging && !dragSessionActiveRef.current) {
      dragSessionActiveRef.current = true;
      resolvedCallbacksRef.current.drag?.onDragStart?.({
        sceneIndex: activeSceneIndex,
        progress: normalizedProgress,
        direction: resolvedDirection,
      });
    }

    if (isDragging && normalizedProgress !== lastDragProgressRef.current) {
      lastDragProgressRef.current = normalizedProgress;
      resolvedCallbacksRef.current.drag?.onDragProgress?.({
        sceneIndex: activeSceneIndex,
        progress: normalizedProgress,
        direction: resolvedDirection,
      });
    }

    if (!isDragging && dragSessionActiveRef.current) {
      dragSessionActiveRef.current = false;
      resolvedCallbacksRef.current.drag?.onDragCancel?.({
        sceneIndex: activeSceneIndex,
        progress: lastDragProgressRef.current,
        direction: resolvedDirection,
      });
      lastDragProgressRef.current = 0;
    }
  }, [resolvedRootMode, isDragging, dragProgress, currentScene]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const ownerWindow = root.ownerDocument?.defaultView ?? window;
    const measureViewport = (): void => {
      const nextRect = root.getBoundingClientRect();
      const nextWidth = nextRect.width;
      const nextHeight = nextRect.height;
      if (nextWidth > 0) {
        setViewportWidth(nextWidth);
      }
      if (nextHeight > 0) {
        setViewportHeight(nextHeight);
      }
    };
    measureViewportRef.current = measureViewport;

    measureViewport();

    const ResizeObserverCtor =
      ownerWindow.ResizeObserver ??
      (typeof ResizeObserver !== 'undefined' ? ResizeObserver : undefined);
    const resizeObserver = ResizeObserverCtor
      ? new ResizeObserverCtor(() => {
          measureViewport();
        })
      : null;

    resizeObserver?.observe(root);
    ownerWindow.addEventListener('resize', measureViewport);

    return (): void => {
      measureViewportRef.current = null;
      resizeObserver?.disconnect();
      ownerWindow.removeEventListener('resize', measureViewport);
    };
  }, []);

  useEffect(() => {
    if (!scrollbar || scrollbar.enabled === false) {
      return;
    }

    const root = containerRef.current;
    const ownerDocument =
      root?.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
    if (!ownerDocument) {
      return;
    }

    const styleId = 'cineview-scrollbar-style';
    let styleNode = ownerDocument.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleNode) {
      styleNode = ownerDocument.createElement('style');
      styleNode.id = styleId;
      ownerDocument.head.appendChild(styleNode);
    }

    styleNode.textContent = createScrollbarCss();

    return (): void => {
      if (styleNode && styleNode.parentNode) {
        styleNode.parentNode.removeChild(styleNode);
      }
    };
  }, [scrollbar]);

  const preloadActiveSceneIndex = currentScene;

  // drag 模式预热当前和相邻场景；scroll 模式使用全局预热计划。
  const { priorityImages, backgroundImages } = useMemo(
    () => collectScenePreloadPlan(scenes, preloadActiveSceneIndex, resolvedRootMode),
    [scenes, preloadActiveSceneIndex, resolvedRootMode]
  );

  // 图片预加载
  const [preloadState, preloadActions] = useImagePreloader({
    priorityUrls: priorityImages,
    backgroundUrls: backgroundImages,
    onProgress: handlePreloadProgress,
    onError: (url, error) => {
      emitError('IMAGE_LOAD_FAILED', error.message, { url });
    },
  });

  // Mirror live preload counts into a ref so the first-scene enter driver can
  // read them for the timeout error context WITHOUT depending on them — they
  // keep changing as background images load, and depending on them would
  // re-run the driver effect and stop() an in-flight enter animation.
  const preloadCountsRef = useRef({ loadedCount: 0, totalCount: 0 });
  preloadCountsRef.current = {
    loadedCount: preloadState.loadedCount,
    totalCount: preloadState.totalCount,
  };

  // First-screen cold-start gate, now mode-agnostic and owned by a single hook
  // (useFirstSceneEnter). The hook owns the two decoupled booleans + the
  // priority-asset / timeout / preventDefault / static-reveal coordination. It
  // GATES only (signals when the first scene may enter); each mode's own track
  // plays the tween. `enabled` is no longer drag-only — scroll's visibility path
  // consumes `firstSceneEnterReady` too. The drag grab preempt is passed as
  // `preemptSignal`; scroll has no equivalent (false).
  const firstSceneTimeoutMs = Math.max(0, modes?.drag?.firstSceneTimeout ?? 3000);
  const getPreloadCounts = useCallback(
    () => ({
      loadedCount: preloadCountsRef.current.loadedCount,
      totalCount: preloadCountsRef.current.totalCount,
    }),
    []
  );
  const {
    firstSceneEnterActive,
    firstSceneEnterReady,
    handleComplete: handleFirstSceneEnterComplete,
  } = useFirstSceneEnter({
    enabled: scenes.length > 0,
    hasFirstScene: Boolean(scenes[0]),
    priorityComplete: preloadState.priorityComplete,
    timeoutMs: firstSceneTimeoutMs,
    preemptSignal: isDragging,
    emitRecoverableError,
    getPreloadCounts,
  });

  // 初始化
  useEffect(() => {
    // Validates Requirement 26.5: Capture ref value before cleanup function
    const timersRef = cleanupTimersRef.current;

    // 开始预加载
    void preloadActions.startPreload();

    // 性能模式下启动性能监控
    if (resolvedPerformance.monitor) {
      performanceMonitor.start();
    }

    // 触发初始化兼容回调
    if (ref && typeof ref !== 'function' && ref.current) {
      resolvedCallbacksRef.current.common?.onReady?.(ref.current);
    }

    return (): void => {
      // Validates Requirement 26.5: Clean up all tracked timers on unmount
      timersRef.forEach((timer) => {
        clearTimeout(timer);
      });
      timersRef.clear();

      // 清理性能监控
      if (resolvedPerformance.monitor) {
        performanceMonitor.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, resolvedPerformance.monitor]); // 只在组件挂载时执行一次

  useEffect(() => {
    const signature = `${priorityImages.join('|')}::${backgroundImages.join('|')}`;
    if (lastAdjacentPreloadSignatureRef.current === signature) {
      return;
    }
    lastAdjacentPreloadSignatureRef.current = signature;

    preloadActions.addUrls(priorityImages, true);
    preloadActions.addUrls(backgroundImages, false);

    if (!hasSyncedAdjacentPreloadRef.current) {
      hasSyncedAdjacentPreloadRef.current = true;
      return;
    }

    if (!preloadState.isLoading) {
      void preloadActions.startPreload();
    }
  }, [priorityImages, backgroundImages, preloadActions, preloadState.isLoading]);

  // 虚拟化渲染：仅渲染当前场景及前后各一个
  const visibleSceneIndices = useMemo(() => {
    const indices = new Set<number>();

    // 当前场景
    indices.add(currentScene);

    // 在非 scroll 的交互模式下，保留相邻场景，兼容动画触发和虚拟化预热。
    if (resolvedRootMode === 'drag') {
      if (currentScene > 0) {
        indices.add(currentScene - 1);
      }
      if (currentScene < totalScenes - 1) {
        indices.add(currentScene + 1);
      }
    }

    return indices;
  }, [resolvedRootMode, currentScene, totalScenes]);

  // API 方法实现
  const goToScene = useCallback(
    (index: number, animated: boolean = true): void => {
      // Programmatic navigation in drag mode also commits a scene change, so emit
      // onDragCommit here to unify "all drag-mode commits fire onDragCommit" (the
      // gesture path fires it in handleSceneChange). Mirror sceneActions.goToScene's
      // own guards (valid range, real change) so a no-op navigation does not emit a
      // phantom commit. Fired BEFORE sceneActions.goToScene to match the gesture
      // ordering (onDragCommit precedes onBeforeChange/onSceneWillChange). progress
      // is 1 (a full commit); elapsedMs/timelineDurationMs are omitted (no gesture
      // timeline). onSceneDidChange still fires via the setAnimating(false) path.
      if (index >= 0 && index < totalScenes && index !== currentScene) {
        resolvedCallbacksRef.current.drag?.onDragCommit?.({
          sceneIndex: currentScene,
          targetSceneIndex: index,
          progress: 1,
          direction: index > currentScene ? 'forward' : 'backward',
        });
      }

      sceneActions.goToScene(index, animated);
    },
    [sceneActions, currentScene, totalScenes]
  );

  // goToZone targets scroll-mode zones; in drag mode (this component) it is a
  // no-op. Scroll navigation is handled by DirectScrollCineView.
  const refreshLayout = useCallback((): void => {
    measureViewportRef.current?.();
    measureSceneHeightsRef.current?.();
  }, []);

  const preload = useCallback(
    async (targets?: CineViewPreloadTarget[]): Promise<void> => {
      const targetImages = resolveScenePreloadTargetImages(scenes, targets, {
        includeZoneIds: true,
      });
      if (targetImages.length > 0) {
        preloadActions.addUrls(targetImages, true);
      }

      await preloadActions.startPreload();
    },
    [preloadActions, scenes]
  );

  const getCurrentScene = useCallback((): number => {
    return currentScene;
  }, [currentScene]);

  const getPerformanceMetrics = useCallback(
    (): PerformanceMetrics => performanceMonitor.getMetrics(),
    []
  );

  // 暴露 API 方法
  useImperativeHandle(
    ref,
    () => ({
      goToScene,
      refreshLayout,
      preload,
      getCurrentScene,
      getPerformanceMetrics,
    }),
    [goToScene, refreshLayout, preload, getCurrentScene, getPerformanceMetrics]
  );

  // 场景切换处理
  const handleSceneChange = useCallback(
    (
      direction: 'forward' | 'backward',
      progressRatio?: number,
      committedElapsedMs?: number,
      timelineDuration?: number
    ) => {
      const activeSceneIndex = currentScene;
      // Two-track model: there is no global element scalar to read. The engine
      // passes the committed elapsed (for the public onDragCommit callback only);
      // the element timeline itself lives on each scene's own track.
      const elapsedMs = Math.max(0, committedElapsedMs ?? 0);
      const targetSceneIndex =
        direction === 'forward' ? activeSceneIndex + 1 : activeSceneIndex - 1;
      const normalizedDragProgress = Math.max(
        0,
        Math.min(progressRatio ?? dragTimelineProgress, 1)
      );
      void progressRatio;

      if (direction === 'forward') {
        if (resolvedRootMode === 'drag') {
          dragSessionActiveRef.current = false;
          lastDragProgressRef.current = 0;
          resolvedCallbacksRef.current.drag?.onDragCommit?.({
            sceneIndex: activeSceneIndex,
            targetSceneIndex,
            progress: normalizedDragProgress,
            direction,
            elapsedMs,
            timelineDurationMs: timelineDuration,
          });
          sceneActions.commitDragSceneChange(
            'forward',
            normalizedDragProgress,
            elapsedMs,
            timelineDuration
          );
        } else {
          sceneActions.nextScene();
        }
      } else {
        if (resolvedRootMode === 'drag') {
          dragSessionActiveRef.current = false;
          lastDragProgressRef.current = 0;
          resolvedCallbacksRef.current.drag?.onDragCommit?.({
            sceneIndex: activeSceneIndex,
            targetSceneIndex,
            progress: normalizedDragProgress,
            direction,
            elapsedMs,
            timelineDurationMs: timelineDuration,
          });
          sceneActions.commitDragSceneChange(
            'backward',
            normalizedDragProgress,
            elapsedMs,
            timelineDuration
          );
        } else {
          sceneActions.prevScene();
        }
      }
    },
    [sceneActions, currentScene, resolvedRootMode, dragTimelineProgress]
  );

  // 渲染场景
  const renderScenes = useCallback((): (JSX.Element | null)[] => {
    return scenes.map((scene, index) => {
      const isVisible = visibleSceneIndices.has(index);
      const effectiveCurrentScene = currentScene;
      const isCurrent = index === effectiveCurrentScene;
      const sceneProps = scene.props as SceneAuthoringCompatProps;
      const effectiveMode = resolvedRootMode;
      const slideDirection = modes?.drag?.direction ?? sceneProps.slideDirection ?? 'y';

      const scenePosition: React.CSSProperties = {
        width: '100%',
        height: '100%',
      };

      if (effectiveMode === 'drag') {
        scenePosition.position = 'absolute';
        scenePosition.inset = 0;
        let clampedProgress = renderProgress;

        if (effectiveCurrentScene === 0 && renderProgress < 0) {
          clampedProgress = 0;
        }

        if (effectiveCurrentScene === totalScenes - 1 && renderProgress > 0) {
          clampedProgress = 0;
        }

        const relativeOffset = index - effectiveCurrentScene;
        const offset = (relativeOffset - clampedProgress) * 100;

        if (slideDirection === 'y') {
          scenePosition.transform = `translate3d(0, ${offset}%, 0)`;
        } else {
          scenePosition.transform = `translate3d(${offset}%, 0, 0)`;
        }

        scenePosition.visibility = 'visible';
        scenePosition.opacity = 1;
        scenePosition.pointerEvents = isCurrent ? 'auto' : 'none';
        scenePosition.contentVisibility = 'visible';
        scenePosition.transition = 'none';
        scenePosition.zIndex = isCurrent ? 10 : 1;
      } else {
        scenePosition.position = 'absolute';
        scenePosition.inset = 0;
        const isAnimatingBackwardReveal =
          isAnimating &&
          direction === 'backward' &&
          (index === effectiveCurrentScene || index === effectiveCurrentScene + 1);
        const isAnimatingForwardStack =
          isAnimating &&
          direction === 'forward' &&
          (index === effectiveCurrentScene || index === effectiveCurrentScene - 1);
        const shouldShow = isCurrent || isAnimatingBackwardReveal || isAnimatingForwardStack;

        scenePosition.visibility = shouldShow ? 'visible' : 'hidden';
        scenePosition.contentVisibility = shouldShow ? 'visible' : 'hidden';

        if (isAnimating && direction === 'backward') {
          scenePosition.zIndex =
            index === effectiveCurrentScene + 1 ? 2 : index === effectiveCurrentScene ? 1 : 0;
        } else if (isAnimating && direction === 'forward') {
          scenePosition.zIndex =
            index === effectiveCurrentScene ? 2 : index === effectiveCurrentScene - 1 ? 1 : 0;
        } else {
          scenePosition.zIndex = isCurrent ? 1 : 0;
        }
      }

      // 虚拟化：scroll 模式保留布局高度，其它模式直接跳过不可见场景
      if (!isVisible) {
        return null;
      }

      // Clone scene element and inject props
      const clonedScene = React.cloneElement(scene, {
        sceneRuntime: {
          mode: effectiveMode,
          direction: slideDirection,
          isActive: isCurrent,
          sceneIndex: index,
          totalScenes: scenes.length,
          currentSceneIndex: effectiveCurrentScene,
          transitionDirection: direction,
          isSceneAnimating: isAnimating,
          sharedTimelineDurationMs,
          viewportWidth,
          viewportHeight,
          firstSceneEnterActive: firstSceneEnterActive && index === 0,
          firstSceneEnterReady: firstSceneEnterReady && index === 0,
        },
        dragRuntime: {
          progress: dragProgress,
          renderProgress,
          timelineProgress: dragTimelineProgress,
          isDragging,
          release: dragRelease,
          threshold: modes?.drag?.threshold,
          dragTimeScale: modes?.drag?.dragTimeScale ?? DEFAULT_DRAG_TIME_SCALE,
          onCommit: handleSceneChange,
          onReset: sceneActions.resetDragInteraction,
          // Both the incoming scene's release-settle completion AND scene 0's
          // cold-start completion fire onActivationComplete. For a scene-change
          // settle this drives state CLEANUP via completeDragTransition (clearing
          // dragRelease/direction/scalars once the element track reaches T — the
          // public onSceneDidChange already fired at render commit, not here); for
          // the cold-start it clears the first-scene window. The two are
          // mutually exclusive per scene instance, so route by which one this is.
          onActivationComplete:
            index === 0 && firstSceneEnterActive
              ? handleFirstSceneEnterComplete
              : sceneActions.completeDragTransition,
          onProgressChange: sceneActions.setDragProgress,
          onRenderProgressChange: sceneActions.setRenderProgress,
          onTimelineProgressChange: sceneActions.setDragTimelineProgress,
          onDraggingChange: sceneActions.setIsDragging,
          onRelease: sceneActions.setDragRelease,
          onSharedTimelineDurationChange: sceneActions.setSharedTimelineDurationMs,
        },
        onSceneChange: handleSceneChange,
      });

      return (
        <div
          key={index}
          ref={(node) => {
            sceneWrapperRefs.current[index] = node;
          }}
          style={scenePosition}
          data-scene-index={index}
        >
          {clonedScene}
        </div>
      );
    });
  }, [
    resolvedRootMode,
    modes?.drag?.direction,
    modes?.drag?.threshold,
    modes?.drag?.dragTimeScale,
    scenes,
    visibleSceneIndices,
    currentScene,
    totalScenes,
    dragProgress,
    dragTimelineProgress,
    renderProgress,
    isDragging,
    sharedTimelineDurationMs,
    dragRelease,
    firstSceneEnterActive,
    firstSceneEnterReady,
    handleFirstSceneEnterComplete,
    direction,
    isAnimating,
    handleSceneChange,
    sceneActions,
    viewportWidth,
    viewportHeight,
  ]);

  // 开发环境检查
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // 检查是否有 Scene 子组件
      if (totalScenes === 0) {
        console.warn('[CineView] No Scene components found. Please add at least one Scene child.');
      }

      // 检查设计稿尺寸
      if (designWidth <= 0 || designHeight <= 0) {
        console.error(
          '[CineView] Invalid config.width/config.height. Both values must be greater than 0.'
        );
      }

      // 性能调试模式
      if (resolvedPerformance.monitor) {
        performanceMonitor.start();
      }
    }
  }, [totalScenes, designWidth, designHeight, resolvedPerformance.monitor]);

  // 容器样式
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100vh',
    minHeight: '100vh',
    overflowX: 'hidden',
    overflowY: 'hidden',
    background: '#0d1624',
  };

  const sceneViewportStyle: React.CSSProperties = {
    opacity: 1,
    pointerEvents: 'auto',
  };

  const runtimeContextValue = useMemo<CineViewRuntimeContextValue>(
    () => ({
      mode: resolvedRootMode,
      visibilityEnterMargin: modes?.scroll?.enterMargin,
      visibilityExitMargin: modes?.scroll?.exitMargin,
      reportError: (detail): void => {
        emitError(detail.code as CineViewErrorCode, detail.message, detail.context);
      },
    }),
    [resolvedRootMode, modes?.scroll?.enterMargin, modes?.scroll?.exitMargin, emitError]
  );

  return (
    <CineViewProvider designWidth={designWidth} designHeight={designHeight}>
      <CineViewRuntimeContext.Provider value={runtimeContextValue}>
        <div
          ref={containerRef}
          style={containerStyle}
          className="cineview-container"
          data-cineview-container="true"
        >
          <div style={sceneViewportStyle}>{renderScenes()}</div>
        </div>
      </CineViewRuntimeContext.Provider>
    </CineViewProvider>
  );
});

DragCineViewComponent.displayName = 'CineViewDrag';

const CineViewComponent = forwardRef<CineViewRef, CineViewProps>((props, ref) => {
  if (resolveRootMode(props.mode) === 'scroll') {
    return <DirectScrollCineView {...props} ref={ref} />;
  }
  return <DragCineViewComponent {...props} ref={ref} />;
});

CineViewComponent.displayName = 'CineView';

export const CineView = CineViewComponent;
