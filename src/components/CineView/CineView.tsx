/**
 * CineView 容器组件
 * 提供全局配置上下文，管理响应式尺寸换算、场景切换、事件系统和图片预加载
 */

import React, {
  forwardRef,
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  Children,
} from 'react';
import { CineViewProvider } from '../../context/CineViewContext';
import { useSceneManager, type DragReleaseInput } from '../../hooks/useSceneManager';
import { useImagePreloader } from '../../hooks/useImagePreloader';
import { useFirstSceneEnter } from '../../hooks/useFirstSceneEnter';
import { performanceMonitor } from '../../utils/performanceMonitor';
import { DirectScrollCineView } from './DirectScrollCineView';
import { DragSceneStack } from './DragSceneStack';
import {
  resolveDesignDimensions,
  isLegacyDisplayNameSceneElement,
  isSceneElement,
} from './directScrollHelpers';
import { getScenePreloadImages } from './preloadTargets';
import { regroupCallbacks, type GroupedCallbacks } from './regroupCallbacks';
import { CineViewRuntimeContext, type CineViewRuntimeContextValue } from './runtimeContext';
import { useCineViewImperativeApi } from './useCineViewImperativeApi';
import type {
  AnimationType,
  CineViewErrorCode,
  CineViewProps,
  CineViewRef,
  CineViewPerformanceConfig,
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
    const firstScene = scenes[clamp(activeSceneIndex, 0, Math.max(scenes.length - 1, 0))];
    const firstSceneImages = firstScene
      ? getScenePreloadImages(firstScene.props as SceneAuthoringCompatProps)
      : [];
    const prioritySet = new Set(firstSceneImages);
    return {
      priorityImages: firstSceneImages,
      backgroundImages: Array.from(
        new Set(
          scenes.flatMap((scene) =>
            getScenePreloadImages(scene.props as SceneAuthoringCompatProps).filter(
              (url) => !prioritySet.has(url)
            )
          )
        )
      ),
    };
  }

  const normalizedActiveScene = clamp(activeSceneIndex, 0, Math.max(scenes.length - 1, 0));
  const priority: string[] = [];
  const background: string[] = [];
  scenes.forEach((scene, index) => {
    const sceneProps = scene.props as SceneAuthoringCompatProps;
    const images = getScenePreloadImages(sceneProps);
    if (index === normalizedActiveScene) {
      priority.push(...images);
    } else {
      background.push(...images);
    }
  });

  const prioritySet = new Set(priority);

  return {
    priorityImages: Array.from(new Set(priority)),
    backgroundImages: Array.from(new Set(background.filter((url) => !prioritySet.has(url)))),
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

  const { designSize } = resolveDesignDimensions(config);

  // 场景引用存储（使用 WeakMap 避免内存泄漏）
  // Validates Requirement 26.2: Use WeakMap to store component references
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneWrapperRefs = useRef<Array<HTMLDivElement | null>>([]);
  const currentSceneRef = useRef(0);
  const lastSceneWillChangeFromRef = useRef<number | null>(null);
  const scenesRef = useRef<React.ReactElement[]>([]);
  const measureViewportRef = useRef<(() => void) | null>(null);

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
  const hasLegacyDisplayNameScene = useMemo(() => {
    let found = false;
    Children.forEach(children, (child) => {
      if (isLegacyDisplayNameSceneElement(child)) {
        found = true;
      }
    });
    return found;
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
  const pendingDragCancelRef = useRef<{ sceneIndex: number; signedProgress: number } | null>(null);
  const hasSyncedPreloadPlanRef = useRef(false);
  const lastPreloadSignatureRef = useRef<string | null>(null);

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
  const sceneActionsRef = useRef(sceneActions);
  sceneActionsRef.current = sceneActions;

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
    if (resolvedRootMode === 'drag') return;
    dragSessionActiveRef.current = false;
    lastDragProgressRef.current = 0;
    pendingDragCancelRef.current = null;
  }, [resolvedRootMode]);

  const handleDragProgressChange = useCallback(
    (progress: number): void => {
      sceneActions.setDragProgress(progress);
      if (resolvedRootMode !== 'drag' || !dragSessionActiveRef.current) return;

      const signedProgress = progress === 0 ? 0 : clamp(progress, -1, 1);
      if (signedProgress === lastDragProgressRef.current) return;

      lastDragProgressRef.current = signedProgress;
      resolvedCallbacksRef.current.drag?.onDragProgress?.({
        sceneIndex: currentSceneRef.current,
        progress: Math.abs(signedProgress),
        direction: signedProgress > 0 ? 'forward' : signedProgress < 0 ? 'backward' : null,
      });
    },
    [resolvedRootMode, sceneActions]
  );

  const handleDraggingChange = useCallback(
    (dragging: boolean): void => {
      sceneActions.setIsDragging(dragging);
      if (resolvedRootMode !== 'drag' || !dragging || dragSessionActiveRef.current) return;

      dragSessionActiveRef.current = true;
      lastDragProgressRef.current = 0;
      pendingDragCancelRef.current = null;
      resolvedCallbacksRef.current.drag?.onDragStart?.({
        sceneIndex: currentSceneRef.current,
        progress: 0,
        direction: null,
      });
    },
    [resolvedRootMode, sceneActions]
  );

  const handleDragRelease = useCallback(
    (release: DragReleaseInput | null): void => {
      if (release?.mode === 'bounce' && dragSessionActiveRef.current) {
        pendingDragCancelRef.current = {
          sceneIndex: currentSceneRef.current,
          signedProgress: lastDragProgressRef.current,
        };
      } else if (release?.mode !== 'bounce') {
        pendingDragCancelRef.current = null;
      }
      sceneActions.setDragRelease(release);
    },
    [sceneActions]
  );

  const handleDragReset = useCallback((): void => {
    if (resolvedRootMode === 'drag' && dragSessionActiveRef.current) {
      const cancelSnapshot = pendingDragCancelRef.current ?? {
        sceneIndex: currentSceneRef.current,
        signedProgress: lastDragProgressRef.current,
      };
      dragSessionActiveRef.current = false;
      lastDragProgressRef.current = 0;
      pendingDragCancelRef.current = null;
      resolvedCallbacksRef.current.drag?.onDragCancel?.({
        sceneIndex: cancelSnapshot.sceneIndex,
        progress: Math.abs(cancelSnapshot.signedProgress),
        direction:
          cancelSnapshot.signedProgress > 0
            ? 'forward'
            : cancelSnapshot.signedProgress < 0
              ? 'backward'
              : null,
      });
    }
    sceneActions.resetDragInteraction();
  }, [resolvedRootMode, sceneActions]);

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

  // 首屏只等待当前场景；其余场景进入后台队列，避免远端资源阻塞首屏 ready。
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
  const preloadActionsRef = useRef(preloadActions);
  preloadActionsRef.current = preloadActions;

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

    return (): void => {
      // Validates Requirement 26.5: Clean up all tracked timers on unmount
      timersRef.forEach((timer) => {
        clearTimeout(timer);
      });
      timersRef.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]); // 只在组件挂载时执行一次

  useEffect(() => {
    if (!resolvedPerformance.monitor) {
      return;
    }

    performanceMonitor.start();
    return (): void => {
      performanceMonitor.stop();
    };
  }, [resolvedPerformance.monitor]);

  useEffect(() => {
    const signature = `${priorityImages.join('|')}::${backgroundImages.join('|')}`;
    if (lastPreloadSignatureRef.current === signature) {
      return;
    }
    lastPreloadSignatureRef.current = signature;

    preloadActions.addUrls(priorityImages, true);
    preloadActions.addUrls(backgroundImages, false);

    if (!hasSyncedPreloadPlanRef.current) {
      hasSyncedPreloadPlanRef.current = true;
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

    // 在 drag 模式下保留相邻场景，兼容动画触发和虚拟化窗口切换。
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

  useCineViewImperativeApi({
    ref,
    currentSceneRef,
    scenesRef,
    sceneActionsRef,
    preloadActionsRef,
    measureViewportRef,
    resolvedCallbacksRef,
  });

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
          pendingDragCancelRef.current = null;
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
          pendingDragCancelRef.current = null;
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

  // 开发环境检查
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // 检查是否有 Scene 子组件
      if (totalScenes === 0) {
        console.warn('[CineView] No Scene components found. Please add at least one Scene child.');
      }

      if (hasLegacyDisplayNameScene) {
        console.warn(
          '[CineView] A child component uses displayName="Scene" but is not the exported CineView Scene. Scene discovery now uses the internal cineViewScene marker; import { Scene } from "cineview" or wrap the exported Scene instead of spoofing displayName.'
        );
      }

      // 检查设计稿尺寸
      if (designSize <= 0) {
        console.error('[CineView] Invalid config.size. It must be greater than 0.');
      }

      // 性能调试模式
      if (resolvedPerformance.monitor) {
        performanceMonitor.start();
      }
    }
  }, [hasLegacyDisplayNameScene, totalScenes, designSize, resolvedPerformance.monitor]);

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
      scrollEnterMargin: modes?.scroll?.enterMargin,
      scrollExitMargin: modes?.scroll?.exitMargin,
      reportError: (detail): void => {
        emitError(detail.code as CineViewErrorCode, detail.message, detail.context);
      },
    }),
    [resolvedRootMode, modes?.scroll?.enterMargin, modes?.scroll?.exitMargin, emitError]
  );

  return (
    <CineViewProvider designSize={designSize}>
      <CineViewRuntimeContext.Provider value={runtimeContextValue}>
        <div
          ref={containerRef}
          style={containerStyle}
          className="cineview-container"
          data-cineview-container="true"
        >
          <div style={sceneViewportStyle}>
            <DragSceneStack
              scenes={scenes}
              visibleSceneIndices={visibleSceneIndices}
              currentScene={currentScene}
              totalScenes={totalScenes}
              mode={resolvedRootMode}
              dragConfig={modes?.drag}
              dragTimeScale={modes?.drag?.dragTimeScale ?? DEFAULT_DRAG_TIME_SCALE}
              dragProgress={dragProgress}
              dragTimelineProgress={dragTimelineProgress}
              renderProgress={renderProgress}
              isDragging={isDragging}
              sharedTimelineDurationMs={sharedTimelineDurationMs}
              dragRelease={dragRelease}
              firstSceneEnterActive={firstSceneEnterActive}
              firstSceneEnterReady={firstSceneEnterReady}
              direction={direction}
              isAnimating={isAnimating}
              viewportWidth={viewportWidth}
              viewportHeight={viewportHeight}
              sceneActions={sceneActions}
              sceneWrapperRefs={sceneWrapperRefs}
              onSceneChange={handleSceneChange}
              onDragProgressChange={handleDragProgressChange}
              onDraggingChange={handleDraggingChange}
              onDragRelease={handleDragRelease}
              onDragReset={handleDragReset}
              onFirstSceneEnterComplete={handleFirstSceneEnterComplete}
            />
          </div>
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
