/**
 * The public `useAnimateTimeline()` surface for one Animate.
 *
 * Split out of `Animate.tsx` (task-flow 2026-09-01, N6 batch B). Four MotionValues
 * plus the one subscription that keeps them fed from whichever driver is active —
 * scroll/arrival publish from their visual + phase motion, drag publishes from the
 * visual-state lane. Consumers read MotionValues, so a frame never becomes React
 * state: the whole point of this being a subscription and not a render path.
 */
import { useEffect, useMemo } from 'react';
import { useMotionValue } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import type {
  AnimatePhase,
  AnimateTimeline,
  AnimateTimelineFrame,
  AnimateTimelineSource,
  ScrollMode,
} from '../../types';
import type { SceneContextType } from './Animate';
import type { DragVisualState } from './dragVisualState';
import { normalizeDragPhase, resolveScrollEnterProgress } from './animateRenderState';

const IDLE_TIMELINE_FRAME: AnimateTimelineFrame = Object.freeze({
  progress: 0,
  signedProgress: 0,
  phase: 'idle',
  source: 'idle',
});

function resolveDragTimelineSource(
  sceneContext: SceneContextType | null,
  state: DragVisualState | null
): AnimateTimelineSource {
  if (!state) {
    return 'idle';
  }

  // A formal transaction remains the authoritative clock owner through its
  // terminal visual frame. In particular, a bounce reaches hidden/0 before the
  // transaction is released; publishing that final frame as idle would make
  // imperative consumers miss the last continuation write back to zero.
  switch (sceneContext?.dragTransaction?.phase) {
    case 'driving':
      return 'gesture';
    case 'settling':
    case 'bouncing':
      return 'continuation';
    case 'programmatic':
      return 'programmatic';
    default:
      break;
  }

  if (
    sceneContext?.dragRelease?.mode === 'settle' ||
    sceneContext?.dragRelease?.mode === 'bounce'
  ) {
    return 'continuation';
  }
  if (sceneContext?.dragRelease?.mode === 'enter' || sceneContext?.firstSceneEnterActive) {
    return 'programmatic';
  }
  return 'idle';
}

export interface UseAnimatePublicTimelineParams {
  mode: ScrollMode;
  isDragArrival: boolean;
  timelineLane: AnimateTimeline['lane'];
  sceneContext: SceneContextType | null;
  arrivalVisualMotion: MotionValue<number>;
  arrivalPhaseMotion: MotionValue<AnimatePhase>;
  scrollVisualMotion: MotionValue<number>;
  scrollPhaseMotion: MotionValue<AnimatePhase>;
  dragVisualState: MotionValue<DragVisualState | null>;
}

export function useAnimatePublicTimeline({
  mode,
  isDragArrival,
  timelineLane,
  sceneContext,
  arrivalVisualMotion,
  arrivalPhaseMotion,
  scrollVisualMotion,
  scrollPhaseMotion,
  dragVisualState,
}: UseAnimatePublicTimelineParams): AnimateTimeline {
  const publicProgress = useMotionValue(0);
  const publicSignedProgress = useMotionValue(0);
  const publicPhase = useMotionValue<AnimatePhase>('idle');
  const publicFrame = useMotionValue<AnimateTimelineFrame>(IDLE_TIMELINE_FRAME);

  useEffect(() => {
    const lane = mode === 'scroll' || isDragArrival ? timelineLane : 'drag';
    const publishFrame = (frame: AnimateTimelineFrame): void => {
      publicProgress.set(frame.progress);
      publicSignedProgress.set(frame.signedProgress);
      publicPhase.set(frame.phase);
      publicFrame.set(frame);
    };

    if (mode === 'scroll' || isDragArrival) {
      const visualSource = isDragArrival ? arrivalVisualMotion : scrollVisualMotion;
      const phaseSource = isDragArrival ? arrivalPhaseMotion : scrollPhaseMotion;
      const publishCurrentFrame = (): void => {
        const signedProgress = visualSource.get();
        publishFrame({
          progress: resolveScrollEnterProgress(signedProgress),
          signedProgress,
          phase: phaseSource.get(),
          source: lane === 'scroll' ? 'scroll' : 'visibility',
        });
      };

      publishCurrentFrame();
      const unsubscribeVisual = visualSource.on('change', publishCurrentFrame);
      const unsubscribePhase = phaseSource.on('change', publishCurrentFrame);
      return (): void => {
        unsubscribeVisual();
        unsubscribePhase();
      };
    }

    const updateDrag = (state: DragVisualState | null): void => {
      if (!state) {
        publishFrame(IDLE_TIMELINE_FRAME);
        return;
      }

      const progress = Math.max(0, Math.min(1, state.localProgress));
      const signedProgress =
        state.mode === 'outgoing' ? (state.direction === 'forward' ? 1 : -1) * progress : progress;
      publishFrame({
        progress,
        signedProgress,
        phase: normalizeDragPhase(state.mode, progress),
        source: resolveDragTimelineSource(sceneContext, state),
      });
    };

    updateDrag(dragVisualState.get());
    return dragVisualState.on('change', updateDrag);
  }, [
    arrivalPhaseMotion,
    arrivalVisualMotion,
    dragVisualState,
    isDragArrival,
    mode,
    publicFrame,
    publicPhase,
    publicProgress,
    publicSignedProgress,
    timelineLane,
    sceneContext,
    scrollPhaseMotion,
    scrollVisualMotion,
  ]);

  return useMemo<AnimateTimeline>(
    () => ({
      mode,
      lane: mode === 'scroll' || isDragArrival ? timelineLane : 'drag',
      progress: publicProgress,
      signedProgress: publicSignedProgress,
      phase: publicPhase,
      frame: publicFrame,
    }),
    [
      isDragArrival,
      mode,
      publicFrame,
      publicPhase,
      publicProgress,
      publicSignedProgress,
      timelineLane,
    ]
  );
}
