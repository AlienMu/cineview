import { useEffect, useRef, type RefCallback } from 'react';
import type { FixedLayerMetrics } from './helpers';
import { getFixedLayerMetrics } from './helpers';
import type { ScrollSceneFrameStore } from '../runtime/scrollSceneFrameStore';

interface SceneFixedLayerProps {
  sceneIndex: number;
  metrics: FixedLayerMetrics;
  setHostRef: RefCallback<HTMLDivElement>;
  frameStore?: ScrollSceneFrameStore;
  direction?: 'x' | 'y';
  viewportWidth?: number;
  viewportHeight?: number;
}

export function SceneFixedLayer({
  sceneIndex,
  metrics,
  setHostRef,
  frameStore,
  direction = 'y',
  viewportWidth = 0,
  viewportHeight = 0,
}: SceneFixedLayerProps): React.JSX.Element {
  const clipRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!frameStore || typeof sceneIndex !== 'number') return undefined;

    const apply = (): void => {
      const frame = frameStore.getKeySnapshot(sceneIndex);
      if (!frame) return;
      const nextMetrics = getFixedLayerMetrics({
        effectiveMode: 'scroll',
        effectiveDirection: direction,
        globalScrollTimelineState: frame.timelineState,
        globalScrollViewportOffset: frame.visualViewportOffset,
        globalViewportWidth: viewportWidth,
        globalViewportHeight: viewportHeight,
      });
      const clip = clipRef.current;
      const frameElement = frameRef.current;
      if (!clip || !frameElement) return;
      clip.style.width = nextMetrics.clipWidth > 0 ? `${nextMetrics.clipWidth}px` : '100%';
      clip.style.height = nextMetrics.clipHeight > 0 ? `${nextMetrics.clipHeight}px` : '100%';
      clip.style.opacity = nextMetrics.visible ? '1' : '0';
      clip.style.visibility = nextMetrics.visible ? 'visible' : 'hidden';
      frameElement.style.top = nextMetrics.isHorizontal ? '0px' : `${nextMetrics.hostOffset}px`;
      frameElement.style.left = nextMetrics.isHorizontal ? `${nextMetrics.hostOffset}px` : '0px';
      frameElement.style.width = nextMetrics.isHorizontal
        ? nextMetrics.hostSpan > 0
          ? `${nextMetrics.hostSpan}px`
          : '100%'
        : '100%';
      frameElement.style.height = nextMetrics.isHorizontal
        ? '100%'
        : nextMetrics.hostSpan > 0
          ? `${nextMetrics.hostSpan}px`
          : '100%';
    };

    apply();
    return frameStore.subscribeKey(sceneIndex, apply);
  }, [direction, frameStore, sceneIndex, viewportHeight, viewportWidth]);

  return (
    <div
      ref={clipRef}
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
        ref={frameRef}
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
