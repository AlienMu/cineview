/**
 * Regression (E-A4):
 *  1. Stalled image requests (neither onload nor onerror) must settle as
 *     {success:false} after timeout (15s) — otherwise a single hung priority
 *     image will freeze progress, block the background queue, and deadlock
 *     the priorityComplete first-screen gate.
 *  2. Priority batch must load concurrently: priorityComplete wait time depends
 *     on the slowest image, not the sum of all load times (old implementation
 *     loaded serially with sequential awaits).
 */

import { renderHook, act } from '@testing-library/react';
import { useImagePreloader } from './useImagePreloader';
import { resetPreloadedImageCache } from './imagePreloadCache';

// Images with 'hang' in src never settle; others fire onload after 100ms.
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
      return; // never load / error
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
    // ok.jpg settled, but the first-screen gate stays closed until hung image times out.
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

    // Each image takes 100ms; with concurrency, advancing one 100ms window settles
    // all images and releases the first-screen gate. Serial loading (bug) would not
    // start p2/p3 until p1 completes, and this assertion would fail.
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current[0].loadedCount).toBe(3);
    expect(result.current[0].priorityComplete).toBe(true);
  });
});
