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
import { useMotionValue } from 'framer-motion';
import { CineViewProvider } from '../../context/CineViewContext';
import { useSceneManager, type DragReleaseInput } from '../../hooks/useSceneManager';
import { useImagePreloader } from '../../hooks/useImagePreloader';
import { useFirstSceneEnter } from '../../hooks/useFirstSceneEnter';
import { acquirePerformanceMonitoring } from '../../utils/performanceMonitor';
import { DragSceneStack } from './DragSceneStack';
import type {
  DragRenderLane,
  DragTakeoverSnapshot,
  SceneActivationKind,
  SceneActivationRecord,
} from '../Scene/types';
import {
  DragPreparedSceneStore,
  type DragSceneTransaction,
  type PreparedSceneInvalidation,
  type PreparedSceneSnapshot,
} from '../Scene/dragPreparedState';
import {
  resolveDesignDimensions,
  isLegacyDisplayNameSceneElement,
  isSceneElement,
} from './directScrollHelpers';
import { getScenePreloadImages } from './preloadTargets';
import { resolveDragTimelineConfig } from '../../utils/dragTimelineMapping';
import { regroupCallbacks, type GroupedCallbacks } from './regroupCallbacks';
import {
  CineViewRuntimeContext,
  type CineViewRuntimeContextValue,
} from '../runtime/runtimeContext';
import { useCineViewImperativeApi } from './useCineViewImperativeApi';
import { DEFAULT_SLIDE_DURATION } from '../../types';
import { devWarn } from '../../utils/devLog';
import type {
  AnimationType,
  CineViewDragModeProps,
  CineViewErrorCode,
  CineViewRef,
  DragModeConfig,
  SceneChangeDetail,
  SceneProps,
  ScrollMode,
} from '../../types';
import { useIsomorphicLayoutEffect } from '../../utils/useIsomorphicLayoutEffect';

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
  rootTransitionDuration: number | undefined
): number {
  // A10: the settle fallback shares DEFAULT_SLIDE_DURATION (800) — the same
  // default the Scene slide itself uses (helpers.ts) — instead of a divergent
  // local 500 that would fire setAnimating(false) before the slide finished.
  if (rootMode === 'drag') {
    return Math.max(
      rootTransitionDuration ?? sceneProps.sceneTransitionDuration ?? DEFAULT_SLIDE_DURATION,
      0
    );
  }

  return Math.max(sceneProps.sceneTransitionDuration ?? DEFAULT_SLIDE_DURATION, 0);
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
  sceneProps: Pick<SceneAuthoringCompatProps, 'layout' | 'sceneStackMode'>,
  rootMode: ScrollMode
): 'replace' | 'cover' {
  return sceneProps.layout?.overlap ?? (rootMode === 'scroll' ? 'cover' : 'replace');
}

/**
 * CineView 组件实现
 */
const DragCineViewComponent = forwardRef<CineViewRef, CineViewDragModeProps>((props, ref) => {
  const {
    designWidth,
    mode,
    direction: dragDirection,
    transitionDuration,
    threshold,
    unit,
    scale,
    firstSceneTimeout,
    scrollbar,
    callbacks,
    monitor,
    children,
  } = props;

  const { designSize } = resolveDesignDimensions(designWidth);
  const dragConfig = useMemo<DragModeConfig>(
    () => ({
      direction: dragDirection,
      transitionDuration,
      threshold,
      unit,
      scale,
      firstSceneTimeout,
    }),
    [dragDirection, transitionDuration, threshold, unit, scale, firstSceneTimeout]
  );

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
  const [scenes, hasLegacyDisplayNameScene] = useMemo(() => {
    const sceneArray: React.ReactElement[] = [];
    let hasLegacyScene = false;
    Children.forEach(children, (child) => {
      if (isSceneElement(child)) {
        sceneArray.push(child);
      } else if (process.env.NODE_ENV === 'development' && isLegacyDisplayNameSceneElement(child)) {
        hasLegacyScene = true;
      }
    });
    return [sceneArray, hasLegacyScene] as const;
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
  // Internal-only re-grab candidate hold. This is deliberately separate from
  // isDragging/public callbacks: pointer-down may pause a live continuation,
  // but ownership does not exist until the directional gate succeeds.
  const candidateSuspendedRef = useRef(false);
  const [candidateSuspended, setCandidateSuspended] = useState(false);
  const elementContinuationScenesRef = useRef<Set<number>>(new Set());
  const blockedDirectionsThisPressRef = useRef<Set<'forward' | 'backward'>>(new Set());
  // The single global render-lane slot (D-F1/D-F7): the in-flight settle
  // page-slide or bounce tween, registered by whichever scene's drag engine
  // created it so a new gesture starting on ANY scene's engine can take it
  // over — stop it in place and scrub on from the frozen position (a rush
  // re-grab mid-slide lands the pointerdown on a different engine than the
  // lane's creator).
  const dragRenderLaneRef = useRef<DragRenderLane | null>(null);
  const dragTakeoverSnapshotRef = useRef<DragTakeoverSnapshot | null>(null);
  const dragTakeoverTokenRef = useRef(0);
  const pendingRenderRebaseRef = useRef(false);
  const preparedSceneStoreRef = useRef(new DragPreparedSceneStore());
  const [dragTransaction, setDragTransaction] = useState<DragSceneTransaction | null>(null);
  const dragTransactionRef = useRef<DragSceneTransaction | null>(null);
  const lastDragProgressRef = useRef(0);
  const pendingDragCancelRef = useRef<{ sceneIndex: number; signedProgress: number } | null>(null);
  const reportedInvalidDragConfigRef = useRef<Set<string>>(new Set());
  const hasSyncedPreloadPlanRef = useRef(false);
  const lastPreloadSignatureRef = useRef<string | null>(null);
  const activationSequenceRef = useRef(0);
  const [sceneActivations, setSceneActivations] = useState<
    ReadonlyMap<number, SceneActivationRecord>
  >(() => new Map());
  const activateScene = useCallback((sceneIndex: number, kind: SceneActivationKind): void => {
    const record: SceneActivationRecord = {
      token: ++activationSequenceRef.current,
      kind,
    };
    setSceneActivations((current) => {
      const next = new Map(current);
      next.set(sceneIndex, record);
      return next;
    });
  }, []);

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
      emitError('EMPTY_SCENES', 'CineView requires at least one Scene child.', {
        mode: resolvedRootMode,
      });
    }
  }, [emitError, resolvedRootMode, totalScenes]);

  useEffect(() => {
    if (resolvedRootMode !== 'drag') return;

    scenes.forEach((scene, sceneIndex) => {
      const sceneProps = scene.props as SceneAuthoringCompatProps;
      resolveDragTimelineConfig(dragConfig, sceneProps.drag, ({ field, value }) => {
        const dedupeKey = `${sceneIndex}:${field}`;
        if (reportedInvalidDragConfigRef.current.has(dedupeKey)) return;
        reportedInvalidDragConfigRef.current.add(dedupeKey);
        emitError('INVALID_DRAG_CONFIG', `Invalid drag ${field}; using the safe default.`, {
          sceneIndex,
          field,
          value,
        });
      });

      const enabled = sceneProps.drag?.enabled;
      if (enabled !== undefined && typeof enabled !== 'boolean') {
        const dedupeKey = `${sceneIndex}:enabled`;
        if (reportedInvalidDragConfigRef.current.has(dedupeKey)) return;
        reportedInvalidDragConfigRef.current.add(dedupeKey);
        emitError('INVALID_DRAG_CONFIG', 'Invalid drag enabled flag; using true.', {
          sceneIndex,
          field: 'enabled',
          value: enabled,
        });
      }
    });
  }, [emitError, dragConfig, resolvedRootMode, scenes]);

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
      resolvedCallbacks.common?.onSceneEnter?.(detail);
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
      resolvedCallbacks.common?.onSceneLeave?.(detail);
    },
    [resolvedCallbacks]
  );

  // 场景管理
  const [sceneState, sceneActions] = useSceneManager({
    totalScenes,
    initialScene: 0,
    mode: resolvedRootMode,
    onBeforeChange: emitSceneWillChange,
    onCommit: (sceneIndex, _previousIndex, kind) => {
      if (resolvedRootMode !== 'drag') return;
      activateScene(sceneIndex, kind === 'drag' ? 'commit' : 'programmatic');
    },
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
  const renderProgressMotion = useMotionValue(0);
  const dragTimelineProgressMotion = useMotionValue(0);

  currentSceneRef.current = currentScene;
  scenesRef.current = scenes;

  useIsomorphicLayoutEffect(() => {
    if (!pendingRenderRebaseRef.current) return;
    pendingRenderRebaseRef.current = false;
    renderProgressMotion.set(0);
    dragTimelineProgressMotion.set(0);
  }, [currentScene, dragTimelineProgressMotion, renderProgressMotion]);

  // 监听场景切换，在动画完成后调用 setAnimating(false)
  useEffect(() => {
    if (!isAnimating) return;

    // 获取当前场景的动画持续时间
    const currentSceneElement = scenes[currentScene];
    if (!currentSceneElement) return;

    const sceneProps = currentSceneElement.props as SceneAuthoringCompatProps;
    const duration = getSceneSettleDuration(sceneProps, resolvedRootMode, transitionDuration);

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
  }, [isAnimating, currentScene, scenes, sceneActions, resolvedRootMode, transitionDuration]);

  useEffect(() => {
    if (resolvedRootMode === 'drag') return;
    dragSessionActiveRef.current = false;
    candidateSuspendedRef.current = false;
    setCandidateSuspended(false);
    elementContinuationScenesRef.current.clear();
    blockedDirectionsThisPressRef.current.clear();
    lastDragProgressRef.current = 0;
    pendingDragCancelRef.current = null;
    const transaction = dragTransactionRef.current;
    if (transaction) {
      preparedSceneStoreRef.current.releaseTransaction(transaction.transactionId);
      dragTransactionRef.current = null;
      setDragTransaction(null);
    }
  }, [resolvedRootMode]);

  const activateDragTransaction = useCallback(
    (next: DragSceneTransaction | null): DragSceneTransaction | null => {
      if (!next) return null;
      const previous = dragTransactionRef.current;
      const shouldPublish =
        !previous || previous.transactionId !== next.transactionId || previous.phase !== next.phase;
      if (previous && previous.transactionId !== next.transactionId) {
        preparedSceneStoreRef.current.releaseTransaction(previous.transactionId);
      }
      dragTransactionRef.current = next;
      if (shouldPublish) {
        setDragTransaction(next);
      }
      return next;
    },
    []
  );

  const releaseActiveDragTransaction = useCallback((transactionId?: symbol): void => {
    const current = dragTransactionRef.current;
    if (!current || (transactionId && current.transactionId !== transactionId)) return;
    preparedSceneStoreRef.current.releaseTransaction(current.transactionId);
    dragTransactionRef.current = null;
    setDragTransaction(null);
  }, []);

  const handlePreparedScene = useCallback((snapshot: PreparedSceneSnapshot): void => {
    preparedSceneStoreRef.current.publishPrepared(snapshot);
  }, []);

  const handlePreparedSceneInvalidated = useCallback(
    (invalidation: PreparedSceneInvalidation): void => {
      preparedSceneStoreRef.current.invalidatePrepared(invalidation);
    },
    []
  );

  const handleElementContinuationChange = useCallback(
    (sceneIndex: number, active: boolean): void => {
      if (active) {
        elementContinuationScenesRef.current.add(sceneIndex);
      } else {
        elementContinuationScenesRef.current.delete(sceneIndex);
      }
    },
    []
  );

  const handlePointerSessionStart = useCallback((): void => {
    blockedDirectionsThisPressRef.current.clear();
  }, []);

  const handleDragCandidateSuspension = useCallback(
    (suspended: boolean): boolean => {
      if (!suspended) {
        candidateSuspendedRef.current = false;
        setCandidateSuspended(false);
        // Tap/cancel/rejected ownership never receives an authoritative base.
        // A successful owner writes baseRatio synchronously before clearing the hold.
        if (dragTakeoverSnapshotRef.current?.baseRatio === null) {
          dragTakeoverSnapshotRef.current = null;
        }
        return false;
      }

      if (resolvedRootMode !== 'drag') return false;
      const hasContinuation =
        dragRenderLaneRef.current !== null || elementContinuationScenesRef.current.size > 0;
      if (!hasContinuation) return false;

      dragTakeoverSnapshotRef.current = {
        token: ++dragTakeoverTokenRef.current,
        sceneIndices: [...elementContinuationScenesRef.current],
        staleRatio: dragTimelineProgressMotion.get(),
        baseRatio: null,
      };
      candidateSuspendedRef.current = true;
      setCandidateSuspended(true);
      return true;
    },
    [dragTimelineProgressMotion, resolvedRootMode]
  );

  const abortSupersededTransaction = useCallback(
    (nextTargetSceneIndex: number | null): void => {
      const previous = dragTransactionRef.current;
      if (!previous || previous.targetSceneIndex === nextTargetSceneIndex) return;

      // Retarget is an internal transaction terminal, not a pointer-session
      // terminal. Stop waiting for the old element arm before its frozen source is
      // released; otherwise the old join can never close after replacement.
      sceneActions.abortDragContinuation();
      elementContinuationScenesRef.current.delete(previous.targetSceneIndex);
    },
    [sceneActions]
  );

  const handleDragOwnershipRequest = useCallback(
    (direction: 'forward' | 'backward'): boolean => {
      if (resolvedRootMode !== 'drag') return false;
      const isReGrab = candidateSuspendedRef.current;
      const hadActiveSession = dragSessionActiveRef.current;
      if (hadActiveSession && !isReGrab) return false;

      const fromIndex = currentSceneRef.current;
      const targetSceneIndex = fromIndex + (direction === 'forward' ? 1 : -1);
      const isPhysicalBoundary = targetSceneIndex < 0 || targetSceneIndex >= totalScenes;

      if (!isPhysicalBoundary) {
        const targetScene = scenes[targetSceneIndex];
        const targetProps = targetScene?.props as SceneAuthoringCompatProps | undefined;
        if (targetProps?.drag?.enabled === false) {
          if (!blockedDirectionsThisPressRef.current.has(direction)) {
            blockedDirectionsThisPressRef.current.add(direction);
            resolvedCallbacksRef.current.drag?.onDragBlocked?.({
              fromIndex,
              targetSceneIndex,
              direction,
            });
          }
          return false;
        }

        const prepared = preparedSceneStoreRef.current.getPrepared(targetSceneIndex);
        if (!prepared) {
          devWarn(
            `Drag ${direction} from Scene ${fromIndex} was not acquired because target Scene ${targetSceneIndex} is not internally ready.`
          );
          return false;
        }

        const transaction = preparedSceneStoreRef.current.beginTransaction(
          targetSceneIndex,
          'driving',
          0
        );
        if (!transaction) return false;
        abortSupersededTransaction(targetSceneIndex);
        if (!activateDragTransaction(transaction)) return false;
      } else if (isReGrab) {
        // Boundary ownership still permanently preempts the held continuation,
        // but deliberately creates no element transaction.
        abortSupersededTransaction(null);
        releaseActiveDragTransaction();
      }

      // Clear the hold synchronously at the ownership boundary. The engine also
      // publishes false after this callback; keeping this local makes the root
      // invariant independent of callback ordering and Framer/native hand-off.
      candidateSuspendedRef.current = false;
      setCandidateSuspended(false);

      if (!hadActiveSession) {
        dragSessionActiveRef.current = true;
        lastDragProgressRef.current = 0;
        pendingDragCancelRef.current = null;
        resolvedCallbacksRef.current.drag?.onDragStart?.({
          sceneIndex: fromIndex,
          progress: 0,
          direction,
        });
      }
      return true;
    },
    [
      abortSupersededTransaction,
      activateDragTransaction,
      releaseActiveDragTransaction,
      resolvedRootMode,
      scenes,
      totalScenes,
    ]
  );

  const handleDragProgressChange = useCallback(
    (progress: number): void => {
      if (resolvedRootMode !== 'drag' || !dragSessionActiveRef.current) return;

      const signedProgress = progress === 0 ? 0 : clamp(progress, -1, 1);
      if (signedProgress === lastDragProgressRef.current) return;

      lastDragProgressRef.current = signedProgress;
      if (signedProgress !== 0) {
        const targetSceneIndex = currentSceneRef.current + (signedProgress > 0 ? 1 : -1);
        // A physical boundary owns only the render rubber-band. Never let an
        // out-of-range target reach the prepared transaction store.
        if (targetSceneIndex >= 0 && targetSceneIndex < totalScenes) {
          const transaction = preparedSceneStoreRef.current.beginTransaction(
            targetSceneIndex,
            'driving',
            Math.abs(signedProgress)
          );
          if (transaction) {
            abortSupersededTransaction(targetSceneIndex);
            activateDragTransaction(transaction);
          }
        }
      }
      resolvedCallbacksRef.current.drag?.onDragProgress?.({
        sceneIndex: currentSceneRef.current,
        progress: Math.abs(signedProgress),
        direction: signedProgress > 0 ? 'forward' : signedProgress < 0 ? 'backward' : null,
      });
    },
    [abortSupersededTransaction, activateDragTransaction, resolvedRootMode, totalScenes]
  );

  const handleDraggingChange = useCallback(
    (dragging: boolean): void => {
      if (!dragging) {
        dragTakeoverSnapshotRef.current = null;
      }
      sceneActions.setIsDragging(dragging);
    },
    [sceneActions]
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

  // The manager injects the release token and also creates programmatic `enter`
  // directives internally, so the committed state is the single phase authority.
  useEffect(() => {
    if (resolvedRootMode !== 'drag') return;
    if (dragRelease) {
      const phase =
        dragRelease.mode === 'settle'
          ? 'settling'
          : dragRelease.mode === 'bounce'
            ? 'bouncing'
            : 'programmatic';
      activateDragTransaction(
        preparedSceneStoreRef.current.beginTransaction(
          dragRelease.targetSceneIndex,
          phase,
          dragRelease.mode === 'enter' ? 0 : (dragRelease.progressRatio ?? 0)
        )
      );
      return;
    }

    if (dragTransactionRef.current?.phase !== 'driving') {
      releaseActiveDragTransaction();
    }
  }, [activateDragTransaction, dragRelease, releaseActiveDragTransaction, resolvedRootMode]);

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

    // A post-commit settle survives a tap/reset until the incoming element arm
    // completes. Driving/bouncing transactions are terminal on reset.
    if (dragTransactionRef.current?.phase !== 'settling') {
      releaseActiveDragTransaction();
    }
    renderProgressMotion.set(0);
    dragTimelineProgressMotion.set(0);
    sceneActions.resetDragInteraction();
  }, [
    dragTimelineProgressMotion,
    releaseActiveDragTransaction,
    renderProgressMotion,
    resolvedRootMode,
    sceneActions,
  ]);

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
  const firstSceneTimeoutMs = Math.max(0, firstSceneTimeout ?? 3000);
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
    firstSceneActivationToken,
    firstSceneActivationKind,
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
  const consumedFirstSceneActivationRef = useRef(0);
  useEffect(() => {
    if (
      resolvedRootMode !== 'drag' ||
      firstSceneActivationToken <= consumedFirstSceneActivationRef.current ||
      firstSceneActivationKind === null
    ) {
      return;
    }
    consumedFirstSceneActivationRef.current = firstSceneActivationToken;
    activateScene(0, firstSceneActivationKind);
  }, [activateScene, firstSceneActivationKind, firstSceneActivationToken, resolvedRootMode]);

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
    if (!monitor) {
      return;
    }

    return acquirePerformanceMonitoring();
  }, [monitor]);

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
      const targetSceneIndex =
        direction === 'forward' ? activeSceneIndex + 1 : activeSceneIndex - 1;

      if (resolvedRootMode !== 'drag') {
        if (direction === 'forward') sceneActions.nextScene();
        else sceneActions.prevScene();
        return;
      }

      const transaction = dragTransactionRef.current;
      const capturedTransaction =
        transaction?.targetSceneIndex === targetSceneIndex ? transaction : null;
      const normalizedDragProgress = capturedTransaction
        ? capturedTransaction.releaseSeed.progressRatio
        : Math.max(0, Math.min(progressRatio ?? dragTimelineProgressMotion.get(), 1));
      const elapsedMs = capturedTransaction
        ? capturedTransaction.releaseSeed.elapsedMs
        : Math.max(0, committedElapsedMs ?? 0);
      const timelineDurationMs = capturedTransaction
        ? capturedTransaction.registrySnapshot.timelineDuration
        : Math.max(0, timelineDuration ?? 0);

      dragSessionActiveRef.current = false;
      lastDragProgressRef.current = 0;
      pendingDragCancelRef.current = null;
      resolvedCallbacksRef.current.drag?.onDragEnd?.({
        sceneIndex: activeSceneIndex,
        targetSceneIndex,
        progress: normalizedDragProgress,
        direction,
        elapsedMs,
        timelineDurationMs,
      });
      pendingRenderRebaseRef.current = true;
      sceneActions.commitDragSceneChange(
        direction,
        normalizedDragProgress,
        elapsedMs,
        timelineDurationMs
      );
      // The transaction remains alive across the render commit. The incoming
      // element track releases it only after reaching the captured T_self.
    },
    [sceneActions, currentScene, dragTimelineProgressMotion, resolvedRootMode]
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

      // 设计稿尺寸校验已并入 resolveDesignDimensions（兜底 750 并对显式非法值
      // console.error），designSize <= 0 在此不可达；性能监控由上方专用 effect
      // 负责 start/stop（此处曾有一个无 stop 的重复 start，已删）。
    }
  }, [hasLegacyDisplayNameScene, totalScenes]);

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
      scrollEnterMargin: undefined,
      scrollExitMargin: undefined,
      reportError: (detail): void => {
        emitError(detail.code as CineViewErrorCode, detail.message, detail.context);
      },
    }),
    [resolvedRootMode, emitError]
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
              dragConfig={dragConfig}
              dragProgress={dragProgress}
              dragTimelineProgress={dragTimelineProgress}
              renderProgress={renderProgress}
              renderProgressMotion={renderProgressMotion}
              timelineProgressMotion={dragTimelineProgressMotion}
              isDragging={isDragging}
              sharedTimelineDurationMs={sharedTimelineDurationMs}
              dragRelease={dragRelease}
              sceneActivations={sceneActivations}
              firstSceneEnterActive={firstSceneEnterActive}
              firstSceneEnterReady={firstSceneEnterReady}
              direction={direction}
              isAnimating={isAnimating}
              viewportWidth={viewportWidth}
              viewportHeight={viewportHeight}
              sceneActions={sceneActions}
              sceneWrapperRefs={sceneWrapperRefs}
              renderLaneRef={dragRenderLaneRef}
              takeoverSnapshot={dragTakeoverSnapshotRef}
              candidateSuspended={candidateSuspended}
              onCandidateSuspensionChange={handleDragCandidateSuspension}
              onElementContinuationChange={handleElementContinuationChange}
              onPointerSessionStart={handlePointerSessionStart}
              dragTransaction={dragTransaction}
              onPrepared={handlePreparedScene}
              onPreparedInvalidated={handlePreparedSceneInvalidated}
              onOwnershipRequest={handleDragOwnershipRequest}
              onTransactionComplete={releaseActiveDragTransaction}
              onSceneChange={handleSceneChange}
              onDragProgressChange={handleDragProgressChange}
              onRenderProgressChange={undefined}
              onDragTimelineProgressChange={(progress) => dragTimelineProgressMotion.set(progress)}
              onDraggingChange={handleDraggingChange}
              onSharedTimelineDurationChange={sceneActions.setSharedTimelineDurationMs}
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

/**
 * drag 引擎根组件。导出是为了让 UMD 能按 mode 拆成单引擎产物
 * （见 task-flow `2026-08-04-umd-mode-split.md`：scroll 引擎独占 UMD 包的 20.3%，
 * 只用 drag 的 script-tag 消费者不该白背它）。
 * 不从 barrel 再导出：公共 API 仍只有 `CineView` + `mode` prop。
 */
export const CineViewDragEngine = DragCineViewComponent;

/**
 * ⚠️ mode 派发器**不在本文件**，见 `CineViewDispatch.tsx`。
 *
 * 原本这里有个 5 行派发器同时静态 import 两套引擎，导致**任何到达本文件的路径都会拖进
 * 两套引擎**。UMD 必须单文件（Rollup 拒绝 UMD 代码拆分），于是只用 drag 的 script-tag
 * 消费者白背 scroll 引擎的 gzip 10437 字节（全包 20.3%），把包顶破 50 KB 门。
 * 把派发器移出后，本文件只含 drag 引擎，`entry-drag.ts` 才能真正不含 scroll。
 * 实测教训：只加入口文件、不搬派发器时，drag 产物是 51937 字节（比全量还大）。
 * 详见 task-flow `2026-08-04-umd-mode-split.md`。
 */
