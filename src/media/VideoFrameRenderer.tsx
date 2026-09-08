/**
 * VideoFrameRenderer — dumb progress → currentTime scrub renderer. No controls, muted,
 * inline playback. progress change → currentTime = progress * duration. No frame skipping
 * (native video continuity).
 *
 * Prefers preloaded objectURL cache (full blob, guarantees seek); falls back to src
 * if not ready (browser buffers). No seek during SSR.
 *
 * ⚠ Scrub smoothness depends on video encoding keyframe (I-frame) density. H.264 P/B frames
 * are deltas relative to previous frames; seeking to arbitrary frames requires decoding
 * from the nearest keyframe to the target frame. If keyframes are sparse (typical default
 * ~250 frames), each scrub incurs long-distance decode → decoder thread maxed → dropped
 * frames (especially backward seeks). This is an encoding issue beyond component scope:
 * scrub videos should be re-encoded as all-keyframe (every frame an I-frame, e.g.
 * `ffmpeg -i in.mp4 -g 1 out.mp4`), trading larger file size for direct frame decode.
 * In development, this component console.warns when seek latency is consistently high.
 */
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CSSProperties,
  FormEventHandler,
  MutableRefObject,
  ReactEventHandler,
  Ref,
} from 'react';
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
import { devWarn } from '../utils/devLog';
import { useIsomorphicLayoutEffect } from '../utils/useIsomorphicLayoutEffect';

const SLOW_SCRUB_SEEK_MS = 50;
const SCRUB_SAMPLE_MIN = 6;
const MEDIA_EVENT_CAPTURE = true;
const scrubWarnedSrcs = new Set<string>();

type VideoEventHandler = ReactEventHandler<HTMLVideoElement>;
type VideoErrorHandler = FormEventHandler<HTMLVideoElement>;
interface PendingPlayRequest {
  requestId: number;
  generation: number;
  activationId: number;
  /** Promise settlement does not retire the token; the native play event may be late. */
  settled: boolean;
}

/**
 * Imperative media-residency control for scroll-driven scrub videos
 * (AnimateVideo `releaseOnLeave`, task-flow 2026-08-14 Plan A).
 *
 * Decoded video frames and GPU textures stay resident after a `<video>` has
 * been scrubbed through, and the compositor pressure they create measurably
 * drops frames in *other* scenes once the viewer scrolls past (probe evidence:
 * `site/scripts/_rv-video-residency.mjs`). This handle lets the owner drop
 * that residency once the zone is far away and restore it before return:
 *
 * - `release()`: pause + drop `src` + `load()` — the browser discards decoded
 *   frames/buffer. The blob URL lease is *kept* so warm-up costs no network.
 * - `warmUp()`: re-attach `src` (blob already in memory) and bump the media
 *   epoch — pending scrub seeks re-arm on the next `loadedmetadata` and catch
 *   up to the current timeline position.
 */
export interface VideoFrameRendererControl {
  release(): void;
  warmUp(): void;
}

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
  /** Optional imperative release/warm-up handle (see VideoFrameRendererControl). */
  controlRef?: MutableRefObject<VideoFrameRendererControl | null>;
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
      controlRef,
    },
    forwardedRef
  ): React.JSX.Element {
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
    const pendingPlayRequestRef = useRef<PendingPlayRequest | undefined>(undefined);
    const mediaGenerationRef = useRef(0);
    const committedMediaIdentityRef = useRef<{ src: string; objectUrl: string | null }>({
      src,
      objectUrl,
    });
    const nativeMediaListenersRef = useRef<{
      video: HTMLVideoElement;
      generation: number;
      activationId: number;
      loadStart: EventListener;
      play: EventListener;
      pause: EventListener;
      ended: EventListener;
    } | null>(null);
    const dispatchOwnershipRef = useRef<(event: VideoPlaybackOwnershipEvent) => void>(
      () => undefined
    );
    const acceptedNativeEventsRef = useRef<
      WeakMap<Event, { generation: number; activationId: number }>
    >(new WeakMap());
    const readyMediaGenerationRef = useRef<number | null>(null);
    const releasedSrcRef = useRef<string | null>(null);

    const bindNativeMediaListeners = useCallback(
      (video: HTMLVideoElement | null, activationId: number): void => {
        const previous = nativeMediaListenersRef.current;
        const generation = mediaGenerationRef.current;
        if (
          previous &&
          (previous.video !== video ||
            previous.activationId !== activationId ||
            previous.generation !== generation)
        ) {
          previous.video.removeEventListener('loadstart', previous.loadStart, MEDIA_EVENT_CAPTURE);
          previous.video.removeEventListener('play', previous.play, MEDIA_EVENT_CAPTURE);
          previous.video.removeEventListener('pause', previous.pause, MEDIA_EVENT_CAPTURE);
          previous.video.removeEventListener('ended', previous.ended, MEDIA_EVENT_CAPTURE);
          nativeMediaListenersRef.current = null;
        }
        if (!video || nativeMediaListenersRef.current) return;

        const isCurrent = (): boolean =>
          activationIdRef.current === activationId && mediaGenerationRef.current === generation;
        const isReady = (): boolean =>
          isCurrent() && readyMediaGenerationRef.current === generation;
        const loadStart: EventListener = (): void => {
          if (!isCurrent()) return;
          readyMediaGenerationRef.current = generation;
        };
        const accept = (event: Event): void => {
          acceptedNativeEventsRef.current.set(event, { generation, activationId });
        };
        const play: EventListener = (event): void => {
          if (!isReady()) return;
          const pendingRequest = pendingPlayRequestRef.current;
          const requestId =
            pendingRequest?.generation === generation &&
            pendingRequest.activationId === activationId
              ? pendingRequest.requestId
              : undefined;
          const ownership = ownershipRef.current;
          const taggedFrameworkPlayAccepted =
            requestId !== undefined &&
            ((!ownership.frameworkPlayBlocked && ownership.activePlayRequestId === requestId) ||
              (ownership.status === 'native-playback' &&
                !ownership.frameworkPlayBlocked &&
                ownership.settledPlayRequestId === requestId));
          const untaggedNativePlayAccepted =
            requestId === undefined && !ownership.frameworkPlayBlocked;

          if (requestId !== undefined) pendingPlayRequestRef.current = undefined;
          if (!taggedFrameworkPlayAccepted && !untaggedNativePlayAccepted) {
            dispatchOwnershipRef.current({ type: 'media-play', requestId, activationId });
            return;
          }
          accept(event);
          dispatchOwnershipRef.current({ type: 'media-play', requestId, activationId });
        };
        const pause: EventListener = (event): void => {
          if (!isReady()) return;
          const frameworkPause = ownershipRef.current.frameworkPausePending;
          if (!frameworkPause) pendingPlayRequestRef.current = undefined;
          accept(event);
          dispatchOwnershipRef.current({ type: 'media-pause', activationId });
        };
        const ended: EventListener = (event): void => {
          if (!isReady()) return;
          accept(event);
          dispatchOwnershipRef.current({ type: 'media-ended', activationId });
        };
        video.addEventListener('loadstart', loadStart, MEDIA_EVENT_CAPTURE);
        video.addEventListener('play', play, MEDIA_EVENT_CAPTURE);
        video.addEventListener('pause', pause, MEDIA_EVENT_CAPTURE);
        video.addEventListener('ended', ended, MEDIA_EVENT_CAPTURE);
        nativeMediaListenersRef.current = {
          video,
          generation,
          activationId,
          loadStart,
          play,
          pause,
          ended,
        };
      },
      []
    );

    const [released, setReleased] = useState(false);
    const [mediaEpoch, setMediaEpoch] = useState(0);
    const [mediaNodeEpoch, setMediaNodeEpoch] = useState(0);

    const resetOwnership = useCallback(
      (rebindCurrentNode = true): void => {
        activationIdRef.current += 1;
        ownershipRef.current = reduceVideoPlaybackOwnership(ownershipRef.current, {
          type: 'reset',
          activationId: activationIdRef.current,
        }).state;
        pendingPlayRequestRef.current = undefined;
        seekSamplesRef.current = [];
        bindNativeMediaListeners(
          rebindCurrentNode ? videoRef.current : null,
          activationIdRef.current
        );
      },
      [bindNativeMediaListeners]
    );

    useEffect(() => {
      const control: VideoFrameRendererControl = {
        release: (): void => {
          const video = videoRef.current;
          setReleased(true);
          if (video) {
            video.pause();
            releasedSrcRef.current = video.getAttribute('src');
            video.removeAttribute('src');
            video.load();
          }
          resetOwnership(false);
        },
        warmUp: (): void => {
          const video = videoRef.current;
          if (video && !video.getAttribute('src')) {
            const restore = releasedSrcRef.current;
            if (restore) {
              video.src = restore;
              releasedSrcRef.current = null;
            }
          }
          setReleased(false);
          setMediaEpoch((epoch) => epoch + 1);
          resetOwnership(false);
        },
      };
      if (controlRef) controlRef.current = control;
      return (): void => {
        if (controlRef) controlRef.current = null;
      };
    }, [controlRef, resetOwnership]);

    const setVideoRef = useCallback(
      (video: HTMLVideoElement | null): void => {
        if (!video) bindNativeMediaListeners(null, activationIdRef.current);
        videoRef.current = video;
        if (video) bindNativeMediaListeners(video, activationIdRef.current);
        assignRef(forwardedRef, video);
      },
      [bindNativeMediaListeners, forwardedRef]
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

      return (): void => {
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
      setReleased(false);
      setMediaEpoch((epoch) => epoch + 1);
    }, [src]);

    useIsomorphicLayoutEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      video.playbackRate = playbackRate ?? 1;
    }, [mediaNodeEpoch, objectUrl, playbackRate, released, src]);

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
                devWarn(
                  `AnimateVideo scrub seek is slow (median ${median.toFixed(0)}ms/seek for "${src}").\n\n` +
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
              const pendingRequest: PendingPlayRequest = {
                requestId: command.requestId,
                generation: mediaGenerationRef.current,
                activationId: ownershipRef.current.activationId,
                settled: false,
              };
              pendingPlayRequestRef.current = pendingRequest;
              const settleRequest = (type: 'play-resolved' | 'play-rejected'): void => {
                if (pendingPlayRequestRef.current !== pendingRequest || pendingRequest.settled) {
                  return;
                }
                pendingRequest.settled = true;
                if (type === 'play-rejected') pendingPlayRequestRef.current = undefined;
                if (
                  mediaGenerationRef.current !== pendingRequest.generation ||
                  ownershipRef.current.activationId !== pendingRequest.activationId
                ) {
                  pendingPlayRequestRef.current = undefined;
                  return;
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

    useIsomorphicLayoutEffect(() => {
      dispatchOwnershipRef.current = dispatchOwnership;
      const committedIdentity = committedMediaIdentityRef.current;
      let identityChanged = false;
      if (committedIdentity.src !== src || committedIdentity.objectUrl !== objectUrl) {
        committedMediaIdentityRef.current = { src, objectUrl };
        mediaGenerationRef.current += 1;
        readyMediaGenerationRef.current = null;
        resetOwnership();
        identityChanged = true;
      }
      if (!identityChanged && videoRef.current && videoRef.current.readyState >= 1) {
        readyMediaGenerationRef.current = mediaGenerationRef.current;
      }
      bindNativeMediaListeners(videoRef.current, activationIdRef.current);
    }, [bindNativeMediaListeners, dispatchOwnership, mediaEpoch, objectUrl, resetOwnership, src]);

    useEffect(
      () => (): void => bindNativeMediaListeners(null, activationIdRef.current),
      [bindNativeMediaListeners]
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
          bindNativeMediaListeners(null, activationIdRef.current);
          dispatchOwnership({ type: 'activate', activationId: activationIdRef.current });
          setMediaNodeEpoch((epoch) => epoch + 1);
          return;
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

      return (): void => {
        unsubscribe();
        video.removeEventListener('loadedmetadata', publishLatest);
      };
    }, [
      bindNativeMediaListeners,
      dispatchOwnership,
      mediaEpoch,
      mediaNodeEpoch,
      objectUrl,
      scrubRange,
      timelineFrame,
    ]);

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
      return (): void => {
        unsubscribe?.();
        video.removeEventListener('loadedmetadata', seekCurrent);
      };
    }, [mediaEpoch, objectUrl, progress, seek, timelineFrame]);

    const consumeAcceptedNativeEvent = (event: Event): boolean => {
      const accepted = acceptedNativeEventsRef.current.get(event);
      acceptedNativeEventsRef.current.delete(event);
      return Boolean(
        accepted &&
        accepted.generation === mediaGenerationRef.current &&
        accepted.activationId === activationIdRef.current
      );
    };
    const handlePlay: VideoEventHandler = (event) => {
      if (!consumeAcceptedNativeEvent(event.nativeEvent)) return;
      onPlay?.(event);
    };
    const handlePause: VideoEventHandler = (event) => {
      if (!consumeAcceptedNativeEvent(event.nativeEvent)) return;
      onPause?.(event);
    };
    const handleEnded: VideoEventHandler = (event) => {
      if (!consumeAcceptedNativeEvent(event.nativeEvent)) return;
      onEnded?.(event);
    };

    const isReleasedForSource = released && objectUrlState.src === src;
    const mediaElementKey = JSON.stringify([
      src,
      objectUrl,
      mediaNodeEpoch,
      isReleasedForSource ? 'released' : 'active',
    ]);

    return (
      <video
        key={mediaElementKey}
        ref={setVideoRef}
        src={(isReleasedForSource ? undefined : (objectUrl ?? src)) || undefined}
        muted
        playsInline
        preload={isReleasedForSource ? 'none' : preload ? 'auto' : objectUrl ? 'metadata' : 'none'}
        aria-label={ariaLabel}
        width={resolvedWidth}
        height={resolvedHeight}
        style={resolvedStyle}
        poster={poster || undefined}
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
