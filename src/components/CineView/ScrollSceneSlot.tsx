import React, { memo, useCallback, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { buildSceneTimelineState } from './directScrollHelpers';
import type {
  SceneAuthoringCompatProps,
  SceneLayoutInfo,
  ScrollInputDirection,
} from './directScrollHelpers';
import type { ScrollModeConfig } from '../../types';
import type { GroupedCallbacks } from './regroupCallbacks';
import type { SceneScrollTimelineState } from '../Scene/sceneScrollRuntime';
import type { KeyedScrollExternalStore } from '../runtime/scrollExternalStore';
import type { ScrollSceneFrameStore } from '../runtime/scrollSceneFrameStore';

export interface ScrollSceneRenderSnapshot {
  sceneLayout: SceneLayoutInfo | null;
  sceneZoneState: SceneScrollTimelineState | null;
  sceneTimelineState: ReturnType<typeof buildSceneTimelineState> | null;
  isCurrent: boolean;
  isBackdropActive: boolean;
  visualViewportOffset: number;
  isScrolling: boolean;
  scrollDirection: ScrollInputDirection | null;
  activeSceneIndex: number;
  viewportWidth: number;
  viewportHeight: number;
  firstSceneEnterGateKnown: boolean;
  firstSceneEnterActive: boolean;
  firstSceneEnterReady: boolean;
  direction: 'x' | 'y';
  sceneCount: number;
  sceneSizing: ScrollModeConfig['sceneSizing'];
  exposeTakeoverDebugData: boolean;
  takeoverSceneSpan: number | null;
}

export const EMPTY_SCROLL_SCENE_SNAPSHOT: ScrollSceneRenderSnapshot = {
  sceneLayout: null,
  sceneZoneState: null,
  sceneTimelineState: null,
  isCurrent: false,
  isBackdropActive: false,
  visualViewportOffset: 0,
  isScrolling: false,
  scrollDirection: null,
  activeSceneIndex: 0,
  viewportWidth: 0,
  viewportHeight: 0,
  firstSceneEnterGateKnown: false,
  firstSceneEnterActive: false,
  firstSceneEnterReady: false,
  direction: 'y',
  sceneCount: 0,
  sceneSizing: 'content',
  exposeTakeoverDebugData: false,
  takeoverSceneSpan: null,
};

export type ScrollSceneSnapshotList = readonly (ScrollSceneRenderSnapshot | undefined)[];
export type ScrollSceneSnapshotStore = KeyedScrollExternalStore<
  ScrollSceneSnapshotList,
  number,
  ScrollSceneRenderSnapshot
>;

interface ScrollSceneSlotProps {
  child: React.ReactElement<SceneAuthoringCompatProps>;
  store: ScrollSceneSnapshotStore;
  frameStore?: ScrollSceneFrameStore;
  sceneIndex: number;
  setWrapperRef: (sceneIndex: number, node: HTMLDivElement | null) => void;
  scrollCallbacks?: GroupedCallbacks['scroll'];
}

export function areScrollSceneRenderSnapshotsEqual(
  previous: ScrollSceneRenderSnapshot,
  next: ScrollSceneRenderSnapshot
): boolean {
  const previousTimeline = previous.sceneTimelineState;
  const nextTimeline = next.sceneTimelineState;
  const timelineEqual =
    previousTimeline === nextTimeline ||
    (previousTimeline !== null &&
      nextTimeline !== null &&
      previousTimeline.phase === nextTimeline.phase &&
      previousTimeline.rangeStart === nextTimeline.rangeStart &&
      previousTimeline.rangeEnd === nextTimeline.rangeEnd &&
      previousTimeline.rangeLength === nextTimeline.rangeLength &&
      previousTimeline.enterLength === nextTimeline.enterLength &&
      previousTimeline.exitLength === nextTimeline.exitLength);
  const previousZone = previous.sceneZoneState;
  const nextZone = next.sceneZoneState;
  const zoneEqual =
    previousZone === nextZone ||
    (previousZone !== null &&
      nextZone !== null &&
      previousZone.zoneId === nextZone.zoneId &&
      previousZone.sceneIndex === nextZone.sceneIndex &&
      previousZone.totalBudgetPx === nextZone.totalBudgetPx &&
      previousZone.active === nextZone.active &&
      previousZone.direction === nextZone.direction &&
      previousZone.approach === nextZone.approach &&
      previousZone.sequence === nextZone.sequence);

  return (
    previous.sceneLayout === next.sceneLayout &&
    zoneEqual &&
    timelineEqual &&
    previous.isCurrent === next.isCurrent &&
    previous.isBackdropActive === next.isBackdropActive &&
    previous.isScrolling === next.isScrolling &&
    previous.scrollDirection === next.scrollDirection &&
    previous.activeSceneIndex === next.activeSceneIndex &&
    previous.viewportWidth === next.viewportWidth &&
    previous.viewportHeight === next.viewportHeight &&
    previous.firstSceneEnterGateKnown === next.firstSceneEnterGateKnown &&
    previous.firstSceneEnterActive === next.firstSceneEnterActive &&
    previous.firstSceneEnterReady === next.firstSceneEnterReady &&
    previous.direction === next.direction &&
    previous.sceneCount === next.sceneCount &&
    previous.sceneSizing === next.sceneSizing &&
    previous.exposeTakeoverDebugData === next.exposeTakeoverDebugData &&
    previous.takeoverSceneSpan === next.takeoverSceneSpan
  );
}

export const ScrollSceneSlot = memo(function ScrollSceneSlot({
  child,
  store,
  frameStore,
  sceneIndex,
  setWrapperRef,
  scrollCallbacks,
}: ScrollSceneSlotProps): JSX.Element {
  const subscribe = useCallback(
    (listener: () => void) => store.subscribeKey(sceneIndex, listener),
    [sceneIndex, store]
  );
  const getSnapshot = useCallback(
    () => store.getKeySnapshot(sceneIndex) ?? EMPTY_SCROLL_SCENE_SNAPSHOT,
    [sceneIndex, store]
  );
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const {
    sceneLayout,
    sceneZoneState,
    sceneTimelineState,
    isCurrent,
    isBackdropActive,
    visualViewportOffset,
    isScrolling,
    scrollDirection,
    activeSceneIndex,
    viewportWidth,
    viewportHeight,
    firstSceneEnterGateKnown,
    firstSceneEnterActive,
    firstSceneEnterReady,
    direction,
    sceneCount,
    sceneSizing,
    exposeTakeoverDebugData,
    takeoverSceneSpan,
  } = snapshot;
  const isTakeoverScene = Boolean(child.props.scroll);
  const takeoverShellRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const shell = takeoverShellRef.current;
    if (!shell) return undefined;

    if (!exposeTakeoverDebugData || !isTakeoverScene || !frameStore) {
      shell.removeAttribute('data-cineview-takeover-progress-px');
      shell.removeAttribute('data-cineview-takeover-viewport-offset');
      return undefined;
    }

    const applyDebugFrame = (): void => {
      const frame = frameStore.getKeySnapshot(sceneIndex);
      shell.setAttribute(
        'data-cineview-takeover-progress-px',
        frame?.zoneProgressPx === null || frame?.zoneProgressPx === undefined
          ? ''
          : String(frame.zoneProgressPx)
      );
      shell.setAttribute(
        'data-cineview-takeover-viewport-offset',
        frame ? String(frame.visualViewportOffset) : ''
      );
    };

    // Apply before subscribing so the first committed debug probe reflects the
    // latest imperative frame even when the React snapshot is intentionally stale.
    applyDebugFrame();
    return frameStore.subscribeKey(sceneIndex, applyDebugFrame);
  }, [exposeTakeoverDebugData, frameStore, isTakeoverScene, sceneIndex]);
  const viewportSpan = Math.max(direction === 'x' ? viewportWidth : viewportHeight, 1);
  const sceneNeedsViewportSpan = sceneSizing === 'screen' && !isTakeoverScene;
  const flowSpan = sceneLayout?.flowSpan;
  const visualSpan = sceneLayout?.visualSpan ?? takeoverSceneSpan ?? viewportSpan;
  const takeoverOverflowInset = isTakeoverScene ? Math.max((visualSpan - viewportSpan) / 2, 0) : 0;
  const takeoverStickyInset = isTakeoverScene ? Math.max((viewportSpan - visualSpan) / 2, 0) : 0;
  const handleWrapperRef = useCallback(
    (node: HTMLDivElement | null): void => setWrapperRef(sceneIndex, node),
    [sceneIndex, setWrapperRef]
  );
  const cloned = React.cloneElement(
    child as unknown as React.ReactElement<Record<string, unknown>>,
    {
      layout:
        isTakeoverScene && takeoverSceneSpan !== null
          ? {
              ...child.props.layout,
              ...(direction === 'x' ? { width: takeoverSceneSpan } : { height: takeoverSceneSpan }),
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
          scrollCallbacks?.onSceneVisibilityChange?.(detail);
        },
      },
      sceneRuntime: {
        mode: 'scroll',
        direction,
        isActive: isCurrent,
        sceneIndex,
        totalScenes: sceneCount,
        currentSceneIndex: activeSceneIndex,
        transitionDirection: scrollDirection,
        isSceneAnimating: isScrolling,
        sharedElapsedMs: 0,
        sharedTimelineDurationMs: 0,
        viewportWidth,
        viewportHeight,
        firstSceneEnterGateKnown,
        firstSceneEnterActive,
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
        frameStore,
        sceneIndex,
      },
    }
  );

  return (
    <div
      key={child.key ?? `scene-${sceneIndex}`}
      ref={handleWrapperRef}
      data-scene-index={sceneIndex}
      style={{
        position: 'relative',
        width:
          isTakeoverScene && typeof flowSpan === 'number' && direction === 'x' ? flowSpan : '100%',
        minHeight: direction === 'y' && sceneNeedsViewportSpan ? '100vh' : undefined,
        minWidth: direction === 'x' && sceneNeedsViewportSpan ? '100vw' : undefined,
        ...(isTakeoverScene && typeof flowSpan === 'number'
          ? direction === 'x'
            ? { boxSizing: 'border-box', paddingLeft: takeoverOverflowInset }
            : { boxSizing: 'border-box', paddingTop: takeoverOverflowInset, height: flowSpan }
          : {}),
      }}
    >
      {isTakeoverScene ? (
        <div
          ref={takeoverShellRef}
          data-cineview-takeover-shell={sceneIndex}
          {...(exposeTakeoverDebugData
            ? {
                'data-cineview-takeover-active-zone': sceneZoneState?.active
                  ? sceneZoneState.zoneId
                  : '',
                'data-cineview-takeover-total-distance-px': sceneZoneState?.totalBudgetPx ?? '',
                'data-cineview-takeover-center-lock-offset': sceneLayout?.centerLockOffset ?? '',
                'data-cineview-takeover-segment-start': sceneLayout?.segmentStart ?? '',
                'data-cineview-takeover-segment-end': sceneLayout?.segmentEnd ?? '',
              }
            : {})}
          style={
            direction === 'x'
              ? {
                  position: 'sticky',
                  left: takeoverStickyInset,
                  width: visualSpan,
                  maxWidth: '100vw',
                  height: '100%',
                  overflow: 'hidden',
                  zIndex: sceneZoneState?.active ? 30 : undefined,
                }
              : {
                  position: 'sticky',
                  top: takeoverStickyInset,
                  width: '100%',
                  height: visualSpan,
                  maxHeight: '100vh',
                  overflow: 'hidden',
                  zIndex: sceneZoneState?.active ? 30 : undefined,
                }
          }
        >
          <div
            data-cineview-takeover-content={sceneIndex}
            style={
              direction === 'x'
                ? {
                    width: visualSpan,
                    height: '100%',
                    transform: `translateX(${-takeoverOverflowInset}px)`,
                  }
                : {
                    width: '100%',
                    height: visualSpan,
                    transform: `translateY(${-takeoverOverflowInset}px)`,
                  }
            }
          >
            {cloned}
          </div>
        </div>
      ) : (
        cloned
      )}
    </div>
  );
});
