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
import { createKeyedScrollExternalStore } from './scrollExternalStore';
import {
  areScrollSceneRenderSnapshotsEqual,
  EMPTY_SCROLL_SCENE_SNAPSHOT,
  type ScrollSceneRenderSnapshot,
  type ScrollSceneSnapshotList,
  type ScrollSceneSnapshotStore,
} from './ScrollSceneSlot';
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
  firstSceneEnterActive: boolean;
  firstSceneEnterReady: boolean;
  exposeTakeoverDebugData: boolean;
  scrollOffsetRef: MutableRefObject<number>;
  updateSceneRenderSnapshotsRef: MutableRefObject<(nativeOffset: number) => void>;
}

export interface ScrollSceneSnapshotsPort {
  store: ScrollSceneSnapshotStore;
  updateSceneRenderSnapshots: (nativeOffset: number) => void;
}

type PreviousSnapshotInputs = readonly [
  scenes: React.ReactElement<SceneAuthoringCompatProps>[],
  layouts: SceneLayoutInfo[],
  zoneStates: Record<string, SceneScrollTimelineState>,
  nativeOffset: number,
  activeSceneIndex: number,
  backdropSceneIndex: number | null,
  viewportWidth: number,
  viewportHeight: number,
  firstSceneEnterActive: boolean,
  firstSceneEnterReady: boolean,
  direction: SlideDirection,
  sceneSizing: ScrollModeConfig['sceneSizing'],
  exposeTakeoverDebugData: boolean,
];

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
  firstSceneEnterActive,
  firstSceneEnterReady,
  exposeTakeoverDebugData,
  scrollOffsetRef,
  updateSceneRenderSnapshotsRef,
}: UseScrollSceneSnapshotsParams): ScrollSceneSnapshotsPort {
  const storeRef = useRef(
    createKeyedScrollExternalStore<ScrollSceneSnapshotList, number, ScrollSceneRenderSnapshot>(
      [],
      (snapshot, sceneIndex) => snapshot[sceneIndex]
    )
  );
  const previousInputsRef = useRef<PreviousSnapshotInputs | null>(null);
  const zoneStateBySceneIndexRef = useRef<Array<SceneScrollTimelineState | undefined>>([]);

  const updateSceneRenderSnapshots = useCallback(
    (nativeOffset: number): void => {
      const zoneStates = timelineStoreRef.current.getSnapshot();
      const layouts = sceneLayoutsRef.current;
      const viewport = viewportSizeRef.current;
      const viewportSpan = Math.max(direction === 'x' ? viewport.width : viewport.height, 1);
      const currentIndex = activeSceneIndexRef.current;
      const activeLayout = layouts[currentIndex];
      const scrollBackdropSceneIndex =
        activeLayout?.stackMode === 'cover' && currentIndex > 0 ? currentIndex - 1 : null;
      const previousSnapshots = storeRef.current.getSnapshot();
      const previousInputs = previousInputsRef.current;
      const isScrolling = isScrollingStateRef.current;
      const scrollDirection = scrollDirectionRef.current;
      const forceFullUpdate =
        previousInputs === null ||
        previousInputs[0] !== scenes ||
        previousInputs[1] !== layouts ||
        previousInputs[6] !== viewport.width ||
        previousInputs[7] !== viewport.height ||
        previousInputs[10] !== direction ||
        previousInputs[11] !== sceneSizing ||
        previousInputs[12] !== exposeTakeoverDebugData;
      const dirtySceneIndices = new Set<number>();
      const markScene = (sceneIndex: number | null): void => {
        if (sceneIndex !== null && sceneIndex >= 0 && sceneIndex < scenes.length) {
          dirtySceneIndices.add(sceneIndex);
        }
      };
      const markActiveNeighborhood = (sceneIndex: number): void => {
        markScene(sceneIndex - 1);
        markScene(sceneIndex);
        markScene(sceneIndex + 1);
      };

      if (forceFullUpdate) {
        zoneStateBySceneIndexRef.current.length = 0;
        for (const zoneId in zoneStates) {
          const state = zoneStates[zoneId];
          zoneStateBySceneIndexRef.current[state.sceneIndex] = state;
        }
        for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
          dirtySceneIndices.add(sceneIndex);
        }
      } else {
        const [
          ,
          ,
          previousZoneStates,
          previousNativeOffset,
          previousActiveSceneIndex,
          previousBackdropSceneIndex,
          previousViewportWidth,
          previousViewportHeight,
          previousFirstSceneEnterActive,
          previousFirstSceneEnterReady,
        ] = previousInputs;
        for (const zoneId in zoneStates) {
          const state = zoneStates[zoneId];
          const previousState = previousZoneStates[zoneId];
          if (state === previousState) continue;
          if (
            previousState &&
            previousState.sceneIndex !== state.sceneIndex &&
            zoneStateBySceneIndexRef.current[previousState.sceneIndex] === previousState
          ) {
            zoneStateBySceneIndexRef.current[previousState.sceneIndex] = undefined;
          }
          zoneStateBySceneIndexRef.current[state.sceneIndex] = state;
          markScene(previousState?.sceneIndex ?? null);
          markScene(state.sceneIndex);
        }
        for (const zoneId in previousZoneStates) {
          if (zoneId in zoneStates) continue;
          const previousState = previousZoneStates[zoneId];
          if (zoneStateBySceneIndexRef.current[previousState.sceneIndex] === previousState) {
            zoneStateBySceneIndexRef.current[previousState.sceneIndex] = undefined;
          }
          markScene(previousState.sceneIndex);
        }

        const previousViewportSpan = Math.max(
          direction === 'x' ? previousViewportWidth : previousViewportHeight,
          1
        );
        for (let sceneIndex = 0; sceneIndex < layouts.length; sceneIndex += 1) {
          const layout = layouts[sceneIndex];
          const intersectsCurrentViewport =
            nativeOffset < layout.sceneEnd && nativeOffset + viewportSpan > layout.sceneStart;
          const intersectsPreviousViewport =
            previousNativeOffset < layout.sceneEnd &&
            previousNativeOffset + previousViewportSpan > layout.sceneStart;
          if (intersectsCurrentViewport || intersectsPreviousViewport) markScene(sceneIndex);
        }

        markActiveNeighborhood(previousActiveSceneIndex);
        markActiveNeighborhood(currentIndex);
        markScene(previousBackdropSceneIndex);
        markScene(scrollBackdropSceneIndex);
        if (
          previousFirstSceneEnterActive !== firstSceneEnterActive ||
          previousFirstSceneEnterReady !== firstSceneEnterReady
        ) {
          markScene(0);
        }
      }

      const nextSnapshots = forceFullUpdate ? [] : previousSnapshots.slice();
      let changed = forceFullUpdate;

      dirtySceneIndices.forEach((sceneIndex) => {
        const scene = scenes[sceneIndex];
        if (!scene) return;
        const sceneLayout = layouts[sceneIndex] ?? null;
        const sceneZoneState = zoneStateBySceneIndexRef.current[sceneIndex] ?? null;
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
        const timelineIsLive =
          sceneTimelineState?.phase === 'enter' ||
          sceneTimelineState?.phase === 'hold' ||
          sceneTimelineState?.phase === 'exit';
        const sceneIsLive = isCurrent || isBackdropActive || timelineIsLive;
        const nextSnapshot: ScrollSceneRenderSnapshot = {
          sceneLayout,
          sceneZoneState,
          sceneTimelineState,
          isCurrent,
          isBackdropActive,
          visualViewportOffset,
          isScrolling: sceneIsLive && isScrolling,
          scrollDirection: sceneIsLive && isScrolling ? scrollDirection : null,
          activeSceneIndex: currentIndex,
          viewportWidth: viewport.width,
          viewportHeight: viewport.height,
          firstSceneEnterGateKnown: true,
          firstSceneEnterActive: sceneIndex === 0 && firstSceneEnterActive,
          firstSceneEnterReady: sceneIndex === 0 && firstSceneEnterReady,
          direction,
          sceneCount: scenes.length,
          sceneSizing,
          exposeTakeoverDebugData,
          takeoverSceneSpan,
        };

        const previous = previousSnapshots[sceneIndex] ?? EMPTY_SCROLL_SCENE_SNAPSHOT;
        if (areScrollSceneRenderSnapshotsEqual(previous, nextSnapshot)) {
          nextSnapshots[sceneIndex] = previous;
        } else {
          nextSnapshots[sceneIndex] = nextSnapshot;
          changed = true;
        }
      });

      if (changed) storeRef.current.setSnapshot(nextSnapshots);
      previousInputsRef.current = [
        scenes,
        layouts,
        zoneStates,
        nativeOffset,
        currentIndex,
        scrollBackdropSceneIndex,
        viewport.width,
        viewport.height,
        firstSceneEnterActive,
        firstSceneEnterReady,
        direction,
        sceneSizing,
        exposeTakeoverDebugData,
      ];
    },
    [
      activeSceneIndexRef,
      direction,
      exposeTakeoverDebugData,
      firstSceneEnterActive,
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
