import React, { useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { MotionValue } from 'framer-motion';
import type { DragModeConfig, SceneProps, ScrollMode } from '../../types';
import { resolveDragTimelineConfig } from '../../utils/dragTimelineMapping';
import type {
  DragRelease,
  DragReleaseInput,
  SceneManagerActions,
} from '../../hooks/useSceneManager';
import type { DragRenderLane, DragTakeoverSnapshot, SceneActivationRecord } from '../Scene/types';
import type {
  DragSceneTransaction,
  PreparedSceneInvalidation,
  PreparedSceneSnapshot,
} from '../Scene/dragPreparedState';
import { useIsomorphicLayoutEffect } from '../../utils/useIsomorphicLayoutEffect';

type DragSceneAuthoringCompatProps = SceneProps & {
  slideDirection?: 'x' | 'y';
};

interface DragSceneStackProps {
  scenes: React.ReactElement[];
  visibleSceneIndices: Set<number>;
  currentScene: number;
  totalScenes: number;
  mode: ScrollMode;
  dragConfig?: DragModeConfig;
  dragProgress: number;
  dragTimelineProgress: number;
  renderProgress: number;
  renderProgressMotion: MotionValue<number>;
  timelineProgressMotion: MotionValue<number>;
  isDragging: boolean;
  sharedTimelineDurationMs: number;
  dragRelease: DragRelease | null;
  sceneActivations: ReadonlyMap<number, SceneActivationRecord>;
  firstSceneEnterActive: boolean;
  firstSceneEnterReady: boolean;
  direction: 'forward' | 'backward' | null;
  isAnimating: boolean;
  viewportWidth: number;
  viewportHeight: number;
  sceneActions: SceneManagerActions;
  sceneWrapperRefs: MutableRefObject<Array<HTMLDivElement | null>>;
  /** CineView-owned shared render-lane slot (D-F1); stable ref. */
  renderLaneRef: MutableRefObject<DragRenderLane | null>;
  /** Synchronous baseline shared by the render and element lanes during takeover. */
  takeoverSnapshot: MutableRefObject<DragTakeoverSnapshot | null>;
  candidateSuspended: boolean;
  onCandidateSuspensionChange: (suspended: boolean) => boolean;
  onElementContinuationChange: (sceneIndex: number, active: boolean) => void;
  onPointerSessionStart: () => void;
  dragTransaction: DragSceneTransaction | null;
  onPrepared: (snapshot: PreparedSceneSnapshot) => void;
  onPreparedInvalidated: (invalidation: PreparedSceneInvalidation) => void;
  onOwnershipRequest: (direction: 'forward' | 'backward') => boolean;
  onSceneChange: (
    direction: 'forward' | 'backward',
    progressRatio?: number,
    committedElapsedMs?: number,
    timelineDuration?: number
  ) => void;
  onDragProgressChange: (progress: number) => void;
  onRenderProgressChange?: (progress: number) => void;
  onDragTimelineProgressChange: (progress: number) => void;
  onDraggingChange: (dragging: boolean) => void;
  onSharedTimelineDurationChange: (duration: number) => void;
  onDragRelease: (release: DragReleaseInput | null) => void;
  onDragReset: () => void;
  onTransactionComplete: (transactionId: symbol) => void;
  onFirstSceneEnterComplete: () => void;
}

interface DragSceneFrameProps {
  index: number;
  currentScene: number;
  totalScenes: number;
  direction: 'x' | 'y';
  renderProgressMotion: MotionValue<number>;
  style: React.CSSProperties;
  sceneWrapperRefs: MutableRefObject<Array<HTMLDivElement | null>>;
  children: React.ReactNode;
}

function DragSceneFrame({
  index,
  currentScene,
  totalScenes,
  direction,
  renderProgressMotion,
  style,
  sceneWrapperRefs,
  children,
}: DragSceneFrameProps): JSX.Element {
  const frameRef = useRef<HTMLDivElement | null>(null);

  useIsomorphicLayoutEffect(() => {
    const applyTransform = (renderProgress: number): void => {
      const frame = frameRef.current;
      if (!frame) return;
      let clampedProgress = renderProgress;
      if (currentScene === 0 && renderProgress < 0) clampedProgress = 0;
      if (currentScene === totalScenes - 1 && renderProgress > 0) clampedProgress = 0;
      const offset = (index - currentScene - clampedProgress) * 100;
      frame.style.transform =
        direction === 'y' ? `translate3d(0, ${offset}%, 0)` : `translate3d(${offset}%, 0, 0)`;
    };

    applyTransform(renderProgressMotion.get());
    return renderProgressMotion.on('change', applyTransform);
  }, [currentScene, direction, index, renderProgressMotion, totalScenes]);

  return (
    <div
      ref={(node) => {
        frameRef.current = node;
        sceneWrapperRefs.current[index] = node;
      }}
      style={style}
      data-scene-index={index}
    >
      {children}
    </div>
  );
}

export function DragSceneStack({
  scenes,
  visibleSceneIndices,
  currentScene,
  totalScenes,
  mode,
  dragConfig,
  dragProgress,
  dragTimelineProgress,
  renderProgress,
  renderProgressMotion,
  timelineProgressMotion,
  isDragging,
  sharedTimelineDurationMs,
  dragRelease,
  sceneActivations,
  firstSceneEnterActive,
  firstSceneEnterReady,
  direction,
  isAnimating,
  viewportWidth,
  viewportHeight,
  sceneActions,
  sceneWrapperRefs,
  renderLaneRef,
  takeoverSnapshot,
  candidateSuspended,
  onCandidateSuspensionChange,
  onElementContinuationChange,
  onPointerSessionStart,
  dragTransaction,
  onPrepared,
  onPreparedInvalidated,
  onOwnershipRequest,
  onSceneChange,
  onDragProgressChange,
  onRenderProgressChange,
  onDragTimelineProgressChange,
  onDraggingChange,
  onSharedTimelineDurationChange,
  onDragRelease,
  onDragReset,
  onTransactionComplete,
  onFirstSceneEnterComplete,
}: DragSceneStackProps): JSX.Element {
  return (
    <>
      {scenes.map((scene, index) => {
        if (!visibleSceneIndices.has(index)) return null;

        const isCurrent = index === currentScene;
        const sceneProps = scene.props as DragSceneAuthoringCompatProps;
        const slideDirection = dragConfig?.direction ?? sceneProps.slideDirection ?? 'y';
        const dragMappingConfig = resolveDragTimelineConfig(dragConfig, sceneProps.drag);
        const scenePosition: React.CSSProperties = {
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        };

        if (mode === 'drag') {
          scenePosition.visibility = 'visible';
          scenePosition.opacity = 1;
          // D-F7 rush re-grab: while a transition is in flight the page is
          // mid-slide, so the touch point usually falls on the INCOMING scene.
          const isTransitionInFlight = isDragging || isAnimating || dragTransaction !== null;
          scenePosition.pointerEvents = isCurrent || isTransitionInFlight ? 'auto' : 'none';
          scenePosition.contentVisibility = 'visible';
          scenePosition.transition = 'none';
          scenePosition.zIndex = isCurrent ? 10 : 1;
        } else {
          const backwardReveal =
            isAnimating &&
            direction === 'backward' &&
            (index === currentScene || index === currentScene + 1);
          const forwardStack =
            isAnimating &&
            direction === 'forward' &&
            (index === currentScene || index === currentScene - 1);
          const shouldShow = isCurrent || backwardReveal || forwardStack;
          scenePosition.visibility = shouldShow ? 'visible' : 'hidden';
          scenePosition.contentVisibility = shouldShow ? 'visible' : 'hidden';
          scenePosition.zIndex = isAnimating
            ? direction === 'backward'
              ? index === currentScene + 1
                ? 2
                : index === currentScene
                  ? 1
                  : 0
              : index === currentScene
                ? 2
                : index === currentScene - 1
                  ? 1
                  : 0
            : isCurrent
              ? 1
              : 0;
        }

        const sceneTransaction =
          dragTransaction?.targetSceneIndex === index ? dragTransaction : null;
        const handleActivationComplete = (): void => {
          if (index === 0 && firstSceneEnterActive) {
            onFirstSceneEnterComplete();
          } else {
            sceneActions.completeDragTransition();
          }
          if (sceneTransaction?.phase === 'settling') {
            onTransactionComplete(sceneTransaction.transactionId);
          }
        };

        const clonedScene = React.cloneElement(scene, {
          sceneRuntime: {
            mode,
            direction: slideDirection,
            isActive: isCurrent,
            sceneIndex: index,
            totalScenes: scenes.length,
            currentSceneIndex: currentScene,
            transitionDirection: direction,
            isSceneAnimating: isAnimating,
            sharedTimelineDurationMs,
            activationToken: sceneActivations.get(index)?.token ?? 0,
            activationKind: sceneActivations.get(index)?.kind ?? null,
            viewportWidth,
            viewportHeight,
            firstSceneEnterActive: firstSceneEnterActive && index === 0,
            firstSceneEnterReady: firstSceneEnterReady && index === 0,
          },
          dragRuntime: {
            progress: dragProgress,
            renderProgress,
            timelineProgress: dragTimelineProgress,
            renderProgressMotion,
            timelineProgressMotion,
            isDragging,
            release: dragRelease,
            threshold: dragConfig?.threshold,
            dragMappingConfig,
            transaction: sceneTransaction,
            onPrepared,
            onPreparedInvalidated,
            onOwnershipRequest,
            candidateSuspended,
            onCandidateSuspensionChange,
            takeoverSnapshot,
            onElementContinuationChange: (active: boolean): void => {
              onElementContinuationChange(index, active);
            },
            onPointerSessionStart,
            renderLane: renderLaneRef,
            onCommit: onSceneChange,
            onReset: onDragReset,
            onActivationComplete: handleActivationComplete,
            onTransactionComplete,
            onProgressChange: onDragProgressChange,
            onRenderProgressChange,
            onTimelineProgressChange: onDragTimelineProgressChange,
            onDraggingChange,
            onRelease: onDragRelease,
            onSharedTimelineDurationChange,
          },
          onSceneChange,
        });

        return mode === 'drag' ? (
          <DragSceneFrame
            key={index}
            index={index}
            currentScene={currentScene}
            totalScenes={totalScenes}
            direction={slideDirection}
            renderProgressMotion={renderProgressMotion}
            style={scenePosition}
            sceneWrapperRefs={sceneWrapperRefs}
          >
            {clonedScene}
          </DragSceneFrame>
        ) : (
          <div
            key={index}
            ref={(node) => {
              sceneWrapperRefs.current[index] = node;
            }}
            style={scenePosition}
            data-scene-index={index}
          >
            {clonedScene}
          </div>
        );
      })}
    </>
  );
}
