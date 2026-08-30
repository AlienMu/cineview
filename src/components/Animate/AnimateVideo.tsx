import { forwardRef, useContext, useEffect, useRef } from 'react';
import type { CSSProperties, MutableRefObject, VideoHTMLAttributes } from 'react';
import type { AnimationType } from '../../types';
import { VideoFrameRenderer } from '../../media/VideoFrameRenderer';
import type { VideoFrameRendererControl } from '../../media/VideoFrameRenderer';
import {
  SceneScrollTakeoverContext,
  useSceneScrollZoneApproach,
} from '../Scene/sceneScrollRuntime';
import { Animate } from './Animate';
import { useAnimateTimeline } from './animateTimeline';

const NEUTRAL_ENTER: AnimationType = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
};

type NativeVideoEventProps = Pick<
  VideoHTMLAttributes<HTMLVideoElement>,
  'onEnded' | 'onPlay' | 'onPause' | 'onTimeUpdate' | 'onError'
>;

export interface AnimateVideoProps extends NativeVideoEventProps {
  /**
   * Video resource URL. Videos authored for scrubbing should use dense keyframes;
   * all-keyframe encoding provides the most predictable reverse-seek performance.
   */
  src: string;
  'aria-label'?: string;
  width?: number | string;
  height?: number | string;
  style?: CSSProperties;
  /** Whether this component eagerly fills the shared video preload cache. */
  preload?: boolean;
  poster?: string;
  playbackRate?: number;
  /** Optional video-time interval driven by progress, including reverse intervals. */
  scrubRange?: readonly [fromSeconds: number, toSeconds: number];
  animateId?: string;
  duration?: {
    enter?: number;
    exit?: number;
  };
  /** Defaults to a neutral variant so frame scrubbing remains the visible animation. */
  enterAnimation?: AnimationType;
  exitAnimation?: AnimationType;
  timeline?: {
    delay?: number;
    after?: string;
  };
  visibility?: {
    replay?: boolean;
    enterMargin?: number;
    exitMargin?: number;
  };
  /**
   * Scroll mode, takeover zones only (default `false`). When `true`, the
   * decoded-frame residency of the scrub video follows the zone's approach
   * band (task-flow 2026-08-14, Plan A "release when far / preload when near"):
   *
   * - Leaving the zone beyond 1.5 viewports (band `'far'`) drops the decoded
   *   frames/textures via `pause + removeAttribute('src') + load()` — probe
   *   evidence shows those frames otherwise cost real compositor time in the
   *   scenes the viewer scrolls to next.
   * - Returning within 1 viewport of the zone (band `'near'`) re-attaches the
   *   source (blob already in memory, zero network) and catches the seek up to
   *   the current timeline position once metadata is back.
   *
   * The release threshold sits deliberately outside the preload threshold
   * (Schmitt ordering) so hovering between them cannot flap. Ignored outside
   * scroll takeover zones and in drag mode. Releasing only happens after the
   * timeline has actually been scrubbed/played once (an un-watched video has
   * nothing resident to free).
   */
  releaseOnLeave?: boolean;
}

type AnimateVideoContentProps = Pick<
  AnimateVideoProps,
  | 'src'
  | 'aria-label'
  | 'width'
  | 'height'
  | 'style'
  | 'preload'
  | 'poster'
  | 'playbackRate'
  | 'scrubRange'
  | 'releaseOnLeave'
  | 'onEnded'
  | 'onPlay'
  | 'onPause'
  | 'onTimeUpdate'
  | 'onError'
>;

/**
 * Band-driven media residency (releaseOnLeave). Lives inside the Animate child
 * so the timeline MotionValue is available for the "has actually been scrubbed"
 * gate; the approach band itself comes from the takeover zone's timeline store
 * (quantized — the subscription re-renders only on threshold crossings).
 */
function useVideoResidencyControl(
  releaseOnLeave: boolean | undefined,
  src: string
): MutableRefObject<VideoFrameRendererControl | null> {
  const controlRef = useRef<VideoFrameRendererControl | null>(null);
  const timeline = useAnimateTimeline();
  const zoneId = useContext(SceneScrollTakeoverContext);
  const approach = useSceneScrollZoneApproach(
    releaseOnLeave ? zoneId : null,
    releaseOnLeave === true
  );
  const scrubbedOnceRef = useRef(false);
  const releasePolicyRef = useRef(Boolean(releaseOnLeave));
  const progress = timeline.progress;

  // Residency eligibility belongs to a source generation. A replacement video
  // must not inherit the previous source's "already scrubbed" fact.
  useEffect(() => {
    scrubbedOnceRef.current = false;
  }, [src]);

  // Mark "has been driven" on the first non-trivial timeline movement; an
  // un-watched video has no decoded frames worth releasing.
  useEffect(() => {
    if (!releaseOnLeave) return;
    const mark = (value: number): void => {
      if (Math.abs(value) > 1e-4) scrubbedOnceRef.current = true;
    };
    mark(progress.get());
    return progress.on('change', mark);
  }, [progress, releaseOnLeave]);

  useEffect(() => {
    const wasEnabled = releasePolicyRef.current;
    releasePolicyRef.current = Boolean(releaseOnLeave);

    if (!releaseOnLeave) {
      // Turning residency management off must restore a source even when the
      // zone is still far away; otherwise the renderer can remain detached.
      if (wasEnabled) controlRef.current?.warmUp();
      return;
    }
    if (!approach) return;
    if (approach === 'far') {
      if (scrubbedOnceRef.current) controlRef.current?.release();
      return;
    }
    controlRef.current?.warmUp();
  }, [approach, releaseOnLeave]);

  return controlRef;
}

const AnimateVideoContent = forwardRef<HTMLVideoElement, AnimateVideoContentProps>(
  function AnimateVideoContent(
    {
      src,
      'aria-label': ariaLabel,
      width,
      height,
      style,
      preload,
      poster,
      playbackRate,
      scrubRange,
      releaseOnLeave,
      onEnded,
      onPlay,
      onPause,
      onTimeUpdate,
      onError,
    },
    ref
  ): JSX.Element {
    const timeline = useAnimateTimeline();
    const controlRef = useVideoResidencyControl(releaseOnLeave, src);

    return (
      <VideoFrameRenderer
        ref={ref}
        controlRef={controlRef}
        src={src}
        progress={timeline.progress}
        timelineFrame={timeline.frame}
        aria-label={ariaLabel}
        width={width}
        height={height}
        style={style}
        preload={preload}
        poster={poster}
        playbackRate={playbackRate}
        scrubRange={scrubRange}
        onEnded={onEnded}
        onPlay={onPlay}
        onPause={onPause}
        onTimeUpdate={onTimeUpdate}
        onError={onError}
      />
    );
  }
);

export const AnimateVideo = forwardRef<HTMLVideoElement, AnimateVideoProps>(function AnimateVideo(
  {
    src,
    'aria-label': ariaLabel,
    width,
    height,
    style,
    preload,
    poster,
    playbackRate,
    scrubRange,
    animateId,
    duration,
    enterAnimation,
    exitAnimation,
    timeline,
    visibility,
    releaseOnLeave,
    onEnded,
    onPlay,
    onPause,
    onTimeUpdate,
    onError,
  },
  ref
): JSX.Element {
  return (
    <Animate
      animateId={animateId}
      enterAnimation={enterAnimation ?? NEUTRAL_ENTER}
      exitAnimation={exitAnimation}
      duration={{ enter: duration?.enter, exit: duration?.exit }}
      timeline={timeline}
      visibility={visibility}
    >
      <AnimateVideoContent
        ref={ref}
        src={src}
        aria-label={ariaLabel}
        width={width}
        height={height}
        style={style}
        preload={preload}
        poster={poster}
        playbackRate={playbackRate}
        scrubRange={scrubRange}
        releaseOnLeave={releaseOnLeave}
        onEnded={onEnded}
        onPlay={onPlay}
        onPause={onPause}
        onTimeUpdate={onTimeUpdate}
        onError={onError}
      />
    </Animate>
  );
});

AnimateVideo.displayName = 'AnimateVideo';
