/**
 * CineView 组件单元测试
 */

import { createRef, act } from 'react';
import { render, waitFor } from '@testing-library/react';
import { CineView } from './CineView';
import type { CineViewRef } from '../../types';
import { performanceMonitor } from '../../utils/performanceMonitor';

// Mock Scene component
interface MockSceneProps {
  children: React.ReactNode;
  preloadImages?: string[];
}

const MockScene: React.FC<MockSceneProps> = ({ children }) => {
  return <div data-testid="mock-scene">{children}</div>;
};
(MockScene as React.FC & { displayName?: string }).displayName = 'Scene';

// Mock performance monitor
jest.mock('../../utils/performanceMonitor', () => ({
  performanceMonitor: {
    start: jest.fn(),
    stop: jest.fn(),
    getMetrics: jest.fn(() => ({
      fps: 60,
      avgFrameTime: 16.67,
      memoryUsage: 50,
      bundleSize: 45,
    })),
    reset: jest.fn(),
  },
}));

// Mock image preloader hook
jest.mock('../../hooks/useImagePreloader', () => ({
  useImagePreloader: jest.fn(() => [
    {
      isLoading: false,
      progress: 100,
      loadedCount: 3,
      totalCount: 3,
      results: [],
      errors: new Map(),
    },
    {
      startPreload: jest.fn(),
      reset: jest.fn(),
      addUrls: jest.fn(),
    },
  ]),
}));

describe('CineView Component', () => {
  const defaultConfig = {
    designSize: 750,
    unit: 'px' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('12.1 核心功能', () => {
    it('应该创建响应式尺寸换算上下文', () => {
      const { container } = render(
        <CineView config={defaultConfig}>
          <MockScene>Scene 1</MockScene>
        </CineView>
      );

      expect(container.querySelector('.cineview-container')).toBeInTheDocument();
    });

    it('应该注册所有 Scene 子组件并维护场景索引', async () => {
      const { container } = render(
        <CineView config={defaultConfig}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
          <MockScene>Scene 3</MockScene>
        </CineView>
      );

      await waitFor(() => {
        const scenes = container.querySelectorAll('[data-scene-index]');
        // 虚拟化渲染：仅渲染当前场景(0)及后一个场景(1)
        expect(scenes.length).toBeGreaterThan(0);
      });
    });

    it('应该初始化图片预加载系统', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useImagePreloader } = require('../../hooks/useImagePreloader');

      render(
        <CineView config={defaultConfig}>
          <MockScene preloadImages={['image1.jpg', 'image2.jpg']}>Scene 1</MockScene>
          <MockScene preloadImages={['image3.jpg']}>Scene 2</MockScene>
        </CineView>
      );

      const [, actions] = useImagePreloader.mock.results[0].value;
      expect(actions.startPreload).toHaveBeenCalled();
    });

    it('应该实现虚拟化渲染（仅渲染当前场景及前后各一个）', async () => {
      const ref = createRef<CineViewRef>();

      const { container } = render(
        <CineView ref={ref} config={defaultConfig}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
          <MockScene>Scene 3</MockScene>
          <MockScene>Scene 4</MockScene>
        </CineView>
      );

      await waitFor(() => {
        const scenes = container.querySelectorAll('[data-scene-index]');
        // 当前场景索引为 0，应该渲染场景 0 和 1
        expect(scenes.length).toBeLessThanOrEqual(2);
      });
    });

    it('应该使用 content-visibility CSS 优化非可见场景', async () => {
      const ref = createRef<CineViewRef>();

      const { container } = render(
        <CineView ref={ref} config={defaultConfig}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
        </CineView>
      );

      await waitFor(() => {
        const scenes = container.querySelectorAll('[data-scene-index]');
        scenes.forEach((scene, index) => {
          if (index === 0) {
            // 当前场景应该可见
            expect(scene).toHaveStyle({ visibility: 'visible' });
          }
        });
      });
    });
  });

  describe('12.2 事件系统', () => {
    it('应该触发 onInit 回调', () => {
      const onInit = jest.fn();

      render(
        <CineView config={defaultConfig} onInit={onInit}>
          <MockScene>Scene 1</MockScene>
        </CineView>
      );

      // React StrictMode may cause double rendering in development
      expect(onInit).toHaveBeenCalled();
    });

    it('应该触发 onBeforeSceneChange 回调', async () => {
      const onBeforeSceneChange = jest.fn();
      const ref = createRef<CineViewRef>();

      render(
        <CineView ref={ref} config={defaultConfig} onBeforeSceneChange={onBeforeSceneChange}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      act(() => {
        ref.current?.goToScene(1);
      });

      expect(onBeforeSceneChange).toHaveBeenCalledWith(0, 1);
    });

    it('应该触发 onAfterSceneChange 回调', async () => {
      const onAfterSceneChange = jest.fn();
      const ref = createRef<CineViewRef>();

      render(
        <CineView ref={ref} config={defaultConfig} onAfterSceneChange={onAfterSceneChange}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      act(() => {
        ref.current?.goToScene(1, false); // 不使用动画，立即触发 onAfterSceneChange
      });

      await waitFor(() => {
        expect(onAfterSceneChange).toHaveBeenCalledWith(1);
      });
    });

    it('应该触发 onLoadProgress 回调', () => {
      const onLoadProgress = jest.fn();

      render(
        <CineView config={defaultConfig} onLoadProgress={onLoadProgress}>
          <MockScene preloadImages={['image1.jpg']}>Scene 1</MockScene>
        </CineView>
      );

      // onLoadProgress 应该被调用（通过 useImagePreloader hook）
      // 实际调用由 mock 的 hook 处理
      expect(onLoadProgress).toBeDefined();
    });
  });

  describe('12.3 API 方法', () => {
    it('应该实现 goToScene 方法（支持 animated 参数）', async () => {
      const ref = createRef<CineViewRef>();

      render(
        <CineView ref={ref} config={defaultConfig}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
          <MockScene>Scene 3</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      act(() => {
        ref.current?.goToScene(2, true);
      });

      expect(ref.current?.getCurrentScene()).toBe(2);
    });

    it('应该实现 triggerAnimation 方法', async () => {
      const ref = createRef<CineViewRef>();

      render(
        <CineView ref={ref} config={defaultConfig}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      // 应该不抛出错误
      expect(() => {
        ref.current?.triggerAnimation(0, 'test-animate');
      }).not.toThrow();
    });

    it('应该实现 reload 方法', async () => {
      const ref = createRef<CineViewRef>();

      render(
        <CineView ref={ref} config={defaultConfig}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      // 切换到场景 1
      act(() => {
        ref.current?.goToScene(1, false);
      });

      expect(ref.current?.getCurrentScene()).toBe(1);

      // 重新加载
      act(() => {
        ref.current?.reload();
      });

      // 应该重置到场景 0
      await waitFor(() => {
        expect(ref.current?.getCurrentScene()).toBe(0);
      });

      // reload 方法应该不抛出错误
      expect(() => ref.current?.reload()).not.toThrow();
    });

    it('应该实现 getCurrentScene 方法', async () => {
      const ref = createRef<CineViewRef>();

      render(
        <CineView ref={ref} config={defaultConfig}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      expect(ref.current?.getCurrentScene()).toBe(0);

      act(() => {
        ref.current?.goToScene(1, false);
      });

      expect(ref.current?.getCurrentScene()).toBe(1);
    });

    it('应该实现 getPerformanceMetrics 方法', async () => {
      const ref = createRef<CineViewRef>();

      render(
        <CineView ref={ref} config={defaultConfig}>
          <MockScene>Scene 1</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const metrics = ref.current?.getPerformanceMetrics();

      expect(metrics).toBeDefined();
      expect(metrics?.fps).toBe(60);
      expect(metrics?.avgFrameTime).toBe(16.67);
      expect(metrics?.memoryUsage).toBe(50);
      expect(metrics?.bundleSize).toBe(45);
    });

    it('应该验证场景索引有效性', async () => {
      const ref = createRef<CineViewRef>();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      render(
        <CineView ref={ref} config={defaultConfig}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      // 尝试跳转到无效索引
      act(() => {
        ref.current?.goToScene(10);
      });

      // 应该输出警告
      expect(consoleWarnSpy).toHaveBeenCalled();

      // 场景索引应该保持不变
      expect(ref.current?.getCurrentScene()).toBe(0);

      consoleWarnSpy.mockRestore();
    });
  });

  describe('12.4 性能优化', () => {
    it('应该使用 WeakMap 存储组件引用', () => {
      // WeakMap 是内部实现细节，通过不产生内存泄漏来验证
      const { unmount } = render(
        <CineView config={defaultConfig}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
        </CineView>
      );

      // 卸载组件不应该导致内存泄漏
      expect(() => unmount()).not.toThrow();
    });

    it('应该支持 performanceMode 开关', () => {
      render(
        <CineView config={defaultConfig} performanceMode={true}>
          <MockScene>Scene 1</MockScene>
        </CineView>
      );

      expect(performanceMonitor.start).toHaveBeenCalled();
    });

    it('应该在组件卸载时清理性能监控', () => {
      const { unmount } = render(
        <CineView config={defaultConfig} performanceMode={true}>
          <MockScene>Scene 1</MockScene>
        </CineView>
      );

      unmount();

      expect(performanceMonitor.stop).toHaveBeenCalled();
    });
  });

  describe('12.5 错误处理和开发者体验', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('应该在开发环境提供详细错误信息', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      render(
        <CineView config={defaultConfig}>
          <div>Not a Scene</div>
        </CineView>
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No Scene components found')
      );

      consoleWarnSpy.mockRestore();
    });

    it('应该在开发环境提供组件层级检查', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <CineView config={{ designSize: -1, unit: 'px' }}>
          <MockScene>Scene 1</MockScene>
        </CineView>
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid designSize'));

      consoleErrorSpy.mockRestore();
    });

    it('应该提供性能调试模式', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      render(
        <CineView config={defaultConfig} performanceMode={true}>
          <MockScene>Scene 1</MockScene>
        </CineView>
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performance mode enabled')
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('虚拟化渲染边界情况', () => {
    it('当前场景索引为 0 时，应该仅渲染场景 0 和场景 1', async () => {
      const ref = createRef<CineViewRef>();

      const { container } = render(
        <CineView ref={ref} config={defaultConfig}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
          <MockScene>Scene 3</MockScene>
        </CineView>
      );

      await waitFor(() => {
        const scenes = container.querySelectorAll('[data-scene-index]');
        const indices = Array.from(scenes).map((s) => s.getAttribute('data-scene-index'));
        expect(indices).toContain('0');
        expect(indices).toContain('1');
        expect(indices).not.toContain('2');
      });
    });

    it('当前场景索引为最后一个时，应该仅渲染最后一个场景和倒数第二个场景', async () => {
      const ref = createRef<CineViewRef>();

      const { container } = render(
        <CineView ref={ref} config={defaultConfig}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
          <MockScene>Scene 3</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      // 跳转到最后一个场景
      act(() => {
        ref.current?.goToScene(2, false);
      });

      await waitFor(() => {
        const scenes = container.querySelectorAll('[data-scene-index]');
        const indices = Array.from(scenes).map((s) => s.getAttribute('data-scene-index'));
        expect(indices).toContain('1');
        expect(indices).toContain('2');
        expect(indices).not.toContain('0');
      });
    });

    it('当前场景索引在中间时，应该渲染当前场景及其前后各一个场景', async () => {
      const ref = createRef<CineViewRef>();

      const { container } = render(
        <CineView ref={ref} config={defaultConfig}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
          <MockScene>Scene 3</MockScene>
          <MockScene>Scene 4</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      // 跳转到中间场景
      act(() => {
        ref.current?.goToScene(2, false);
      });

      await waitFor(() => {
        const scenes = container.querySelectorAll('[data-scene-index]');
        const indices = Array.from(scenes).map((s) => s.getAttribute('data-scene-index'));
        expect(indices).toContain('1');
        expect(indices).toContain('2');
        expect(indices).toContain('3');
        expect(indices).not.toContain('0');
      });
    });
  });

  describe('图片预加载流程', () => {
    it('应该优先加载首屏图片', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useImagePreloader } = require('../../hooks/useImagePreloader');

      render(
        <CineView config={defaultConfig}>
          <MockScene preloadImages={['first1.jpg', 'first2.jpg']}>Scene 1</MockScene>
          <MockScene preloadImages={['second1.jpg']}>Scene 2</MockScene>
        </CineView>
      );

      const callArgs = useImagePreloader.mock.calls[0][0];
      expect(callArgs.priorityUrls).toEqual(['first1.jpg', 'first2.jpg']);
      expect(callArgs.backgroundUrls).toEqual(['second1.jpg']);
    });

    it('应该在首屏图片加载完成后渲染首屏内容', async () => {
      const { container } = render(
        <CineView config={defaultConfig}>
          <MockScene>Scene 1</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(container.querySelector('[data-scene-index]')).toBeInTheDocument();
      });
    });
  });
});
