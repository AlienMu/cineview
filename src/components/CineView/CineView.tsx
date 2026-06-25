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
  isValidElement,
} from 'react';
import { CineViewProvider } from '../../context/CineViewContext';
import { useSceneManager } from '../../hooks/useSceneManager';
import { useImagePreloader } from '../../hooks/useImagePreloader';
import { performanceMonitor } from '../../utils/performanceMonitor';
import { DirectScrollCineView } from './DirectScrollCineView';
import { getScenePreloadImages, resolveScenePreloadTargetImages } from './preloadTargets';
import { CineViewRuntimeContext } from './runtimeContext';
import {
  SceneScrollRuntimeContext,
  type SceneScrollTimelineState,
} from '../Scene/sceneScrollRuntime';
import {
  areResolvedSceneScrollSequencesEqual,
  resolveSceneScrollAnimationBudgets,
  type SceneScrollAnimationRegistration,
} from '../Scene/sceneScrollBudget';
import type {
  AnimationType,
  CineViewPreloadTarget,
  CineViewProps,
  CineViewRef,
  CineViewCallbacks,
  CineViewPerformanceConfig,
  PerformanceMetrics,
  SceneChangeDetail,
  SceneProps,
  SceneVisibilityDetail,
  ScrollMode,
  ScrollModeConfig,
  ScrollTimelineState,
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

function isScrollDebugEnabled(): boolean {
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') {
    return false;
  }

  return Boolean(
    (window as Window & { __CINEVIEW_SCROLL_DEBUG__?: boolean }).__CINEVIEW_SCROLL_DEBUG__
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeWheelDeltaPx(delta: number, deltaMode: number, viewportSpan: number): number {
  if (!Number.isFinite(delta) || delta === 0) {
    return 0;
  }

  const safeViewportSpan = Math.max(viewportSpan, 1);
  if (deltaMode === 1) {
    return delta * 18;
  }

  if (deltaMode === 2) {
    return delta * safeViewportSpan;
  }

  return delta;
}

function normalizeTouchDeltaPx(delta: number): number {
  if (!Number.isFinite(delta) || delta === 0) {
    return 0;
  }

  return delta;
}

function resolveDesignDimensions(config: CineViewProps['config']): {
  designWidth: number;
  designHeight: number;
  unit: NonNullable<CineViewProps['config']['unit']>;
} {
  const designWidth = config.width ?? 750;
  const designHeight = config.height ?? 1334;

  return {
    designWidth,
    designHeight,
    unit: config.unit ?? 'px',
  };
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

function getSceneTransitionConfig(sceneProps: SceneAuthoringCompatProps): {
  enterAnimation?: SceneAuthoringCompatProps['enterAnimation'];
  exitAnimation?: SceneAuthoringCompatProps['exitAnimation'];
  transitionDurationMs: number;
  scrollEnterLength?: number;
  scrollExitLength?: number;
} {
  return {
    enterAnimation: sceneProps.transition?.enterAnimation ?? sceneProps.enterAnimation,
    exitAnimation: sceneProps.transition?.exitAnimation ?? sceneProps.exitAnimation,
    transitionDurationMs: sceneProps.sceneTransitionDuration ?? 800,
    scrollEnterLength: sceneProps.scrollEnterLength,
    scrollExitLength: sceneProps.scrollExitLength,
  };
}

export function resolveRootSceneStackMode(
  sceneProps: SceneAuthoringCompatProps,
  rootMode: ScrollMode
): 'replace' | 'cover' {
  return sceneProps.stack?.mode ?? (rootMode === 'scroll' ? 'cover' : 'replace');
}

function shouldIgnoreSceneMeasurementNode(element: HTMLElement): boolean {
  return Boolean(
    element.dataset.sceneMeasureIgnore !== undefined ||
    element.closest('[data-scene-measure-ignore]') ||
    element.dataset.sceneFixedHost !== undefined ||
    element.closest('[data-scene-fixed-host]') ||
    element.dataset.sceneFixedLayer !== undefined ||
    element.closest('[data-scene-fixed-layer]')
  );
}

function getRelativeLayoutOffset(
  element: HTMLElement,
  ancestor: HTMLElement,
  direction: 'x' | 'y'
): number {
  let offset = 0;
  let current: HTMLElement | null = element;

  while (current && current !== ancestor) {
    offset += direction === 'x' ? current.offsetLeft : current.offsetTop;
    const next: Element | null = current.offsetParent;
    current = next instanceof HTMLElement ? next : null;
  }

  if (current === ancestor) {
    return offset;
  }

  const ancestorRect = ancestor.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  return direction === 'x'
    ? elementRect.left - ancestorRect.left
    : elementRect.top - ancestorRect.top;
}

function measureSceneContentHeight(node: HTMLDivElement): number {
  const nodeStyle = typeof window !== 'undefined' ? window.getComputedStyle(node) : null;
  const isViewportFillSceneWrapper =
    nodeStyle?.position === 'absolute' &&
    nodeStyle.top === '0px' &&
    nodeStyle.right === '0px' &&
    nodeStyle.bottom === '0px' &&
    nodeStyle.left === '0px';
  let maxBottom = isViewportFillSceneWrapper
    ? 1
    : Math.max(node.offsetHeight, node.scrollHeight, 1);
  const descendants = node.querySelectorAll<HTMLElement>('*');

  descendants.forEach((element) => {
    if (shouldIgnoreSceneMeasurementNode(element)) {
      return;
    }

    const relativeLeft = getRelativeLayoutOffset(element, node, 'x');
    const relativeTop = getRelativeLayoutOffset(element, node, 'y');
    const isFillScaffold =
      relativeLeft === 0 &&
      relativeTop === 0 &&
      Math.abs(element.offsetWidth - node.offsetWidth) <= 1 &&
      Math.abs(element.offsetHeight - node.offsetHeight) <= 1;
    if (isFillScaffold) {
      return;
    }

    const relativeBottom = relativeTop + Math.max(element.offsetHeight, element.clientHeight, 0);
    if (Number.isFinite(relativeBottom)) {
      maxBottom = Math.max(maxBottom, relativeBottom);
    }
  });

  return Math.max(maxBottom, 1);
}

function getSceneMeasurementTargets(node: HTMLDivElement): HTMLElement[] {
  const targets: HTMLElement[] = [node];

  Array.from(node.children).forEach((child) => {
    if (!(child instanceof HTMLElement) || shouldIgnoreSceneMeasurementNode(child)) {
      return;
    }

    targets.push(child);
  });

  return targets;
}

function resolveScrollSceneDeclaredSpan(
  sceneProps: SceneAuthoringCompatProps,
  direction: 'x' | 'y',
  viewportWidth: number,
  viewportHeight: number
): number | null {
  const rawSize =
    direction === 'x'
      ? (sceneProps.layout?.width ?? sceneProps.sceneWidth)
      : (sceneProps.layout?.height ?? sceneProps.sceneHeight);

  if (typeof rawSize === 'number' && Number.isFinite(rawSize) && rawSize > 0) {
    return rawSize;
  }

  if (typeof rawSize !== 'string') {
    return null;
  }

  const value = rawSize.trim().toLowerCase();
  if (!value || value === 'auto') {
    return null;
  }

  const numericValue = Number.parseFloat(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  if (value.endsWith('px')) {
    return numericValue;
  }

  if (value.endsWith('vh')) {
    return (viewportHeight * numericValue) / 100;
  }

  if (value.endsWith('vw')) {
    return (viewportWidth * numericValue) / 100;
  }

  return null;
}

export function resolveActiveViewportId(
  zoneRegistry: Map<
    string,
    {
      sceneIndex: number;
      trigger: 'center-lock';
      element: HTMLElement | null;
    }
  >,
  activeSceneIndex: number,
  rootRect: DOMRect,
  viewportHeight: number,
  zoneStates?: Record<string, SceneScrollTimelineState>,
  previousActiveZoneId?: string | null,
  direction: 'x' | 'y' = 'y'
): string | null {
  const viewportCenter =
    direction === 'x'
      ? rootRect.left + Math.max(viewportHeight, 1) / 2
      : rootRect.top + Math.max(viewportHeight, 1) / 2;
  const activationThreshold = Math.min(Math.max(Math.max(viewportHeight, 1) * 0.06, 24), 72);
  const stickyState = previousActiveZoneId ? zoneStates?.[previousActiveZoneId] : null;
  const stickyMeta = previousActiveZoneId ? zoneRegistry.get(previousActiveZoneId) : null;

  if (
    previousActiveZoneId &&
    stickyState &&
    stickyMeta &&
    stickyMeta.sceneIndex === activeSceneIndex &&
    stickyMeta.element &&
    stickyState.progressPx > 0.001 &&
    stickyState.progressPx < stickyState.totalBudgetPx - 0.001
  ) {
    const stickyRect = stickyMeta.element.getBoundingClientRect();
    const stickyVisible =
      direction === 'x'
        ? stickyRect.right > rootRect.left && stickyRect.left < rootRect.right
        : stickyRect.bottom > rootRect.top && stickyRect.top < rootRect.bottom;
    if (stickyVisible) {
      return previousActiveZoneId;
    }
  }

  let activeZoneId: string | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  zoneRegistry.forEach((meta, zoneId) => {
    if (meta.sceneIndex !== activeSceneIndex || !meta.element) {
      return;
    }

    const rect = meta.element.getBoundingClientRect();
    const isOutOfView =
      direction === 'x'
        ? rect.right <= rootRect.left || rect.left >= rootRect.right
        : rect.bottom <= rootRect.top || rect.top >= rootRect.bottom;
    if (isOutOfView) {
      return;
    }

    const center = direction === 'x' ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
    const distance = Math.abs(center - viewportCenter);
    if (distance <= activationThreshold && distance < nearestDistance) {
      nearestDistance = distance;
      activeZoneId = zoneId;
    }
  });

  return activeZoneId;
}

/**
 * CineView 组件实现
 */
const DragCineViewComponent = forwardRef<CineViewRef, CineViewProps>((props, ref) => {
  const { config, mode, modes, scrollbar, callbacks, performance, children } = props;

  const { designWidth, designHeight, unit } = resolveDesignDimensions(config);

  // 场景引用存储（使用 WeakMap 避免内存泄漏）
  // Validates Requirement 26.2: Use WeakMap to store component references
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneWrapperRefs = useRef<Array<HTMLDivElement | null>>([]);
  const scrollTouchRef = useRef<{ x: number; y: number } | null>(null);
  const currentSceneRef = useRef(0);
  const lastReportedScrollSceneRef = useRef(0);
  const lastSceneWillChangeFromRef = useRef<number | null>(null);
  const scenesRef = useRef<React.ReactElement[]>([]);
  const measureViewportRef = useRef<(() => void) | null>(null);
  const measureSceneHeightsRef = useRef<(() => void) | null>(null);
  const nativeScrollOffsetRef = useRef(0);

  // Track cleanup timers to clear on unmount
  // Validates Requirement 26.5: Clean up timers on unmount
  const cleanupTimersRef = useRef<Set<NodeJS.Timeout>>(new Set());

  // 收集所有 Scene 子组件
  const scenes = useMemo(() => {
    const sceneArray: React.ReactElement[] = [];
    Children.forEach(children, (child) => {
      if (
        isValidElement(child) &&
        child.type &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (child.type as any).displayName === 'Scene'
      ) {
        sceneArray.push(child);
      }
    });
    return sceneArray;
  }, [children]);

  const totalScenes = scenes.length;
  const resolvedRootMode = useMemo<ScrollMode>(() => resolveRootMode(mode), [mode]);
  const isRootScrollMode = false;
  const resolvedScrollConfig = useMemo<ScrollModeConfig>(
    () => ({
      direction: modes?.scroll?.direction,
      zoneTrigger: modes?.scroll?.zoneTrigger ?? 'center-lock',
      sceneSizing: modes?.scroll?.sceneSizing ?? 'content',
    }),
    [modes?.scroll]
  );
  const resolvedScrollDirection = resolvedScrollConfig.direction ?? 'y';
  const resolvedCallbacks = useMemo<CineViewCallbacks>(
    () => ({
      ...callbacks,
      common: {
        ...callbacks?.common,
        onReady: callbacks?.common?.onReady,
        onLoadProgress: callbacks?.common?.onLoadProgress,
      },
    }),
    [callbacks]
  );
  const resolvedCallbacksRef = useRef(resolvedCallbacks);
  const lastInteractionStateRef = useRef<string | null>(null);
  const dragSessionActiveRef = useRef(false);
  const lastDragProgressRef = useRef(0);
  const lastZoneStatesRef = useRef<Record<string, SceneScrollTimelineState>>({});
  const lastMeasuredLayoutRef = useRef<{ width: number; height: number } | null>(null);
  const previousRootModeRef = useRef<ScrollMode | null>(null);
  const hasSyncedAdjacentPreloadRef = useRef(false);
  const lastAdjacentPreloadSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    resolvedCallbacksRef.current = resolvedCallbacks;
  }, [resolvedCallbacks]);

  const emitError = useCallback(
    (code: string, message: string, context?: Record<string, unknown>): void => {
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
    (code: string, message: string, context?: Record<string, unknown>): boolean => {
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
  const initialVirtualScroll = 0;
  const [virtualScroll, setVirtualScroll] = useState(initialVirtualScroll);
  const [virtualScrollDirection, setVirtualScrollDirection] = useState<
    'forward' | 'backward' | null
  >(null);
  const [virtualScrolling, setVirtualScrolling] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [sceneHeights, setSceneHeights] = useState<number[]>([]);
  const [zoneStates, setZoneStates] = useState<Record<string, SceneScrollTimelineState>>({});
  const [zoneStateVersion, setZoneStateVersion] = useState(0);
  const virtualScrollRef = useRef(initialVirtualScroll);
  const hasInitializedScrollRef = useRef(false);
  const virtualScrollIdleTimerRef = useRef<number | null>(null);
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
  const zoneStatesRef = useRef<Record<string, SceneScrollTimelineState>>({});

  const scrollViewportSpan = resolvedScrollDirection === 'x' ? viewportWidth : viewportHeight;

  const scrollSceneLayout = useMemo(() => {
    let cursor = 0;

    return scenes.map((scene, index) => {
      const sceneProps = scene.props as SceneAuthoringCompatProps;
      const measuredHeight = sceneHeights[index];
      const declaredSpan = resolveScrollSceneDeclaredSpan(
        sceneProps,
        resolvedScrollDirection,
        viewportWidth,
        viewportHeight
      );
      const fallbackSpan = Math.max(scrollViewportSpan, 1);
      const measuredSpan = Math.max(measuredHeight ?? declaredSpan ?? 0, 0);
      const height =
        resolvedScrollConfig.sceneSizing === 'screen'
          ? Math.max(measuredSpan, fallbackSpan, 1)
          : Math.max(measuredSpan, 1);
      const transitionConfig = getSceneTransitionConfig(sceneProps);
      const sceneStart = cursor;
      const sceneEnd = sceneStart + height;
      const hasEnter = Boolean(
        transitionConfig.enterAnimation && transitionConfig.enterAnimation !== 'none' && index > 0
      );
      const hasExit = Boolean(
        transitionConfig.exitAnimation &&
        transitionConfig.exitAnimation !== 'none' &&
        index < totalScenes - 1
      );
      const requestedEnterLength = Math.max(
        0,
        transitionConfig.scrollEnterLength ?? (hasEnter ? transitionConfig.transitionDurationMs : 0)
      );
      const requestedExitLength = Math.max(
        0,
        transitionConfig.scrollExitLength ?? (hasExit ? transitionConfig.transitionDurationMs : 0)
      );
      const maxPhaseLength = Math.max(Math.min(height, scrollViewportSpan || height || 1), 1);
      const enterLength = Math.min(requestedEnterLength, maxPhaseLength);
      const exitLength = Math.min(requestedExitLength, maxPhaseLength);
      const holdLength = Math.max(height - enterLength - exitLength, 0);
      cursor = sceneEnd;

      return {
        index,
        sceneStart,
        sceneEnd,
        height,
        enterLength,
        holdLength,
        exitLength,
      };
    });
  }, [
    resolvedScrollConfig.sceneSizing,
    resolvedScrollDirection,
    sceneHeights,
    scenes,
    totalScenes,
    scrollViewportSpan,
    viewportWidth,
    viewportHeight,
  ]);

  const maxVirtualScroll = useMemo(() => {
    const lastLayout = scrollSceneLayout[scrollSceneLayout.length - 1];
    return Math.max((lastLayout?.sceneEnd ?? 0) - Math.max(scrollViewportSpan, 1), 0);
  }, [scrollSceneLayout, scrollViewportSpan]);
  const minVirtualScroll = 0;
  const updateZoneStatesRef = useCallback(
    (nextStates: Record<string, SceneScrollTimelineState>): void => {
      const previousEntries = Object.entries(zoneStatesRef.current);
      const nextEntries = Object.entries(nextStates);
      const isSame =
        previousEntries.length === nextEntries.length &&
        nextEntries.every(([zoneId, nextState]) => {
          const previousState = zoneStatesRef.current[zoneId];
          return (
            previousState &&
            previousState.progressPx === nextState.progressPx &&
            previousState.totalBudgetPx === nextState.totalBudgetPx &&
            previousState.active === nextState.active &&
            previousState.direction === nextState.direction &&
            previousState.sceneIndex === nextState.sceneIndex &&
            areResolvedSceneScrollSequencesEqual(previousState.sequence, nextState.sequence)
          );
        });

      if (isSame) {
        return;
      }

      zoneStatesRef.current = nextStates;
      setZoneStates(nextStates);
      setZoneStateVersion((version) => version + 1);
    },
    []
  );

  const resolveZoneGlobalSegments = useCallback(() => {
    if (!isRootScrollMode) {
      return [];
    }

    const viewportSpan = Math.max(scrollViewportSpan, 1);

    const segments = Object.values(zoneStatesRef.current)
      .map((state) => {
        const meta = zoneRegistryRef.current.get(state.zoneId);
        const sceneLayout = scrollSceneLayout[state.sceneIndex];
        const sceneWrapper = sceneWrapperRefs.current[state.sceneIndex];
        if (!meta?.element || !sceneLayout || !sceneWrapper || state.totalBudgetPx <= 0) {
          return null;
        }

        const zoneOffsetWithinScene = getRelativeLayoutOffset(
          meta.element,
          sceneWrapper,
          resolvedScrollDirection
        );
        const zoneSpan =
          resolvedScrollDirection === 'x'
            ? Math.max(meta.element.offsetWidth, meta.element.clientWidth, 0)
            : Math.max(meta.element.offsetHeight, meta.element.clientHeight, 0);
        const rawAnchor =
          sceneLayout.sceneStart + zoneOffsetWithinScene + zoneSpan / 2 - viewportSpan / 2;
        const anchorFloor = sceneLayout.sceneStart;
        const anchorCeiling = Math.max(
          Math.min(sceneLayout.sceneEnd - viewportSpan, maxVirtualScroll),
          anchorFloor
        );
        const anchorOffset = clamp(rawAnchor, anchorFloor, anchorCeiling);

        return {
          zoneId: state.zoneId,
          sceneIndex: state.sceneIndex,
          anchorOffset,
          budget: state.totalBudgetPx,
        };
      })
      .filter(
        (
          segment
        ): segment is {
          zoneId: string;
          sceneIndex: number;
          anchorOffset: number;
          budget: number;
        } => segment !== null
      )
      .sort((left, right) => left.anchorOffset - right.anchorOffset);

    let consumedBudget = 0;

    return segments.map((segment) => {
      const globalStart = clamp(
        segment.anchorOffset + consumedBudget,
        minVirtualScroll,
        Number.MAX_SAFE_INTEGER
      );
      const globalEnd = globalStart + segment.budget;
      consumedBudget += segment.budget;

      return {
        ...segment,
        globalStart,
        globalEnd,
      };
    });
  }, [
    isRootScrollMode,
    maxVirtualScroll,
    minVirtualScroll,
    resolvedScrollDirection,
    scrollSceneLayout,
    scrollViewportSpan,
  ]);

  const resolveUnclampedGlobalOffsetForVisualOffset = useCallback(
    (visualOffset: number): number => {
      const clampedVisualOffset = clamp(visualOffset, minVirtualScroll, maxVirtualScroll);
      const consumedBudget = resolveZoneGlobalSegments().reduce((total, segment) => {
        if (segment.anchorOffset <= clampedVisualOffset) {
          return total + segment.budget;
        }

        return total;
      }, 0);

      return clampedVisualOffset + consumedBudget;
    },
    [maxVirtualScroll, minVirtualScroll, resolveZoneGlobalSegments]
  );
  const maxGlobalScroll = useMemo(
    () =>
      Math.max(
        clamp(
          resolveUnclampedGlobalOffsetForVisualOffset(maxVirtualScroll),
          minVirtualScroll,
          Number.MAX_SAFE_INTEGER
        ),
        0
      ),
    [maxVirtualScroll, minVirtualScroll, resolveUnclampedGlobalOffsetForVisualOffset]
  );
  const nativeScrollSpan = useMemo(
    () => Math.max(maxGlobalScroll + Math.max(scrollViewportSpan, 1), scrollViewportSpan),
    [maxGlobalScroll, scrollViewportSpan]
  );
  const resolveGlobalOffsetForVisualOffset = useCallback(
    (visualOffset: number): number =>
      clamp(
        resolveUnclampedGlobalOffsetForVisualOffset(visualOffset),
        minVirtualScroll,
        maxGlobalScroll
      ),
    [maxGlobalScroll, minVirtualScroll, resolveUnclampedGlobalOffsetForVisualOffset]
  );

  const syncScrollTimelineFromGlobalOffset = useCallback(
    (globalOffset: number, directionHint?: 'forward' | 'backward' | null): void => {
      if (!isRootScrollMode) {
        return;
      }

      const segments = resolveZoneGlobalSegments();
      const clampedGlobalOffset = clamp(globalOffset, minVirtualScroll, maxGlobalScroll);
      let consumedBudget = 0;
      let activeZoneId: string | null = null;
      let activeZoneProgress = 0;
      let visualOffset = clampedGlobalOffset;

      for (const segment of segments) {
        if (clampedGlobalOffset < segment.globalStart) {
          break;
        }

        if (clampedGlobalOffset <= segment.globalEnd) {
          activeZoneId = segment.zoneId;
          activeZoneProgress = clampedGlobalOffset - segment.globalStart;
          visualOffset = segment.anchorOffset;
          break;
        }

        consumedBudget += segment.budget;
      }

      if (!activeZoneId) {
        visualOffset = clamp(
          clampedGlobalOffset - consumedBudget,
          minVirtualScroll,
          maxVirtualScroll
        );
      }

      const previousStates = zoneStatesRef.current;
      const nextStates: Record<string, SceneScrollTimelineState> = {};

      Object.entries(previousStates).forEach(([zoneId, state]) => {
        const segment = segments.find((candidate) => candidate.zoneId === zoneId);
        let progressPx = 0;
        let active = false;

        if (segment) {
          if (clampedGlobalOffset < segment.globalStart) {
            progressPx = 0;
          } else if (clampedGlobalOffset > segment.globalEnd) {
            progressPx = segment.budget;
          } else {
            progressPx = activeZoneId === zoneId ? activeZoneProgress : 0;
            active = activeZoneId === zoneId;
          }
        }

        nextStates[zoneId] = {
          ...state,
          progressPx,
          active,
          direction:
            active || progressPx !== state.progressPx
              ? (directionHint ?? state.direction)
              : state.direction,
        };
      });

      virtualScrollRef.current = visualOffset;
      setVirtualScroll(visualOffset);
      updateZoneStatesRef(nextStates);
    },
    [
      isRootScrollMode,
      maxGlobalScroll,
      maxVirtualScroll,
      minVirtualScroll,
      resolveZoneGlobalSegments,
      updateZoneStatesRef,
    ]
  );

  const getScrollTimelineState = useCallback(
    (sceneIndex: number, position: number): ScrollTimelineState => {
      const layout = scrollSceneLayout[sceneIndex];
      const safeViewportHeight = Math.max(scrollViewportSpan, 1);

      if (!layout) {
        return {
          phase: 'before',
          enterProgress: 0,
          holdProgress: 0,
          exitProgress: 0,
          sceneProgress: 0,
          rangeStart: 0,
          rangeEnd: 0,
          rangeLength: 1,
          enterLength: 0,
          holdLength: 0,
          exitLength: 0,
        };
      }

      const viewportTop = position;
      const viewportBottom = position + safeViewportHeight;
      const viewportCenter = viewportTop + safeViewportHeight / 2;
      const visibleTop = Math.max(viewportTop, layout.sceneStart);
      const visibleBottom = Math.min(viewportBottom, layout.sceneEnd);
      const overlap = Math.max(visibleBottom - visibleTop, 0);
      const sceneTravel = Math.max(layout.height - safeViewportHeight, 0);
      const holdStart = layout.sceneStart + layout.enterLength;
      const exitStart = layout.sceneEnd - Math.max(layout.exitLength, 0);

      let phase: ScrollTimelineState['phase'] = 'before';
      let enterProgress = 0;
      let holdProgress = 0;
      let exitProgress = 0;

      if (viewportBottom <= layout.sceneStart) {
        phase = 'before';
      } else if (viewportTop >= layout.sceneEnd) {
        phase = 'after';
        enterProgress = layout.enterLength > 0 ? 1 : 0;
        holdProgress = layout.holdLength > 0 ? 1 : 0;
        exitProgress = layout.exitLength > 0 ? 1 : 0;
      } else if (layout.enterLength > 0 && viewportTop < holdStart) {
        phase = 'enter';
        const distanceIntoEnter = viewportBottom - layout.sceneStart;
        enterProgress = Math.max(
          0,
          Math.min(distanceIntoEnter / Math.max(layout.enterLength, 1), 1)
        );
      } else if (layout.exitLength > 0 && viewportTop >= exitStart) {
        phase = 'exit';
        exitProgress = Math.max(
          0,
          Math.min((viewportTop - exitStart) / Math.max(layout.exitLength, 1), 1)
        );
        enterProgress = layout.enterLength > 0 ? 1 : 0;
        holdProgress = layout.holdLength > 0 ? 1 : 0;
      } else {
        phase = 'hold';
        if (sceneTravel > 0) {
          holdProgress = Math.max(0, Math.min((viewportTop - holdStart) / sceneTravel, 1));
        } else {
          holdProgress = overlap > 0 ? 1 : 0;
        }
        enterProgress = layout.enterLength > 0 ? 1 : 0;
      }

      const rangeLength = Math.max(layout.height, 1);
      const sceneProgress = Math.max(
        0,
        Math.min((viewportCenter - layout.sceneStart) / rangeLength, 1)
      );

      return {
        phase,
        enterProgress,
        holdProgress,
        exitProgress,
        sceneProgress,
        rangeStart: layout.sceneStart,
        rangeEnd: layout.sceneEnd,
        rangeLength,
        enterLength: layout.enterLength,
        holdLength: layout.holdLength,
        exitLength: layout.exitLength,
      };
    },
    [scrollSceneLayout, scrollViewportSpan]
  );

  const scrollSceneStates = useMemo(
    () => scrollSceneLayout.map((_, index) => getScrollTimelineState(index, virtualScroll)),
    [scrollSceneLayout, getScrollTimelineState, virtualScroll]
  );
  const scrollViewportOffset = virtualScroll;

  const scrollActiveSceneIndex = useMemo(() => {
    if (scrollSceneLayout.length === 0) return 0;

    const viewportTop = scrollViewportOffset;
    const viewportCenter = viewportTop + Math.max(scrollViewportSpan, 1) / 2;
    const containingIndex = scrollSceneLayout.findIndex(
      (layout) => viewportCenter >= layout.sceneStart && viewportCenter < layout.sceneEnd
    );

    if (containingIndex !== -1) {
      return containingIndex;
    }

    if (viewportCenter < scrollSceneLayout[0].sceneStart) {
      return 0;
    }

    return scrollSceneLayout.length - 1;
  }, [scrollSceneLayout, scrollViewportOffset, scrollViewportSpan]);

  const syncZoneStates = useCallback((): void => {
    if (!isRootScrollMode) {
      updateZoneStatesRef({});
      return;
    }

    const nextStates: Record<string, SceneScrollTimelineState> = {};

    zoneRegistryRef.current.forEach((meta, zoneId) => {
      const registrations =
        zoneAnimationsRef.current.get(zoneId) ??
        new Map<string, SceneScrollAnimationRegistration>();
      const sequence = resolveSceneScrollAnimationBudgets(registrations);
      const previous = zoneStatesRef.current[zoneId];
      nextStates[zoneId] = {
        zoneId,
        sceneIndex: meta.sceneIndex,
        progressPx: clamp(previous?.progressPx ?? 0, 0, sequence.totalBudgetPx),
        totalBudgetPx: sequence.totalBudgetPx,
        active: previous?.active ?? false,
        direction: previous?.direction ?? null,
        sequence,
      };
    });

    updateZoneStatesRef(nextStates);
  }, [isRootScrollMode, updateZoneStatesRef]);

  const updateZoneActiveState = useCallback((): void => {
    if (!isRootScrollMode) {
      return;
    }
    syncScrollTimelineFromGlobalOffset(nativeScrollOffsetRef.current, virtualScrollDirection);
  }, [isRootScrollMode, syncScrollTimelineFromGlobalOffset, virtualScrollDirection]);

  const registerZone = useCallback(
    (
      zoneId: string,
      config: {
        sceneIndex: number;
        trigger: 'center-lock';
      }
    ) => {
      const existing = zoneRegistryRef.current.get(zoneId);
      zoneRegistryRef.current.set(zoneId, {
        ...config,
        element: existing?.element ?? null,
      });
      syncZoneStates();
    },
    [syncZoneStates]
  );

  const unregisterZone = useCallback(
    (zoneId: string) => {
      zoneRegistryRef.current.delete(zoneId);
      zoneAnimationsRef.current.delete(zoneId);
      const nextStates = { ...zoneStatesRef.current };
      delete nextStates[zoneId];
      updateZoneStatesRef(nextStates);
    },
    [updateZoneStatesRef]
  );

  const setZoneElement = useCallback(
    (zoneId: string, element: HTMLElement | null) => {
      const existing = zoneRegistryRef.current.get(zoneId);
      if (!existing) return;
      zoneRegistryRef.current.set(zoneId, {
        ...existing,
        element,
      });
      updateZoneActiveState();
    },
    [updateZoneActiveState]
  );

  const registerZoneAnimation = useCallback(
    (zoneId: string, animation: SceneScrollAnimationRegistration) => {
      const zoneAnimations =
        zoneAnimationsRef.current.get(zoneId) ??
        new Map<string, SceneScrollAnimationRegistration>();
      zoneAnimations.set(animation.animateId, animation);
      zoneAnimationsRef.current.set(zoneId, zoneAnimations);
      syncZoneStates();
    },
    [syncZoneStates]
  );

  const unregisterZoneAnimation = useCallback(
    (zoneId: string, animateId: string) => {
      const zoneAnimations = zoneAnimationsRef.current.get(zoneId);
      if (!zoneAnimations) return;
      zoneAnimations.delete(animateId);
      syncZoneStates();
    },
    [syncZoneStates]
  );

  const zoneRuntimeValue = useMemo(
    () => ({
      version: zoneStateVersion,
      zoneStates,
      registerZone,
      unregisterZone,
      setZoneElement,
      registerZoneAnimation,
      unregisterZoneAnimation,
    }),
    [
      registerZone,
      unregisterZone,
      setZoneElement,
      registerZoneAnimation,
      unregisterZoneAnimation,
      zoneStateVersion,
      zoneStates,
    ]
  );

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
    scrollProgress,
    scrollDirection,
    renderProgress,
    isDragging,
    isScrolling,
    sharedTimelineDurationMs,
    dragRelease,
    scrollTransitionSnapshot,
  } = sceneState;

  currentSceneRef.current = isRootScrollMode ? scrollActiveSceneIndex : currentScene;
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
    virtualScrollRef.current = virtualScroll;
  }, [virtualScroll]);

  useEffect(() => {
    const previousMode = previousRootModeRef.current;
    previousRootModeRef.current = resolvedRootMode;

    if (previousMode === null || previousMode === resolvedRootMode) {
      return;
    }

    sceneActions.resetDragInteraction();
    sceneActions.resetScrollInteraction();
    sceneActions.setAnimating(false);
    setScrollBackdropSceneIndex(null);
    setVirtualScrolling(false);
    setVirtualScrollDirection(null);
    setVirtualScroll(0);
    lastInteractionStateRef.current = null;
    dragSessionActiveRef.current = false;
    lastDragProgressRef.current = 0;
  }, [resolvedRootMode, sceneActions]);

  useEffect(() => {
    const interactionState = {
      mode: resolvedRootMode,
      dragging: isDragging,
      scrolling: isRootScrollMode ? virtualScrolling : isScrolling,
      animating: isAnimating,
    };
    const signature = JSON.stringify(interactionState);

    if (lastInteractionStateRef.current === signature) {
      return;
    }

    lastInteractionStateRef.current = signature;
    resolvedCallbacksRef.current.common?.onInteractionStateChange?.(interactionState);
  }, [resolvedRootMode, isDragging, isRootScrollMode, virtualScrolling, isScrolling, isAnimating]);

  useEffect(() => {
    if (viewportWidth <= 0 || viewportHeight <= 0) {
      return;
    }

    const previousLayout = lastMeasuredLayoutRef.current;
    if (previousLayout?.width === viewportWidth && previousLayout?.height === viewportHeight) {
      return;
    }

    lastMeasuredLayoutRef.current = { width: viewportWidth, height: viewportHeight };
    resolvedCallbacksRef.current.common?.onLayoutMeasured?.({
      width: viewportWidth,
      height: viewportHeight,
    });
  }, [viewportWidth, viewportHeight]);

  useEffect(() => {
    if (resolvedRootMode !== 'drag') {
      dragSessionActiveRef.current = false;
      lastDragProgressRef.current = 0;
      return;
    }

    const activeSceneIndex = isRootScrollMode ? scrollActiveSceneIndex : currentScene;
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
  }, [
    resolvedRootMode,
    isDragging,
    dragProgress,
    isRootScrollMode,
    scrollActiveSceneIndex,
    currentScene,
  ]);

  useEffect(() => {
    const previousZoneStates = lastZoneStatesRef.current;
    const nextZoneStates = zoneStates;

    Object.values(nextZoneStates).forEach((zoneState) => {
      const previousZoneState = previousZoneStates[zoneState.zoneId];
      const progress =
        zoneState.totalBudgetPx > 0
          ? Math.max(0, Math.min(zoneState.progressPx / zoneState.totalBudgetPx, 1))
          : 0;

      if (zoneState.active && !previousZoneState?.active) {
        resolvedCallbacksRef.current.scroll?.onZoneEnter?.({
          zoneId: zoneState.zoneId,
          sceneIndex: zoneState.sceneIndex,
        });
      }

      if (
        !previousZoneState ||
        previousZoneState.progressPx !== zoneState.progressPx ||
        previousZoneState.totalBudgetPx !== zoneState.totalBudgetPx
      ) {
        resolvedCallbacksRef.current.scroll?.onZoneProgress?.({
          zoneId: zoneState.zoneId,
          sceneIndex: zoneState.sceneIndex,
          progress,
        });
      }

      if (!zoneState.active && previousZoneState?.active) {
        resolvedCallbacksRef.current.scroll?.onZoneLeave?.({
          zoneId: zoneState.zoneId,
          sceneIndex: zoneState.sceneIndex,
        });
      }
    });

    Object.values(previousZoneStates).forEach((zoneState) => {
      if (!nextZoneStates[zoneState.zoneId] && zoneState.active) {
        resolvedCallbacksRef.current.scroll?.onZoneLeave?.({
          zoneId: zoneState.zoneId,
          sceneIndex: zoneState.sceneIndex,
        });
      }
    });

    lastZoneStatesRef.current = nextZoneStates;
  }, [zoneStates]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const ownerWindow = root.ownerDocument?.defaultView ?? window;
    const measureViewport = (): void => {
      const nextRect = root.getBoundingClientRect();
      const nextWidth = isRootScrollMode
        ? Math.min(nextRect.width || ownerWindow.innerWidth, ownerWindow.innerWidth)
        : nextRect.width;
      const nextHeight = isRootScrollMode
        ? Math.min(nextRect.height || ownerWindow.innerHeight, ownerWindow.innerHeight)
        : nextRect.height;
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
  }, [isRootScrollMode]);

  useEffect(() => {
    if (!isRootScrollMode) return;

    const wrappers = sceneWrapperRefs.current;
    let measureFrame: number | null = null;
    const observedTargets = new Set<HTMLElement>();

    const scheduleMeasureHeights = (): void => {
      if (typeof window === 'undefined') {
        measureHeights();
        return;
      }

      if (measureFrame !== null) {
        window.cancelAnimationFrame(measureFrame);
      }

      measureFrame = window.requestAnimationFrame(() => {
        measureFrame = null;
        measureHeights();
      });
    };

    const observeMeasureTargets = (root: HTMLElement): void => {
      if (!resizeObserver) {
        return;
      }

      getSceneMeasurementTargets(root as HTMLDivElement).forEach((element) => {
        if (observedTargets.has(element)) {
          return;
        }

        observedTargets.add(element);
        resizeObserver.observe(element);
      });
    };

    const handleSubtreeLoad = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || shouldIgnoreSceneMeasurementNode(target)) {
        return;
      }

      scheduleMeasureHeights();
    };

    const measureHeights = (): void => {
      setSceneHeights((previous) => {
        const nextHeights = scenes.map((_, index) => {
          const node = wrappers[index];
          if (node) {
            return Math.max(measureSceneContentHeight(node), 1);
          }

          // In content sizing mode, do not inflate short scenes to the viewport
          // before the first wrapper measurement arrives.
          return previous[index] ?? 1;
        });

        if (
          previous.length === nextHeights.length &&
          previous.every((value, index) => Math.abs(value - nextHeights[index]) < 0.5)
        ) {
          return previous;
        }

        return nextHeights;
      });
    };
    measureSceneHeightsRef.current = measureHeights;

    measureHeights();

    const ownerWindow =
      wrappers.find((wrapper) => wrapper?.ownerDocument?.defaultView)?.ownerDocument?.defaultView ??
      window;
    const ResizeObserverCtor =
      ownerWindow.ResizeObserver ??
      (typeof ResizeObserver !== 'undefined' ? ResizeObserver : undefined);
    const resizeObserver = ResizeObserverCtor
      ? new ResizeObserverCtor(() => {
          scheduleMeasureHeights();
        })
      : null;

    wrappers.forEach((wrapper) => {
      if (!wrapper) return;

      if (resizeObserver) {
        observeMeasureTargets(wrapper);
      }
      wrapper.addEventListener('load', handleSubtreeLoad, true);
    });

    return (): void => {
      measureSceneHeightsRef.current = null;
      if (measureFrame !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(measureFrame);
      }
      resizeObserver?.disconnect();
      observedTargets.clear();
      wrappers.forEach((wrapper) => {
        wrapper?.removeEventListener('load', handleSubtreeLoad, true);
      });
    };
  }, [isRootScrollMode, scenes]);

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

  useEffect(() => {
    if (!isRootScrollMode) return;

    if (hasInitializedScrollRef.current) return;

    const initialValue = 0;
    const root = containerRef.current;
    hasInitializedScrollRef.current = true;
    nativeScrollOffsetRef.current = initialValue;
    if (root) {
      if (resolvedScrollDirection === 'x') {
        root.scrollLeft = initialValue;
      } else {
        root.scrollTop = initialValue;
      }
    }
    if (virtualScrollRef.current === initialValue) return;

    virtualScrollRef.current = initialValue;
    setVirtualScroll(initialValue);
    setVirtualScrollDirection(null);
    setVirtualScrolling(false);
  }, [isRootScrollMode, resolvedScrollDirection]);

  useEffect(() => {
    syncZoneStates();
  }, [syncZoneStates, sceneHeights, viewportHeight, scrollSceneLayout.length]);

  useEffect(() => {
    updateZoneActiveState();
  }, [updateZoneActiveState, viewportHeight, scrollActiveSceneIndex, zoneStateVersion]);

  useEffect(() => {
    if (!isRootScrollMode) return;

    const previousIndex = lastReportedScrollSceneRef.current;
    if (previousIndex === scrollActiveSceneIndex) return;

    emitSceneWillChange(previousIndex, scrollActiveSceneIndex);
    emitSceneDidChange(scrollActiveSceneIndex, previousIndex);
    lastReportedScrollSceneRef.current = scrollActiveSceneIndex;
  }, [isRootScrollMode, scrollActiveSceneIndex, emitSceneWillChange, emitSceneDidChange]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || !isRootScrollMode) return;

    const ownerWindow = root.ownerDocument?.defaultView ?? window;

    const clearIdleTimer = (): void => {
      if (virtualScrollIdleTimerRef.current !== null) {
        ownerWindow.clearTimeout(virtualScrollIdleTimerRef.current);
        virtualScrollIdleTimerRef.current = null;
      }
    };

    const markScrolling = (): void => {
      setVirtualScrolling(true);
      clearIdleTimer();
      virtualScrollIdleTimerRef.current = ownerWindow.setTimeout(() => {
        virtualScrollIdleTimerRef.current = null;
        setVirtualScrolling(false);
      }, 120);
    };

    const readRootOffset = (): number =>
      resolvedScrollDirection === 'x' ? root.scrollLeft : root.scrollTop;

    nativeScrollOffsetRef.current = readRootOffset();

    const handleScroll = (): void => {
      const nextOffset = readRootOffset();
      const delta = nextOffset - nativeScrollOffsetRef.current;
      const resolvedDirection =
        Math.abs(delta) <= 0.001 ? virtualScrollDirection : delta > 0 ? 'forward' : 'backward';
      nativeScrollOffsetRef.current = nextOffset;
      setVirtualScrollDirection(resolvedDirection);
      syncScrollTimelineFromGlobalOffset(nextOffset, resolvedDirection);
      markScrolling();

      if (isScrollDebugEnabled()) {
        console.log('[CineViewScroll]', {
          globalOffset: nextOffset.toFixed(3),
          delta: delta.toFixed(3),
          direction: resolvedDirection,
        });
      }
    };

    root.addEventListener('scroll', handleScroll, { passive: true });

    return (): void => {
      root.removeEventListener('scroll', handleScroll);
      clearIdleTimer();
    };
  }, [
    isRootScrollMode,
    resolvedScrollDirection,
    syncScrollTimelineFromGlobalOffset,
    virtualScrollDirection,
  ]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || !isRootScrollMode) return;

    const readRootOffset = (): number =>
      resolvedScrollDirection === 'x' ? root.scrollLeft : root.scrollTop;
    const writeRootOffset = (nextOffset: number): void => {
      if (resolvedScrollDirection === 'x') {
        root.scrollLeft = nextOffset;
      } else {
        root.scrollTop = nextOffset;
      }
    };

    const applyInputDelta = (deltaPx: number): void => {
      if (Math.abs(deltaPx) <= 0.001) {
        return;
      }

      const currentOffset = readRootOffset();
      const nextOffset = clamp(currentOffset + deltaPx, minVirtualScroll, maxGlobalScroll);
      if (Math.abs(nextOffset - currentOffset) <= 0.001) {
        return;
      }

      writeRootOffset(nextOffset);
    };

    const handleWheel = (event: WheelEvent): void => {
      const axisDelta =
        resolvedScrollDirection === 'x'
          ? Math.abs(event.deltaX) > Math.abs(event.deltaY)
            ? event.deltaX
            : event.deltaY
          : event.deltaY;
      const deltaPx = normalizeWheelDeltaPx(axisDelta, event.deltaMode, scrollViewportSpan);
      if (Math.abs(deltaPx) <= 0.001) {
        return;
      }

      event.preventDefault();
      applyInputDelta(deltaPx);
    };

    const handleTouchStart = (event: TouchEvent): void => {
      const touch = event.touches[0];
      if (!touch) {
        scrollTouchRef.current = null;
        return;
      }

      scrollTouchRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchMove = (event: TouchEvent): void => {
      const touch = event.touches[0];
      const previousTouch = scrollTouchRef.current;
      if (!touch || !previousTouch) {
        return;
      }

      const rawDelta =
        resolvedScrollDirection === 'x'
          ? previousTouch.x - touch.clientX
          : previousTouch.y - touch.clientY;
      scrollTouchRef.current = { x: touch.clientX, y: touch.clientY };

      const deltaPx = normalizeTouchDeltaPx(rawDelta);
      if (Math.abs(deltaPx) <= 0.001) {
        return;
      }

      event.preventDefault();
      applyInputDelta(deltaPx);
    };

    const clearTouch = (): void => {
      scrollTouchRef.current = null;
    };

    root.addEventListener('wheel', handleWheel, { passive: false });
    root.addEventListener('touchstart', handleTouchStart, { passive: true });
    root.addEventListener('touchmove', handleTouchMove, { passive: false });
    root.addEventListener('touchend', clearTouch);
    root.addEventListener('touchcancel', clearTouch);

    return (): void => {
      root.removeEventListener('wheel', handleWheel);
      root.removeEventListener('touchstart', handleTouchStart);
      root.removeEventListener('touchmove', handleTouchMove);
      root.removeEventListener('touchend', clearTouch);
      root.removeEventListener('touchcancel', clearTouch);
    };
  }, [
    isRootScrollMode,
    maxGlobalScroll,
    minVirtualScroll,
    resolvedScrollDirection,
    scrollViewportSpan,
  ]);

  const preloadActiveSceneIndex = isRootScrollMode ? scrollActiveSceneIndex : currentScene;

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
  });

  const [scrollBackdropSceneIndex, setScrollBackdropSceneIndex] = useState<number | null>(null);

  // Mirror live preload counts into a ref so the first-scene enter driver can
  // read them for the timeout error context WITHOUT depending on them — they
  // keep changing as background images load, and depending on them would
  // re-run the driver effect and stop() an in-flight enter animation.
  const preloadCountsRef = useRef({ loadedCount: 0, totalCount: 0 });
  preloadCountsRef.current = {
    loadedCount: preloadState.loadedCount,
    totalCount: preloadState.totalCount,
  };

  // First-screen cold-start enter (two-track model). In drag mode the first
  // scene holds at its initial (pre-enter) visual until its priority assets are
  // ready, then plays a single enter pass. The ANIMATE now lives in scene 0's
  // own useElementTrack (single writer of its element track); CineView only
  // coordinates the GATING: it owns `firstSceneEnterActive` (the window flag
  // read by useAnimateDrag to keep the scene at its enter lerp instead of
  // snapping to rest) and `firstSceneEnterReady` (the trigger that tells scene
  // 0's driver to start 0->T). Extend-on-growth + the warm-cache race are gone
  // here — they are now scene-local (the driver reads its own always-current
  // getTimelineDuration()).
  const [firstSceneEnterActive, setFirstSceneEnterActive] = useState<boolean>(
    () => resolvedRootMode === 'drag'
  );
  const [firstSceneEnterReady, setFirstSceneEnterReady] = useState<boolean>(false);
  const firstSceneEnterRanRef = useRef(false);
  const firstSceneTimeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstSceneTimeoutMs = Math.max(0, modes?.drag?.firstSceneTimeout ?? 3000);

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

  // First-screen cold-start enter driver. Runs once: when the first scene's
  // priority assets settle (preloadState.priorityComplete), drive the shared
  // timeline 0->duration so the first scene plays a single enter pass via the
  // firstSceneEnterActive window in useAnimateDrag. If the assets do not settle
  // within firstSceneTimeoutMs, emit a recoverable FIRST_SCENE_TIMEOUT error;
  // unless the consumer calls preventDefault(), fall back to a static reveal
  // (clear firstSceneEnterActive so the scene rests at its final visual).
  useEffect(() => {
    if (resolvedRootMode !== 'drag') return;
    if (firstSceneEnterRanRef.current) return;

    const firstSceneElement = scenes[0];
    if (!firstSceneElement) return;

    // Two-track model: CineView no longer owns the cold-start tween. It only
    // GATES it. Scene 0's own useElementTrack runs the 0->T enter (and the
    // extend-on-growth re-target) once `firstSceneEnterReady` turns on — the
    // single-writer rule means the scene drives its own element track. CineView's
    // job here is: detect ready (priority assets) / timeout / preventDefault /
    // static reveal, flip the window flag + the ready trigger, and fire the
    // public onFirstSceneReady signal. No animate() lives here anymore.
    const startEnter = (fromPreload: boolean): void => {
      firstSceneEnterRanRef.current = true;
      if (firstSceneTimeoutTimerRef.current) {
        clearTimeout(firstSceneTimeoutTimerRef.current);
        firstSceneTimeoutTimerRef.current = null;
      }
      resolvedCallbacksRef.current.common?.onFirstSceneReady?.({
        sceneIndex: 0,
        fromPreload,
      });
      // Turn on the ready trigger — scene 0's useElementTrack starts its 0->T
      // enter. The window flag stays on until that enter completes
      // (onColdStartComplete -> handleFirstSceneEnterComplete).
      setFirstSceneEnterReady(true);
    };

    const settleStatically = (): void => {
      // Default timeout fallback: no enter animation, just reveal the scene at
      // its terminal (rest) visual. Clear the window so useAnimateDrag rests.
      firstSceneEnterRanRef.current = true;
      setFirstSceneEnterReady(false);
      setFirstSceneEnterActive(false);
    };

    if (preloadState.priorityComplete) {
      startEnter(true);
      return;
    }

    if (firstSceneTimeoutTimerRef.current === null) {
      firstSceneTimeoutTimerRef.current = setTimeout(() => {
        firstSceneTimeoutTimerRef.current = null;
        if (firstSceneEnterRanRef.current) return;
        firstSceneEnterRanRef.current = true;
        const handled = emitRecoverableError(
          'FIRST_SCENE_TIMEOUT',
          `First scene priority assets did not load within ${firstSceneTimeoutMs}ms.`,
          {
            sceneIndex: 0,
            timeoutMs: firstSceneTimeoutMs,
            loadedCount: preloadCountsRef.current.loadedCount,
            totalCount: preloadCountsRef.current.totalCount,
          }
        );
        // Consumer took over (e.g. retry UI): leave the first scene at its
        // initial visual (window stays on, ready stays off) and let them drive
        // recovery. Otherwise fall back to a static reveal so the page is usable.
        if (!handled) {
          settleStatically();
        }
      }, firstSceneTimeoutMs);
    }

    return (): void => {
      if (firstSceneTimeoutTimerRef.current) {
        clearTimeout(firstSceneTimeoutTimerRef.current);
        firstSceneTimeoutTimerRef.current = null;
      }
    };
  }, [
    resolvedRootMode,
    preloadState.priorityComplete,
    scenes,
    firstSceneTimeoutMs,
    emitRecoverableError,
  ]);

  // Scene 0's cold-start enter reached T: clear the window so useAnimateDrag
  // resolves the scene to rest. Wired to scene 0's onColdStartComplete via the
  // dragRuntime.onActivationComplete path.
  const handleFirstSceneEnterComplete = useCallback(() => {
    setFirstSceneEnterActive(false);
  }, []);

  // If the user grabs the first scene while its cold-start enter is still
  // playing, the scene's own useElementTrack already stops its in-flight enter
  // animate (single writer reacting to the drag). CineView just clears the
  // window + ready trigger so the gesture fully owns the element track.
  useEffect(() => {
    if (!isDragging) return;
    firstSceneEnterRanRef.current = true;
    if (firstSceneTimeoutTimerRef.current) {
      clearTimeout(firstSceneTimeoutTimerRef.current);
      firstSceneTimeoutTimerRef.current = null;
    }
    setFirstSceneEnterReady(false);
    setFirstSceneEnterActive(false);
  }, [isDragging]);

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
    if (isRootScrollMode) {
      const hasMeasuredScrollLayout =
        sceneHeights.length === totalScenes && sceneHeights.every((height) => height > 1);

      if (!hasMeasuredScrollLayout) {
        return new Set(scenes.map((_, index) => index));
      }

      const indices = new Set<number>();
      const anchorIndex = scrollActiveSceneIndex;

      for (let offset = -1; offset <= 1; offset += 1) {
        const candidate = anchorIndex + offset;
        if (candidate >= 0 && candidate < totalScenes) {
          indices.add(candidate);
        }
      }

      if (scrollBackdropSceneIndex !== null) {
        indices.add(scrollBackdropSceneIndex);
      }

      return indices;
    }

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
  }, [
    isRootScrollMode,
    resolvedRootMode,
    currentScene,
    sceneHeights,
    scrollActiveSceneIndex,
    scrollBackdropSceneIndex,
    totalScenes,
    scenes,
    isAnimating,
    direction,
  ]);

  // API 方法实现
  const goToScene = useCallback(
    (index: number, animated: boolean = true): void => {
      if (isRootScrollMode) {
        const layout = scrollSceneLayout[index];
        if (!layout) return;
        const nextValue = resolveGlobalOffsetForVisualOffset(layout.sceneStart);
        const root = containerRef.current;
        const directionHint = nextValue >= nativeScrollOffsetRef.current ? 'forward' : 'backward';
        setVirtualScrollDirection(directionHint);
        syncScrollTimelineFromGlobalOffset(nextValue, directionHint);
        setVirtualScrolling(false);
        if (root) {
          if (resolvedScrollDirection === 'x') {
            root.scrollLeft = nextValue;
            nativeScrollOffsetRef.current = root.scrollLeft;
          } else {
            root.scrollTop = nextValue;
            nativeScrollOffsetRef.current = root.scrollTop;
          }
        }
        void animated;
        return;
      }

      sceneActions.goToScene(index, animated);
    },
    [
      isRootScrollMode,
      resolvedScrollDirection,
      resolveGlobalOffsetForVisualOffset,
      sceneActions,
      scrollSceneLayout,
      syncScrollTimelineFromGlobalOffset,
    ]
  );

  const goToZone = useCallback(
    (zoneId: string, options?: { align?: 'center'; animated?: boolean }): void => {
      if (!isRootScrollMode) {
        return;
      }

      const meta = zoneRegistryRef.current.get(zoneId);
      if (!meta) {
        return;
      }

      const layout = scrollSceneLayout[meta.sceneIndex];
      if (!layout) {
        return;
      }

      let nextValue = resolveGlobalOffsetForVisualOffset(layout.sceneStart);

      if (options?.align === 'center' && meta.element && containerRef.current) {
        const segment = resolveZoneGlobalSegments().find(
          (candidate) => candidate.zoneId === zoneId
        );
        if (segment) {
          nextValue = segment.globalStart;
        } else {
          const rootRect = containerRef.current.getBoundingClientRect();
          const elementRect = meta.element.getBoundingClientRect();
          const elementCenter =
            resolvedScrollDirection === 'x'
              ? elementRect.left - rootRect.left + scrollViewportOffset + elementRect.width / 2
              : elementRect.top - rootRect.top + scrollViewportOffset + elementRect.height / 2;
          nextValue = resolveGlobalOffsetForVisualOffset(elementCenter - scrollViewportSpan / 2);
        }
      }

      const clampedValue = clamp(nextValue, minVirtualScroll, maxGlobalScroll);
      const root = containerRef.current;
      const directionHint = clampedValue >= nativeScrollOffsetRef.current ? 'forward' : 'backward';
      setVirtualScrollDirection(directionHint);
      syncScrollTimelineFromGlobalOffset(clampedValue, directionHint);
      setVirtualScrolling(Boolean(options?.animated));
      if (root) {
        if (resolvedScrollDirection === 'x') {
          root.scrollLeft = clampedValue;
          nativeScrollOffsetRef.current = root.scrollLeft;
        } else {
          root.scrollTop = clampedValue;
          nativeScrollOffsetRef.current = root.scrollTop;
        }
      }
    },
    [
      isRootScrollMode,
      maxGlobalScroll,
      minVirtualScroll,
      resolvedScrollDirection,
      resolveGlobalOffsetForVisualOffset,
      resolveZoneGlobalSegments,
      scrollSceneLayout,
      scrollViewportOffset,
      scrollViewportSpan,
      syncScrollTimelineFromGlobalOffset,
    ]
  );

  const refreshLayout = useCallback((): void => {
    measureViewportRef.current?.();
    measureSceneHeightsRef.current?.();
    syncZoneStates();
    updateZoneActiveState();
  }, [syncZoneStates, updateZoneActiveState]);

  const preload = useCallback(
    async (targets?: CineViewPreloadTarget[]): Promise<void> => {
      const targetImages = resolveScenePreloadTargetImages(scenes, targets);
      if (targetImages.length > 0) {
        preloadActions.addUrls(targetImages, true);
      }

      await preloadActions.startPreload();
    },
    [preloadActions, scenes]
  );

  const getCurrentScene = useCallback((): number => {
    return isRootScrollMode ? scrollActiveSceneIndex : currentScene;
  }, [isRootScrollMode, currentScene, scrollActiveSceneIndex]);

  const getPerformanceMetrics = useCallback((): PerformanceMetrics => {
    const metrics = performanceMonitor.getMetrics();
    return {
      fps: metrics.fps,
      avgFrameTime: metrics.avgFrameTime,
      memoryUsage: metrics.memoryUsage,
      bundleSize: metrics.bundleSize,
    };
  }, []);

  // 暴露 API 方法
  useImperativeHandle(
    ref,
    () => ({
      goToScene,
      goToZone,
      refreshLayout,
      preload,
      getCurrentScene,
      getPerformanceMetrics,
    }),
    [goToScene, goToZone, refreshLayout, preload, getCurrentScene, getPerformanceMetrics]
  );

  // 场景切换处理
  const handleSceneChange = useCallback(
    (
      direction: 'forward' | 'backward',
      progressRatio?: number,
      committedElapsedMs?: number,
      timelineDuration?: number
    ) => {
      const activeSceneIndex = isRootScrollMode ? scrollActiveSceneIndex : currentScene;
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
    [
      sceneActions,
      currentScene,
      isRootScrollMode,
      resolvedRootMode,
      scenes,
      scrollActiveSceneIndex,
      dragTimelineProgress,
      scrollProgress,
    ]
  );

  // 渲染场景
  const renderScenes = useCallback((): (JSX.Element | null)[] => {
    return scenes.map((scene, index) => {
      const isVisible = visibleSceneIndices.has(index);
      const effectiveCurrentScene = isRootScrollMode ? scrollActiveSceneIndex : currentScene;
      const isCurrent = index === effectiveCurrentScene;
      const sceneProps = scene.props as SceneAuthoringCompatProps;
      const effectiveMode = resolvedRootMode;
      const slideDirection = modes?.drag?.direction ?? sceneProps.slideDirection ?? 'y';
      const scrollTimelineState = isRootScrollMode ? scrollSceneStates[index] : null;
      const isScrollBackdropActive = false;

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
        callbacks: {
          ...sceneProps.callbacks,
          onVisibilityChange: (detail: SceneVisibilityDetail) => {
            sceneProps.callbacks?.onVisibilityChange?.(detail);
            resolvedCallbacksRef.current.scroll?.onSceneVisibilityChange?.(detail);
          },
        },
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
        },
        globalFirstSceneEnterActive: firstSceneEnterActive && index === 0,
        globalFirstSceneEnterReady: firstSceneEnterReady && index === 0,
        dragRuntime: {
          progress: dragProgress,
          renderProgress,
          timelineProgress: dragTimelineProgress,
          isDragging,
          release: dragRelease,
          onCommit: handleSceneChange,
          onReset: sceneActions.resetDragInteraction,
          // Both the incoming scene's release-settle completion AND scene 0's
          // cold-start completion fire onActivationComplete. For a scene-change
          // settle this defers onSceneDidChange via completeDragTransition; for
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
        scrollRuntime: {
          progress: isRootScrollMode ? (scrollTimelineState?.sceneProgress ?? 0) : scrollProgress,
          isScrolling: isRootScrollMode ? virtualScrolling : isScrolling,
          direction: isRootScrollMode ? virtualScrollDirection : scrollDirection,
          transitionSnapshot: scrollTransitionSnapshot,
          backdropActive: isScrollBackdropActive,
          timelineState: scrollTimelineState,
          activeSceneIndex: scrollActiveSceneIndex,
          viewportOffset: scrollViewportOffset,
          onProgressChange: sceneActions.setScrollProgress,
          onDirectionChange: sceneActions.setScrollDirection,
          onScrollingChange: sceneActions.setIsScrolling,
          onCommit: handleSceneChange,
          onReset: sceneActions.resetScrollInteraction,
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
    isRootScrollMode,
    resolvedRootMode,
    resolvedScrollDirection,
    resolvedScrollConfig.sceneSizing,
    modes?.drag?.direction,
    scenes,
    visibleSceneIndices,
    currentScene,
    totalScenes,
    scrollActiveSceneIndex,
    scrollSceneLayout,
    scrollSceneStates,
    dragProgress,
    dragTimelineProgress,
    scrollProgress,
    scrollDirection,
    renderProgress,
    isDragging,
    isScrolling,
    virtualScrolling,
    virtualScrollDirection,
    sharedTimelineDurationMs,
    dragRelease,
    firstSceneEnterActive,
    firstSceneEnterReady,
    handleFirstSceneEnterComplete,
    scrollTransitionSnapshot,
    direction,
    isAnimating,
    handleSceneChange,
    sceneActions,
    scrollBackdropSceneIndex,
    viewportWidth,
    viewportHeight,
    scrollViewportOffset,
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
    overflowX: isRootScrollMode && resolvedScrollDirection === 'x' ? 'auto' : 'hidden',
    overflowY: isRootScrollMode && resolvedScrollDirection !== 'x' ? 'auto' : 'hidden',
    overscrollBehavior: isRootScrollMode ? 'contain' : undefined,
    WebkitOverflowScrolling: isRootScrollMode ? 'touch' : undefined,
    background: '#0d1624',
  };

  const sceneViewportStyle: React.CSSProperties = {
    opacity: 1,
    pointerEvents: 'auto',
  };

  const scrollViewportShellStyle: React.CSSProperties | undefined = isRootScrollMode
    ? {
        position: 'sticky',
        top: 0,
        left: 0,
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
      }
    : undefined;

  const scrollTrackStyle: React.CSSProperties | undefined = isRootScrollMode
    ? {
        position: 'relative',
        width:
          resolvedScrollDirection === 'x'
            ? scrollSceneLayout.length > 0
              ? scrollSceneLayout[scrollSceneLayout.length - 1].sceneEnd
              : '100%'
            : '100%',
        height:
          resolvedScrollDirection === 'x'
            ? '100%'
            : scrollSceneLayout.length > 0
              ? scrollSceneLayout[scrollSceneLayout.length - 1].sceneEnd
              : '100%',
        transform:
          resolvedScrollDirection === 'x'
            ? `translate3d(${-scrollViewportOffset}px, 0, 0)`
            : `translate3d(0, ${-scrollViewportOffset}px, 0)`,
        willChange: 'transform',
      }
    : undefined;

  return (
    <CineViewProvider designWidth={designWidth} designHeight={designHeight} unit={unit}>
      <CineViewRuntimeContext.Provider value={{ mode: resolvedRootMode }}>
        <SceneScrollRuntimeContext.Provider value={zoneRuntimeValue}>
          <div
            ref={containerRef}
            style={containerStyle}
            className="cineview-container"
            data-cineview-container="true"
          >
            {isRootScrollMode ? (
              <div
                style={{
                  position: 'relative',
                  width: resolvedScrollDirection === 'x' ? nativeScrollSpan : '100%',
                  height: resolvedScrollDirection === 'x' ? '100%' : nativeScrollSpan,
                }}
              >
                <div style={{ ...scrollViewportShellStyle, ...sceneViewportStyle }}>
                  <div style={scrollTrackStyle}>{renderScenes()}</div>
                </div>
              </div>
            ) : (
              <div style={sceneViewportStyle}>{renderScenes()}</div>
            )}
          </div>
        </SceneScrollRuntimeContext.Provider>
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
