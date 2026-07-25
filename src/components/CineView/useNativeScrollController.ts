import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from 'react';
import type { SlideDirection } from '../../types';
import type { SceneScrollTimelineState } from '../Scene/sceneScrollRuntime';
import {
  CENTER_LOCK_BOUNDARY_EPSILON_PX,
  TAKEOVER_PROGRESS_SNAP_EPSILON_PX,
  clamp,
  resolveScrollIntentOffset,
  type CenterLockSegment,
  type SceneLayoutInfo,
  type ScrollInputDirection,
} from './directScrollHelpers';
import type { GroupedCallbacks } from './regroupCallbacks';
import type { ScrollExternalStore } from './scrollExternalStore';
import type {
  ScrollTimelineStore,
  ScrollZoneRegistryRef,
  ScrollZoneStatesRef,
} from './useScrollZoneRegistry';
import { useScrollInputBindings } from './useScrollInputBindings';

interface UseNativeScrollControllerParams {
  rootRef: RefObject<HTMLDivElement | null>;
  direction: SlideDirection;
  getViewportSpan: () => number;
  updateViewportMetrics: () => void;
  measureSceneLayouts: () => SceneLayoutInfo[];
  sceneLayoutsRef: MutableRefObject<SceneLayoutInfo[]>;
  zoneRegistryRef: ScrollZoneRegistryRef;
  zoneStatesRef: ScrollZoneStatesRef;
  timelineStoreRef: MutableRefObject<ScrollTimelineStore>;
  scrollOffsetRef: MutableRefObject<number>;
  scrollOffsetStore: ScrollExternalStore<number>;
  activeSceneIndexRef: MutableRefObject<number>;
  scrollDirectionRef: MutableRefObject<ScrollInputDirection | null>;
  isScrollingStateRef: MutableRefObject<boolean>;
  updateSceneRenderSnapshotsRef: MutableRefObject<(nativeOffset: number) => void>;
  callbacks: GroupedCallbacks;
  zoneRuntimeVersion: number;
}

export interface NativeScrollControllerPort {
  isScrolling: boolean;
  scrollContentSpan: number;
  syncNativeScrollState: (fromGesture?: boolean) => void;
  applyNativeScrollDelta: (deltaPx: number) => boolean;
  applyNativeScrollbarOffset: (targetOffset: number) => void;
  goToScrollZone: (zoneId: string, options?: { animated?: boolean }) => void;
}

export function useNativeScrollController({
  rootRef,
  direction,
  getViewportSpan,
  updateViewportMetrics,
  measureSceneLayouts,
  sceneLayoutsRef,
  zoneRegistryRef,
  zoneStatesRef,
  timelineStoreRef,
  scrollOffsetRef,
  scrollOffsetStore,
  activeSceneIndexRef,
  scrollDirectionRef,
  isScrollingStateRef,
  updateSceneRenderSnapshotsRef,
  callbacks,
  zoneRuntimeVersion,
}: UseNativeScrollControllerParams): NativeScrollControllerPort {
  const scrollingIdleTimerRef = useRef<number | null>(null);
  const isScrollingGestureRef = useRef(false);
  const previousScrollOffsetRef = useRef(0);
  const previousZoneStatesRef = useRef<Record<string, SceneScrollTimelineState>>({});
  const lastReportedSceneRef = useRef(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollContentSpan, setScrollContentSpan] = useState(1);

  const getMaxNativeOffset = useCallback((): number => {
    const root = rootRef.current;
    if (!root) return 0;

    const contentSpan = direction === 'x' ? root.scrollWidth : root.scrollHeight;
    return Math.max(contentSpan - getViewportSpan(), 0);
  }, [direction, getViewportSpan, rootRef]);

  const getCenterLockSegments = useCallback((): CenterLockSegment[] => {
    return sceneLayoutsRef.current
      .filter((layout) => layout.segmentEnd - layout.segmentStart > CENTER_LOCK_BOUNDARY_EPSILON_PX)
      .map((layout) => ({
        segmentStart: layout.segmentStart,
        segmentEnd: layout.segmentEnd,
      }))
      .sort((left, right) => left.segmentStart - right.segmentStart);
  }, [sceneLayoutsRef]);

  const resolveNativeScrollIntent = useCallback(
    (currentOffset: number, deltaPx: number): number =>
      resolveScrollIntentOffset({
        currentOffset,
        deltaPx,
        maxNativeOffset: getMaxNativeOffset(),
        segments: getCenterLockSegments(),
      }),
    [getCenterLockSegments, getMaxNativeOffset]
  );

  const setNativeOffset = useCallback(
    (offset: number): void => {
      const root = rootRef.current;
      if (!root) return;

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
    [direction, getMaxNativeOffset, rootRef]
  );

  const updateActiveScene = useCallback(
    (nativeOffset: number): void => {
      const layouts = sceneLayoutsRef.current;
      if (layouts.length === 0) return;

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
      if (activeSceneIndexRef.current === nearestIndex) return;

      const previousIndex = lastReportedSceneRef.current;
      activeSceneIndexRef.current = nearestIndex;
      updateSceneRenderSnapshotsRef.current(nativeOffset);
      if (previousIndex === nearestIndex) return;

      const transitionDirection = nearestIndex >= previousIndex ? 'forward' : 'backward';
      callbacks.common?.onSceneWillChange?.({
        fromIndex: previousIndex,
        toIndex: nearestIndex,
        direction: transitionDirection,
      });
      callbacks.common?.onSceneDidChange?.({
        fromIndex: previousIndex,
        toIndex: nearestIndex,
        direction: transitionDirection,
      });
      lastReportedSceneRef.current = nearestIndex;
    },
    [
      activeSceneIndexRef,
      callbacks.common,
      getViewportSpan,
      sceneLayoutsRef,
      updateSceneRenderSnapshotsRef,
    ]
  );

  const syncZoneStatesFromNativeOffset = useCallback(
    (nativeOffset: number, inputDirection: ScrollInputDirection | null): void => {
      const previousStates = previousZoneStatesRef.current;
      const nextStates: Record<string, SceneScrollTimelineState> = {};

      Object.entries(zoneStatesRef.current).forEach(([zoneId, state]) => {
        const layout = sceneLayoutsRef.current[state.sceneIndex];
        if (!layout || state.totalBudgetPx <= 0) {
          nextStates[zoneId] = { ...state, progressPx: 0, active: false, direction: null };
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

      const currentStates = zoneStatesRef.current;
      const nextEntries = Object.entries(nextStates);
      const unchanged =
        Object.keys(currentStates).length === nextEntries.length &&
        nextEntries.every(([zoneId, nextState]) => {
          const currentState = currentStates[zoneId];
          return (
            currentState?.progressPx === nextState.progressPx &&
            currentState.active === nextState.active &&
            currentState.direction === nextState.direction &&
            currentState.totalBudgetPx === nextState.totalBudgetPx
          );
        });

      if (!unchanged) {
        zoneStatesRef.current = nextStates;
        const currentTimeline = timelineStoreRef.current.getSnapshot();
        timelineStoreRef.current.setSnapshot({
          version: currentTimeline.version,
          zoneStates: nextStates,
        });
      }
      updateSceneRenderSnapshotsRef.current(nativeOffset);
      previousZoneStatesRef.current = nextStates;

      Object.entries(nextStates).forEach(([zoneId, state]) => {
        const previousState = previousStates[zoneId];
        const meta = zoneRegistryRef.current.get(zoneId);
        if (!meta) return;

        if (!previousState || Math.abs(previousState.progressPx - state.progressPx) > 0.5) {
          callbacks.scroll?.onZoneProgress?.({
            zoneId,
            sceneIndex: meta.sceneIndex,
            progress:
              state.totalBudgetPx > 0 ? clamp(state.progressPx / state.totalBudgetPx, 0, 1) : 0,
          });
        }
        if (!previousState?.active && state.active) {
          callbacks.scroll?.onZoneEnter?.({ zoneId, sceneIndex: meta.sceneIndex });
        } else if (previousState?.active && !state.active) {
          callbacks.scroll?.onZoneLeave?.({ zoneId, sceneIndex: meta.sceneIndex });
        }
      });
    },
    [
      callbacks.scroll,
      sceneLayoutsRef,
      timelineStoreRef,
      updateSceneRenderSnapshotsRef,
      zoneRegistryRef,
      zoneStatesRef,
    ]
  );

  const syncNativeScrollState = useCallback(
    (fromGesture = false): void => {
      const root = rootRef.current;
      if (!root) return;

      if (fromGesture) {
        if (!isScrollingGestureRef.current) {
          updateViewportMetrics();
          measureSceneLayouts();
        }
        isScrollingGestureRef.current = true;
      }
      const rawOffset = direction === 'x' ? root.scrollLeft : root.scrollTop;
      const previousOffset = previousScrollOffsetRef.current;
      const resolvedOffset = resolveNativeScrollIntent(previousOffset, rawOffset - previousOffset);
      if (Math.abs(resolvedOffset - rawOffset) > 0.5) setNativeOffset(resolvedOffset);

      const nextDirection =
        Math.abs(resolvedOffset - previousOffset) <= 0.5
          ? scrollDirectionRef.current
          : resolvedOffset > previousOffset
            ? 'forward'
            : 'backward';
      previousScrollOffsetRef.current = resolvedOffset;
      scrollOffsetRef.current = resolvedOffset;
      scrollOffsetStore.setSnapshot(resolvedOffset);
      scrollDirectionRef.current = nextDirection;
      isScrollingStateRef.current = true;
      setIsScrolling((current) => (current ? current : true));

      if (scrollingIdleTimerRef.current !== null) {
        window.clearTimeout(scrollingIdleTimerRef.current);
      }
      scrollingIdleTimerRef.current = window.setTimeout(() => {
        isScrollingStateRef.current = false;
        setIsScrolling(false);
        isScrollingGestureRef.current = false;
        scrollingIdleTimerRef.current = null;
        updateSceneRenderSnapshotsRef.current(scrollOffsetRef.current);
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
      isScrollingStateRef,
      measureSceneLayouts,
      resolveNativeScrollIntent,
      rootRef,
      scrollDirectionRef,
      scrollOffsetRef,
      scrollOffsetStore,
      setNativeOffset,
      syncZoneStatesFromNativeOffset,
      updateActiveScene,
      updateSceneRenderSnapshotsRef,
      updateViewportMetrics,
    ]
  );

  const applyNativeScrollDelta = useCallback(
    (deltaPx: number): boolean => {
      const root = rootRef.current;
      if (!root || deltaPx === 0) return false;

      const currentOffset = direction === 'x' ? root.scrollLeft : root.scrollTop;
      const nextOffset = resolveNativeScrollIntent(currentOffset, deltaPx);
      if (Math.abs(nextOffset - currentOffset) <= 0.5) return false;

      setNativeOffset(nextOffset);
      syncNativeScrollState(true);
      return true;
    },
    [direction, resolveNativeScrollIntent, rootRef, setNativeOffset, syncNativeScrollState]
  );

  const applyNativeScrollbarOffset = useCallback(
    (targetOffset: number): void => {
      const root = rootRef.current;
      const currentOffset = root
        ? direction === 'x'
          ? root.scrollLeft
          : root.scrollTop
        : scrollOffsetRef.current;
      setNativeOffset(resolveNativeScrollIntent(currentOffset, targetOffset - currentOffset));
      syncNativeScrollState(true);
    },
    [
      direction,
      resolveNativeScrollIntent,
      rootRef,
      scrollOffsetRef,
      setNativeOffset,
      syncNativeScrollState,
    ]
  );

  const goToScrollZone = useCallback(
    (zoneId: string, options?: { animated?: boolean }): void => {
      const root = rootRef.current;
      const state = zoneStatesRef.current[zoneId];
      const layout = state ? sceneLayoutsRef.current[state.sceneIndex] : null;
      if (!root || !layout) return;

      root.scrollTo({
        top: direction === 'x' ? undefined : layout.centerLockOffset,
        left: direction === 'x' ? layout.centerLockOffset : undefined,
        behavior: options?.animated === false ? 'auto' : 'smooth',
      });
      previousScrollOffsetRef.current = layout.centerLockOffset;
      scrollOffsetRef.current = layout.centerLockOffset;
      scrollOffsetStore.setSnapshot(layout.centerLockOffset);
      syncZoneStatesFromNativeOffset(layout.centerLockOffset, null);
      updateActiveScene(layout.centerLockOffset);
    },
    [
      direction,
      rootRef,
      sceneLayoutsRef,
      scrollOffsetRef,
      scrollOffsetStore,
      syncZoneStatesFromNativeOffset,
      updateActiveScene,
      zoneStatesRef,
    ]
  );

  useScrollInputBindings({
    rootRef,
    direction,
    getViewportSpan,
    applyNativeScrollDelta,
  });

  useEffect(() => {
    return (): void => {
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
    if (typeof window === 'undefined') return;

    const handleResize = (): void => {
      updateViewportMetrics();
      measureSceneLayouts();
      syncNativeScrollState();
    };
    window.addEventListener('resize', handleResize);
    return (): void => window.removeEventListener('resize', handleResize);
  }, [measureSceneLayouts, syncNativeScrollState, updateViewportMetrics]);

  return {
    isScrolling,
    scrollContentSpan,
    syncNativeScrollState,
    applyNativeScrollDelta,
    applyNativeScrollbarOffset,
    goToScrollZone,
  };
}
