/**
 * useImagePreloader Hook Unit Tests
 * Tests image preload queue management, priority loading, progress calculation, and error handling
 */

import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { useImagePreloader, UseImagePreloaderOptions } from './useImagePreloader';
import { isImagePreloaded, resetPreloadedImageCache } from './imagePreloadCache';

// Mock Image constructor
class MockImage {
  src: string = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    // Simulate async loading
    setTimeout(() => {
      if (this.src.includes('error')) {
        this.onerror?.();
      } else {
        this.onload?.();
      }
    }, 10);
  }
}

// Replace global Image
(global as any).Image = MockImage;

describe('useImagePreloader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPreloadedImageCache();
  });

  describe('Initial state', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useImagePreloader());
      const [state] = result.current;

      expect(state.isLoading).toBe(false);
      expect(state.progress).toBe(0);
      expect(state.loadedCount).toBe(0);
      expect(state.totalCount).toBe(0);
      expect(state.results).toEqual([]);
      expect(state.errors.size).toBe(0);
    });

    it('should initialize with priority and background URLs', () => {
      const options: UseImagePreloaderOptions = {
        priorityUrls: ['image1.jpg', 'image2.jpg'],
        backgroundUrls: ['image3.jpg', 'image4.jpg'],
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [state] = result.current;

      expect(state.totalCount).toBe(4);
    });
  });

  describe('Image loading queue management', () => {
    it('should load all images in queue', async () => {
      const options: UseImagePreloaderOptions = {
        priorityUrls: ['image1.jpg', 'image2.jpg'],
        backgroundUrls: ['image3.jpg'],
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [, actions] = result.current;

      act(() => {
        actions.startPreload();
      });

      await waitFor(
        () => {
          const [state] = result.current;
          expect(state.isLoading).toBe(false);
        },
        { timeout: 1000 }
      );

      const [state] = result.current;
      expect(state.loadedCount).toBe(3);
      expect(state.results).toHaveLength(3);
      expect(state.progress).toBe(100);
      expect(isImagePreloaded('image1.jpg')).toBe(true);
    });

    it('should handle empty queue', async () => {
      const onComplete = jest.fn();
      const onProgress = jest.fn();
      const options: UseImagePreloaderOptions = {
        priorityUrls: [],
        backgroundUrls: [],
        onProgress,
        onComplete,
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [, actions] = result.current;

      act(() => {
        actions.startPreload();
      });

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith([]);
      });

      const [state] = result.current;
      expect(state.isLoading).toBe(false);
      expect(state.progress).toBe(100);
      expect(onProgress).toHaveBeenCalledWith(100);
    });

    it('should add URLs dynamically', async () => {
      const { result } = renderHook(() => useImagePreloader());

      act(() => {
        const [, actions] = result.current;
        actions.addUrls(['image1.jpg', 'image2.jpg'], true);
        actions.addUrls(['image3.jpg'], false);
      });

      // Start preload to verify URLs were added
      act(() => {
        const [, actions] = result.current;
        actions.startPreload();
      });

      await waitFor(
        () => {
          const [state] = result.current;
          expect(state.loadedCount).toBe(3);
        },
        { timeout: 1000 }
      );

      const [state] = result.current;
      expect(state.totalCount).toBe(3);
    });
  });

  describe('Priority loading', () => {
    it('should load priority images before background images', async () => {
      const loadOrder: string[] = [];

      const originalImage = (global as any).Image;

      // Custom Mock to track load order
      class TrackingMockImage {
        src: string = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        constructor() {
          setTimeout(() => {
            loadOrder.push(this.src);
            this.onload?.();
          }, 10);
        }
      }

      (global as any).Image = TrackingMockImage;

      const options: UseImagePreloaderOptions = {
        priorityUrls: ['priority1.jpg', 'priority2.jpg'],
        backgroundUrls: ['background1.jpg', 'background2.jpg'],
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [, actions] = result.current;

      act(() => {
        actions.startPreload();
      });

      await waitFor(
        () => {
          const [state] = result.current;
          expect(state.loadedCount).toBe(4);
        },
        { timeout: 1000 }
      );

      // Verify priority images load first
      expect(loadOrder[0]).toBe('priority1.jpg');
      expect(loadOrder[1]).toBe('priority2.jpg');

      // Restore original Mock
      (global as any).Image = originalImage;
    });

    it('should complete priority images before starting background images', async () => {
      const priorityComplete: number[] = [];
      const backgroundStart: number[] = [];

      const originalImage = (global as any).Image;

      class TimingMockImage {
        src: string = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        constructor() {
          setTimeout(() => {
            if (this.src.includes('priority')) {
              priorityComplete.push(Date.now());
            } else if (this.src.includes('background')) {
              backgroundStart.push(Date.now());
            }
            this.onload?.();
          }, 10);
        }
      }

      (global as any).Image = TimingMockImage;

      const options: UseImagePreloaderOptions = {
        priorityUrls: ['priority1.jpg'],
        backgroundUrls: ['background1.jpg'],
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [, actions] = result.current;

      act(() => {
        actions.startPreload();
      });

      await waitFor(
        () => {
          const [state] = result.current;
          expect(state.loadedCount).toBe(2);
        },
        { timeout: 1000 }
      );

      // Verify priority images complete before background images
      expect(priorityComplete.length).toBeGreaterThan(0);
      expect(backgroundStart.length).toBeGreaterThan(0);

      (global as any).Image = originalImage;
    });
  });

  describe('Progress calculation', () => {
    it('should calculate progress correctly', async () => {
      const progressUpdates: number[] = [];
      const options: UseImagePreloaderOptions = {
        priorityUrls: ['image1.jpg', 'image2.jpg'],
        backgroundUrls: ['image3.jpg', 'image4.jpg'],
        onProgress: (progress) => {
          progressUpdates.push(progress);
        },
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [, actions] = result.current;

      act(() => {
        actions.startPreload();
      });

      await waitFor(
        () => {
          const [state] = result.current;
          expect(state.progress).toBe(100);
        },
        { timeout: 1000 }
      );

      // Verify progress goes from 0 to 100
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });

    it('should update loadedCount correctly', async () => {
      const options: UseImagePreloaderOptions = {
        priorityUrls: ['image1.jpg'],
        backgroundUrls: ['image2.jpg', 'image3.jpg'],
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [, actions] = result.current;

      act(() => {
        actions.startPreload();
      });

      await waitFor(
        () => {
          const [state] = result.current;
          expect(state.loadedCount).toBe(3);
        },
        { timeout: 1000 }
      );

      const [state] = result.current;
      expect(state.loadedCount).toBe(state.totalCount);
    });

    it('should calculate progress as 0 for empty queue', () => {
      const { result } = renderHook(() => useImagePreloader());
      const [state] = result.current;

      expect(state.progress).toBe(0);
      expect(state.totalCount).toBe(0);
    });

    it('should update progress incrementally', async () => {
      const progressUpdates: number[] = [];
      const options: UseImagePreloaderOptions = {
        priorityUrls: ['image1.jpg', 'image2.jpg', 'image3.jpg', 'image4.jpg'],
        onProgress: (progress) => {
          progressUpdates.push(progress);
        },
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [, actions] = result.current;

      act(() => {
        actions.startPreload();
      });

      await waitFor(
        () => {
          const [state] = result.current;
          expect(state.progress).toBe(100);
        },
        { timeout: 1000 }
      );

      // Verify progress is monotonically increasing
      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i]).toBeGreaterThanOrEqual(progressUpdates[i - 1]);
      }
    });

    it('should continue the active preload run when URLs are added mid-flight', async () => {
      const progressUpdates: number[] = [];

      const originalImage = (global as any).Image;

      class DelayedMockImage {
        private currentSrc: string = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        get src(): string {
          return this.currentSrc;
        }

        set src(value: string) {
          this.currentSrc = value;
          const delay = value.includes('priority') ? 25 : 5;
          setTimeout(() => {
            this.onload?.();
          }, delay);
        }
      }

      (global as any).Image = DelayedMockImage;

      const options: UseImagePreloaderOptions = {
        priorityUrls: ['priority-image.jpg'],
        backgroundUrls: ['background-image.jpg'],
        onProgress: (progress) => {
          progressUpdates.push(progress);
        },
      };

      const { result } = renderHook(() => useImagePreloader(options));

      act(() => {
        const [, actions] = result.current;
        actions.startPreload();
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        const [, actions] = result.current;
        actions.addUrls(['late-background-image.jpg'], false);
      });

      await waitFor(
        () => {
          const [state] = result.current;
          expect(state.isLoading).toBe(false);
        },
        { timeout: 1000 }
      );

      const [state] = result.current;
      expect(Math.max(...progressUpdates)).toBeLessThanOrEqual(100);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
      expect(state.progress).toBe(100);
      expect(state.loadedCount).toBe(3);
      expect(state.results).toHaveLength(3);
      expect(state.results.map((item) => item.url)).toEqual([
        'priority-image.jpg',
        'background-image.jpg',
        'late-background-image.jpg',
      ]);

      (global as any).Image = originalImage;
    });

    it('should ignore stale progress updates after reset starts a new preload run', async () => {
      const progressUpdates: number[] = [];

      const originalImage = (global as any).Image;

      class SlowMockImage {
        private currentSrc: string = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        get src(): string {
          return this.currentSrc;
        }

        set src(value: string) {
          this.currentSrc = value;
          setTimeout(() => {
            this.onload?.();
          }, 20);
        }
      }

      (global as any).Image = SlowMockImage;

      const options: UseImagePreloaderOptions = {
        priorityUrls: ['image1.jpg'],
        backgroundUrls: ['image2.jpg'],
        onProgress: (progress) => {
          progressUpdates.push(progress);
        },
      };

      const { result } = renderHook(() => useImagePreloader(options));

      act(() => {
        const [, actions] = result.current;
        actions.startPreload();
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        const [, actions] = result.current;
        actions.reset();
        actions.startPreload();
      });

      await waitFor(
        () => {
          const [state] = result.current;
          expect(state.isLoading).toBe(false);
        },
        { timeout: 1000 }
      );

      const [state] = result.current;
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
      expect(Math.max(...progressUpdates)).toBeLessThanOrEqual(100);
      expect(state.progress).toBe(100);
      expect(state.loadedCount).toBe(2);

      (global as any).Image = originalImage;
    });
  });

  describe('Error handling', () => {
    it('should handle image load errors', async () => {
      const onError = jest.fn();
      const options: UseImagePreloaderOptions = {
        priorityUrls: ['error-image.jpg'],
        onError,
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [, actions] = result.current;

      act(() => {
        actions.startPreload();
      });

      await waitFor(
        () => {
          const [state] = result.current;
          expect(state.isLoading).toBe(false);
        },
        { timeout: 1000 }
      );

      expect(onError).toHaveBeenCalled();
      const [state] = result.current;
      expect(state.errors.size).toBeGreaterThan(0);
      expect(state.errors.has('error-image.jpg')).toBe(true);
    });

    it('should continue loading after error', async () => {
      const options: UseImagePreloaderOptions = {
        priorityUrls: ['error-image.jpg', 'good-image.jpg'],
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [, actions] = result.current;

      act(() => {
        actions.startPreload();
      });

      await waitFor(
        () => {
          const [state] = result.current;
          expect(state.loadedCount).toBe(2);
        },
        { timeout: 1000 }
      );

      const [state] = result.current;
      expect(state.results).toHaveLength(2);
      expect(state.results[0].success).toBe(false);
      expect(state.results[1].success).toBe(true);
    });

    it('should record all failed images', async () => {
      const options: UseImagePreloaderOptions = {
        priorityUrls: ['error1.jpg', 'error2.jpg'],
        backgroundUrls: ['error3.jpg'],
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [, actions] = result.current;

      act(() => {
        actions.startPreload();
      });

      await waitFor(
        () => {
          const [state] = result.current;
          expect(state.isLoading).toBe(false);
        },
        { timeout: 1000 }
      );

      const [state] = result.current;
      expect(state.errors.size).toBe(3);
      expect(state.errors.has('error1.jpg')).toBe(true);
      expect(state.errors.has('error2.jpg')).toBe(true);
      expect(state.errors.has('error3.jpg')).toBe(true);
    });

    it('should call onError for each failed image', async () => {
      const onError = jest.fn();
      const options: UseImagePreloaderOptions = {
        priorityUrls: ['error1.jpg'],
        backgroundUrls: ['error2.jpg'],
        onError,
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [, actions] = result.current;

      act(() => {
        actions.startPreload();
      });

      await waitFor(
        () => {
          const [state] = result.current;
          expect(state.isLoading).toBe(false);
        },
        { timeout: 1000 }
      );

      expect(onError).toHaveBeenCalledTimes(2);
    });
  });

  describe('WebP fallback', () => {
    it('should handle WebP format URLs', async () => {
      const options: UseImagePreloaderOptions = {
        priorityUrls: ['image.webp'],
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [, actions] = result.current;

      act(() => {
        actions.startPreload();
      });

      await waitFor(
        () => {
          const [state] = result.current;
          expect(state.isLoading).toBe(false);
        },
        { timeout: 1000 }
      );

      const [state] = result.current;
      expect(state.results[0].url).toBe('image.webp');
      expect(state.results[0].success).toBe(true);
    });

    it('should handle mixed format URLs', async () => {
      const options: UseImagePreloaderOptions = {
        priorityUrls: ['image.webp', 'image.jpg', 'image.png'],
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [, actions] = result.current;

      act(() => {
        actions.startPreload();
      });

      await waitFor(
        () => {
          const [state] = result.current;
          expect(state.loadedCount).toBe(3);
        },
        { timeout: 1000 }
      );

      const [state] = result.current;
      expect(state.results).toHaveLength(3);
      state.results.forEach((result) => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Reset and cleanup', () => {
    it('should reset state', async () => {
      const options: UseImagePreloaderOptions = {
        priorityUrls: ['image1.jpg'],
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [, actions] = result.current;

      act(() => {
        actions.startPreload();
      });

      await waitFor(
        () => {
          const [state] = result.current;
          expect(state.loadedCount).toBe(1);
        },
        { timeout: 1000 }
      );

      act(() => {
        const [, actions] = result.current;
        actions.reset();
      });

      const [state] = result.current;
      expect(state.isLoading).toBe(false);
      expect(state.progress).toBe(0);
      expect(state.loadedCount).toBe(0);
      expect(state.results).toEqual([]);
      expect(state.errors.size).toBe(0);
    });

    it('should abort ongoing loads on reset', async () => {
      const options: UseImagePreloaderOptions = {
        priorityUrls: ['image1.jpg', 'image2.jpg', 'image3.jpg'],
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [, actions] = result.current;

      act(() => {
        actions.startPreload();
      });

      // Reset before loading completes
      act(() => {
        const [, actions] = result.current;
        actions.reset();
      });

      const [state] = result.current;
      expect(state.isLoading).toBe(false);
    });

    it('should cleanup on unmount', async () => {
      // The real regression to prevent: after unmount, when the in-flight image's onload fires,
      // the hook must not call setState. React logs unmount-after setState as console.error;
      // the original test only had a truthy assertion that caught nothing.
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const onProgress = jest.fn();
      const options: UseImagePreloaderOptions = {
        priorityUrls: ['image1.jpg'],
        onProgress,
      };

      const { result, unmount } = renderHook(() => useImagePreloader(options));

      act(() => {
        const [, actions] = result.current;
        actions.startPreload();
      });
      expect(result.current[0].isLoading).toBe(true);

      // Unmount component (MockImage's 10ms timer has not expired yet)
      unmount();

      // Let the in-flight load complete, then confirm no error thrown and no post-unmount state write.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Callback functions', () => {
    it('should call onProgress callback', async () => {
      const onProgress = jest.fn();
      const options: UseImagePreloaderOptions = {
        priorityUrls: ['image1.jpg', 'image2.jpg'],
        onProgress,
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [, actions] = result.current;

      act(() => {
        actions.startPreload();
      });

      await waitFor(
        () => {
          const [state] = result.current;
          expect(state.progress).toBe(100);
        },
        { timeout: 1000 }
      );

      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(100);
    });

    it('should call onComplete callback', async () => {
      const onComplete = jest.fn();
      const options: UseImagePreloaderOptions = {
        priorityUrls: ['image1.jpg'],
        onComplete,
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [, actions] = result.current;

      act(() => {
        actions.startPreload();
      });

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });

      expect(onComplete).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            url: 'image1.jpg',
            success: true,
          }),
        ])
      );
    });

    it('should call onError callback for failed images', async () => {
      const onError = jest.fn();
      const options: UseImagePreloaderOptions = {
        priorityUrls: ['error-image.jpg'],
        onError,
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [, actions] = result.current;

      act(() => {
        actions.startPreload();
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      expect(onError).toHaveBeenCalledWith('error-image.jpg', expect.any(Error));
    });
  });

  describe('Concurrency control', () => {
    it('should prevent multiple simultaneous preloads', async () => {
      const options: UseImagePreloaderOptions = {
        priorityUrls: ['image1.jpg'],
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [, actions] = result.current;

      act(() => {
        actions.startPreload();
        actions.startPreload(); // Second call should be ignored
      });

      await waitFor(
        () => {
          const [state] = result.current;
          expect(state.isLoading).toBe(false);
        },
        { timeout: 1000 }
      );

      const [state] = result.current;
      // Should only load once
      expect(state.loadedCount).toBe(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle very large queue', async () => {
      const largeQueue = Array.from({ length: 100 }, (_, i) => `image${i}.jpg`);
      const options: UseImagePreloaderOptions = {
        priorityUrls: largeQueue.slice(0, 50),
        backgroundUrls: largeQueue.slice(50),
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [, actions] = result.current;

      act(() => {
        actions.startPreload();
      });

      await waitFor(
        () => {
          const [state] = result.current;
          expect(state.progress).toBe(100);
        },
        { timeout: 5000 }
      );

      const [state] = result.current;
      expect(state.loadedCount).toBe(100);
    });

    it('should handle duplicate URLs', async () => {
      const options: UseImagePreloaderOptions = {
        priorityUrls: ['image1.jpg', 'image1.jpg'],
        backgroundUrls: ['image1.jpg'],
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [, actions] = result.current;

      act(() => {
        actions.startPreload();
      });

      await waitFor(
        () => {
          const [state] = result.current;
          expect(state.isLoading).toBe(false);
        },
        { timeout: 1000 }
      );

      const [state] = result.current;
      expect(state.loadedCount).toBe(1); // Duplicate URLs only preloaded once
    });

    it('should handle special characters in URLs', async () => {
      const options: UseImagePreloaderOptions = {
        priorityUrls: ['image with spaces.jpg', 'image%20encoded.jpg'],
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [, actions] = result.current;

      act(() => {
        actions.startPreload();
      });

      await waitFor(
        () => {
          const [state] = result.current;
          expect(state.loadedCount).toBe(2);
        },
        { timeout: 1000 }
      );

      const [state] = result.current;
      expect(state.results).toHaveLength(2);
    });
  });
});
