import type { RefObject } from 'react';
import { useContext, useEffect, useId } from 'react';
import type { ScrollMode } from '../../types';
import { SceneScrollRuntimeContext } from './sceneScrollRuntime';

interface SceneScrollTakeoverConfig {
  sceneId?: string;
  sceneIndex: number;
  mode: ScrollMode;
  scroll?: {
    zoneId?: string;
    trigger?: 'center-lock';
  };
  elementRef: RefObject<HTMLElement>;
}

export function useSceneScrollTakeover({
  sceneId,
  sceneIndex,
  mode,
  scroll,
  elementRef,
}: SceneScrollTakeoverConfig): string | null {
  const runtime = useContext(SceneScrollRuntimeContext);
  const autoId = useId();
  const zoneId = scroll?.zoneId ?? sceneId ?? `scene-zone-${autoId}`;
  const registerZone = runtime?.registerZone;
  const unregisterZone = runtime?.unregisterZone;
  const setZoneElement = runtime?.setZoneElement;
  const hasScrollTakeover = Boolean(scroll);
  const trigger = scroll?.trigger ?? 'center-lock';

  useEffect(() => {
    if (mode !== 'scroll' || !hasScrollTakeover || !registerZone || !unregisterZone) {
      return;
    }

    registerZone(zoneId, {
      sceneIndex,
      trigger,
    });

    return (): void => {
      unregisterZone(zoneId, sceneIndex);
    };
  }, [mode, hasScrollTakeover, registerZone, unregisterZone, zoneId, sceneIndex, trigger]);

  useEffect(() => {
    if (mode !== 'scroll' || !hasScrollTakeover || !setZoneElement) {
      return;
    }

    setZoneElement(zoneId, sceneIndex, elementRef.current);

    return (): void => {
      setZoneElement(zoneId, sceneIndex, null);
    };
  }, [elementRef, mode, hasScrollTakeover, sceneIndex, setZoneElement, zoneId]);

  if (mode !== 'scroll' || !scroll) {
    return null;
  }

  return zoneId;
}
