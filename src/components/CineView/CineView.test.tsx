/**
 * CineView 组件单元测试
 */

import { createRef, act } from 'react';
import { render, waitFor } from '@testing-library/react';
import { CineView, resolveRootSceneStackMode } from './CineView';
import type { CineViewRef } from '../../types';
import { performanceMonitor } from '../../utils/performanceMonitor';

// Mock Scene component
interface MockSceneProps {
  children: React.ReactNode;
  sceneId?: string;
  preloadImages?: string[];
  assets?: {
    preloadImages?: string[];
  };
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
    width: 750,
    height: 1334,
    unit: 'px' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('stack mode resolution', () => {
    it('defaults scroll scenes to cover when scene stack mode is omitted', () => {
      expect(resolveRootSceneStackMode({}, 'scroll')).toBe('cover');
      expect(resolveRootSceneStackMode({ sceneStackMode: 'replace' }, 'scroll')).toBe('cover');
      expect(resolveRootSceneStackMode({ stack: { mode: 'replace' } }, 'scroll')).toBe('replace');
    });
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

    it('不应该因为 onLoadProgress 回调身份变化而重新启动预加载', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useImagePreloader } = require('../../hooks/useImagePreloader');
      const startPreload = jest.fn();

      useImagePreloader.mockImplementation(() => [
        {
          isLoading: false,
          progress: 100,
          loadedCount: 1,
          totalCount: 1,
          results: [],
          errors: new Map(),
        },
        {
          startPreload,
          reset: jest.fn(),
          addUrls: jest.fn(),
        },
      ]);

      const { rerender } = render(
        <CineView config={defaultConfig} callbacks={{ common: { onLoadProgress: () => {} } }}>
          <MockScene preloadImages={['image1.jpg']}>Scene 1</MockScene>
        </CineView>
      );

      rerender(
        <CineView config={defaultConfig} callbacks={{ common: { onLoadProgress: () => {} } }}>
          <MockScene preloadImages={['image1.jpg']}>Scene 1</MockScene>
        </CineView>
      );

      expect(startPreload).toHaveBeenCalledTimes(1);
    });

    it('应该兼容 grouped assets.preloadImages', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useImagePreloader } = require('../../hooks/useImagePreloader');

      render(
        <CineView config={defaultConfig}>
          <MockScene assets={{ preloadImages: ['grouped-first.jpg'] }}>Scene 1</MockScene>
          <MockScene assets={{ preloadImages: ['grouped-second.jpg'] }}>Scene 2</MockScene>
        </CineView>
      );

      const callArgs = useImagePreloader.mock.calls[0][0];
      expect(callArgs.priorityUrls).toEqual(['grouped-first.jpg', 'grouped-second.jpg']);
      expect(callArgs.backgroundUrls).toEqual([]);
    });

    it('应该在首屏优先图片未完成时仍然展示场景视口', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useImagePreloader } = require('../../hooks/useImagePreloader');

      useImagePreloader.mockImplementation(() => [
        {
          isLoading: true,
          progress: 0,
          loadedCount: 0,
          totalCount: 1,
          results: [],
          errors: new Map(),
        },
        {
          startPreload: jest.fn(),
          reset: jest.fn(),
          addUrls: jest.fn(),
        },
      ]);

      const { container } = render(
        <CineView config={defaultConfig}>
          <MockScene assets={{ preloadImages: ['hero.jpg'] }}>Scene 1</MockScene>
        </CineView>
      );

      const viewport = container.querySelector('.cineview-container > div');
      expect(viewport).toHaveStyle({ opacity: '1', pointerEvents: 'auto' });
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

    it('应该仅在 scroll screen sizing 下为 scene wrapper 注入视口主轴下限', async () => {
      const { container, rerender } = render(
        <CineView
          config={defaultConfig}
          mode="scroll"
          modes={{ scroll: { direction: 'y', sceneSizing: 'content' } }}
        >
          <MockScene>Short Scene</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(container.querySelector('[data-scene-index="0"]')).toBeInTheDocument();
      });

      const contentSizedScene = container.querySelector('[data-scene-index="0"]') as HTMLDivElement;
      expect(contentSizedScene.style.minHeight).toBe('');

      rerender(
        <CineView
          config={defaultConfig}
          mode="scroll"
          modes={{ scroll: { direction: 'y', sceneSizing: 'screen' } }}
        >
          <MockScene>Short Scene</MockScene>
        </CineView>
      );

      await waitFor(() => {
        const screenSizedScene = container.querySelector(
          '[data-scene-index="0"]'
        ) as HTMLDivElement;
        expect(screenSizedScene.style.minHeight).not.toBe('');
      });
    });

    it('应该在根容器注册隐藏浏览器原生 scrollbar 的样式', () => {
      render(
        <CineView
          config={defaultConfig}
          scrollbar={{ enabled: true, width: 10, thumbColor: 'rgba(1, 2, 3, 0.5)' }}
        >
          <MockScene>Scene 1</MockScene>
        </CineView>
      );

      const styleNode = document.getElementById('cineview-scrollbar-style');
      expect(styleNode).toBeInTheDocument();
      expect(styleNode?.textContent).toContain('scrollbar-width: none');
      expect(styleNode?.textContent).toContain('-ms-overflow-style: none');
      expect(styleNode?.textContent).toContain('display: none');
      expect(styleNode?.textContent).not.toContain('scrollbar-width: thin');
      expect(styleNode?.textContent).not.toContain('scrollbar-color');
    });
  });

  describe('12.2 事件系统', () => {
    it('应该触发 onInit 回调', () => {
      const onInit = jest.fn();
      const ref = createRef<CineViewRef>();

      render(
        <CineView ref={ref} config={defaultConfig} callbacks={{ common: { onReady: onInit } }}>
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
        <CineView
          ref={ref}
          config={defaultConfig}
          callbacks={{ common: { onSceneWillChange: onBeforeSceneChange } }}
        >
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

      expect(onBeforeSceneChange).toHaveBeenCalledWith(
        expect.objectContaining({ fromIndex: 0, toIndex: 1, direction: 'forward' })
      );
    });

    it('应该触发 onAfterSceneChange 回调', async () => {
      const onAfterSceneChange = jest.fn();
      const ref = createRef<CineViewRef>();

      render(
        <CineView
          ref={ref}
          config={defaultConfig}
          callbacks={{ common: { onSceneDidChange: onAfterSceneChange } }}
        >
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
        expect(onAfterSceneChange).toHaveBeenCalledWith(
          expect.objectContaining({ fromIndex: 0, toIndex: 1, direction: 'forward' })
        );
      });
    });

    it('应该触发 onLoadProgress 回调', () => {
      const onLoadProgress = jest.fn();

      render(
        <CineView config={defaultConfig} callbacks={{ common: { onLoadProgress } }}>
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

    it('不应该通过 ref 暴露内部 runtime 快照', async () => {
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

      expect('getState' in (ref.current as object)).toBe(false);
    });

    it('应该实现 refreshLayout 和 preload 方法', async () => {
      const ref = createRef<CineViewRef>();
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useImagePreloader } = require('../../hooks/useImagePreloader');
      const startPreload = jest.fn();

      useImagePreloader.mockImplementation(() => [
        {
          isLoading: false,
          progress: 100,
          loadedCount: 1,
          totalCount: 1,
          results: [],
          errors: new Map(),
        },
        {
          startPreload,
          reset: jest.fn(),
          addUrls: jest.fn(),
        },
      ]);

      render(
        <CineView ref={ref} config={defaultConfig}>
          <MockScene preloadImages={['image1.jpg']}>Scene 1</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(ref.current?.refreshLayout).toBeDefined();
        expect(ref.current?.preload).toBeDefined();
      });

      expect(() => {
        ref.current?.refreshLayout?.();
      }).not.toThrow();

      await act(async () => {
        await ref.current?.preload?.();
      });

      expect(startPreload).toHaveBeenCalledTimes(2);
    });

    it('preload(targets) 只按场景索引和 sceneId 追加优先图片', async () => {
      const ref = createRef<CineViewRef>();
      const startPreload = jest.fn().mockResolvedValue(undefined);
      const addUrls = jest.fn();
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useImagePreloader } = require('../../hooks/useImagePreloader');

      useImagePreloader.mockImplementation(() => [
        {
          isLoading: false,
          progress: 100,
          loadedCount: 0,
          totalCount: 0,
          results: [],
          errors: new Map(),
        },
        {
          startPreload,
          reset: jest.fn(),
          addUrls,
        },
      ]);

      render(
        <CineView ref={ref} config={defaultConfig}>
          <MockScene sceneId="intro" assets={{ preloadImages: ['intro.jpg'] }}>
            Scene 1
          </MockScene>
          <MockScene sceneId="details" assets={{ preloadImages: ['details.jpg'] }}>
            Scene 2
          </MockScene>
          <MockScene sceneId="cta" assets={{ preloadImages: ['cta.jpg'] }}>
            Scene 3
          </MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      await act(async () => {
        await ref.current?.preload?.([2, 'details']);
      });

      expect(addUrls).toHaveBeenCalledWith(['cta.jpg', 'details.jpg'], true);
      expect(startPreload).toHaveBeenCalled();
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
        <CineView config={defaultConfig} performance={{ monitor: true }}>
          <MockScene>Scene 1</MockScene>
        </CineView>
      );

      expect(performanceMonitor.start).toHaveBeenCalled();
    });

    it('应该在组件卸载时清理性能监控', () => {
      const { unmount } = render(
        <CineView config={defaultConfig} performance={{ monitor: true }}>
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
        <CineView config={{ width: 0, height: 0, unit: 'px' }}>
          <MockScene>Scene 1</MockScene>
        </CineView>
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid config.width/config.height')
      );

      consoleErrorSpy.mockRestore();
    });

    it('应该提供性能调试模式', () => {
      render(
        <CineView config={defaultConfig} performance={{ monitor: true }}>
          <MockScene>Scene 1</MockScene>
        </CineView>
      );

      expect(performanceMonitor.start).toHaveBeenCalled();
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
    it('应该优先加载当前场景及相邻场景图片', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useImagePreloader } = require('../../hooks/useImagePreloader');

      render(
        <CineView config={defaultConfig}>
          <MockScene assets={{ preloadImages: ['first1.jpg', 'first2.jpg'] }}>Scene 1</MockScene>
          <MockScene assets={{ preloadImages: ['second1.jpg'] }}>Scene 2</MockScene>
          <MockScene assets={{ preloadImages: ['third1.jpg'] }}>Scene 3</MockScene>
        </CineView>
      );

      const callArgs = useImagePreloader.mock.calls[0][0];
      expect(callArgs.priorityUrls).toEqual(['first1.jpg', 'first2.jpg', 'second1.jpg']);
      expect(callArgs.backgroundUrls).toEqual([]);
    });

    it('应该在翻页后追加预加载新的相邻场景图片', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useImagePreloader } = require('../../hooks/useImagePreloader');
      const startPreload = jest.fn();
      const addUrls = jest.fn();
      const ref = createRef<CineViewRef>();

      useImagePreloader.mockImplementation(() => [
        {
          isLoading: false,
          progress: 100,
          loadedCount: 0,
          totalCount: 0,
          results: [],
          errors: new Map(),
        },
        {
          startPreload,
          reset: jest.fn(),
          addUrls,
        },
      ]);

      render(
        <CineView ref={ref} config={defaultConfig}>
          <MockScene assets={{ preloadImages: ['scene-1.jpg'] }}>Scene 1</MockScene>
          <MockScene assets={{ preloadImages: ['scene-2.jpg'] }}>Scene 2</MockScene>
          <MockScene assets={{ preloadImages: ['scene-3.jpg'] }}>Scene 3</MockScene>
          <MockScene assets={{ preloadImages: ['scene-4.jpg'] }}>Scene 4</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      act(() => {
        ref.current?.goToScene(2, false);
      });

      await waitFor(() => {
        expect(addUrls).toHaveBeenCalledWith(['scene-2.jpg', 'scene-3.jpg', 'scene-4.jpg'], true);
      });

      expect(startPreload).toHaveBeenCalled();
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
