/**
 * 回归:useImagePreloader 把 video URL 路由到 mediaPreloadCache(blob buffer),
 * 且这些媒体计入同一优先级批次 → priorityComplete 等媒体就绪才 fire。普通图片仍走
 * Image()。mediaPreloadCache 被 mock 以隔离网络。
 */
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { useImagePreloader } from './useImagePreloader';
import { resetPreloadedImageCache } from './imagePreloadCache';

class MockImage {
  src = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    setTimeout(() => this.onload?.(), 5);
  }
}
(global as unknown as { Image: unknown }).Image = MockImage;

const preloadMediaMock = jest.fn<Promise<void>, [string, string?]>();
jest.mock('./mediaPreloadCache', () => ({
  inferMediaKind: (src: string) => (/\.(mp4|webm)(\?|#|$)/i.test(src) ? 'video' : null),
  preloadMedia: (src: string, kind?: string) => preloadMediaMock(src, kind),
}));

describe('useImagePreloader — media routing', () => {
  beforeEach(() => {
    resetPreloadedImageCache();
    preloadMediaMock.mockReset();
    preloadMediaMock.mockResolvedValue(undefined);
  });

  it('routes video priority urls through preloadMedia with the inferred kind', async () => {
    const { result } = renderHook(() => useImagePreloader({ priorityUrls: ['/b.mp4', '/c.jpg'] }));
    await act(async () => {
      await result.current[1].startPreload();
    });
    await waitFor(() => expect(result.current[0].priorityComplete).toBe(true));
    expect(preloadMediaMock).toHaveBeenCalledWith('/b.mp4', 'video');
    // the plain image did NOT go through preloadMedia
    expect(preloadMediaMock).not.toHaveBeenCalledWith('/c.jpg', expect.anything());
  });

  it('priorityComplete waits for slow video buffer before firing', async () => {
    let resolveBuffer: (() => void) | null = null;
    preloadMediaMock.mockImplementation(
      () =>
        new Promise<void>((res) => {
          resolveBuffer = res;
        })
    );
    const { result } = renderHook(() => useImagePreloader({ priorityUrls: ['/slow.mp4'] }));
    act(() => {
      void result.current[1].startPreload();
    });
    // still not complete while buffer is pending
    await waitFor(() => expect(result.current[0].isLoading).toBe(true));
    expect(result.current[0].priorityComplete).toBe(false);
    // resolve buffer → priorityComplete fires
    act(() => {
      resolveBuffer?.();
    });
    await waitFor(() => expect(result.current[0].priorityComplete).toBe(true));
  });

  it('media buffer failure marks the url failed but still settles priorityComplete', async () => {
    preloadMediaMock.mockRejectedValue(new Error('fetch failed'));
    const onError = jest.fn();
    const { result } = renderHook(() =>
      useImagePreloader({ priorityUrls: ['/broken.mp4'], onError })
    );
    await act(async () => {
      await result.current[1].startPreload();
    });
    await waitFor(() => expect(result.current[0].priorityComplete).toBe(true));
    expect(onError).toHaveBeenCalledWith('/broken.mp4', expect.any(Error));
  });

  it('does not publish a stale media error after unmount', async () => {
    let rejectBuffer: ((error: Error) => void) | null = null;
    preloadMediaMock.mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectBuffer = reject;
        })
    );
    const onError = jest.fn();
    const { result, unmount } = renderHook(() =>
      useImagePreloader({ priorityUrls: ['/late-error.mp4'], onError })
    );

    act(() => {
      void result.current[1].startPreload();
    });
    await waitFor(() => expect(preloadMediaMock).toHaveBeenCalled());

    unmount();
    await act(async () => {
      rejectBuffer?.(new Error('late failure'));
      await Promise.resolve();
    });

    expect(onError).not.toHaveBeenCalled();
  });
});
