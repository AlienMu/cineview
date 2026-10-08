/**
 * The scrub video behind <cv-video>: an imperative port of 1.x src/media/VideoFrameRenderer.tsx.
 *
 * - The element's timeline frames go through the ownership reducer (ownership.ts); its commands
 *   (seek, pause, play) are executed here.
 * - The source is the preloaded blob from the shared cache (cache.ts) when there is one, the
 *   network URL otherwise. When the blob arrives later the node is swapped; a node the browser
 *   owned (playing, user-paused, ended) keeps its position and state across the swap.
 * - Every node and every activation is a generation: native play / pause / ended events from an
 *   older one never reach the reducer or the page.
 * - Metadata that arrives late seeds the node from the latest frame once.
 * - `release()` drops the decoded frames of a scene outside the activation window (plan v3 §7);
 *   `warmUp()` re-attaches the source (the blob stays leased, so no network) before it returns.
 *
 * Scrub smoothness depends on keyframe density; the development build warns when seeks are slow
 * (re-encode as all-keyframe: `ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264 out.mp4`).
 */
import { warn } from '../dev/warn';
import {
  acquireVideoObjectUrl,
  isMediaPreloaded,
  preloadMedia,
  releaseVideoObjectUrl,
  subscribeToPreloadedMedia,
} from './cache';
import {
  createVideoPlaybackOwnershipState,
  reduceVideoPlaybackOwnership,
  type TimelineFrame,
  type VideoPlaybackOwnershipCommand,
  type VideoPlaybackOwnershipEvent,
  type VideoPlaybackOwnershipState,
} from './ownership';

const SLOW_SCRUB_SEEK_MS = 50;
const SCRUB_SAMPLE_MIN = 6;
const warnedSrcs = new Set<string>();
/** Native media events re-dispatched on the host, only when they belong to the current node. */
const FORWARDED = ['play', 'pause', 'ended'] as const;

interface PendingPlayRequest {
  requestId: number;
  generation: number;
  activationId: number;
  /** Promise settlement does not retire the token; the native play event may be late. */
  settled: boolean;
}

interface NativeSnapshot {
  generation: number;
  time: number;
  playing: boolean;
  ended: boolean;
}

export interface VideoOptions {
  src: string;
  /** Fill the shared blob cache eagerly (1.x default true). */
  preload: boolean;
  poster: string | null;
  playbackRate: number;
  label: string | null;
  range: readonly [number, number] | undefined;
}

export const IDLE_FRAME: TimelineFrame = {
  progress: 0,
  signedProgress: 0,
  phase: 'idle',
  source: 'idle',
};

export class VideoDriver {
  video: HTMLVideoElement | null = null;
  private options: VideoOptions = {
    src: '',
    preload: true,
    poster: null,
    playbackRate: 1,
    label: null,
    range: undefined,
  };
  private objectUrl: string | null = null;
  private leasedSrc: string | null = null;
  private unsubscribe: () => void = (): void => undefined;
  private generation = 0;
  private activationId = 0;
  private readyGeneration: number | null = null;
  private ownership: VideoPlaybackOwnershipState = createVideoPlaybackOwnershipState(0);
  private pending: PendingPlayRequest | undefined;
  private latest: TimelineFrame = IDLE_FRAME;
  private pendingRestore: NativeSnapshot | null = null;
  private released = false;
  private seekSamples: number[] = [];
  private unbind: () => void = (): void => undefined;
  /** Events this driver accepted for the current node; only those reach the page. */
  private accepted = new WeakSet<Event>();
  /** Drag: is the scene the current one? Distinguishes a cancelled return from a departure. */
  sceneActive: (() => boolean | undefined) | null = null;
  /** The current node failed to load its source (the host reports it). */
  failed: ((url: string) => void) | null = null;

  private container: ParentNode | null = null;

  constructor(private host: HTMLElement) {}

  /** Where the node lives (the innermost layer of the host's shadow root, rebuilt with it). */
  place(container: ParentNode): void {
    this.container = container;
    if (this.video && this.video.parentNode !== container) container.prepend(this.video);
  }

  /** Apply attributes. A new `src` is a new media identity. */
  configure(options: VideoOptions): void {
    const previous = this.options;
    this.options = options;
    if (options.src !== previous.src || !this.video) {
      this.setSource(options.src);
      return;
    }
    const video = this.video;
    video.playbackRate = options.playbackRate;
    if (options.poster) video.poster = options.poster;
    else video.removeAttribute('poster');
    if (options.label) video.setAttribute('aria-label', options.label);
    else video.removeAttribute('aria-label');
    if (options.preload && !previous.preload) this.warmCache();
    // A new range re-seeks from the latest frame.
    if (options.range?.[0] !== previous.range?.[0] || options.range?.[1] !== previous.range?.[1]) {
      this.publish(this.latest);
    }
  }

  /** Feed one timeline frame (from the input driving the element). */
  frame(frame: TimelineFrame): void {
    this.publish(frame);
  }

  get scrubbed(): boolean {
    return this.ownership.lastSeekTime !== null;
  }

  /** Drop decoded frames (scene left the activation window). The blob lease is kept. */
  release(): void {
    if (this.released) return;
    const video = this.video;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    this.released = true;
    this.resetOwnership(false);
    this.mount();
  }

  /** Re-attach the source before the scene returns; seeks catch up once metadata is back. */
  warmUp(): void {
    if (!this.released) return;
    this.released = false;
    this.resetOwnership(false);
    this.mount();
  }

  destroy(): void {
    this.unbind();
    this.unsubscribe();
    if (this.leasedSrc) releaseVideoObjectUrl(this.leasedSrc);
    this.leasedSrc = null;
    this.video?.pause();
    this.video?.remove();
    this.video = null;
  }

  // ---- source and node -----------------------------------------------------------------------

  private setSource(src: string): void {
    this.unsubscribe();
    this.unsubscribe = (): void => undefined;
    if (this.leasedSrc) releaseVideoObjectUrl(this.leasedSrc);
    this.leasedSrc = null;
    this.released = false;
    this.objectUrl = null;
    if (src && typeof window !== 'undefined') {
      if (!this.lease(src)) {
        this.unsubscribe = subscribeToPreloadedMedia((ready) => {
          if (ready !== src || this.options.src !== src || this.leasedSrc) return;
          // The blob arrived: swap nodes, keeping what the browser owned on the old one.
          const snapshot = this.snapshot();
          if (this.lease(src)) this.identityChanged(snapshot);
        });
      }
      this.warmCache();
    }
    this.identityChanged(null);
  }

  private lease(src: string): boolean {
    const url = acquireVideoObjectUrl(src);
    if (!url) return false;
    this.leasedSrc = src;
    this.objectUrl = url;
    return true;
  }

  private warmCache(): void {
    const src = this.options.src;
    if (!src || !this.options.preload || isMediaPreloaded(src)) return;
    preloadMedia(src, 'video').catch(() => undefined);
  }

  /** What the browser owned on the current node, to carry over to the blob node. */
  private snapshot(): NativeSnapshot | null {
    const video = this.video;
    const status = this.ownership.status;
    const nativeOwned =
      status === 'native-playback' ||
      status === 'native-paused' ||
      status === 'play-pending' ||
      status === 'ended';
    return video && video.readyState >= 2 && nativeOwned
      ? {
          generation: this.generation,
          time: video.currentTime,
          playing: !video.paused,
          ended: video.ended,
        }
      : null;
  }

  private identityChanged(snapshot: NativeSnapshot | null): void {
    this.pendingRestore = snapshot?.generation === this.generation ? snapshot : null;
    this.generation++;
    this.readyGeneration = null;
    this.resetOwnership(false);
    this.mount();
  }

  /** A fresh <video> node for the current identity, activation and residency. */
  private mount(): void {
    this.unbind();
    const old = this.video;
    const video = document.createElement('video');
    const { src, preload, poster, playbackRate, label } = this.options;
    video.setAttribute('part', 'video');
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    // Without preloading the browser streams; metadata is still needed to scrub (1.x used 'none'
    // here, which left an uncached video unscrubbable).
    video.preload = this.released ? 'none' : preload ? 'auto' : 'metadata';
    if (poster) video.poster = poster;
    if (label) video.setAttribute('aria-label', label);
    if (!this.released && (this.objectUrl ?? src)) video.src = this.objectUrl ?? src;
    video.playbackRate = playbackRate;
    if (old?.parentNode) old.replaceWith(video);
    else this.container?.prepend(video);
    if (old) {
      old.pause();
      old.removeAttribute('src');
      old.load();
    }
    this.video = video;
    this.bind(video);
  }

  private resetOwnership(rebind: boolean): void {
    this.activationId++;
    this.ownership = reduceVideoPlaybackOwnership(this.ownership, {
      type: 'reset',
      activationId: this.activationId,
    }).state;
    this.pending = undefined;
    this.seekSamples = [];
    if (rebind && this.video) {
      this.unbind();
      this.bind(this.video);
    }
  }

  /** Native listeners for one node, generation and activation; they ignore anything newer. */
  private bind(video: HTMLVideoElement): void {
    const generation = this.generation;
    const activationId = this.activationId;
    const isCurrent = (): boolean =>
      this.video === video && this.activationId === activationId && this.generation === generation;
    const isReady = (): boolean => isCurrent() && this.readyGeneration === generation;
    if (video.readyState >= 1) this.readyGeneration = generation;
    const loadStart = (): void => {
      if (isCurrent()) this.readyGeneration = generation;
    };
    const play = (event: Event): void => {
      if (!isReady()) return;
      const pending = this.pending;
      const requestId =
        pending?.generation === generation && pending.activationId === activationId
          ? pending.requestId
          : undefined;
      const o = this.ownership;
      const taggedAccepted =
        requestId !== undefined &&
        ((!o.frameworkPlayBlocked && o.activePlayRequestId === requestId) ||
          (o.status === 'native-playback' &&
            !o.frameworkPlayBlocked &&
            o.settledPlayRequestId === requestId));
      const untaggedAccepted = requestId === undefined && !o.frameworkPlayBlocked;
      if (requestId !== undefined) this.pending = undefined;
      if (taggedAccepted || untaggedAccepted) this.accepted.add(event);
      this.dispatch({ type: 'media-play', requestId, activationId });
    };
    const pause = (event: Event): void => {
      if (!isReady()) return;
      if (!this.ownership.frameworkPausePending) this.pending = undefined;
      this.accepted.add(event);
      this.dispatch({ type: 'media-pause', activationId });
    };
    const ended = (event: Event): void => {
      if (!isReady()) return;
      this.accepted.add(event);
      this.dispatch({ type: 'media-ended', activationId });
    };
    // Forward accepted events to the page (media events do not leave the shadow root).
    const forward = (event: Event): void => {
      if (!this.accepted.has(event)) return;
      this.accepted.delete(event);
      if (!isCurrent()) return;
      this.host.dispatchEvent(new Event(event.type));
    };
    const metadata = (): void => {
      if (isCurrent()) this.publishLatest();
    };
    const error = (): void => {
      if (this.video !== video || this.generation !== generation || !video.error) return;
      this.host.dispatchEvent(new Event('error'));
      this.failed?.(video.currentSrc || video.src);
    };
    video.addEventListener('loadstart', loadStart, true);
    video.addEventListener('play', play, true);
    video.addEventListener('pause', pause, true);
    video.addEventListener('ended', ended, true);
    for (const type of FORWARDED) video.addEventListener(type, forward);
    video.addEventListener('loadedmetadata', metadata);
    video.addEventListener('error', error);
    if (video.readyState >= 1) queueMicrotask(metadata);
    this.unbind = (): void => {
      video.removeEventListener('loadstart', loadStart, true);
      video.removeEventListener('play', play, true);
      video.removeEventListener('pause', pause, true);
      video.removeEventListener('ended', ended, true);
      for (const type of FORWARDED) video.removeEventListener(type, forward);
      video.removeEventListener('loadedmetadata', metadata);
      video.removeEventListener('error', error);
      this.unbind = (): void => undefined;
    };
  }

  // ---- frames ---------------------------------------------------------------------------------

  /** Metadata is here: restore what a swapped node owned, then seed from the latest frame. */
  private publishLatest(): void {
    const video = this.video;
    if (!video) return;
    const restore = this.pendingRestore;
    if (restore) {
      this.pendingRestore = null;
      const phase = this.latest.phase;
      this.dispatch({
        type: 'restore-native',
        time: Math.min(restore.time, video.duration),
        playing:
          restore.playing &&
          this.sceneActive?.() !== false &&
          phase !== 'exiting' &&
          phase !== 'exited',
        ended: restore.ended,
      });
    }
    this.publish(this.latest);
  }

  private publish(frame: TimelineFrame): void {
    this.latest = frame;
    const video = this.video;
    if (!video) return;
    const o = this.ownership;
    if (frame.phase === 'entering' && (o.status === 'ended' || o.outgoing)) {
      // A new entrance after the browser finished or after a departure: a new activation on a
      // new node, so late events from the old one cannot touch it.
      this.activationId++;
      this.ownership = reduceVideoPlaybackOwnership(this.ownership, {
        type: 'activate',
        activationId: this.activationId,
      }).state;
      this.pending = undefined;
      this.mount();
      return;
    }
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    this.dispatch({
      type: 'timeline-frame',
      frame,
      duration: video.duration,
      currentTime: video.currentTime,
      dragSceneActive: this.sceneActive?.(),
      scrubRange: this.options.range,
    });
  }

  private dispatch(event: VideoPlaybackOwnershipEvent): void {
    const video = this.video;
    if (!video) return;
    const next = reduceVideoPlaybackOwnership(this.ownership, event);
    this.ownership = next.state;
    for (const command of next.commands) this.execute(video, command);
  }

  private execute(video: HTMLVideoElement, command: VideoPlaybackOwnershipCommand): void {
    switch (command.type) {
      case 'pause':
        video.pause();
        return;
      case 'seek':
        this.seek(video, command.time);
        return;
      case 'play': {
        const request: PendingPlayRequest = {
          requestId: command.requestId,
          generation: this.generation,
          activationId: this.ownership.activationId,
          settled: false,
        };
        this.pending = request;
        const settle = (type: 'play-resolved' | 'play-rejected'): void => {
          if (this.pending !== request || request.settled) return;
          request.settled = true;
          if (type === 'play-rejected') this.pending = undefined;
          if (
            this.generation !== request.generation ||
            this.ownership.activationId !== request.activationId
          ) {
            this.pending = undefined;
            return;
          }
          this.dispatch({ type, requestId: command.requestId });
        };
        let result: Promise<void>;
        try {
          result = video.play();
        } catch {
          settle('play-rejected');
          return;
        }
        void Promise.resolve(result).then(
          () => settle('play-resolved'),
          () => settle('play-rejected')
        );
        return;
      }
    }
  }

  private seek(video: HTMLVideoElement, time: number): void {
    const src = this.options.src;
    if (__DEV__ && !warnedSrcs.has(src)) {
      const startedAt = performance.now();
      video.addEventListener(
        'seeked',
        () => {
          const samples = this.seekSamples;
          samples.push(performance.now() - startedAt);
          if (samples.length < SCRUB_SAMPLE_MIN || warnedSrcs.has(src)) return;
          const median = [...samples].sort((a, b) => a - b)[samples.length >> 1]!;
          if (median > SLOW_SCRUB_SEEK_MS) {
            warnedSrcs.add(src);
            warn(
              this.host,
              `scrub seeks are slow (median ${median.toFixed(0)} ms) for "${src}": the video has sparse keyframes. Re-encode it as all-keyframe, e.g. ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264 out.mp4`
            );
          }
        },
        { once: true }
      );
    }
    video.currentTime = time;
  }
}
