/**
 * useImagePreloader branch coverage tests
 * Covers:
 *  - line 222-223: when a run has only background URLs (priorityBatch is empty),
 *    priorityCompleteFired is immediately true and setPriorityComplete(true) is called synchronously
 *  - line 288-289: when background Promise.all resolves but the run has been superseded by reset
 *    (activeRunIdRef !== runId) → early return, no result commit
 *  - line 305-307: when a run finishes cleanly, the finally callback resets currentRunPromiseRef to null
 *    (awaiting the promise returned by startPreload ensures the finally microtask executes before unmount)
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useImagePreloader } from './useImagePreloader';
import { resetPreloadedImageCache } from './imagePreloadCache';

// Mock Image: async onload for success path (consistent with existing tests).
class MockImage {
  src: string = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    setTimeout(() => {
      if (this.src.includes('error')) {
        this.onerror?.();
      } else if (this.src !== '') {
        this.onload?.();
      }
    }, 10);
  }
}

(global as any).Image = MockImage;

describe('useImagePreloader branch coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPreloadedImageCache();
  });

  it('marks priorityComplete immediately for a background-only run (no priority URLs)', async () => {
    // priorityBatch is empty, background is not => initialTotal>0 (no early return for 0-batch),
    // initialPriorityUrls.size === 0 => priorityCompleteFired=true => line 223 fires.
    const { result } = renderHook(() =>
      useImagePreloader({ backgroundUrls: ['bg-1.jpg', 'bg-2.jpg'] })
    );

    let runPromise: Promise<void> | undefined;
    act(() => {
      const [, actions] = result.current;
      runPromise = actions.startPreload();
    });

    // priorityComplete should become true after run starts when there are no priority URLs.
    await waitFor(() => {
      expect(result.current[0].priorityComplete).toBe(true);
    });

    await act(async () => {
      await runPromise;
    });

    // Clean finish: both background images loaded successfully.
    expect(result.current[0].results).toHaveLength(2);
    expect(result.current[0].isLoading).toBe(false);
  });

  it('abandons a background run whose runId was superseded by reset (no result commit)', async () => {
    const { result } = renderHook(() =>
      useImagePreloader({ backgroundUrls: ['bg-a.jpg', 'bg-b.jpg'] })
    );

    act(() => {
      const [, actions] = result.current;
      // Start then immediately reset: the async run is now waiting at the background Promise.all await,
      // reset() increments activeRunIdRef, causing the runId check after Promise.all resolves to fail → line 289 return.
      actions.startPreload();
      actions.reset();
    });

    // reset clears state; the superseded run must not commit any results.
    await waitFor(() => {
      expect(result.current[0].isLoading).toBe(false);
    });
    // Wait for original background timers/abort to settle.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(result.current[0].results).toHaveLength(0);
    expect(result.current[0].loadedCount).toBe(0);
  });

  it('clears currentRunPromiseRef when a run finishes cleanly (finally true-branch)', async () => {
    const { result } = renderHook(() =>
      useImagePreloader({ priorityUrls: ['p-1.jpg'], backgroundUrls: ['b-1.jpg'] })
    );

    let runPromise: Promise<void> | undefined;
    act(() => {
      const [, actions] = result.current;
      runPromise = actions.startPreload();
    });

    // Wait for the startPreload promise to resolve — its finally callback then resets
    // currentRunPromiseRef.current === runPromise to null (line 307).
    await act(async () => {
      await runPromise;
    });

    expect(result.current[0].isLoading).toBe(false);
    expect(result.current[0].results).toHaveLength(2);

    // Observable proof that reset worked: can start a fresh run again (loadingRef is released).
    let secondRun: Promise<void> | undefined;
    act(() => {
      const [, actions] = result.current;
      secondRun = actions.startPreload();
    });
    await act(async () => {
      await secondRun;
    });
    expect(result.current[0].isLoading).toBe(false);
  });
});
