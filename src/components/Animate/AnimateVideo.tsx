import { forwardRef } from 'react';
import type { CSSProperties, VideoHTMLAttributes } from 'react';
import type { AnimationType } from '../../types';
import { VideoFrameRenderer } from '../../media/VideoFrameRenderer';
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
    waitFor?: string;
  };
  visibility?: {
    replayOnReenter?: boolean;
    enterMargin?: number;
    exitMargin?: number;
  };
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
  | 'onEnded'
  | 'onPlay'
  | 'onPause'
  | 'onTimeUpdate'
  | 'onError'
>;

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
      onEnded,
      onPlay,
      onPause,
      onTimeUpdate,
      onError,
    },
    ref
  ): JSX.Element {
    const timeline = useAnimateTimeline();

    return (
      <VideoFrameRenderer
        ref={ref}
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
