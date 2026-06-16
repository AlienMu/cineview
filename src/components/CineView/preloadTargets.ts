import type { CineViewPreloadTarget } from '../../types';

interface ScenePreloadTargetProps {
  sceneId?: string;
  scroll?: {
    zoneId?: string;
  };
  assets?: {
    preloadImages?: string[];
  };
}

interface ScenePreloadSceneLike {
  props: ScenePreloadTargetProps;
}

export function getScenePreloadImages(sceneProps: ScenePreloadTargetProps): string[] {
  return sceneProps.assets?.preloadImages ?? [];
}

export function resolveScenePreloadTargetImages(
  scenes: ScenePreloadSceneLike[],
  targets?: CineViewPreloadTarget[],
  options: { includeZoneIds?: boolean } = {}
): string[] {
  if (!targets || targets.length === 0) {
    return [];
  }

  const includeZoneIds = options.includeZoneIds ?? false;
  const seenUrls = new Set<string>();
  const resolvedUrls: string[] = [];

  const addSceneImages = (scene: ScenePreloadSceneLike | undefined): void => {
    if (!scene) {
      return;
    }

    getScenePreloadImages(scene.props).forEach((url) => {
      if (!url || seenUrls.has(url)) {
        return;
      }

      seenUrls.add(url);
      resolvedUrls.push(url);
    });
  };

  targets.forEach((target) => {
    if (typeof target === 'number') {
      if (Number.isInteger(target) && target >= 0 && target < scenes.length) {
        addSceneImages(scenes[target]);
      }
      return;
    }

    if (!target) {
      return;
    }

    scenes.forEach((scene) => {
      if (scene.props.sceneId === target) {
        addSceneImages(scene);
        return;
      }

      if (includeZoneIds && scene.props.scroll?.zoneId === target) {
        addSceneImages(scene);
      }
    });
  });

  return resolvedUrls;
}
