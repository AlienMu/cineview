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
import { ScrollZoneRuntimeContext, type ScrollZoneTimelineState } from '../ScrollZone';
import {
  resolveScrollZoneAnimationBudgets,
  type ScrollZoneAnimationRegistration,
} from '../ScrollZone/scrollZoneBudget';
import type {
  AnimationType,
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
  ScrollbarConfig,
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

function createScrollbarCss(config: ScrollbarConfig): string {
  const width = Math.max(config.width ?? 6, 1);
  const radius = Math.max(config.radius ?? width, 0);
  const inset = Math.max(config.inset ?? 4, 0);
  const trackColor = config.trackColor ?? 'rgba(255,255,255,0.08)';
  const thumbColor = config.thumbColor ?? 'rgba(255,255,255,0.28)';
  const thumbHoverColor = config.thumbHoverColor ?? 'rgba(255,255,255,0.42)';
  const autoHide = config.autoHide ?? true;
  const opacity = autoHide ? 0 : 1;

  return `
    [data-cineview-container="true"] {
      scrollbar-width: thin;
      scrollbar-color: ${thumbColor} ${trackColor};
    }
    [data-cineview-container="true"]::-webkit-scrollbar {
      width: ${width}px;
      height: ${width}px;
    }
    [data-cineview-container="true"]::-webkit-scrollbar-track {
      background: ${trackColor};
      border-radius: ${radius}px;
      margin: ${inset}px;
      opacity: ${opacity};
    }
    [data-cineview-container="true"]::-webkit-scrollbar-thumb {
      background: ${thumbColor};
      border-radius: ${radius}px;
      border: ${Math.max(Math.floor(inset / 2), 0)}px solid transparent;
      background-clip: padding-box;
    }
    [data-cineview-container="true"]:hover::-webkit-scrollbar-track,
    [data-cineview-container="true"]:hover::-webkit-scrollbar-thumb {
      opacity: 1;
    }
    [data-cineview-container="true"]::-webkit-scrollbar-thumb:hover {
      background: ${thumbHoverColor};
    }
  `;
}

function createRect(left: number, top: number, width: number, height: number): DOMRect {
  if (typeof DOMRect !== 'undefined') {
    return new DOMRect(left, top, width, height);
  }

  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({ left, top, width, height }),
  } as DOMRect;
}

export function resolveRootMode(mode: ScrollMode | undefined): ScrollMode {
  return mode ?? 'snap';
}

function getSceneSettleDuration(
  sceneProps: SceneAuthoringCompatProps,
  rootMode: ScrollMode,
  modes: CineViewProps['modes'] | undefined
): number {
  if (rootMode === 'snap') {
    return Math.max(modes?.snap?.duration ?? sceneProps.sceneTransitionDuration ?? 500, 0);
  }

  if (rootMode === 'drag') {
    return Math.max(
      modes?.drag?.transitionDuration ?? sceneProps.sceneTransitionDuration ?? 500,
      0
    );
  }

  return Math.max(sceneProps.sceneTransitionDuration ?? 500, 0);
}

function getScenePreloadImages(sceneProps: SceneAuthoringCompatProps): string[] {
  return sceneProps.assets?.preloadImages ?? [];
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

function getRelativeLayoutTop(element: HTMLElement, ancestor: HTMLElement): number {
  let offset = 0;
  let current: HTMLElement | null = element;

  while (current && current !== ancestor) {
    offset += current.offsetTop;
    const next: Element | null = current.offsetParent;
    current = next instanceof HTMLElement ? next : null;
  }

  if (current === ancestor) {
    return offset;
  }

  const ancestorRect = ancestor.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  return elementRect.top - ancestorRect.top;
}

function measureSceneContentHeight(node: HTMLDivElement): number {
  let maxBottom = Math.max(node.offsetHeight, node.scrollHeight, 1);
  const descendants = node.querySelectorAll<HTMLElement>('*');

  descendants.forEach((element) => {
    if (shouldIgnoreSceneMeasurementNode(element)) {
      return;
    }

    const relativeTop = getRelativeLayoutTop(element, node);
    const relativeBottom = relativeTop + Math.max(element.offsetHeight, element.scrollHeight, 0);
    if (Number.isFinite(relativeBottom)) {
      maxBottom = Math.max(maxBottom, relativeBottom);
    }
  });

  return Math.max(maxBottom, 1);
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
      budget: 'auto' | number;
      replayOnReenter: boolean;
      element: HTMLElement | null;
    }
  >,
  activeSceneIndex: number,
  rootRect: DOMRect,
  viewportHeight: number,
  zoneStates?: Record<string, ScrollZoneTimelineState>,
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
const CineViewComponent = forwardRef<CineViewRef, CineViewProps>((props, ref) => {
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
  const isRootScrollMode = resolvedRootMode === 'scroll';
  const resolvedScrollConfig = useMemo<
    Required<Pick<ScrollModeConfig, 'wheelStep' | 'touchStep'>> & ScrollModeConfig
  >(
    () => ({
      direction: modes?.scroll?.direction,
      zoneTrigger: modes?.scroll?.zoneTrigger ?? 'center-lock',
      replayOnReenter: modes?.scroll?.replayOnReenter,
      sceneSizing: modes?.scroll?.sceneSizing ?? 'content',
      wheelStep: modes?.scroll?.wheelStep ?? 0.038,
      touchStep: modes?.scroll?.touchStep ?? 0.028,
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
  const lastZoneStatesRef = useRef<Record<string, ScrollZoneTimelineState>>({});
  const lastMeasuredLayoutRef = useRef<{ width: number; height: number } | null>(null);
  const previousRootModeRef = useRef<ScrollMode | null>(null);

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
  const [zoneStates, setZoneStates] = useState<Record<string, ScrollZoneTimelineState>>({});
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
        budget: 'auto' | number;
        replayOnReenter: boolean;
        element: HTMLElement | null;
      }
    >
  >(new Map());
  const zoneAnimationsRef = useRef<Map<string, Map<string, ScrollZoneAnimationRegistration>>>(
    new Map()
  );
  const zoneStatesRef = useRef<Record<string, ScrollZoneTimelineState>>({});

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

  const updateZoneStatesRef = useCallback(
    (nextStates: Record<string, ScrollZoneTimelineState>): void => {
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
            previousState.sequence.totalDurationMs === nextState.sequence.totalDurationMs
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

  const syncZoneStates = useCallback((): void => {
    if (!isRootScrollMode) {
      updateZoneStatesRef({});
      return;
    }

    const nextStates: Record<string, ScrollZoneTimelineState> = {};

    zoneRegistryRef.current.forEach((meta, zoneId) => {
      const registrations =
        zoneAnimationsRef.current.get(zoneId) ?? new Map<string, ScrollZoneAnimationRegistration>();
      const sequence = resolveScrollZoneAnimationBudgets(registrations, meta.budget);
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

    const root = containerRef.current;
    if (!root) {
      return;
    }

    const measuredRootRect = root.getBoundingClientRect();
    const rootRect = isRootScrollMode
      ? createRect(
          measuredRootRect.left,
          measuredRootRect.top,
          viewportWidth || measuredRootRect.width,
          viewportHeight || measuredRootRect.height
        )
      : measuredRootRect;
    const previousActiveZoneId =
      Object.values(zoneStatesRef.current).find(
        (state) => state.active && state.sceneIndex === scrollActiveSceneIndex
      )?.zoneId ?? null;
    const activeZoneId = resolveActiveViewportId(
      zoneRegistryRef.current,
      scrollActiveSceneIndex,
      rootRect,
      scrollViewportSpan,
      zoneStatesRef.current,
      previousActiveZoneId,
      resolvedScrollDirection
    );

    const nextStates: Record<string, ScrollZoneTimelineState> = {};
    Object.entries(zoneStatesRef.current).forEach(([zoneId, state]) => {
      nextStates[zoneId] = {
        ...state,
        active: zoneId === activeZoneId,
      };
    });

    updateZoneStatesRef(nextStates);
  }, [
    isRootScrollMode,
    scrollActiveSceneIndex,
    updateZoneStatesRef,
    scrollViewportSpan,
    viewportHeight,
    viewportWidth,
    resolvedScrollDirection,
  ]);

  const registerZone = useCallback(
    (
      zoneId: string,
      config: {
        sceneIndex: number;
        trigger: 'center-lock';
        budget: 'auto' | number;
        replayOnReenter: boolean;
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
    (zoneId: string, animation: ScrollZoneAnimationRegistration) => {
      const zoneAnimations =
        zoneAnimationsRef.current.get(zoneId) ?? new Map<string, ScrollZoneAnimationRegistration>();
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
      if (resolvedRootMode === 'snap') {
        resolvedCallbacks.snap?.onTransitionStart?.(detail);
      }
    },
    [resolvedCallbacks, resolvedRootMode]
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
      if (resolvedRootMode === 'snap') {
        resolvedCallbacks.snap?.onTransitionEnd?.(detail);
      }
    },
    [resolvedCallbacks, resolvedRootMode]
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
    sharedElapsedMs,
    sharedTimelineDurationMs,
    dragTransitionSnapshot,
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
          budget: zoneState.totalBudgetPx,
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

      resizeObserver.observe(root);
      root.querySelectorAll<HTMLElement>('*').forEach((element) => {
        if (shouldIgnoreSceneMeasurementNode(element)) {
          return;
        }

        resizeObserver.observe(element);
      });
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
    const mutationObserver = new MutationObserver(() => {
      wrappers.forEach((wrapper) => {
        if (!wrapper) return;
        observeMeasureTargets(wrapper);
      });
      scheduleMeasureHeights();
    });

    wrappers.forEach((wrapper) => {
      if (!wrapper) return;

      if (resizeObserver) {
        observeMeasureTargets(wrapper);
      }
      mutationObserver.observe(wrapper, {
        childList: true,
        subtree: true,
      });
    });

    return (): void => {
      measureSceneHeightsRef.current = null;
      if (measureFrame !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(measureFrame);
      }
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
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

    styleNode.textContent = createScrollbarCss(scrollbar);

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
    hasInitializedScrollRef.current = true;
    if (virtualScrollRef.current === initialValue) return;

    virtualScrollRef.current = initialValue;
    setVirtualScroll(initialValue);
    setVirtualScrollDirection(null);
    setVirtualScrolling(false);
  }, [isRootScrollMode]);

  useEffect(() => {
    if (!isRootScrollMode) return;
    lastReportedScrollSceneRef.current = scrollActiveSceneIndex;
  }, [isRootScrollMode, scrollActiveSceneIndex]);

  useEffect(() => {
    syncZoneStates();
  }, [syncZoneStates, sceneHeights, viewportHeight, scrollSceneLayout.length]);

  useEffect(() => {
    updateZoneActiveState();
  }, [updateZoneActiveState, virtualScroll, viewportHeight, scrollActiveSceneIndex]);

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
    const wheelScale = Math.max(resolvedScrollConfig.wheelStep, 0.01);
    const touchScale = Math.max(resolvedScrollConfig.touchStep, 0.01);

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

    const applyScrollDelta = (rawDelta: number, source: 'wheel' | 'touch'): boolean => {
      if (Math.abs(rawDelta) <= 0.001) return false;

      const scale = source === 'wheel' ? wheelScale : touchScale;
      let remainingDelta = rawDelta * scale;
      const direction = remainingDelta >= 0 ? 'forward' : 'backward';
      const activeZoneState = Object.values(zoneStatesRef.current).find(
        (state) => state.active && state.sceneIndex === scrollActiveSceneIndex
      );

      if (activeZoneState) {
        const nextZoneProgress = clamp(
          activeZoneState.progressPx + remainingDelta,
          0,
          activeZoneState.totalBudgetPx
        );
        const consumedDelta = nextZoneProgress - activeZoneState.progressPx;

        if (Math.abs(consumedDelta) > 0.001) {
          updateZoneStatesRef({
            ...zoneStatesRef.current,
            [activeZoneState.zoneId]: {
              ...activeZoneState,
              progressPx: nextZoneProgress,
              direction,
              active: true,
            },
          });
          remainingDelta -= consumedDelta;
          markScrolling();
        }
      }

      const nextValue = Math.max(
        minVirtualScroll,
        Math.min(virtualScrollRef.current + remainingDelta, maxVirtualScroll)
      );

      if (Math.abs(nextValue - virtualScrollRef.current) <= 0.001) {
        return Math.abs(remainingDelta) !== Math.abs(rawDelta * scale);
      }

      setVirtualScrollDirection(nextValue > virtualScrollRef.current ? 'forward' : 'backward');
      virtualScrollRef.current = nextValue;
      setVirtualScroll(nextValue);
      markScrolling();

      if (isScrollDebugEnabled()) {
        console.log('[CineViewScroll]', {
          source,
          rawDelta: rawDelta.toFixed(3),
          remainingDelta: remainingDelta.toFixed(3),
          nextValue: nextValue.toFixed(3),
          activeScene: scrollActiveSceneIndex,
        });
      }

      return true;
    };

    const handleWheel = (event: WheelEvent): void => {
      const wheelDelta = resolvedScrollDirection === 'x' ? event.deltaX : event.deltaY;
      if (applyScrollDelta(wheelDelta, 'wheel')) {
        event.preventDefault();
      }
    };

    const handleTouchStart = (event: TouchEvent): void => {
      const touch = event.touches[0];
      scrollTouchRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchMove = (event: TouchEvent): void => {
      if (!scrollTouchRef.current) return;
      const touch = event.touches[0];
      const delta =
        resolvedScrollDirection === 'x'
          ? scrollTouchRef.current.x - touch.clientX
          : scrollTouchRef.current.y - touch.clientY;
      scrollTouchRef.current = { x: touch.clientX, y: touch.clientY };
      if (applyScrollDelta(delta, 'touch')) {
        event.preventDefault();
      }
    };

    const handleTouchEnd = (): void => {
      scrollTouchRef.current = null;
    };

    root.addEventListener('wheel', handleWheel, { passive: false });
    root.addEventListener('touchstart', handleTouchStart, { passive: true });
    root.addEventListener('touchmove', handleTouchMove, { passive: false });
    root.addEventListener('touchend', handleTouchEnd, { passive: true });

    return (): void => {
      root.removeEventListener('wheel', handleWheel);
      root.removeEventListener('touchstart', handleTouchStart);
      root.removeEventListener('touchmove', handleTouchMove);
      root.removeEventListener('touchend', handleTouchEnd);
      clearIdleTimer();
    };
  }, [
    isRootScrollMode,
    minVirtualScroll,
    maxVirtualScroll,
    scrollActiveSceneIndex,
    resolvedScrollDirection,
    resolvedScrollConfig.touchStep,
    resolvedScrollConfig.wheelStep,
    updateZoneStatesRef,
  ]);

  // 收集所有场景的预加载图片
  const { priorityImages, backgroundImages } = useMemo((): {
    priorityImages: string[];
    backgroundImages: string[];
  } => {
    const priority: string[] = [];
    const background: string[] = [];

    scenes.forEach((scene, index) => {
      const sceneProps = scene.props as SceneAuthoringCompatProps;
      const images = getScenePreloadImages(sceneProps);

      if (index === 0) {
        // 首屏图片优先加载
        priority.push(...images);
      } else {
        // 后续场景图片后台加载
        background.push(...images);
      }
    });

    return { priorityImages: priority, backgroundImages: background };
  }, [scenes]);

  // 图片预加载
  const [preloadState, preloadActions] = useImagePreloader({
    priorityUrls: priorityImages,
    backgroundUrls: backgroundImages,
    onProgress: handlePreloadProgress,
  });

  // 首屏加载完成标志
  const [firstSceneLoaded, setFirstSceneLoaded] = useState(false);
  const [scrollBackdropSceneIndex, setScrollBackdropSceneIndex] = useState<number | null>(null);

  // 初始化
  useEffect(() => {
    // Validates Requirement 26.5: Capture ref value before cleanup function
    const timersRef = cleanupTimersRef.current;

    // 开始预加载
    preloadActions.startPreload();

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

  // 监听首屏图片加载完成
  useEffect(() => {
    // 如果没有优先图片，立即标记为已加载
    if (priorityImages.length === 0) {
      setFirstSceneLoaded(true);
      return;
    }

    // 如果有优先图片，等待加载完成
    if (preloadState.loadedCount >= priorityImages.length && !firstSceneLoaded) {
      setFirstSceneLoaded(true);
    }
  }, [preloadState.loadedCount, priorityImages.length, firstSceneLoaded]);

  // 虚拟化渲染：仅渲染当前场景及前后各一个
  const visibleSceneIndices = useMemo(() => {
    if (isRootScrollMode) {
      return new Set(scenes.map((_, index) => index));
    }

    const indices = new Set<number>();

    // 当前场景
    indices.add(currentScene);

    // 在非 scroll 的交互模式下，保留相邻场景，兼容动画触发和虚拟化预热。
    if (resolvedRootMode === 'drag' || resolvedRootMode === 'snap') {
      if (currentScene > 0) {
        indices.add(currentScene - 1);
      }
      if (currentScene < totalScenes - 1) {
        indices.add(currentScene + 1);
      }
    }

    if (resolvedRootMode === 'snap' && isAnimating) {
      if (direction === 'forward' && currentScene > 0) {
        indices.add(currentScene - 1);
      }
      if (direction === 'backward' && currentScene < totalScenes - 1) {
        indices.add(currentScene + 1);
      }
    }

    return indices;
  }, [
    isRootScrollMode,
    resolvedRootMode,
    currentScene,
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
        const nextValue = layout.sceneStart;
        setVirtualScrollDirection(nextValue >= virtualScrollRef.current ? 'forward' : 'backward');
        virtualScrollRef.current = nextValue;
        setVirtualScroll(nextValue);
        setVirtualScrolling(false);
        void animated;
        return;
      }

      sceneActions.goToScene(index, animated);
    },
    [isRootScrollMode, scrollSceneLayout, sceneActions]
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

      let nextValue = layout.sceneStart;

      if (options?.align === 'center' && meta.element && containerRef.current) {
        const rootRect = containerRef.current.getBoundingClientRect();
        const elementRect = meta.element.getBoundingClientRect();
        const elementCenter =
          resolvedScrollDirection === 'x'
            ? elementRect.left - rootRect.left + scrollViewportOffset + elementRect.width / 2
            : elementRect.top - rootRect.top + scrollViewportOffset + elementRect.height / 2;
        nextValue = elementCenter - scrollViewportSpan / 2;
      }

      const clampedValue = clamp(nextValue, minVirtualScroll, maxVirtualScroll);
      setVirtualScrollDirection(clampedValue >= virtualScrollRef.current ? 'forward' : 'backward');
      virtualScrollRef.current = clampedValue;
      setVirtualScroll(clampedValue);
      setVirtualScrolling(Boolean(options?.animated));
    },
    [
      isRootScrollMode,
      maxVirtualScroll,
      minVirtualScroll,
      resolvedScrollDirection,
      scrollSceneLayout,
      scrollViewportOffset,
      scrollViewportSpan,
    ]
  );

  const refreshLayout = useCallback((): void => {
    measureViewportRef.current?.();
    measureSceneHeightsRef.current?.();
    syncZoneStates();
    updateZoneActiveState();
  }, [syncZoneStates, updateZoneActiveState]);

  const preload = useCallback(
    async (_targets?: Array<number | string>): Promise<void> => {
      preloadActions.startPreload();
    },
    [preloadActions]
  );

  const getCurrentScene = useCallback((): number => {
    return isRootScrollMode ? scrollActiveSceneIndex : currentScene;
  }, [isRootScrollMode, currentScene, scrollActiveSceneIndex]);

  const getState = useCallback(() => {
    const runtimeState: 'inactive' | 'entering' | 'active' | 'exiting' | 'covered' | 'parked' =
      resolvedRootMode === 'drag'
        ? isDragging
          ? 'entering'
          : isAnimating
            ? 'exiting'
            : 'active'
        : resolvedRootMode === 'scroll'
          ? virtualScrolling
            ? 'entering'
            : 'active'
          : isAnimating
            ? 'entering'
            : 'active';

    return {
      mode: resolvedRootMode,
      currentScene: isRootScrollMode ? scrollActiveSceneIndex : currentScene,
      totalScenes,
      runtimeState,
    };
  }, [
    resolvedRootMode,
    isRootScrollMode,
    scrollActiveSceneIndex,
    currentScene,
    totalScenes,
    isDragging,
    isAnimating,
    virtualScrolling,
  ]);

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
      getState,
      goToScene,
      goToZone,
      refreshLayout,
      preload,
      getCurrentScene,
      getPerformanceMetrics,
    }),
    [getState, goToScene, goToZone, refreshLayout, preload, getCurrentScene, getPerformanceMetrics]
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
      const elapsedMs = Math.max(0, committedElapsedMs ?? sharedElapsedMs);
      const targetSceneIndex =
        direction === 'forward' ? activeSceneIndex + 1 : activeSceneIndex - 1;
      const targetSceneElement = scenes[targetSceneIndex];
      const targetSceneProps = targetSceneElement?.props as SceneAuthoringCompatProps | undefined;
      const normalizedDragProgress = Math.max(
        0,
        Math.min(progressRatio ?? dragTimelineProgress, 1)
      );
      const normalizedScrollProgress = Math.max(0, Math.min(progressRatio ?? scrollProgress, 1));

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
        } else if (resolvedRootMode === 'scroll') {
          const targetStackMode = targetSceneProps
            ? resolveRootSceneStackMode(targetSceneProps, resolvedRootMode)
            : 'cover';
          setScrollBackdropSceneIndex(targetStackMode === 'cover' ? activeSceneIndex : null);
          sceneActions.commitScrollSceneChange('forward', normalizedScrollProgress);
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
        } else if (resolvedRootMode === 'scroll') {
          const targetStackMode = targetSceneProps
            ? resolveRootSceneStackMode(targetSceneProps, resolvedRootMode)
            : 'cover';
          setScrollBackdropSceneIndex(targetStackMode === 'cover' ? activeSceneIndex : null);
          sceneActions.commitScrollSceneChange('backward', normalizedScrollProgress);
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
      sharedElapsedMs,
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
      const scrollLayout = isRootScrollMode ? scrollSceneLayout[index] : null;
      const slideDirection =
        effectiveMode === 'scroll'
          ? resolvedScrollDirection
          : effectiveMode === 'drag'
            ? (modes?.drag?.direction ?? sceneProps.slideDirection ?? 'y')
            : (modes?.snap?.direction ?? sceneProps.slideDirection ?? 'y');
      const currentSceneProps = scenes[effectiveCurrentScene]?.props as
        | SceneAuthoringCompatProps
        | undefined;
      const scrollTimelineState = isRootScrollMode ? scrollSceneStates[index] : null;
      const isScrollBackdropActive =
        effectiveMode === 'scroll' &&
        currentSceneProps !== undefined &&
        resolveRootSceneStackMode(currentSceneProps, effectiveMode) === 'cover' &&
        scrollBackdropSceneIndex === index &&
        index !== effectiveCurrentScene;

      // 虚拟化：不可见的场景不渲染
      if (!isVisible) {
        return null;
      }

      // 计算场景位置
      const scenePosition: React.CSSProperties = {
        width: '100%',
        height: effectiveMode === 'scroll' ? 'auto' : '100%',
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
      } else if (effectiveMode === 'scroll') {
        scenePosition.position = 'relative';
        scenePosition.height = 'auto';
        if (resolvedScrollConfig.sceneSizing === 'screen' && scrollLayout) {
          if (resolvedScrollDirection === 'x') {
            scenePosition.minWidth = scrollLayout.height;
          } else {
            scenePosition.minHeight = scrollLayout.height;
          }
        }
        scenePosition.top = undefined;
        scenePosition.left = undefined;
        scenePosition.visibility = 'visible';
        scenePosition.opacity = 1;
        scenePosition.pointerEvents = 'auto';
        scenePosition.contentVisibility = 'visible';
        scenePosition.transition = 'none';
        scenePosition.zIndex = sceneProps.stack?.zIndex ?? sceneProps.sceneZIndex ?? index + 1;
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
          sharedElapsedMs,
          sharedTimelineDurationMs,
          viewportWidth,
          viewportHeight,
        },
        dragRuntime: {
          progress: dragProgress,
          renderProgress,
          timelineProgress: dragTimelineProgress,
          isDragging,
          transitionSnapshot: dragTransitionSnapshot,
          onCommit: handleSceneChange,
          onReset: sceneActions.resetDragInteraction,
          onActivationComplete: sceneActions.clearDragTransitionSnapshot,
          onProgressChange: sceneActions.setDragProgress,
          onRenderProgressChange: sceneActions.setRenderProgress,
          onTimelineProgressChange: sceneActions.setDragTimelineProgress,
          onSharedElapsedMsChange: sceneActions.setSharedElapsedMs,
          onDraggingChange: sceneActions.setIsDragging,
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
    modes?.snap?.direction,
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
    sharedElapsedMs,
    sharedTimelineDurationMs,
    dragTransitionSnapshot,
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
    height: isRootScrollMode ? 'auto' : '100vh',
    minHeight: '100vh',
    overflow: isRootScrollMode ? 'visible' : 'hidden',
    background: '#0d1624',
  };

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
      <ScrollZoneRuntimeContext.Provider value={zoneRuntimeValue}>
        <div
          ref={containerRef}
          style={containerStyle}
          className="cineview-container"
          data-cineview-container="true"
        >
          {isRootScrollMode ? <div style={scrollTrackStyle}>{renderScenes()}</div> : renderScenes()}
        </div>
      </ScrollZoneRuntimeContext.Provider>
    </CineViewProvider>
  );
});

CineViewComponent.displayName = 'CineView';

export const CineView = CineViewComponent;
