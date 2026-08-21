/**
 * VideoFrameRenderer 单测:渲染 <video muted playsInline>、progress → currentTime seek、
 * 就绪后换 objectURL、单尺子换算。jsdom 的 video.duration/currentTime 需 mock。
 */
import { createRef, Suspense, startTransition, useState } from 'react';
import { render, act, fireEvent } from '@testing-library/react';
import { motionValue } from 'framer-motion';
import type { AnimateTimelineFrame } from '../types';
import { CineViewProvider } from '../context/CineViewContext';
import { VideoFrameRenderer } from './VideoFrameRenderer';
import type { VideoFrameRendererControl } from './VideoFrameRenderer';
import * as cache from '../hooks/mediaPreloadCache';

let currentTimeSetters: number[] = [];

function stubVideoTiming(duration: number, readyState = 1): void {
  Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
    configurable: true,
    get: () => duration,
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
    configurable: true,
    get: () => readyState,
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
    configurable: true,
    get: () => 0,
    set: (v: number) => {
      currentTimeSetters.push(v);
    },
  });
}

beforeEach(() => {
  currentTimeSetters = [];
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 750 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 1334 });
  // Renderer objectURL reads are leases now. Most tests mock the cache getter;
  // proxy acquire through that getter so fixtures preserve the production
  // acquire/release contract instead of bypassing it.
  jest
    .spyOn(cache, 'acquireVideoObjectUrl')
    .mockImplementation((src) => cache.getVideoObjectUrl(src));
  jest.spyOn(cache, 'releaseVideoObjectUrl').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  cache.resetMediaPreloadCache();
});

describe('VideoFrameRenderer', () => {
  it('renders a muted inline video with src fallback before preload', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(undefined);
    jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(false);
    jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
    stubVideoTiming(10);
    const { container } = render(<VideoFrameRenderer src="/clip.mp4" progress={0} />);
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video).not.toBeNull();
    expect(video.muted).toBe(true);
    expect(video.getAttribute('src')).toBe('/clip.mp4');
  });

  it('triggers preloadMedia with video kind', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(undefined);
    jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(false);
    const spy = jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
    stubVideoTiming(10);
    render(<VideoFrameRenderer src="/v.mp4" progress={0} />);
    expect(spy).toHaveBeenCalledWith('/v.mp4', 'video');
  });

  it('subscribes without starting an eager fetch when preload is false', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(undefined);
    jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(false);
    const spy = jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
    stubVideoTiming(10);
    const { container } = render(
      <VideoFrameRenderer src="/background.mp4" progress={0} preload={false} />
    );

    expect(spy).not.toHaveBeenCalled();
    expect(container.querySelector('video')).toHaveAttribute('preload', 'none');
  });

  it('seeks currentTime = progress * duration when metadata ready', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue('blob:mock-x');
    stubVideoTiming(20, 1);
    render(<VideoFrameRenderer src="/s.mp4" progress={0.5} />);
    // 0.5 * 20 = 10
    expect(currentTimeSetters).toContain(10);
  });

  it('re-seeks when progress changes', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue('blob:mock-y');
    stubVideoTiming(100, 1);
    const { rerender } = render(<VideoFrameRenderer src="/r.mp4" progress={0.1} />);
    act(() => {
      rerender(<VideoFrameRenderer src="/r.mp4" progress={0.9} />);
    });
    expect(currentTimeSetters).toContain(10); // 0.1*100
    expect(currentTimeSetters).toContain(90); // 0.9*100
  });

  it('seeks directly from a MotionValue without replacing the video element', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue('blob:motion');
    stubVideoTiming(100, 1);
    const progress = motionValue(0.2);
    const { container } = render(<VideoFrameRenderer src="/motion.mp4" progress={progress} />);
    const video = container.querySelector('video');

    act(() => {
      progress.set(0.75);
    });

    expect(currentTimeSetters).toContain(20);
    expect(currentTimeSetters).toContain(75);
    expect(container.querySelector('video')).toBe(video);
  });

  it('cleans MotionValue subscriptions on source swap and unmount', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue('blob:swap');
    stubVideoTiming(100, 1);
    const oldProgress = motionValue(0.1);
    const nextProgress = motionValue(0.2);
    const { rerender, unmount } = render(
      <VideoFrameRenderer src="/old.mp4" progress={oldProgress} />
    );

    rerender(<VideoFrameRenderer src="/next.mp4" progress={nextProgress} />);
    const afterSwap = currentTimeSetters.length;
    act(() => {
      oldProgress.set(0.8);
    });
    expect(currentTimeSetters).toHaveLength(afterSwap);

    act(() => {
      nextProgress.set(0.6);
    });
    expect(currentTimeSetters).toContain(60);

    const afterUnmount = currentTimeSetters.length;
    unmount();
    act(() => {
      nextProgress.set(0.9);
    });
    expect(currentTimeSetters).toHaveLength(afterUnmount);
  });

  it('prefers preloaded objectURL over raw src', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue('blob:ready');
    stubVideoTiming(5, 1);
    const { container } = render(<VideoFrameRenderer src="/orig.mp4" progress={0} />);
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video.getAttribute('src')).toBe('blob:ready');
  });

  it('drops the previous objectURL immediately when src changes to an uncached video', () => {
    jest
      .spyOn(cache, 'getVideoObjectUrl')
      .mockImplementation((src) => (src === '/old.mp4' ? 'blob:old' : undefined));
    jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(false);
    jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
    stubVideoTiming(5, 1);

    const { container, rerender } = render(<VideoFrameRenderer src="/old.mp4" progress={0} />);
    expect(container.querySelector('video')).toHaveAttribute('src', 'blob:old');

    rerender(<VideoFrameRenderer src="/new.mp4" progress={0} />);

    expect(container.querySelector('video')).toHaveAttribute('src', '/new.mp4');
  });

  it('releases objectURL leases on source change and unmount', () => {
    jest
      .spyOn(cache, 'getVideoObjectUrl')
      .mockImplementation((src) => `blob:${src.replace('/', '')}`);
    const acquireSpy = jest
      .spyOn(cache, 'acquireVideoObjectUrl')
      .mockImplementation((src) => `blob:${src.replace('/', '')}`);
    const releaseSpy = jest.spyOn(cache, 'releaseVideoObjectUrl');
    stubVideoTiming(5, 1);

    const { rerender, unmount } = render(<VideoFrameRenderer src="/old.mp4" progress={0} />);
    expect(acquireSpy).toHaveBeenCalledWith('/old.mp4');

    rerender(<VideoFrameRenderer src="/new.mp4" progress={0} />);
    expect(releaseSpy).toHaveBeenCalledWith('/old.mp4');
    expect(acquireSpy).toHaveBeenCalledWith('/new.mp4');

    unmount();
    expect(releaseSpy).toHaveBeenCalledWith('/new.mp4');
  });

  it('applies px2vw conversion to numeric dimensions', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue('blob:z');
    stubVideoTiming(5, 1);
    // viewport 750 / design 750 → scale 1；height 也走宽度尺子（认宽不认高）。
    const { container } = render(
      <CineViewProvider designSize={750}>
        <VideoFrameRenderer src="/d.mp4" progress={0} width={375} height={667} />
      </CineViewProvider>
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video.getAttribute('width')).toBe('375');
    expect(video.getAttribute('height')).toBe('667');
  });

  it('height 与 width 共用同一宽度尺子（px2vw，viewport 半宽时等比减半）', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue('blob:half');
    stubVideoTiming(5, 1);
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 375 });
    const { container } = render(
      <CineViewProvider designSize={750}>
        <VideoFrameRenderer src="/h.mp4" progress={0} width={200} height={200} />
      </CineViewProvider>
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    // scale = 375/750 = 0.5；正方形 200×200 → 100×100（不形变）。
    expect(video.getAttribute('width')).toBe('100');
    expect(video.getAttribute('height')).toBe('100');
  });

  it('reuses an already-preloaded objectURL without subscribing (early return)', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue('blob:existing');
    jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(true);
    const subSpy = jest.spyOn(cache, 'subscribeToPreloadedMedia');
    const preSpy = jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
    stubVideoTiming(5, 1);
    render(<VideoFrameRenderer src="/e.mp4" progress={0} />);
    // 已有 objectURL → 订阅/预加载路径不触发。
    expect(subSpy).not.toHaveBeenCalled();
    expect(preSpy).not.toHaveBeenCalled();
  });

  it('subscribes and swaps to objectURL when preload completes', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(undefined);
    jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(false);
    jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
    let notifyReady: ((url: string) => void) | undefined;
    jest.spyOn(cache, 'subscribeToPreloadedMedia').mockImplementation((listener) => {
      notifyReady = listener;
      return () => {};
    });
    stubVideoTiming(10, 1);
    const { container } = render(<VideoFrameRenderer src="/late.mp4" progress={0} />);
    // 初始回退到 src。
    expect((container.querySelector('video') as HTMLVideoElement).getAttribute('src')).toBe(
      '/late.mp4'
    );
    // 预加载就绪 → 通知 → 换 objectURL。
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue('blob:late-ready');
    act(() => {
      notifyReady?.('/late.mp4');
    });
    expect((container.querySelector('video') as HTMLVideoElement).getAttribute('src')).toBe(
      'blob:late-ready'
    );
  });

  it('does not seek when duration is invalid (NaN/0 guard)', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue('blob:nodur');
    stubVideoTiming(NaN, 1);
    render(<VideoFrameRenderer src="/nd.mp4" progress={0.5} />);
    expect(currentTimeSetters).toHaveLength(0);
  });

  it('waits for loadedmetadata when readyState < 1', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue('blob:cold');
    // readyState 0 → 不立即 seek，改挂 loadedmetadata 监听。
    stubVideoTiming(40, 0);
    const { container } = render(<VideoFrameRenderer src="/cold.mp4" progress={0.25} />);
    expect(currentTimeSetters).toHaveLength(0);
    const video = container.querySelector('video') as HTMLVideoElement;
    act(() => {
      video.dispatchEvent(new Event('loadedmetadata'));
    });
    // 0.25 * 40 = 10
    expect(currentTimeSetters).toContain(10);
  });

  it('clamps out-of-range progress to [0,1] before seeking', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue('blob:clamp');
    stubVideoTiming(80, 1);
    const { rerender } = render(<VideoFrameRenderer src="/c.mp4" progress={-0.5} />);
    act(() => {
      rerender(<VideoFrameRenderer src="/c.mp4" progress={2} />);
    });
    // -0.5 → 0, 2 → 1；currentTime 只应出现 0 和 80。
    expect(currentTimeSetters).toContain(0);
    expect(currentTimeSetters).toContain(80);
    expect(currentTimeSetters.every((t) => t >= 0 && t <= 80)).toBe(true);
  });

  it('warns once in development when scrub seeks are consistently slow', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue('blob:slow');
    stubVideoTiming(100, 1);

    // performance.now 每次调用 +100ms → 每个 seek 采样 100ms（> 50ms 阈值）。
    let clock = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => (clock += 100));

    const { rerender } = render(<VideoFrameRenderer src="/slow.mp4" progress={0} />);
    const video = document.querySelector('video') as HTMLVideoElement;
    // 累计 ≥ SCRUB_SAMPLE_MIN(6) 个慢样本，每次 progress 变触发一次 seek + 'seeked'。
    for (let i = 1; i <= 7; i++) {
      act(() => {
        rerender(<VideoFrameRenderer src="/slow.mp4" progress={i / 10} />);
      });
      act(() => {
        video.dispatchEvent(new Event('seeked'));
      });
    }
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('scrub seek is slow');

    process.env.NODE_ENV = prevEnv;
  });

  it('does not seek when metadata never arrives and video is absent (SSR-safe guards)', () => {
    // 空 src → 预加载 effect 的 !src 守卫命中，不订阅/不预加载。
    const subSpy = jest.spyOn(cache, 'subscribeToPreloadedMedia');
    const preSpy = jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(undefined);
    stubVideoTiming(10, 1);
    render(<VideoFrameRenderer src="" progress={0} />);
    expect(subSpy).not.toHaveBeenCalled();
    expect(preSpy).not.toHaveBeenCalled();
  });

  it('forwards the video ref, poster, playbackRate, and native media events', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue('blob:native');
    stubVideoTiming(10, 1);
    const ref = createRef<HTMLVideoElement>();
    const onPlay = jest.fn();
    const onPause = jest.fn();
    const onEnded = jest.fn();
    const onTimeUpdate = jest.fn();
    const onError = jest.fn();

    const { container } = render(
      <VideoFrameRenderer
        ref={ref}
        src="/native.mp4"
        progress={0}
        poster="/poster.jpg"
        playbackRate={1.5}
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onEnded}
        onTimeUpdate={onTimeUpdate}
        onError={onError}
      />
    );
    const video = container.querySelector('video') as HTMLVideoElement;

    expect(ref.current).toBe(video);
    expect(video).toHaveAttribute('poster', '/poster.jpg');
    expect(video.playbackRate).toBe(1.5);
    fireEvent.play(video);
    fireEvent.pause(video);
    fireEvent.ended(video);
    fireEvent.timeUpdate(video);
    fireEvent.error(video);
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(onTimeUpdate).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('uses atomic timeline frames to pause native playback before gesture seeking', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue('blob:ownership');
    stubVideoTiming(10, 1);
    const pauseSpy = jest
      .spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => undefined);
    const frame = motionValue<AnimateTimelineFrame>({
      progress: 0,
      signedProgress: 0,
      phase: 'entering',
      source: 'gesture',
    });
    const { container } = render(
      <VideoFrameRenderer src="/ownership.mp4" progress={0} timelineFrame={frame} />
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    fireEvent.play(video);
    currentTimeSetters = [];

    act(() => {
      frame.set({ progress: 0.4, signedProgress: 0.4, phase: 'entering', source: 'gesture' });
    });

    expect(pauseSpy).toHaveBeenCalledTimes(1);
    expect(currentTimeSetters).toEqual([4]);
  });

  it('hands a partial scrub range to native play once and absorbs rejection', async () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue('blob:handoff');
    stubVideoTiming(10, 1);
    const playSpy = jest
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockRejectedValue(new DOMException('blocked', 'NotAllowedError'));
    const frame = motionValue<AnimateTimelineFrame>({
      progress: 0,
      signedProgress: 0,
      phase: 'entering',
      source: 'gesture',
    });
    render(
      <VideoFrameRenderer
        src="/handoff.mp4"
        progress={0}
        timelineFrame={frame}
        scrubRange={[0, 6]}
      />
    );
    currentTimeSetters = [];

    await act(async () => {
      frame.set({ progress: 1, signedProgress: 1, phase: 'entered', source: 'gesture' });
      await Promise.resolve();
    });
    act(() => {
      frame.set({ progress: 1, signedProgress: 1, phase: 'entered', source: 'continuation' });
    });

    expect(currentTimeSetters).toEqual([6]);
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it('pauses on outgoing frames without mapping exit progress to currentTime', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue('blob:outgoing');
    stubVideoTiming(10, 1);
    const pauseSpy = jest
      .spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => undefined);
    const frame = motionValue<AnimateTimelineFrame>({
      progress: 1,
      signedProgress: 1,
      phase: 'entered',
      source: 'gesture',
    });
    const { container } = render(
      <VideoFrameRenderer src="/outgoing.mp4" progress={1} timelineFrame={frame} />
    );
    fireEvent.play(container.querySelector('video') as HTMLVideoElement);
    currentTimeSetters = [];

    act(() => {
      frame.set({ progress: 0.4, signedProgress: 0.4, phase: 'exiting', source: 'idle' });
      frame.set({ progress: 0.8, signedProgress: 0.8, phase: 'exiting', source: 'idle' });
    });

    expect(pauseSpy).toHaveBeenCalledTimes(1);
    expect(currentTimeSetters).toEqual([]);
  });

  it('allows an external play after automatic play rejection', async () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue('blob:retry');
    stubVideoTiming(10, 1);
    jest
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockRejectedValue(new DOMException('blocked', 'NotAllowedError'));
    const pauseSpy = jest
      .spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => undefined);
    const frame = motionValue<AnimateTimelineFrame>({
      progress: 0,
      signedProgress: 0,
      phase: 'entering',
      source: 'gesture',
    });
    const { container } = render(
      <VideoFrameRenderer src="/retry.mp4" progress={0} timelineFrame={frame} scrubRange={[0, 6]} />
    );
    const video = container.querySelector('video') as HTMLVideoElement;

    await act(async () => {
      frame.set({ progress: 1, signedProgress: 1, phase: 'entered', source: 'gesture' });
      await Promise.resolve();
    });
    fireEvent.play(video);

    expect(pauseSpy).not.toHaveBeenCalled();
  });

  it('restores the native playbackRate default when the prop is removed', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue('blob:rate');
    stubVideoTiming(10, 1);
    const { container, rerender } = render(
      <VideoFrameRenderer src="/rate.mp4" progress={0} playbackRate={1.5} />
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video.playbackRate).toBe(1.5);

    rerender(<VideoFrameRenderer src="/rate.mp4" progress={0} />);
    expect(video.playbackRate).toBe(1);
  });

  it('re-applies playbackRate when a source swap replaces the keyed video node', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(undefined);
    jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(false);
    jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
    stubVideoTiming(10, 1);
    const { container, rerender } = render(
      <VideoFrameRenderer src="/rate-a.mp4" progress={0} playbackRate={1.5} />
    );
    const firstVideo = container.querySelector('video') as HTMLVideoElement;
    expect(firstVideo.playbackRate).toBe(1.5);

    rerender(<VideoFrameRenderer src="/rate-b.mp4" progress={0} playbackRate={1.5} />);

    const replacementVideo = container.querySelector('video') as HTMLVideoElement;
    expect(replacementVideo).not.toBe(firstVideo);
    expect(replacementVideo.playbackRate).toBe(1.5);
  });

  it('reactivates an ended mounted video when a new enter frame starts', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue('blob:reenter');
    stubVideoTiming(10, 1);
    const frame = motionValue<AnimateTimelineFrame>({
      progress: 1,
      signedProgress: 1,
      phase: 'entered',
      source: 'gesture',
    });
    const { container } = render(
      <VideoFrameRenderer src="/reenter.mp4" progress={1} timelineFrame={frame} />
    );
    fireEvent.ended(container.querySelector('video') as HTMLVideoElement);
    currentTimeSetters = [];

    act(() => {
      frame.set({ progress: 0.2, signedProgress: 0.2, phase: 'entering', source: 'programmatic' });
    });

    expect(currentTimeSetters).toEqual([2]);
  });

  it('rejects a delayed play event after promise settlement and framework scrub takeover', async () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(undefined);
    jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(false);
    jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
    stubVideoTiming(10, 1);
    const playSpy = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const pauseSpy = jest
      .spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => undefined);
    const onPlay = jest.fn();
    const frame = motionValue<AnimateTimelineFrame>({
      progress: 0,
      signedProgress: 0,
      phase: 'entering',
      source: 'gesture',
    });
    const { container } = render(
      <VideoFrameRenderer
        src="/late-play.mp4"
        progress={0}
        timelineFrame={frame}
        scrubRange={[0, 6]}
        onPlay={onPlay}
      />
    );
    const video = container.querySelector('video') as HTMLVideoElement;

    await act(async () => {
      frame.set({ progress: 1, signedProgress: 1, phase: 'entered', source: 'gesture' });
      await Promise.resolve();
    });
    expect(playSpy).toHaveBeenCalledTimes(1);

    act(() => {
      frame.set({ progress: 0.8, signedProgress: 0.8, phase: 'entering', source: 'scroll' });
    });
    expect(pauseSpy).toHaveBeenCalledTimes(1);

    // The browser may deliver this event after play() has already resolved.
    // It must not reclaim ownership or reach the public callback.
    fireEvent.play(video);
    expect(pauseSpy).toHaveBeenCalledTimes(2);
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('isolates an outgoing pause queued before same-source timeline reactivation', async () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(undefined);
    jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(false);
    jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
    stubVideoTiming(10, 1);
    const onPause = jest.fn();
    const pauseSpy = jest
      .spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => undefined);
    const playSpy = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const frame = motionValue<AnimateTimelineFrame>({
      progress: 0,
      signedProgress: 0,
      phase: 'entering',
      source: 'gesture',
    });
    const { container } = render(
      <VideoFrameRenderer
        src="/same-activation-source.mp4"
        progress={0}
        timelineFrame={frame}
        scrubRange={[0, 6]}
        onPause={onPause}
      />
    );
    const outgoingVideo = container.querySelector('video') as HTMLVideoElement;

    fireEvent.play(outgoingVideo);
    const queuedPause = new Event('pause');
    act(() => {
      frame.set({ progress: 0.8, signedProgress: 0.8, phase: 'exiting', source: 'idle' });
    });
    expect(pauseSpy).toHaveBeenCalledTimes(1);

    act(() => {
      frame.set({
        progress: 0.2,
        signedProgress: 0.2,
        phase: 'entering',
        source: 'programmatic',
      });
    });
    const reactivatedVideo = container.querySelector('video') as HTMLVideoElement;
    expect(reactivatedVideo).not.toBe(outgoingVideo);

    outgoingVideo.dispatchEvent(queuedPause);
    expect(onPause).not.toHaveBeenCalled();

    await act(async () => {
      frame.set({ progress: 1, signedProgress: 1, phase: 'entered', source: 'gesture' });
      await Promise.resolve();
    });
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it('does not let a stale ended event from the previous source poison the new activation', async () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(undefined);
    jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(false);
    jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
    stubVideoTiming(10, 1);
    const addEventListenerSpy = jest.spyOn(HTMLMediaElement.prototype, 'addEventListener');
    const playSpy = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const onEnded = jest.fn();
    const frame = motionValue<AnimateTimelineFrame>({
      progress: 0,
      signedProgress: 0,
      phase: 'entering',
      source: 'gesture',
    });
    const { container, rerender } = render(
      <VideoFrameRenderer
        src="/source-a.mp4"
        progress={0}
        timelineFrame={frame}
        scrubRange={[0, 6]}
        onEnded={onEnded}
      />
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    const sourceAEndedListeners = addEventListenerSpy.mock.calls
      .filter(([type]) => type === 'ended')
      .map(([, listener]) => listener as EventListener);
    const sourceAEndedListener = sourceAEndedListeners[sourceAEndedListeners.length - 1];
    expect(sourceAEndedListener).toEqual(expect.any(Function));

    // Model an `ended` event queued by source A after source B has replaced it.
    rerender(
      <VideoFrameRenderer
        src="/source-b.mp4"
        progress={0}
        timelineFrame={frame}
        scrubRange={[0, 6]}
        onEnded={onEnded}
      />
    );
    const sourceBEndedListeners = addEventListenerSpy.mock.calls
      .filter(([type]) => type === 'ended')
      .map(([, listener]) => listener as EventListener);
    const sourceBEndedListener = sourceBEndedListeners[sourceBEndedListeners.length - 1];
    expect(sourceBEndedListener).toEqual(expect.any(Function));
    expect(sourceBEndedListener).not.toBe(sourceAEndedListener);
    const staleEndedEvent = new Event('ended');
    sourceAEndedListener?.call(video, staleEndedEvent);
    // Remove the new tokenized listener so dispatch reaches only React's
    // delegated handler; it must observe that the native event was not accepted.
    if (sourceBEndedListener) {
      video.removeEventListener('ended', sourceBEndedListener);
      video.removeEventListener('ended', sourceBEndedListener, true);
    }
    video.dispatchEvent(staleEndedEvent);

    await act(async () => {
      frame.set({ progress: 1, signedProgress: 1, phase: 'entered', source: 'gesture' });
      await Promise.resolve();
    });

    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(onEnded).not.toHaveBeenCalled();
  });

  it('rejects queued native play events from the previous source generation', async () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(undefined);
    jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(false);
    jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
    stubVideoTiming(10, 1);
    const addEventListenerSpy = jest.spyOn(HTMLMediaElement.prototype, 'addEventListener');
    const removeEventListenerSpy = jest.spyOn(HTMLMediaElement.prototype, 'removeEventListener');
    const playSpy = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const sourceAOnPlay = jest.fn();
    const sourceBOnPlay = jest.fn();
    const frame = motionValue<AnimateTimelineFrame>({
      progress: 0,
      signedProgress: 0,
      phase: 'entering',
      source: 'gesture',
    });
    const { container, rerender } = render(
      <VideoFrameRenderer
        src="/source-a-play.mp4"
        progress={0}
        timelineFrame={frame}
        scrubRange={[0, 6]}
        onPlay={sourceAOnPlay}
      />
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    const sourceAPlayListener = addEventListenerSpy.mock.calls
      .filter(([type, , options]) => type === 'play' && options === true)
      .map(([, listener]) => listener as EventListener)
      .slice(-1)[0];

    rerender(
      <VideoFrameRenderer
        src="/source-b-play.mp4"
        progress={0}
        timelineFrame={frame}
        scrubRange={[0, 6]}
        onPlay={sourceBOnPlay}
      />
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith('play', sourceAPlayListener, true);
    const sourceBVideo = container.querySelector('video') as HTMLVideoElement;
    expect(sourceBVideo).not.toBe(video);
    const staleOldClosureEvent = new Event('play');
    const staleQueuedEvent = new Event('play');

    // Both a late A closure and an A event already queued by the browser stay
    // attached to A's detached node; neither can enter B's listener generation.
    sourceAPlayListener?.call(video, staleOldClosureEvent);
    video.dispatchEvent(staleOldClosureEvent);
    video.dispatchEvent(staleQueuedEvent);

    expect(sourceAOnPlay).not.toHaveBeenCalled();
    expect(sourceBOnPlay).not.toHaveBeenCalled();

    fireEvent.loadStart(sourceBVideo);
    await act(async () => {
      frame.set({ progress: 1, signedProgress: 1, phase: 'entered', source: 'gesture' });
      await Promise.resolve();
    });
    // The stale event must not make B a native owner; B still hands its
    // bounded scrub range to native playback exactly once at the endpoint.
    expect(playSpy).toHaveBeenCalledTimes(1);

    fireEvent.play(sourceBVideo);
    expect(sourceBOnPlay).toHaveBeenCalledTimes(1);
  });

  it('rejects a queued native pause from the previous source while preserving current pause events', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(undefined);
    jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(false);
    jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
    stubVideoTiming(10, 1);
    const addEventListenerSpy = jest.spyOn(HTMLMediaElement.prototype, 'addEventListener');
    const removeEventListenerSpy = jest.spyOn(HTMLMediaElement.prototype, 'removeEventListener');
    const sourceAOnPause = jest.fn();
    const sourceBOnPause = jest.fn();
    const { container, rerender } = render(
      <VideoFrameRenderer src="/source-a-pause.mp4" progress={0} onPause={sourceAOnPause} />
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    const sourceAPauseListener = addEventListenerSpy.mock.calls
      .filter(([type, , options]) => type === 'pause' && options === true)
      .map(([, listener]) => listener as EventListener)
      .slice(-1)[0];

    rerender(
      <VideoFrameRenderer src="/source-b-pause.mp4" progress={0} onPause={sourceBOnPause} />
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith('pause', sourceAPauseListener, true);
    const sourceBVideo = container.querySelector('video') as HTMLVideoElement;
    expect(sourceBVideo).not.toBe(video);
    const staleOldClosureEvent = new Event('pause');
    const staleQueuedEvent = new Event('pause');

    sourceAPauseListener?.call(video, staleOldClosureEvent);
    video.dispatchEvent(staleOldClosureEvent);
    // A source swap replaces the media node, so a queued event from A cannot
    // reach B's capture listener even if it runs after B committed.
    video.dispatchEvent(staleQueuedEvent);

    expect(sourceAOnPause).not.toHaveBeenCalled();
    expect(sourceBOnPause).not.toHaveBeenCalled();

    fireEvent.loadStart(sourceBVideo);
    fireEvent.pause(sourceBVideo);
    expect(sourceBOnPause).toHaveBeenCalledTimes(1);
  });

  it('isolates queued media events across same-source release and warm-up generations', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(undefined);
    jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(false);
    jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
    stubVideoTiming(10, 1);
    const onEnded = jest.fn();
    const controlRef = createRef<VideoFrameRendererControl | null>();
    const { container } = render(
      <VideoFrameRenderer
        src="/same-source.mp4"
        progress={0}
        controlRef={controlRef}
        onEnded={onEnded}
      />
    );
    const initialVideo = container.querySelector('video') as HTMLVideoElement;
    jest.spyOn(initialVideo, 'pause').mockImplementation(() => undefined);
    jest.spyOn(initialVideo, 'load').mockImplementation(() => undefined);
    const staleEnded = new Event('ended');

    act(() => controlRef.current?.release());
    act(() => controlRef.current?.warmUp());

    const warmedVideo = container.querySelector('video') as HTMLVideoElement;
    expect(warmedVideo).not.toBe(initialVideo);
    initialVideo.dispatchEvent(staleEnded);
    expect(onEnded).not.toHaveBeenCalled();

    fireEvent.ended(warmedVideo);
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('does not let an old source loadstart arm the replacement generation', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(undefined);
    jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(false);
    jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
    stubVideoTiming(10, 0);
    const sourceAOnPlay = jest.fn();
    const sourceBOnPlay = jest.fn();
    const { container, rerender } = render(
      <VideoFrameRenderer src="/source-a-loadstart.mp4" progress={0} onPlay={sourceAOnPlay} />
    );
    const sourceAVideo = container.querySelector('video') as HTMLVideoElement;

    rerender(
      <VideoFrameRenderer src="/source-b-loadstart.mp4" progress={0} onPlay={sourceBOnPlay} />
    );
    const sourceBVideo = container.querySelector('video') as HTMLVideoElement;
    expect(sourceBVideo).not.toBe(sourceAVideo);

    sourceAVideo.dispatchEvent(new Event('loadstart'));
    sourceAVideo.dispatchEvent(new Event('play'));
    expect(sourceAOnPlay).not.toHaveBeenCalled();
    expect(sourceBOnPlay).not.toHaveBeenCalled();

    fireEvent.loadStart(sourceBVideo);
    fireEvent.play(sourceBVideo);
    expect(sourceBOnPlay).toHaveBeenCalledTimes(1);
  });

  it('keeps the committed source generation during an aborted transition render', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(undefined);
    jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(false);
    jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
    stubVideoTiming(10, 1);
    const onEnded = jest.fn();
    const frame = motionValue<AnimateTimelineFrame>({
      progress: 0,
      signedProgress: 0,
      phase: 'entered',
      source: 'gesture',
    });
    const suspended = new Promise<never>(() => undefined);
    let showSourceB = (): void => undefined;

    function SuspendSourceB({ source }: { source: string }): JSX.Element | null {
      if (source === '/source-b.mp4') throw suspended;
      return null;
    }

    function Harness(): JSX.Element {
      const [source, setSource] = useState('/source-a.mp4');
      showSourceB = (): void => setSource('/source-b.mp4');
      return (
        <Suspense fallback={null}>
          <VideoFrameRenderer src={source} progress={0} timelineFrame={frame} onEnded={onEnded} />
          <SuspendSourceB source={source} />
        </Suspense>
      );
    }

    const { container } = render(<Harness />);
    const video = container.querySelector('video') as HTMLVideoElement;
    currentTimeSetters = [];

    act(() => {
      startTransition(showSourceB);
    });

    expect(container.querySelector('video')).toBe(video);
    expect(video).toHaveAttribute('src', '/source-a.mp4');

    fireEvent.ended(video);
    currentTimeSetters = [];
    act(() => {
      frame.set({ progress: 0.5, signedProgress: 0.5, phase: 'entered', source: 'programmatic' });
    });

    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(currentTimeSetters).toEqual([]);
  });

  it('forwards an accepted ended event to the latest committed callback', () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(undefined);
    jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(false);
    jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
    stubVideoTiming(10, 1);
    const firstOnEnded = jest.fn();
    const latestOnEnded = jest.fn();
    const { container, rerender } = render(
      <VideoFrameRenderer src="/callback.mp4" progress={0} onEnded={firstOnEnded} />
    );
    const video = container.querySelector('video') as HTMLVideoElement;

    rerender(<VideoFrameRenderer src="/callback.mp4" progress={0} onEnded={latestOnEnded} />);
    fireEvent.ended(video);

    expect(firstOnEnded).not.toHaveBeenCalled();
    expect(latestOnEnded).toHaveBeenCalledTimes(1);
  });

  describe('releaseOnLeave control handle', () => {
    // jsdom's HTMLMediaElement methods log "Not implemented" to console.error,
    // which setupTests treats as a failure — stub pause/load on every path.
    const stubMediaMethods = (video: HTMLVideoElement): void => {
      jest.spyOn(video, 'load').mockImplementation(() => undefined);
      jest.spyOn(video, 'pause').mockImplementation(() => undefined);
    };

    it('release() detaches src and calls load() to drop decoded residency', () => {
      jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(undefined);
      jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(false);
      jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
      stubVideoTiming(10);
      const controlRef = createRef<VideoFrameRendererControl | null>();
      const { container } = render(
        <VideoFrameRenderer src="/release.mp4" progress={0} controlRef={controlRef} />
      );
      const video = container.querySelector('video') as HTMLVideoElement;
      expect(video.getAttribute('src')).toBe('/release.mp4');
      stubMediaMethods(video);

      act(() => {
        controlRef.current?.release();
      });

      expect(video.pause).toHaveBeenCalled();
      expect(video.hasAttribute('src')).toBe(false);
      expect(video.load).toHaveBeenCalled();
      // preload attr collapses to none while released — no refetch.
      const releasedVideo = container.querySelector('video') as HTMLVideoElement;
      expect(releasedVideo).not.toBe(video);
      expect(releasedVideo.hasAttribute('src')).toBe(false);
      expect(releasedVideo.getAttribute('preload')).toBe('none');
    });

    it('warmUp() re-attaches src and re-seeks to the current timeline position', () => {
      jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(undefined);
      jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(false);
      stubVideoTiming(10);
      const controlRef = createRef<VideoFrameRendererControl | null>();
      const progress = motionValue(0.4);
      const { container } = render(
        <VideoFrameRenderer src="/warm.mp4" progress={progress} controlRef={controlRef} />
      );
      const video = container.querySelector('video') as HTMLVideoElement;
      stubMediaMethods(video);

      act(() => {
        controlRef.current?.release();
      });
      expect(video.hasAttribute('src')).toBe(false);

      currentTimeSetters = [];
      act(() => {
        controlRef.current?.warmUp();
      });

      const warmedVideo = container.querySelector('video') as HTMLVideoElement;
      expect(warmedVideo).not.toBe(video);
      expect(warmedVideo.getAttribute('src')).toBe('/warm.mp4');
      // The epoch bump re-armed the seek catch-up: current progress (0.4 × 10s)
      // is applied once metadata reports ready again.
      expect(currentTimeSetters).toEqual([4]);
    });

    it('recovers a released renderer immediately when the source changes', () => {
      jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(undefined);
      jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(false);
      jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
      stubVideoTiming(10);
      const controlRef = createRef<VideoFrameRendererControl | null>();
      const { container, rerender } = render(
        <VideoFrameRenderer src="/a.mp4" progress={0.2} controlRef={controlRef} />
      );
      const video = container.querySelector('video') as HTMLVideoElement;
      stubMediaMethods(video);

      act(() => controlRef.current?.release());
      expect(video).not.toHaveAttribute('src');

      act(() => {
        rerender(<VideoFrameRenderer src="/b.mp4" progress={0.2} controlRef={controlRef} />);
      });
      const nextVideo = container.querySelector('video') as HTMLVideoElement;
      expect(nextVideo).not.toBe(video);
      expect(nextVideo).toHaveAttribute('src', '/b.mp4');
      expect(nextVideo).toHaveAttribute('preload', 'auto');
    });

    it('re-applies playbackRate across release and warm-up keyed remounts', () => {
      jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(undefined);
      jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(false);
      jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
      stubVideoTiming(10, 1);
      const pauseSpy = jest
        .spyOn(HTMLMediaElement.prototype, 'pause')
        .mockImplementation(() => undefined);
      const loadSpy = jest
        .spyOn(HTMLMediaElement.prototype, 'load')
        .mockImplementation(() => undefined);
      const controlRef = createRef<VideoFrameRendererControl | null>();
      const { container } = render(
        <VideoFrameRenderer
          src="/rate-residency.mp4"
          progress={0}
          playbackRate={1.25}
          controlRef={controlRef}
        />
      );
      const initialVideo = container.querySelector('video') as HTMLVideoElement;
      expect(initialVideo.playbackRate).toBe(1.25);

      act(() => controlRef.current?.release());
      const releasedVideo = container.querySelector('video') as HTMLVideoElement;
      expect(releasedVideo).not.toBe(initialVideo);
      expect(releasedVideo.playbackRate).toBe(1.25);

      act(() => controlRef.current?.warmUp());
      const warmedVideo = container.querySelector('video') as HTMLVideoElement;
      expect(warmedVideo).not.toBe(releasedVideo);
      expect(warmedVideo.playbackRate).toBe(1.25);
      expect(pauseSpy).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
    });

    it('keeps the objectURL lease across release — warm-up costs no network', () => {
      const url = 'blob:http://localhost/warm-lease';
      jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(url);
      jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(true);
      stubVideoTiming(10);
      const releaseSpy = jest.spyOn(cache, 'releaseVideoObjectUrl');
      const controlRef = createRef<VideoFrameRendererControl | null>();
      const { container, unmount } = render(
        <VideoFrameRenderer src="/lease.mp4" progress={0} controlRef={controlRef} />
      );
      const video = container.querySelector('video') as HTMLVideoElement;
      stubMediaMethods(video);

      act(() => {
        controlRef.current?.release();
      });
      expect(releaseSpy).not.toHaveBeenCalled();

      unmount();
      // The lease is released exactly once, on unmount — not on residency release.
      expect(releaseSpy).toHaveBeenCalledTimes(1);
    });
  });
});
