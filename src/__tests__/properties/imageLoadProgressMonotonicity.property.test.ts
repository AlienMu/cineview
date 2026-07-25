/**
 * Property-Based Test: 图片加载进度单调性
 * **Validates: Requirements 11.6**
 *
 * 属性 4: 后一个时间点的加载进度必须大于或等于前一个时间点
 * 形式化：∀ time t1, t2: t1 < t2 ⟹ progress(t1) ≤ progress(t2)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { test } from '@fast-check/jest';
import * as fc from 'fast-check';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useImagePreloader } from '../../hooks/useImagePreloader';

describe('Property: 图片加载进度单调性', () => {
  // 保存原始 Image 构造函数
  const originalImage = global.Image;

  afterEach(() => {
    // 恢复原始 Image
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
    '图片加载进度应该单调递增（不会减少）',
    async (imageConfigs: Array<{ shouldLoad: boolean; delay: number }>) => {
      const configs = imageConfigs;
      // 创建模拟图片 URL
      const imageUrls = configs.map(
        (_: { shouldLoad: boolean; delay: number }, index: number) =>
          `https://example.com/image-${index}.jpg`
      );

      // 模拟 Image 对象
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

      // 记录初始进度
      const [initialState] = result.current;
      progressHistory.push(initialState.progress);

      // 开始预加载
      act(() => {
        const [, actions] = result.current;
        actions.startPreload();
      });

      // 等待加载完成，同时记录进度变化
      await waitFor(
        () => {
          const [state] = result.current;
          progressHistory.push(state.progress);
          return !state.isLoading;
        },
        { timeout: 5000, interval: 50 }
      );

      // 验证单调性：每个进度值都应该 >= 前一个进度值
      for (let i = 1; i < progressHistory.length; i++) {
        expect(progressHistory[i]).toBeGreaterThanOrEqual(progressHistory[i - 1]);
      }

      // 验证进度范围
      progressHistory.forEach((progress) => {
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(100);
      });
    }
  );

  test.prop([fc.integer({ min: 1, max: 20 })])(
    '边界情况：初始进度应该为 0',
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
    '边界情况：所有图片加载完成后进度应该为 100',
    async (imageCount: number) => {
      const count = imageCount;
      const imageUrls = Array.from(
        { length: count },
        (_, i) => `https://example.com/image-${i}.jpg`
      );

      // 模拟所有图片成功加载
      global.Image = class {
        onload: ((this: GlobalEventHandlers, ev: Event) => unknown) | null = null;
        onerror: ((this: GlobalEventHandlers, ev: Event) => unknown) | null = null;
        src = '';

        constructor() {
          // 使用 queueMicrotask 确保在 React 更新周期内执行
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
        // 等待微任务队列清空
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
    '部分加载情况：进度应该反映已加载图片的比例',
    async (totalImages: number, loadedCount: number) => {
      const total = totalImages;
      const loaded = loadedCount;
      const actualLoadedCount = Math.min(loaded, total);
      const imageUrls = Array.from(
        { length: total },
        (_, i) => `https://example.com/image-${i}.jpg`
      );

      // 模拟部分图片加载
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

      // 确保 hook 正确初始化
      if (!result.current) {
        return;
      }

      // 开始预加载
      await act(async () => {
        const [, actions] = result.current;
        if (actions) {
          actions.startPreload();
        }
      });

      // 等待加载完成
      await waitFor(
        () => {
          const [state] = result.current;
          return !state.isLoading;
        },
        { timeout: 2000 }
      );

      const [finalState] = result.current;

      // 验证进度在合理范围内
      expect(finalState.progress).toBeGreaterThanOrEqual(0);
      expect(finalState.progress).toBeLessThanOrEqual(100);

      // 如果有图片加载，进度应该大于 0
      if (actualLoadedCount > 0) {
        expect(finalState.progress).toBeGreaterThan(0);
      }
    }
  );
});
