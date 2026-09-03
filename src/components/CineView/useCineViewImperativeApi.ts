import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ForwardedRef,
  type MutableRefObject,
} from 'react';
import type { CineViewPreloadTarget, CineViewRef, PerformanceMetrics } from '../../types';
import { performanceMonitor } from '../../utils/performanceMonitor';
import { resolveScenePreloadTargetImages } from './preloadTargets';
import type { GroupedCallbacks } from './regroupCallbacks';

interface SceneActionsPort {
  goToScene: (index: number, animated?: boolean) => void;
}

interface PreloadActionsPort {
  addUrls: (urls: string[], priority?: boolean) => void;
  startPreload: () => Promise<void>;
}

interface UseCineViewImperativeApiParams {
  ref: ForwardedRef<CineViewRef>;
  currentSceneRef: MutableRefObject<number>;
  scenesRef: MutableRefObject<React.ReactElement[]>;
  sceneActionsRef: MutableRefObject<SceneActionsPort>;
  preloadActionsRef: MutableRefObject<PreloadActionsPort>;
  measureViewportRef: MutableRefObject<(() => void) | null>;
  resolvedCallbacksRef: MutableRefObject<GroupedCallbacks>;
}

export function useCineViewImperativeApi({
  ref,
  currentSceneRef,
  scenesRef,
  sceneActionsRef,
  preloadActionsRef,
  measureViewportRef,
  resolvedCallbacksRef,
}: UseCineViewImperativeApiParams): CineViewRef {
  const goToScene = useCallback(
    (index: number, animated = true): void => {
      const activeSceneIndex = currentSceneRef.current;
      const sceneCount = scenesRef.current.length;
      if (index >= 0 && index < sceneCount && index !== activeSceneIndex) {
        resolvedCallbacksRef.current.drag?.onDragEnd?.({
          sceneIndex: activeSceneIndex,
          targetSceneIndex: index,
          progress: 1,
          direction: index > activeSceneIndex ? 'forward' : 'backward',
          elapsedMs: 0,
          timelineDurationMs: 0,
        });
      }

      sceneActionsRef.current.goToScene(index, animated);
    },
    [currentSceneRef, resolvedCallbacksRef, sceneActionsRef, scenesRef]
  );

  const refreshLayout = useCallback((): void => {
    measureViewportRef.current?.();
  }, [measureViewportRef]);

  const preload = useCallback(
    async (targets?: CineViewPreloadTarget[]): Promise<void> => {
      const targetImages = resolveScenePreloadTargetImages(
        scenesRef.current as Array<{
          props: {
            sceneId?: string;
            scroll?: { zoneId?: string };
            assets?: { preloadImages?: string[] };
          };
        }>,
        targets,
        {
          includeZoneIds: true,
        }
      );
      if (targetImages.length > 0) {
        preloadActionsRef.current.addUrls(targetImages, true);
      }

      await preloadActionsRef.current.startPreload();
    },
    [preloadActionsRef, scenesRef]
  );

  const getCurrentIndex = useCallback((): number => currentSceneRef.current, [currentSceneRef]);
  const getPerformanceMetrics = useCallback(
    (): PerformanceMetrics => performanceMonitor.getMetrics(),
    []
  );
  const runtimeApi = useMemo<CineViewRef>(
    () => ({
      goToScene,
      refreshLayout,
      preload,
      getCurrentIndex,
      getPerformanceMetrics,
    }),
    [getCurrentIndex, getPerformanceMetrics, goToScene, preload, refreshLayout]
  );

  useImperativeHandle(ref, () => runtimeApi, [runtimeApi]);

  const onReadyFiredRef = useRef(false);
  useEffect(() => {
    if (onReadyFiredRef.current) {
      return;
    }

    onReadyFiredRef.current = true;
    resolvedCallbacksRef.current.common?.onReady?.(runtimeApi);
  }, [resolvedCallbacksRef, runtimeApi]);

  return runtimeApi;
}
