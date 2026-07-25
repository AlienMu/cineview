/**
 * VideoFrameRenderer 单测:渲染 <video muted playsInline>、progress → currentTime seek、
 * 就绪后换 objectURL、单尺子换算。jsdom 的 video.duration/currentTime 需 mock。
 */
import { render, act } from '@testing-library/react';
import { motionValue } from 'framer-motion';
import { CineViewProvider } from '../context/CineViewContext';
import { VideoFrameRenderer } from './VideoFrameRenderer';
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
});
