import React, { useContext, useEffect, useId, useMemo, useRef } from 'react';
import { SceneIdentityContext } from '../Scene/Scene';
import { ScrollZoneContext, ScrollZoneRuntimeContext } from './runtime';
import type { ScrollZoneProps } from '../../types';

export const ScrollZone: React.FC<ScrollZoneProps> = ({
  zoneId,
  trigger = 'center-lock',
  replayOnReenter = true,
  budget = 'auto',
  children,
}) => {
  const autoId = useId();
  const resolvedZoneId = zoneId ?? `scroll-zone-${autoId}`;
  const sceneIndex = useContext(SceneIdentityContext);
  const runtime = useContext(ScrollZoneRuntimeContext);
  const elementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!runtime?.registerZone || !runtime?.unregisterZone || sceneIndex === null) return;

    runtime.registerZone(resolvedZoneId, {
      sceneIndex,
      trigger,
      budget,
      replayOnReenter,
    });

    return () => {
      runtime.unregisterZone(resolvedZoneId);
    };
  }, [
    budget,
    replayOnReenter,
    resolvedZoneId,
    runtime,
    runtime?.registerZone,
    runtime?.unregisterZone,
    sceneIndex,
    trigger,
  ]);

  useEffect(() => {
    if (!runtime?.setZoneElement) return;

    runtime.setZoneElement(resolvedZoneId, elementRef.current);

    return () => {
      runtime.setZoneElement(resolvedZoneId, null);
    };
  }, [resolvedZoneId, runtime, runtime?.setZoneElement]);

  const contextValue = useMemo(() => resolvedZoneId, [resolvedZoneId]);

  return (
    <ScrollZoneContext.Provider value={contextValue}>
      <div
        ref={elementRef}
        data-cineview-scroll-zone={resolvedZoneId}
        style={{ position: 'relative', width: '100%' }}
      >
        {children}
      </div>
    </ScrollZoneContext.Provider>
  );
};

ScrollZone.displayName = 'ScrollZone';
