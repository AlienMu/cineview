/**
 * VideoFrameRenderer — dumb「progress → currentTime」scrub 渲染器。零控件、静音、
 * 内联播放。progress 变 → currentTime = progress * duration。无抽帧(video 原生连续)。
 *
 * 优先用预加载缓存的 objectURL(整段 blob,保证可 seek);未就绪则直接用 src(浏览器
 * 自行 buffer)。SSR 下不 seek。
 *
 * ⚠ scrub 平滑度取决于视频编码的「关键帧(I 帧)密度」。H.264 的 P/B 帧是相对前帧的差分,
 * seek 到任意帧须从最近的 I 帧起逐帧解码到目标帧。若视频关键帧稀疏(常见默认每 ~250 帧一个),
 * 每次 scrub 都要长距离解码 → 解码线程吃满 → 掉帧(尤其往回 seek)。这是编码问题,非本组件可解:
 * 用于 scrub 的视频应重编码为「全关键帧」(每帧皆 I 帧,如 `ffmpeg -i in.mp4 -g 1 out.mp4`),
 * 代价是文件变大,换来任意帧可直接解码。开发环境下,本组件测得 seek 延迟持续偏高时会 console.warn。
 */
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FormEventHandler, ReactEventHandler, Ref } from 'react';
import type { MotionValue } from 'framer-motion';
import type { AnimateTimelineFrame } from '../types';
import { useCineViewContext } from '../context/CineViewContext';
import { convertStyle } from '../utils/styleConvert';
import {
  acquireVideoObjectUrl,
  getVideoObjectUrl,
  isMediaPreloaded,
  preloadMedia,
  releaseVideoObjectUrl,
  subscribeToPreloadedMedia,
} from '../hooks/mediaPreloadCache';
import {
  createVideoPlaybackOwnershipState,
  reduceVideoPlaybackOwnership,
  type VideoPlaybackOwnershipCommand,
  type VideoPlaybackOwnershipEvent,
  type VideoPlaybackOwnershipState,
} from './videoPlaybackOwnership';

const SLOW_SCRUB_SEEK_MS = 50;
const SCRUB_SAMPLE_MIN = 6;
const scrubWarnedSrcs = new Set<string>();

type VideoEventHandler = ReactEventHandler<HTMLVideoElement>;
type VideoErrorHandler = FormEventHandler<HTMLVideoElement>;

export interface VideoFrameRendererProps {
  src: string;
  /** Legacy progress-only input. Atomic timelineFrame takes ownership when supplied. */
  progress: number | MotionValue<number>;
  timelineFrame?: MotionValue<AnimateTimelineFrame>;
  scrubRange?: readonly [fromSeconds: number, toSeconds: number];
  width?: number | string;
  height?: number | string;
  style?: CSSProperties;
  'aria-label'?: string;
  preload?: boolean;
  poster?: string;
  playbackRate?: number;
  onEnded?: VideoEventHandler;
  onPlay?: VideoEventHandler;
  onPause?: VideoEventHandler;
  onTimeUpdate?: VideoEventHandler;
  onError?: VideoErrorHandler;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref) {
    (ref as { current: T | null }).current = value;
  }
}

export const VideoFrameRenderer = forwardRef<HTMLVideoElement, VideoFrameRendererProps>(
  function VideoFrameRenderer(
    {
      src,
      progress,
      timelineFrame,
      scrubRange,
      width,
      height,
      style,
      'aria-label': ariaLabel,
      preload = true,
      poster,
      playbackRate,
      onEnded,
      onPlay,
      onPause,
      onTimeUpdate,
      onError,
    },
    forwardedRef
  ): JSX.Element {
    const context = useCineViewContext();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [objectUrlState, setObjectUrlState] = useState<{ src: string; url: string | null }>(
      () => ({
        src,
        url: getVideoObjectUrl(src) ?? null,
      })
    );
    const objectUrl = objectUrlState.src === src ? objectUrlState.url : null;
    const seekSamplesRef = useRef<number[]>([]);
    const ownershipRef = useRef<VideoPlaybackOwnershipState>(createVideoPlaybackOwnershipState(0));
    const activationIdRef = useRef(0);
    const pendingPlayRequestRef = useRef<number | undefined>(undefined);

    const setVideoRef = useCallback(
      (video: HTMLVideoElement | null): void => {
        videoRef.current = video;
        assignRef(forwardedRef, video);
      },
      [forwardedRef]
    );

    const resolvedWidth = useMemo(
      () => (typeof width === 'number' ? (context?.convert(width) ?? width) : width),
      [context, width]
    );
    const resolvedHeight = useMemo(
      () => (typeof height === 'number' ? (context?.convert(height) ?? height) : height),
      [context, height]
    );
    const resolvedStyle = useMemo(() => convertStyle(style, context ?? null), [context, style]);

    useEffect(() => {
      if (typeof window === 'undefined' || !src) {
        setObjectUrlState({ src, url: null });
        return;
      }

      let active = true;
      let leased = false;
      const leaseCachedUrl = (): boolean => {
        const url = acquireVideoObjectUrl(src);
        if (!url) return false;
        leased = true;
        setObjectUrlState({ src, url });
        return true;
      };

      let unsubscribe = (): void => undefined;
      if (!leaseCachedUrl()) {
        setObjectUrlState({ src, url: null });
        unsubscribe = subscribeToPreloadedMedia((readyUrl) => {
          if (readyUrl === src && active && !leased) {
            leaseCachedUrl();
          }
        });
      }

      return () => {
        active = false;
        unsubscribe();
        if (leased) releaseVideoObjectUrl(src);
      };
    }, [src]);

    useEffect(() => {
      if (typeof window === 'undefined' || !src || !preload || isMediaPreloaded(src)) return;
      void preloadMedia(src, 'video').catch(() => undefined);
    }, [preload, src]);

    useEffect(() => {
      activationIdRef.current += 1;
      ownershipRef.current = reduceVideoPlaybackOwnership(ownershipRef.current, {
        type: 'reset',
        activationId: activationIdRef.current,
      }).state;
      pendingPlayRequestRef.current = undefined;
      seekSamplesRef.current = [];
    }, [src]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      video.playbackRate = playbackRate ?? 1;
    }, [objectUrl, playbackRate]);

    const seek = useCallback(
      (video: HTMLVideoElement, targetTime: number): void => {
        if (process.env.NODE_ENV === 'development' && !scrubWarnedSrcs.has(src)) {
          const startedAt = performance.now();
          video.addEventListener(
            'seeked',
            () => {
              const samples = seekSamplesRef.current;
              samples.push(performance.now() - startedAt);
              if (samples.length < SCRUB_SAMPLE_MIN || scrubWarnedSrcs.has(src)) return;
              const sorted = [...samples].sort((a, b) => a - b);
              const median = sorted[Math.floor(sorted.length / 2)];
              if (median > SLOW_SCRUB_SEEK_MS) {
                scrubWarnedSrcs.add(src);
                console.warn(
                  `[CineView Warning] AnimateVideo scrub seek is slow (median ${median.toFixed(0)}ms/seek for "${src}").\n\n` +
                    `Cause: the video has sparse keyframes, so each scroll frame must decode a long run of frames from the nearest keyframe.\n` +
                    `Fix: re-encode the scrub video as all-keyframe (every frame an I-frame), e.g.\n` +
                    `  ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264 out.mp4\n` +
                    `This makes any frame directly decodable (larger file, smooth scrub).`
                );
              }
            },
            { once: true }
          );
        }
        video.currentTime = targetTime;
      },
      [src]
    );

    const dispatchOwnership = useCallback(
      (event: VideoPlaybackOwnershipEvent): void => {
        const video = videoRef.current;
        if (!video) return;
        const next = reduceVideoPlaybackOwnership(ownershipRef.current, event);
        ownershipRef.current = next.state;

        const execute = (command: VideoPlaybackOwnershipCommand): void => {
          switch (command.type) {
            case 'pause':
              video.pause();
              return;
            case 'seek':
              seek(video, command.time);
              return;
            case 'play': {
              pendingPlayRequestRef.current = command.requestId;
              const settleRequest = (type: 'play-resolved' | 'play-rejected'): void => {
                if (pendingPlayRequestRef.current === command.requestId) {
                  pendingPlayRequestRef.current = undefined;
                }
                dispatchOwnership({ type, requestId: command.requestId });
              };
              let playResult: Promise<void>;
              try {
                playResult = video.play();
              } catch {
                settleRequest('play-rejected');
                return;
              }
              void Promise.resolve(playResult).then(
                () => settleRequest('play-resolved'),
                () => settleRequest('play-rejected')
              );
              return;
            }
          }
        };

        next.commands.forEach(execute);
      },
      [seek]
    );

    useEffect(() => {
      if (!timelineFrame) return;
      const video = videoRef.current;
      if (!video || typeof window === 'undefined') return;

      let latestFrame = timelineFrame.get();
      const publish = (frame: AnimateTimelineFrame): void => {
        latestFrame = frame;
        const ownership = ownershipRef.current;
        if (
          frame.phase === 'entering' &&
          (ownership.status === 'ended' || ownership.outgoingLatched)
        ) {
          activationIdRef.current += 1;
          dispatchOwnership({ type: 'activate', activationId: activationIdRef.current });
        }
        if (!Number.isFinite(video.duration) || video.duration <= 0) return;
        dispatchOwnership({
          type: 'timeline-frame',
          frame,
          duration: video.duration,
          scrubRange,
        });
      };
      const publishLatest = (): void => publish(latestFrame);
      const unsubscribe = timelineFrame.on('change', publish);
      if (video.readyState >= 1) publishLatest();
      else video.addEventListener('loadedmetadata', publishLatest, { once: true });

      return () => {
        unsubscribe();
        video.removeEventListener('loadedmetadata', publishLatest);
      };
    }, [dispatchOwnership, objectUrl, scrubRange, timelineFrame]);

    useEffect(() => {
      if (timelineFrame) return;
      const video = videoRef.current;
      if (!video || typeof window === 'undefined') return;
      const progressMotion = typeof progress === 'object' ? progress : null;
      const seekProgress = (nextProgress: number): void => {
        const duration = video.duration;
        if (!Number.isFinite(duration) || duration <= 0) return;
        const clamped = nextProgress < 0 ? 0 : nextProgress > 1 ? 1 : nextProgress;
        seek(video, clamped * duration);
      };
      const seekCurrent = (): void => seekProgress(progressMotion?.get() ?? (progress as number));
      const unsubscribe = progressMotion?.on('change', seekProgress);
      if (video.readyState >= 1) seekCurrent();
      else video.addEventListener('loadedmetadata', seekCurrent, { once: true });
      return () => {
        unsubscribe?.();
        video.removeEventListener('loadedmetadata', seekCurrent);
      };
    }, [objectUrl, progress, seek, timelineFrame]);

    const handlePlay: VideoEventHandler = (event) => {
      const requestId = pendingPlayRequestRef.current;
      pendingPlayRequestRef.current = undefined;
      dispatchOwnership({ type: 'media-play', requestId });
      onPlay?.(event);
    };
    const handlePause: VideoEventHandler = (event) => {
      dispatchOwnership({ type: 'media-pause' });
      onPause?.(event);
    };
    const handleEnded: VideoEventHandler = (event) => {
      dispatchOwnership({ type: 'media-ended' });
      onEnded?.(event);
    };

    return (
      <video
        ref={setVideoRef}
        src={objectUrl ?? src}
        muted
        playsInline
        preload={preload ? 'auto' : objectUrl ? 'metadata' : 'none'}
        aria-label={ariaLabel}
        width={resolvedWidth}
        height={resolvedHeight}
        style={resolvedStyle}
        poster={poster}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onTimeUpdate={onTimeUpdate}
        onError={onError}
      />
    );
  }
);

VideoFrameRenderer.displayName = 'VideoFrameRenderer';
