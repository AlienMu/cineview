import { CineView, Scene } from 'cineview';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMotionValue } from 'framer-motion';
import type { DragCommitDetail, DragDetail } from 'cineview';
import { AmbientStage } from './AmbientStage';
import { SceneCut } from './SceneCut';
import { SceneFlux } from './SceneFlux';
import { SceneRolling } from './SceneRolling';
import { SceneSlate } from './SceneSlate';
import { SceneSync } from './SceneSync';
import { TemporalMotionProvider } from './TemporalMotion';
import '../../styles/temporal-drag.css';

export const TemporalDragExperience = memo(function TemporalDragExperience(): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const calibrationTimerRef = useRef<number | null>(null);
  const calibrationCleanupRef = useRef<number | null>(null);
  const directionRef = useRef<DragDetail['direction']>(null);
  const dragProgress = useMotionValue(0);
  const signedDragProgress = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);

  const updateDirection = useCallback((direction: DragDetail['direction']): void => {
    if (!direction || directionRef.current === direction) return;
    directionRef.current = direction;
    const root = rootRef.current;
    if (root) root.dataset.dragDirection = direction;
  }, []);

  const handleDragStart = useCallback(
    ({ direction }: DragDetail): void => {
      dragProgress.set(0);
      signedDragProgress.set(0);
      updateDirection(direction);
      setIsDragging(true);
    },
    [dragProgress, signedDragProgress, updateDirection]
  );
  const handleDragProgress = useCallback(
    ({ direction, progress }: DragDetail): void => {
      dragProgress.set(progress);
      signedDragProgress.set((direction === 'backward' ? -1 : 1) * progress);
      updateDirection(direction);
    },
    [dragProgress, signedDragProgress, updateDirection]
  );
  const finishDrag = useCallback((): void => {
    dragProgress.set(0);
    signedDragProgress.set(0);
    directionRef.current = null;
    const root = rootRef.current;
    if (root) delete root.dataset.dragDirection;
    setIsDragging(false);
  }, [dragProgress, signedDragProgress]);
  const handleDragCommit = useCallback(
    ({ targetSceneIndex }: DragCommitDetail): void => {
      finishDrag();
      if (calibrationTimerRef.current !== null) window.clearTimeout(calibrationTimerRef.current);
      if (calibrationCleanupRef.current !== null)
        window.clearTimeout(calibrationCleanupRef.current);
      calibrationTimerRef.current = window.setTimeout(() => {
        const ticks = rootRef.current?.querySelector('.s01-dial__ticks');
        if (!ticks || (targetSceneIndex !== 0 && targetSceneIndex !== 1)) return;
        ticks.classList.add('is-calibrating');
        calibrationCleanupRef.current = window.setTimeout(
          () => ticks.classList.remove('is-calibrating'),
          450
        );
      }, 500);
    },
    [finishDrag]
  );
  const callbacks = useMemo(
    () => ({
      onDragStart: handleDragStart,
      onDragProgress: handleDragProgress,
      onDragCancel: finishDrag,
      onDragCommit: handleDragCommit,
    }),
    [finishDrag, handleDragCommit, handleDragProgress, handleDragStart]
  );

  useEffect(
    () => () => {
      if (calibrationTimerRef.current !== null) window.clearTimeout(calibrationTimerRef.current);
      if (calibrationCleanupRef.current !== null)
        window.clearTimeout(calibrationCleanupRef.current);
    },
    []
  );

  return (
    <div ref={rootRef} className="drag-temporal" data-dragging={isDragging}>
      <TemporalMotionProvider>
        <CineView
          config={{ size: 390 }}
          mode="drag"
          modes={{
            drag: {
              direction: 'y',
              transitionDuration: 720,
              dragTimeScale: 16,
              threshold: {
                minVelocity: 0,
                maxVelocity: 1200,
                minRatio: 0.15,
                maxRatio: 0.32,
              },
            },
          }}
          callbacks={callbacks}
        >
          <Scene
            sceneId="rolling"
            className="tp-scene tp-scene--01"
            layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
          >
            <SceneRolling isDragging={isDragging} signedDragProgress={signedDragProgress} />
          </Scene>
          <Scene
            sceneId="slate"
            className="tp-scene tp-scene--02"
            layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
          >
            <SceneSlate />
          </Scene>
          <Scene
            sceneId="sync"
            className="tp-scene tp-scene--03"
            layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
          >
            <SceneSync />
          </Scene>
          <Scene
            sceneId="flux"
            className="tp-scene tp-scene--04"
            layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
          >
            <SceneFlux dragProgress={dragProgress} />
          </Scene>
          <Scene
            sceneId="cut"
            className="tp-scene tp-scene--05"
            layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
          >
            <SceneCut />
          </Scene>
        </CineView>
        {/* Ambient light layer: drifting key-light, projector ray sweep, and dust
            motes. Sits ABOVE the opaque scenes but BELOW the grain texture, using
            mix-blend-mode:screen so it only adds light (center type stays crisp).
            Persists across every act; NOT inside the CineView tree. */}
        <AmbientStage />
        {/* Texture layer (v3 §3): film grain + scanline + vignette. Sits above the
            scenes, pointer-events:none, NOT inside the CineView tree — pure decoration. */}
        <div className="tp-texture" aria-hidden="true">
          <div className="tp-texture__grain" />
          <div className="tp-texture__scanline" />
          <div className="tp-texture__vignette" />
        </div>
      </TemporalMotionProvider>
    </div>
  );
});
