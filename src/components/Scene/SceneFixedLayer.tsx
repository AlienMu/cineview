import type { RefCallback } from 'react';
import type { FixedLayerMetrics } from './helpers';

interface SceneFixedLayerProps {
  sceneIndex: number;
  metrics: FixedLayerMetrics;
  setHostRef: RefCallback<HTMLDivElement>;
}

export function SceneFixedLayer({
  sceneIndex,
  metrics,
  setHostRef,
}: SceneFixedLayerProps): JSX.Element {
  return (
    <div
      data-scene-fixed-layer={sceneIndex}
      data-scene-fixed-role="clip"
      style={{
        position: 'absolute',
        inset: 0,
        width: metrics.clipWidth > 0 ? metrics.clipWidth : '100%',
        height: metrics.clipHeight > 0 ? metrics.clipHeight : '100%',
        overflow: 'hidden',
        pointerEvents: 'none',
        opacity: metrics.visible ? 1 : 0,
        visibility: metrics.visible ? 'visible' : 'hidden',
        zIndex: 20,
      }}
    >
      <div
        data-scene-fixed-layer={sceneIndex}
        data-scene-fixed-role="frame"
        style={{
          position: 'absolute',
          top: metrics.isHorizontal ? 0 : metrics.hostOffset,
          left: metrics.isHorizontal ? metrics.hostOffset : 0,
          width: metrics.isHorizontal ? (metrics.hostSpan > 0 ? metrics.hostSpan : '100%') : '100%',
          height: metrics.isHorizontal ? '100%' : metrics.hostSpan > 0 ? metrics.hostSpan : '100%',
          pointerEvents: 'none',
        }}
      >
        <div
          ref={setHostRef}
          data-scene-fixed-layer={sceneIndex}
          data-scene-fixed-host={sceneIndex}
          data-scene-fixed-role="host"
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            // The empty host must not cover interactive Scene children. Portaled
            // Position nodes carry their own pointer-events value.
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}
