import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type { ScrollModeConfig, SlideDirection } from '../../types';
import type { SceneScrollTimelineState } from '../Scene/sceneScrollRuntime';
import {
  buildSceneTimelineState,
  resolveTakeoverSceneSpan,
  type SceneAuthoringCompatProps,
  type SceneLayoutInfo,
  type ScrollInputDirection,
} from './directScrollHelpers';
import { createScrollExternalStore, type ScrollExternalStore } from './scrollExternalStore';
import {
  areScrollSceneRenderSnapshotsEqual,
  EMPTY_SCROLL_SCENE_SNAPSHOT,
  type ScrollSceneRenderSnapshot,
} from './ScrollSceneSlot';
import type { ScrollSceneSnapshotMap } from './ScrollSceneStack';
import type { ScrollTimelineStore } from './useScrollZoneRegistry';

interface UseScrollSceneSnapshotsParams {
  scenes: React.ReactElement<SceneAuthoringCompatProps>[];
  sceneLayoutsRef: MutableRefObject<SceneLayoutInfo[]>;
  timelineStoreRef: MutableRefObject<ScrollTimelineStore>;
  viewportSizeRef: MutableRefObject<{ width: number; height: number }>;
  activeSceneIndexRef: MutableRefObject<number>;
  scrollDirectionRef: MutableRefObject<ScrollInputDirection | null>;
  isScrollingStateRef: MutableRefObject<boolean>;
  direction: SlideDirection;
  sceneSizing: ScrollModeConfig['sceneSizing'];
  firstSceneEnterReady: boolean;
  exposeTakeoverDebugData: boolean;
  scrollOffsetRef: MutableRefObject<number>;
  updateSceneRenderSnapshotsRef: MutableRefObject<(nativeOffset: number) => void>;
}

export interface ScrollSceneSnapshotsPort {
  store: ScrollExternalStore<ScrollSceneSnapshotMap>;
  updateSceneRenderSnapshots: (nativeOffset: number) => void;
}

export function useScrollSceneSnapshots({
  scenes,
  sceneLayoutsRef,
  timelineStoreRef,
  viewportSizeRef,
  activeSceneIndexRef,
  scrollDirectionRef,
  isScrollingStateRef,
  direction,
  sceneSizing,
  firstSceneEnterReady,
  exposeTakeoverDebugData,
  scrollOffsetRef,
  updateSceneRenderSnapshotsRef,
}: UseScrollSceneSnapshotsParams): ScrollSceneSnapshotsPort {
  const storeRef = useRef(createScrollExternalStore<ScrollSceneSnapshotMap>(new Map()));

  const updateSceneRenderSnapshots = useCallback(
    (nativeOffset: number): void => {
      const timelineSnapshot = timelineStoreRef.current.getSnapshot();
      const zoneStateBySceneIndex = new Map<number, SceneScrollTimelineState>();
      Object.values(timelineSnapshot.zoneStates).forEach((state) => {
        zoneStateBySceneIndex.set(state.sceneIndex, state);
      });

      const viewport = viewportSizeRef.current;
      const viewportSpan = Math.max(direction === 'x' ? viewport.width : viewport.height, 1);
      const currentIndex = activeSceneIndexRef.current;
      const activeLayout = sceneLayoutsRef.current[currentIndex];
      const scrollBackdropSceneIndex =
        activeLayout?.stackMode === 'cover' && currentIndex > 0 ? currentIndex - 1 : null;
      const previousSnapshots = storeRef.current.getSnapshot();
      const nextSnapshots = new Map<number, ScrollSceneRenderSnapshot>();
      let changed = previousSnapshots.size !== scenes.length;

      scenes.forEach((scene, sceneIndex) => {
        const sceneLayout = sceneLayoutsRef.current[sceneIndex] ?? null;
        const sceneZoneState = zoneStateBySceneIndex.get(sceneIndex) ?? null;
        const isTakeoverScene = Boolean(scene.props.scroll);
        const isCurrent = sceneIndex === currentIndex || Boolean(sceneZoneState?.active);
        const isBackdropActive = scrollBackdropSceneIndex === sceneIndex;
        const visualViewportOffset =
          isTakeoverScene && sceneZoneState?.active && sceneLayout
            ? sceneLayout.centerLockOffset
            : nativeOffset;
        const sceneTimelineState = sceneLayout
          ? buildSceneTimelineState(sceneLayout, visualViewportOffset, viewportSpan)
          : null;
        const rawTakeoverSpan =
          direction === 'x'
            ? (scene.props.layout?.width ?? scene.props.sceneWidth)
            : (scene.props.layout?.height ?? scene.props.sceneHeight);
        const takeoverSceneSpan = isTakeoverScene
          ? resolveTakeoverSceneSpan(rawTakeoverSpan, viewport.width, viewport.height)
          : null;
        const nextSnapshot: ScrollSceneRenderSnapshot = {
          sceneLayout,
          sceneZoneState,
          sceneTimelineState,
          isCurrent,
          isBackdropActive,
          visualViewportOffset,
          isScrolling: isScrollingStateRef.current,
          scrollDirection: scrollDirectionRef.current,
          activeSceneIndex: currentIndex,
          viewportWidth: viewport.width,
          viewportHeight: viewport.height,
          firstSceneEnterReady,
          direction,
          sceneCount: scenes.length,
          sceneSizing,
          exposeTakeoverDebugData,
          takeoverSceneSpan,
        };

        const previous = previousSnapshots.get(sceneIndex) ?? EMPTY_SCROLL_SCENE_SNAPSHOT;
        if (areScrollSceneRenderSnapshotsEqual(previous, nextSnapshot)) {
          nextSnapshots.set(sceneIndex, previous);
        } else {
          nextSnapshots.set(sceneIndex, nextSnapshot);
          changed = true;
        }
      });

      if (changed) storeRef.current.setSnapshot(nextSnapshots);
    },
    [
      activeSceneIndexRef,
      direction,
      exposeTakeoverDebugData,
      firstSceneEnterReady,
      isScrollingStateRef,
      sceneLayoutsRef,
      sceneSizing,
      scenes,
      scrollDirectionRef,
      timelineStoreRef,
      viewportSizeRef,
    ]
  );

  updateSceneRenderSnapshotsRef.current = updateSceneRenderSnapshots;
  useEffect(() => {
    updateSceneRenderSnapshots(scrollOffsetRef.current);
  }, [scrollOffsetRef, updateSceneRenderSnapshots]);

  return { store: storeRef.current, updateSceneRenderSnapshots };
}
