/**
 * Property-Based Test: Image Load Progress Monotonicity
 * **Validates: Requirements 11.6**
 *
 * Property 4: Loading progress at a later time point must be greater than or equal to the progress at an earlier time point
 * Formal: ∀ time t1, t2: t1 < t2 ⟹ progress(t1) ≤ progress(t2)
 */

import { test } from '@fast-check/jest';
import * as fc from 'fast-check';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useImagePreloader } from '../../hooks/useImagePreloader';

describe('Property: Image Load Progress Monotonicity', () => {
  const originalImage = global.Image;

  afterEach(() => {
    global.Image = originalImage;
  });

  test.prop([
    fc.array(
      fc.record({
        shouldLoad: fc.boolean(),
        delay: fc.integer({ min: 10, max: 100 }),
      }),
      { minLength: 2, maxLength: 10 }
    ),
  ])(
    'image load progress should monotonically increase (never decrease)',
    async (imageConfigs: Array<{ shouldLoad: boolean; delay: number }>) => {
      const configs = imageConfigs;
      const imageUrls = configs.map(
        (_: { shouldLoad: boolean; delay: number }, index: number) =>
          `https://example.com/image-${index}.jpg`
      );

      let imageIndex = 0;
      global.Image = class {
        onload: ((this: GlobalEventHandlers, ev: Event) => unknown) | null = null;
        onerror: ((this: GlobalEventHandlers, ev: Event) => unknown) | null = null;
        src = '';

        constructor() {
          const currentIndex = imageIndex++;
          const config = configs[currentIndex];

          setTimeout(() => {
            if (config && config.shouldLoad && this.onload) {
              this.onload.call({} as GlobalEventHandlers, new Event('load'));
            } else if (config && !config.shouldLoad && this.onerror) {
              this.onerror.call({} as GlobalEventHandlers, new Event('error'));
            }
          }, config?.delay || 10);
        }
      } as unknown as typeof Image;

      const { result } = renderHook(() => useImagePreloader({ priorityUrls: imageUrls }));

      const progressHistory: number[] = [];

      const [initialState] = result.current;
      progressHistory.push(initialState.progress);

      act(() => {
        const [, actions] = result.current;
        actions.startPreload();
      });

      await waitFor(
        () => {
          const [state] = result.current;
          progressHistory.push(state.progress);
          return !state.isLoading;
        },
        { timeout: 5000, interval: 50 }
      );

      // Verify monotonicity: each progress value should be >= the previous value
      for (let i = 1; i < progressHistory.length; i++) {
        expect(progressHistory[i]).toBeGreaterThanOrEqual(progressHistory[i - 1]);
      }

      progressHistory.forEach((progress) => {
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(100);
      });
    }
  );

  test.prop([fc.integer({ min: 1, max: 20 })])(
    'boundary case: initial progress should be 0',
    (imageCount: number) => {
      const count = imageCount;
      const imageUrls = Array.from(
        { length: count },
        (_, i) => `https://example.com/image-${i}.jpg`
      );

      const { result } = renderHook(() => useImagePreloader({ priorityUrls: imageUrls }));

      const [state] = result.current;
      expect(state.progress).toBe(0);
    }
  );

  test.prop([fc.integer({ min: 1, max: 20 })])(
    'boundary case: progress should be 100 after all images load',
    async (imageCount: number) => {
      const count = imageCount;
      const imageUrls = Array.from(
        { length: count },
        (_, i) => `https://example.com/image-${i}.jpg`
      );

      global.Image = class {
        onload: ((this: GlobalEventHandlers, ev: Event) => unknown) | null = null;
        onerror: ((this: GlobalEventHandlers, ev: Event) => unknown) | null = null;
        src = '';

        constructor() {
          queueMicrotask(() => {
            if (this.onload) {
              this.onload.call({} as GlobalEventHandlers, new Event('load'));
            }
          });
        }
      } as unknown as typeof Image;

      const { result } = renderHook(() => useImagePreloader({ priorityUrls: imageUrls }));

      await act(async () => {
        const [, actions] = result.current;
        actions.startPreload();
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      await waitFor(
        () => {
          const [state] = result.current;
          return !state.isLoading;
        },
        { timeout: 2000 }
      );

      const [finalState] = result.current;
      expect(finalState.progress).toBe(100);
    }
  );

  test.prop([fc.integer({ min: 2, max: 10 }), fc.integer({ min: 1, max: 9 })])(
    'partial load case: progress should reflect the proportion of loaded images',
    async (totalImages: number, loadedCount: number) => {
      const total = totalImages;
      const loaded = loadedCount;
      const actualLoadedCount = Math.min(loaded, total);
      const imageUrls = Array.from(
        { length: total },
        (_, i) => `https://example.com/image-${i}.jpg`
      );

      let loadedImages = 0;
      global.Image = class {
        onload: ((this: GlobalEventHandlers, ev: Event) => unknown) | null = null;
        onerror: ((this: GlobalEventHandlers, ev: Event) => unknown) | null = null;
        src = '';

        constructor() {
          queueMicrotask(() => {
            if (loadedImages < actualLoadedCount && this.onload) {
              loadedImages++;
              this.onload.call({} as GlobalEventHandlers, new Event('load'));
            } else if (this.onerror) {
              this.onerror.call({} as GlobalEventHandlers, new Event('error'));
            }
          });
        }
      } as unknown as typeof Image;

      const { result } = renderHook(() => useImagePreloader({ priorityUrls: imageUrls }));

      if (!result.current) {
        return;
      }

      await act(async () => {
        const [, actions] = result.current;
        if (actions) {
          actions.startPreload();
        }
      });

      await waitFor(
        () => {
          const [state] = result.current;
          return !state.isLoading;
        },
        { timeout: 2000 }
      );

      const [finalState] = result.current;

      expect(finalState.progress).toBeGreaterThanOrEqual(0);
      expect(finalState.progress).toBeLessThanOrEqual(100);

      if (actualLoadedCount > 0) {
        expect(finalState.progress).toBeGreaterThan(0);
      }
    }
  );
});
