import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from 'react';
import type { SlideDirection } from '../../types';
import { resolveZoneApproachBand } from '../Scene/sceneScrollRuntime';
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
import type { ScrollExternalStore } from '../runtime/scrollExternalStore';
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
  beginProgrammaticScroll: (targetOffset: number) => void;
}

// S-F2: arrival threshold for programmatic (self-issued) scrolls. Browsers
// land smooth-scroll animations on — or within a subpixel of — the requested
// offset, so 1px reliably detects completion without false positives from
// pass-through frames.
const PROGRAMMATIC_SCROLL_ARRIVAL_EPSILON_PX = 1;

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
  // S-F2: in-flight programmatic scroll target (goToZone / goToScene). While
  // set, scroll frames are self-issued — not user gestures — so
  // syncNativeScrollState must skip the anti-skip intent clamp for them: its
  // corrective behavior:'auto' scrollTo would abort the in-flight smooth
  // scroll per the CSSOM spec, stranding the user mid-way. Cleared on arrival
  // (|offset − target| ≤ epsilon) or by any real user input.
  const programmaticScrollTargetRef = useRef<number | null>(null);
  const previousZoneStatesRef = useRef<Record<string, SceneScrollTimelineState>>({});
  // onZoneProgress threshold baseline. Must be the LAST REPORTED value, not the
  // last synced frame: previousZoneStatesRef is overwritten every sync, so slow
  // scrolling (≤0.5px per frame) would reset the baseline each frame and starve
  // the callback forever. Mutated in place — no per-frame allocation.
  const lastReportedZoneProgressRef = useRef<Record<string, number>>({});
  const lastReportedSceneRef = useRef(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollContentSpan, setScrollContentSpan] = useState(1);
  const scrollContentSpanRef = useRef(1);

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

  const beginProgrammaticScroll = useCallback(
    (targetOffset: number): void => {
      programmaticScrollTargetRef.current = clamp(targetOffset, 0, getMaxNativeOffset());
    },
    [getMaxNativeOffset]
  );

  // Any real user input (wheel / touch / keyboard / scrollbar) reclaims
  // control from an in-flight programmatic smooth scroll: stop the animation
  // where it is (a behavior:'auto' scrollTo aborts it per CSSOM), re-anchor
  // the delta baseline at the real offset, and drop the in-flight flag so the
  // gesture goes through the normal anti-skip intent clamp again.
  const cancelProgrammaticScrollForUserInput = useCallback((): void => {
    if (programmaticScrollTargetRef.current === null) return;

    programmaticScrollTargetRef.current = null;
    const root = rootRef.current;
    if (!root) return;

    const rawOffset = clamp(
      direction === 'x' ? root.scrollLeft : root.scrollTop,
      0,
      getMaxNativeOffset()
    );
    setNativeOffset(rawOffset);
    previousScrollOffsetRef.current = rawOffset;
  }, [direction, getMaxNativeOffset, rootRef, setNativeOffset]);

  const updateActiveScene = useCallback(
    (nativeOffset: number, measuredViewportSpan = getViewportSpan()): void => {
      const layouts = sceneLayoutsRef.current;
      if (layouts.length === 0) return;

      const viewportCenter = nativeOffset + measuredViewportSpan / 2;
      // Containment wins outright; otherwise (viewport center parked in a gap
      // between scene ranges — plain document-flow content interleaved between
      // scenes) pick the scene whose range is CLOSEST to the center. The old
      // fallback jumped to layouts.length - 1 for any center past scene 0's
      // start, wrongly reporting the last scene while sitting right after an
      // early one.
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < layouts.length; index += 1) {
        const layout = layouts[index];
        if (viewportCenter >= layout.sceneStart && viewportCenter < layout.sceneEnd) {
          nearestIndex = index;
          break;
        }

        const distance =
          viewportCenter < layout.sceneStart
            ? layout.sceneStart - viewportCenter
            : viewportCenter - layout.sceneEnd;
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      }
      if (activeSceneIndexRef.current === nearestIndex) return;

      const previousIndex = lastReportedSceneRef.current;
      activeSceneIndexRef.current = nearestIndex;
      updateSceneRenderSnapshotsRef.current(nativeOffset);
      if (previousIndex === nearestIndex) return;

      const transitionDirection = nearestIndex >= previousIndex ? 'forward' : 'backward';
      callbacks.common?.onSceneEnter?.({
        fromIndex: previousIndex,
        toIndex: nearestIndex,
        direction: transitionDirection,
      });
      callbacks.common?.onSceneLeave?.({
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
    (
      nativeOffset: number,
      inputDirection: ScrollInputDirection | null,
      measuredViewportSpan = getViewportSpan()
    ): void => {
      const previousStates = previousZoneStatesRef.current;
      const currentStates = zoneStatesRef.current;
      // Read the viewport once for the whole gesture frame. Calling
      // getViewportSpan() inside each zone iteration repeats a live client
      // dimension read and scales layout work with the number of zones.
      const viewportSpan = measuredViewportSpan;
      const nextStates: Record<string, SceneScrollTimelineState> = {};

      Object.entries(currentStates).forEach(([zoneId, state]) => {
        const layout = sceneLayoutsRef.current[state.sceneIndex];
        if (!layout || state.totalBudgetPx <= 0) {
          nextStates[zoneId] =
            state.progressPx === 0 && !state.active && state.direction === null
              ? state
              : { ...state, progressPx: 0, active: false, direction: null };
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
        // Quantized approach band (Schmitt trigger inside): only crosses at
        // 1·viewport leaving / 1.5·viewports returning, so publishing stays
        // O(threshold crossings) — never per frame.
        const approachDistancePx = Math.max(
          layout.segmentStart - nativeOffset,
          nativeOffset - layout.segmentEnd,
          0
        );
        const approach = resolveZoneApproachBand(approachDistancePx, viewportSpan, state.approach);
        const nextState: SceneScrollTimelineState = {
          ...state,
          progressPx,
          active,
          direction: active ? inputDirection : null,
          approach,
        };
        nextStates[zoneId] =
          state.progressPx === nextState.progressPx &&
          state.active === nextState.active &&
          state.direction === nextState.direction &&
          state.approach === nextState.approach
            ? state
            : nextState;
      });

      const nextEntries = Object.entries(nextStates);
      const unchanged =
        Object.keys(currentStates).length === nextEntries.length &&
        nextEntries.every(([zoneId, nextState]) => currentStates[zoneId] === nextState);

      if (!unchanged) {
        zoneStatesRef.current = nextStates;
        timelineStoreRef.current.setSnapshot(nextStates);
      }
      updateSceneRenderSnapshotsRef.current(nativeOffset);
      previousZoneStatesRef.current = nextStates;

      Object.entries(nextStates).forEach(([zoneId, state]) => {
        const previousState = previousStates[zoneId];
        const meta = zoneRegistryRef.current.get(zoneId);
        if (!meta) return;

        const lastReportedProgressPx = lastReportedZoneProgressRef.current[zoneId];
        const atBoundary = state.progressPx === 0 || state.progressPx === state.totalBudgetPx;
        // Report against the last reported value (accumulated movement), and
        // always force the terminal 0 / full values through so consumers see
        // the exact endpoints even when the final frame moved ≤ 0.5px.
        const shouldReport =
          lastReportedProgressPx === undefined ||
          Math.abs(lastReportedProgressPx - state.progressPx) > 0.5 ||
          (atBoundary && lastReportedProgressPx !== state.progressPx);
        if (shouldReport) {
          lastReportedZoneProgressRef.current[zoneId] = state.progressPx;
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
      getViewportSpan,
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

      const rawOffset = direction === 'x' ? root.scrollLeft : root.scrollTop;
      // Input handlers eagerly apply the requested offset so takeover state is
      // available in the same event. Browsers then emit a native `scroll`
      // event for that exact write; the second callback has no new state to
      // publish and would repeat the entire zone/frame hot path.
      if (
        fromGesture &&
        isScrollingGestureRef.current &&
        programmaticScrollTargetRef.current === null &&
        Math.abs(rawOffset - previousScrollOffsetRef.current) <= TAKEOVER_PROGRESS_SNAP_EPSILON_PX
      ) {
        return;
      }

      if (fromGesture) {
        if (!isScrollingGestureRef.current) {
          updateViewportMetrics();
          measureSceneLayouts();
        }
        isScrollingGestureRef.current = true;
      }
      const previousOffset = previousScrollOffsetRef.current;
      const programmaticTarget = programmaticScrollTargetRef.current;
      let resolvedOffset: number;
      if (programmaticTarget !== null) {
        // S-F2: programmatic smooth-scroll frame. The animation is continuous,
        // so every crossed takeover segment naturally produces in-segment
        // frames — the anti-skip clamp (built to bound user gestures) must not
        // run: its corrective auto scrollTo would abort the smooth scroll.
        // Follow the real offset so the delta baseline stays frame-sized.
        resolvedOffset = clamp(rawOffset, 0, getMaxNativeOffset());
        if (
          Math.abs(resolvedOffset - programmaticTarget) <= PROGRAMMATIC_SCROLL_ARRIVAL_EPSILON_PX
        ) {
          programmaticScrollTargetRef.current = null;
        }
      } else {
        resolvedOffset = resolveNativeScrollIntent(previousOffset, rawOffset - previousOffset);
        if (Math.abs(resolvedOffset - rawOffset) > 0.5) setNativeOffset(resolvedOffset);
      }

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
      // Only real gestures enter the scrolling state. Programmatic syncs
      // (mount / resize / refreshLayout) used to flip isScrolling true for
      // 120ms, flashing the autoHide scrollbar and false-reporting
      // isSceneAnimating. They also must not reset an in-flight gesture's
      // idle timer.
      if (fromGesture) {
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
      }

      // Read native extent before frame-store subscribers write fixed-layer
      // geometry. This keeps the hot path ordered as layout reads first, visual
      // writes second, avoiding a synchronous read-after-write layout flush.
      const viewportSpan = getViewportSpan();
      const contentSpan = Math.max(
        direction === 'x' ? root.scrollWidth : root.scrollHeight,
        viewportSpan
      );
      syncZoneStatesFromNativeOffset(resolvedOffset, nextDirection, viewportSpan);
      updateActiveScene(resolvedOffset, viewportSpan);
      if (Math.abs(scrollContentSpanRef.current - contentSpan) > 0.5) {
        scrollContentSpanRef.current = contentSpan;
        setScrollContentSpan(contentSpan);
      }
    },
    [
      direction,
      getMaxNativeOffset,
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

      cancelProgrammaticScrollForUserInput();
      const currentOffset = direction === 'x' ? root.scrollLeft : root.scrollTop;
      const nextOffset = resolveNativeScrollIntent(currentOffset, deltaPx);
      if (Math.abs(nextOffset - currentOffset) <= 0.5) return false;

      setNativeOffset(nextOffset);
      syncNativeScrollState(true);
      return true;
    },
    [
      cancelProgrammaticScrollForUserInput,
      direction,
      resolveNativeScrollIntent,
      rootRef,
      setNativeOffset,
      syncNativeScrollState,
    ]
  );

  const applyNativeScrollbarOffset = useCallback(
    (targetOffset: number): void => {
      cancelProgrammaticScrollForUserInput();
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
      cancelProgrammaticScrollForUserInput,
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

      if (options?.animated !== false) {
        // S-F2: smooth navigation. Mark the in-flight target and let the
        // browser's smooth-scroll frames drive zone/timeline state through
        // syncNativeScrollState. Do NOT pre-seed previousScrollOffsetRef with
        // the target — that made the first smooth frame look like a giant
        // reverse gesture, and the intent clamp's corrective auto scrollTo
        // aborted the smooth scroll mid-way.
        beginProgrammaticScroll(layout.centerLockOffset);
        root.scrollTo({
          top: direction === 'x' ? undefined : layout.centerLockOffset,
          left: direction === 'x' ? layout.centerLockOffset : undefined,
          behavior: 'smooth',
        });
        return;
      }

      root.scrollTo({
        top: direction === 'x' ? undefined : layout.centerLockOffset,
        left: direction === 'x' ? layout.centerLockOffset : undefined,
        behavior: 'auto',
      });
      previousScrollOffsetRef.current = layout.centerLockOffset;
      scrollOffsetRef.current = layout.centerLockOffset;
      scrollOffsetStore.setSnapshot(layout.centerLockOffset);
      syncZoneStatesFromNativeOffset(layout.centerLockOffset, null);
      updateActiveScene(layout.centerLockOffset);
    },
    [
      beginProgrammaticScroll,
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
      programmaticScrollTargetRef.current = null;
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
    beginProgrammaticScroll,
  };
}
