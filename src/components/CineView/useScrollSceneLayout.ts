import { useCallback, useRef, type MutableRefObject, type RefObject } from 'react';
import type { ScrollModeConfig, SlideDirection } from '../../types';
import {
  getRelativeOffset,
  getSceneTransitionConfig,
  resolveRootSceneStackMode,
  resolveScrollSceneDeclaredSpan,
  resolveTakeoverSceneSpan,
  type SceneAuthoringCompatProps,
  type SceneLayoutInfo,
} from './directScrollHelpers';
import type { ScrollZoneRegistryRef } from './useScrollZoneRegistry';

interface UseScrollSceneLayoutParams {
  rootRef: RefObject<HTMLDivElement | null>;
  direction: SlideDirection;
  scenes: React.ReactElement<SceneAuthoringCompatProps>[];
  sceneSizing: ScrollModeConfig['sceneSizing'];
  getViewportSpan: () => number;
  getZoneIdForScene: (sceneIndex: number) => string | null;
  getZoneDistance: (sceneIndex: number) => number;
  zoneRegistryRef: ScrollZoneRegistryRef;
  scrollOffsetRef: MutableRefObject<number>;
  updateSceneRenderSnapshotsRef: MutableRefObject<(nativeOffset: number) => void>;
}

export interface ScrollSceneLayoutPort {
  sceneLayoutsRef: MutableRefObject<SceneLayoutInfo[]>;
  sceneWrapperRefs: MutableRefObject<Array<HTMLDivElement | null>>;
  measureSceneLayouts: () => SceneLayoutInfo[];
  setSceneWrapperRef: (sceneIndex: number, node: HTMLDivElement | null) => void;
}

export function useScrollSceneLayout({
  rootRef,
  direction,
  scenes,
  sceneSizing,
  getViewportSpan,
  getZoneIdForScene,
  getZoneDistance,
  zoneRegistryRef,
  scrollOffsetRef,
  updateSceneRenderSnapshotsRef,
}: UseScrollSceneLayoutParams): ScrollSceneLayoutPort {
  const sceneLayoutsRef = useRef<SceneLayoutInfo[]>([]);
  const sceneWrapperRefs = useRef<Array<HTMLDivElement | null>>([]);

  const measureSceneLayouts = useCallback((): SceneLayoutInfo[] => {
    const root = rootRef.current;
    if (!root) return sceneLayoutsRef.current;

    const viewportSpan = getViewportSpan();
    const nextLayouts = scenes.map((scene, index) => {
      const wrapper = sceneWrapperRefs.current[index];
      const sceneProps = scene.props;
      const transitionConfig = getSceneTransitionConfig(sceneProps);
      const isTakeoverScene = Boolean(sceneProps.scroll);
      const rawTakeoverSpan =
        direction === 'x'
          ? (sceneProps.layout?.width ?? sceneProps.sceneWidth)
          : (sceneProps.layout?.height ?? sceneProps.sceneHeight);
      const renderedTakeoverSpan = isTakeoverScene
        ? resolveTakeoverSceneSpan(rawTakeoverSpan, root.clientWidth, root.clientHeight)
        : null;
      const zoneId = getZoneIdForScene(index);
      const zoneElement = zoneId ? zoneRegistryRef.current.get(zoneId)?.element : null;
      const declaredSpan = isTakeoverScene
        ? renderedTakeoverSpan
        : resolveScrollSceneDeclaredSpan(
            sceneProps,
            direction,
            root.clientWidth,
            root.clientHeight
          );
      const measuredSpan =
        direction === 'x'
          ? Math.max(
              isTakeoverScene ? (zoneElement?.offsetWidth ?? 0) : (wrapper?.offsetWidth ?? 0),
              isTakeoverScene ? (zoneElement?.clientWidth ?? 0) : (wrapper?.clientWidth ?? 0),
              0
            )
          : Math.max(
              isTakeoverScene ? (zoneElement?.offsetHeight ?? 0) : (wrapper?.offsetHeight ?? 0),
              isTakeoverScene ? (zoneElement?.clientHeight ?? 0) : (wrapper?.clientHeight ?? 0),
              0
            );
      const visualSpan = isTakeoverScene
        ? Math.max(renderedTakeoverSpan ?? measuredSpan, 1)
        : sceneSizing === 'screen'
          ? Math.max(measuredSpan, declaredSpan ?? 0, viewportSpan, 1)
          : Math.max(measuredSpan, declaredSpan ?? 0, 1);
      const timelineDistancePx = isTakeoverScene ? getZoneDistance(index) : 0;
      const flowSpan = isTakeoverScene
        ? Math.max(visualSpan, viewportSpan) + timelineDistancePx
        : visualSpan;
      const sceneStart = wrapper ? getRelativeOffset(wrapper, root, direction) : 0;
      const sceneEnd = sceneStart + flowSpan;
      const centerLockOffset = Math.max(sceneStart + visualSpan / 2 - viewportSpan / 2, 0);
      const hasEnter = Boolean(
        transitionConfig.enterAnimation && transitionConfig.enterAnimation !== 'none' && index > 0
      );
      const hasExit = Boolean(
        transitionConfig.exitAnimation &&
        transitionConfig.exitAnimation !== 'none' &&
        index < scenes.length - 1
      );
      const requestedEnterLength = Math.max(
        0,
        transitionConfig.scrollEnterLength ?? (hasEnter ? transitionConfig.transitionDurationMs : 0)
      );
      const requestedExitLength = Math.max(
        0,
        transitionConfig.scrollExitLength ?? (hasExit ? transitionConfig.transitionDurationMs : 0)
      );
      const maxPhaseLength = Math.max(Math.min(flowSpan, viewportSpan), 1);
      const enterLength = Math.min(requestedEnterLength, maxPhaseLength);
      const exitLength = Math.min(requestedExitLength, maxPhaseLength);

      return {
        sceneStart,
        sceneEnd,
        visualSpan,
        flowSpan,
        timelineDistancePx,
        centerLockOffset,
        segmentStart: centerLockOffset,
        segmentEnd: centerLockOffset + timelineDistancePx,
        enterLength,
        exitLength,
        stackMode: resolveRootSceneStackMode(sceneProps),
      };
    });

    sceneLayoutsRef.current = nextLayouts;
    updateSceneRenderSnapshotsRef.current(scrollOffsetRef.current);
    return nextLayouts;
  }, [
    direction,
    getViewportSpan,
    getZoneDistance,
    getZoneIdForScene,
    rootRef,
    sceneSizing,
    scenes,
    scrollOffsetRef,
    updateSceneRenderSnapshotsRef,
    zoneRegistryRef,
  ]);

  const setSceneWrapperRef = useCallback(
    (sceneIndex: number, node: HTMLDivElement | null): void => {
      sceneWrapperRefs.current[sceneIndex] = node;
    },
    []
  );

  return { sceneLayoutsRef, sceneWrapperRefs, measureSceneLayouts, setSceneWrapperRef };
}
