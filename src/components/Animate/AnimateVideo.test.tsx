/**
 * AnimateVideo facade 单测:渲染 VideoFrameRenderer、透传 src、animateId 生效、
 * 触发 video 预加载。scrub 机制由下层单测覆盖。
 */
import { render, waitFor } from '@testing-library/react';
import { AnimateVideo } from './AnimateVideo';
import * as cache from '../../hooks/mediaPreloadCache';

beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
    configurable: true,
    get: () => 10,
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
    configurable: true,
    get: () => 1,
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
    configurable: true,
    get: () => 0,
    set: () => undefined,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  cache.resetMediaPreloadCache();
});

describe('AnimateVideo facade', () => {
  it('renders a muted inline video with forwarded src', async () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(undefined);
    jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(false);
    jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
    const { container } = render(<AnimateVideo src="/clip.mp4" />);
    await waitFor(() => {
      expect(container.querySelector('video')?.getAttribute('src')).toBe('/clip.mp4');
    });
    expect((container.querySelector('video') as HTMLVideoElement).muted).toBe(true);
  });

  it('applies animateId to the underlying Animate host once the neutral variant parses', async () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(undefined);
    jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(false);
    jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
    const { container } = render(<AnimateVideo src="/v.mp4" animateId="my-vid" />);
    await waitFor(() => {
      expect(container.querySelector('[data-cineview-animate-id="my-vid"]')).not.toBeNull();
    });
  });

  it('triggers video preload for its src', async () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(undefined);
    jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(false);
    const spy = jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
    const { container } = render(<AnimateVideo src="/w.mp4" animateId="w" />);
    await waitFor(() => {
      expect(container.querySelector('[data-cineview-animate-id="w"]')).not.toBeNull();
    });
    expect(spy).toHaveBeenCalledWith('/w.mp4', 'video');
  });

  it('can defer preload to the owning Scene resource queue', async () => {
    jest.spyOn(cache, 'getVideoObjectUrl').mockReturnValue(undefined);
    jest.spyOn(cache, 'isMediaPreloaded').mockReturnValue(false);
    const spy = jest.spyOn(cache, 'preloadMedia').mockResolvedValue(undefined);
    const { container } = render(<AnimateVideo src="/later.mp4" preload={false} />);

    await waitFor(() => {
      expect(container.querySelector('video')).not.toBeNull();
    });
    expect(spy).not.toHaveBeenCalled();
    expect(container.querySelector('video')).toHaveAttribute('preload', 'none');
  });
});
