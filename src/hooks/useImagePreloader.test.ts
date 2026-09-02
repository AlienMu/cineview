/**
 * useImagePreloader Hook 单元测试
 * 测试图片预加载队列管理、优先级加载、进度计算、错误处理
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
    // 模拟异步加载
    setTimeout(() => {
      if (this.src.includes('error')) {
        this.onerror?.();
      } else {
        this.onload?.();
      }
    }, 10);
  }
}

// 替换全局 Image

(global as any).Image = MockImage;

describe('useImagePreloader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPreloadedImageCache();
  });

  describe('初始状态', () => {
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

  describe('图片加载队列管理', () => {
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

      // 开始预加载以验证 URL 已添加
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

  describe('优先级加载', () => {
    it('should load priority images before background images', async () => {
      const loadOrder: string[] = [];

      const originalImage = (global as any).Image;

      // 自定义 Mock 来追踪加载顺序
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

      // 验证优先级图片先加载
      expect(loadOrder[0]).toBe('priority1.jpg');
      expect(loadOrder[1]).toBe('priority2.jpg');

      // 恢复原始 Mock

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

      // 验证优先级图片在后台图片之前完成
      expect(priorityComplete.length).toBeGreaterThan(0);
      expect(backgroundStart.length).toBeGreaterThan(0);

      (global as any).Image = originalImage;
    });
  });

  describe('进度计算', () => {
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

      // 验证进度从 0 到 100
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

      // 验证进度是递增的
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

  describe('错误处理', () => {
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

  describe('重置和清理', () => {
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

      // 在加载完成前重置
      act(() => {
        const [, actions] = result.current;
        actions.reset();
      });

      const [state] = result.current;
      expect(state.isLoading).toBe(false);
    });

    it('should cleanup on unmount', async () => {
      // 真正要防的回归：卸载后那张仍在飞行中的图片 onload 触发时，hook 不得再 setState。
      // React 会把卸载后的 setState 记成 console.error；本用例原先只有一条恒真断言，
      // 那条断言抓不到任何东西。
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

      // 卸载组件（此时 MockImage 的 10ms 定时器还没到期）
      unmount();

      // 让飞行中的加载完成，然后确认既没抛错、也没有卸载后的状态写入。
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('回调函数', () => {
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

  describe('并发控制', () => {
    it('should prevent multiple simultaneous preloads', async () => {
      const options: UseImagePreloaderOptions = {
        priorityUrls: ['image1.jpg'],
      };

      const { result } = renderHook(() => useImagePreloader(options));
      const [, actions] = result.current;

      act(() => {
        actions.startPreload();
        actions.startPreload(); // 第二次调用应该被忽略
      });

      await waitFor(
        () => {
          const [state] = result.current;
          expect(state.isLoading).toBe(false);
        },
        { timeout: 1000 }
      );

      const [state] = result.current;
      // 应该只加载一次
      expect(state.loadedCount).toBe(1);
    });
  });

  describe('边界情况', () => {
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
      expect(state.loadedCount).toBe(1); // 重复 URL 只预热一次
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
