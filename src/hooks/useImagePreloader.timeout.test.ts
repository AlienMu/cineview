/**
 * 回归(E-A4):
 *  1. 挂起(既不 onload 也不 onerror)的图片请求必须在超时(15s)后按加载失败
 *     {success:false} 结算 —— 否则一张挂起的 priority 图会冻结 progress、阻塞
 *     background 队列、卡死 priorityComplete 首屏门。
 *  2. priority 批必须并发加载:priorityComplete 的等待时间取决于最慢一张,
 *     而不是各图加载时间之和(旧实现逐张串行 await)。
 */

import { renderHook, act } from '@testing-library/react';
import { useImagePreloader } from './useImagePreloader';
import { resetPreloadedImageCache } from './imagePreloadCache';

// src 含 'hang' 的图片永不结算;其余在 100ms 后 onload。
class TimerMockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private currentSrc = '';

  get src(): string {
    return this.currentSrc;
  }

  set src(value: string) {
    this.currentSrc = value;
    if (value === '' || value.includes('hang')) {
      return; // 永不 load / error
    }
    setTimeout(() => this.onload?.(), 100);
  }
}

describe('useImagePreloader — stalled requests & priority concurrency', () => {
  const originalImage = (global as any).Image;

  beforeEach(() => {
    jest.useFakeTimers();
    resetPreloadedImageCache();

    (global as any).Image = TimerMockImage;
  });

  afterEach(() => {
    jest.useRealTimers();

    (global as any).Image = originalImage;
  });

  it('settles a hung priority image as a failure after the timeout and releases priorityComplete', async () => {
    const onError = jest.fn();
    const { result } = renderHook(() =>
      useImagePreloader({ priorityUrls: ['hang.jpg', 'ok.jpg'], onError })
    );

    act(() => {
      void result.current[1].startPreload();
    });

    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    // ok.jpg 已结算,但挂起图未超时前不放行首屏门。
    expect(result.current[0].priorityComplete).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(15_000);
    });
    expect(result.current[0].priorityComplete).toBe(true);
    expect(onError).toHaveBeenCalledWith('hang.jpg', expect.any(Error));
    expect(result.current[0].progress).toBe(100);
    const hung = result.current[0].results.find((r) => r.url === 'hang.jpg');
    expect(hung?.success).toBe(false);
    expect(result.current[0].errors.has('hang.jpg')).toBe(true);
  });

  it('loads the priority batch concurrently — total wait is the max, not the sum', async () => {
    const { result } = renderHook(() =>
      useImagePreloader({ priorityUrls: ['p1.jpg', 'p2.jpg', 'p3.jpg'] })
    );

    act(() => {
      void result.current[1].startPreload();
    });

    // 单张耗时 100ms;并发下推进一个 100ms 窗口即可全部结算并放行首屏门。
    // 串行(bug)时 p2/p3 的加载在 p1 结算前根本没开始,此断言必然失败。
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current[0].loadedCount).toBe(3);
    expect(result.current[0].priorityComplete).toBe(true);
  });
});
