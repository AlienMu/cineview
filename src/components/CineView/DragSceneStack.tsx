import React from 'react';
import type { MutableRefObject } from 'react';
import type { DragModeConfig, SceneProps, ScrollMode } from '../../types';
import type {
  DragRelease,
  DragReleaseInput,
  SceneManagerActions,
} from '../../hooks/useSceneManager';

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
  dragTimeScale: number;
  dragProgress: number;
  dragTimelineProgress: number;
  renderProgress: number;
  isDragging: boolean;
  sharedTimelineDurationMs: number;
  dragRelease: DragRelease | null;
  firstSceneEnterActive: boolean;
  firstSceneEnterReady: boolean;
  direction: 'forward' | 'backward' | null;
  isAnimating: boolean;
  viewportWidth: number;
  viewportHeight: number;
  sceneActions: SceneManagerActions;
  sceneWrapperRefs: MutableRefObject<Array<HTMLDivElement | null>>;
  onSceneChange: (
    direction: 'forward' | 'backward',
    progressRatio?: number,
    committedElapsedMs?: number,
    timelineDuration?: number
  ) => void;
  onDragProgressChange: (progress: number) => void;
  onDraggingChange: (dragging: boolean) => void;
  onDragRelease: (release: DragReleaseInput | null) => void;
  onDragReset: () => void;
  onFirstSceneEnterComplete: () => void;
}

export function DragSceneStack({
  scenes,
  visibleSceneIndices,
  currentScene,
  totalScenes,
  mode,
  dragConfig,
  dragTimeScale,
  dragProgress,
  dragTimelineProgress,
  renderProgress,
  isDragging,
  sharedTimelineDurationMs,
  dragRelease,
  firstSceneEnterActive,
  firstSceneEnterReady,
  direction,
  isAnimating,
  viewportWidth,
  viewportHeight,
  sceneActions,
  sceneWrapperRefs,
  onSceneChange,
  onDragProgressChange,
  onDraggingChange,
  onDragRelease,
  onDragReset,
  onFirstSceneEnterComplete,
}: DragSceneStackProps): JSX.Element {
  return (
    <>
      {scenes.map((scene, index) => {
        if (!visibleSceneIndices.has(index)) return null;

        const isCurrent = index === currentScene;
        const sceneProps = scene.props as DragSceneAuthoringCompatProps;
        const slideDirection = dragConfig?.direction ?? sceneProps.slideDirection ?? 'y';
        const scenePosition: React.CSSProperties = {
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        };

        if (mode === 'drag') {
          let clampedProgress = renderProgress;
          if (currentScene === 0 && renderProgress < 0) clampedProgress = 0;
          if (currentScene === totalScenes - 1 && renderProgress > 0) clampedProgress = 0;

          const offset = (index - currentScene - clampedProgress) * 100;
          scenePosition.transform =
            slideDirection === 'y'
              ? `translate3d(0, ${offset}%, 0)`
              : `translate3d(${offset}%, 0, 0)`;
          scenePosition.visibility = 'visible';
          scenePosition.opacity = 1;
          scenePosition.pointerEvents = isCurrent ? 'auto' : 'none';
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
            viewportWidth,
            viewportHeight,
            firstSceneEnterActive: firstSceneEnterActive && index === 0,
            firstSceneEnterReady: firstSceneEnterReady && index === 0,
          },
          dragRuntime: {
            progress: dragProgress,
            renderProgress,
            timelineProgress: dragTimelineProgress,
            isDragging,
            release: dragRelease,
            threshold: dragConfig?.threshold,
            dragTimeScale,
            onCommit: onSceneChange,
            onReset: onDragReset,
            onActivationComplete:
              index === 0 && firstSceneEnterActive
                ? onFirstSceneEnterComplete
                : sceneActions.completeDragTransition,
            onProgressChange: onDragProgressChange,
            onRenderProgressChange: sceneActions.setRenderProgress,
            onTimelineProgressChange: sceneActions.setDragTimelineProgress,
            onDraggingChange,
            onRelease: onDragRelease,
            onSharedTimelineDurationChange: sceneActions.setSharedTimelineDurationMs,
          },
          onSceneChange,
        });

        return (
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
