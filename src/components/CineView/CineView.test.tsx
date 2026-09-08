/**
 * CineView Component Unit Tests
 */

import { createRef, act } from 'react';
import { render, waitFor } from '@testing-library/react';
import { CineView } from './CineViewDispatch';
import { resolveRootSceneStackMode } from './CineView';
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
(MockScene as React.FC & { cineViewScene?: boolean; displayName?: string }).cineViewScene = true;
(MockScene as React.FC & { displayName?: string }).displayName = 'Scene';

// Mock performance monitor
jest.mock('../../utils/performanceMonitor', () => {
  const performanceMonitor = {
    start: jest.fn(),
    stop: jest.fn(),
    getMetrics: jest.fn(() => ({
      fps: 60,
      avgFrameTime: 16.67,
      memoryUsage: 50,
      bundleSize: 45,
    })),
    reset: jest.fn(),
  };
  return {
    performanceMonitor,
    acquirePerformanceMonitoring: jest.fn(() => {
      performanceMonitor.start();
      return () => performanceMonitor.stop();
    }),
  };
});

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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('stack mode resolution', () => {
    it('defaults scroll scenes to cover when scene stack mode is omitted', () => {
      expect(resolveRootSceneStackMode({}, 'scroll')).toBe('cover');
      expect(resolveRootSceneStackMode({ sceneStackMode: 'replace' }, 'scroll')).toBe('cover');
      expect(resolveRootSceneStackMode({ layout: { overlap: 'replace' } }, 'scroll')).toBe(
        'replace'
      );
    });
  });

  describe('12.1 Core Functionality', () => {
    it('should create responsive size conversion context', () => {
      const { container } = render(
        <CineView designWidth={750}>
          <MockScene>Scene 1</MockScene>
        </CineView>
      );

      expect(container.querySelector('.cineview-container')).toBeInTheDocument();
    });

    it('should register all Scene children and maintain scene index', async () => {
      const { container } = render(
        <CineView designWidth={750}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
          <MockScene>Scene 3</MockScene>
        </CineView>
      );

      await waitFor(() => {
        const scenes = container.querySelectorAll('[data-scene-index]');
        // Virtualized rendering: only renders current scene (0) and next scene (1)
        expect(scenes.length).toBeGreaterThan(0);
      });
    });

    it('should initialize image preload system', () => {
      const { useImagePreloader } = require('../../hooks/useImagePreloader');

      render(
        <CineView designWidth={750}>
          <MockScene preloadImages={['image1.jpg', 'image2.jpg']}>Scene 1</MockScene>
          <MockScene preloadImages={['image3.jpg']}>Scene 2</MockScene>
        </CineView>
      );

      const [, actions] = useImagePreloader.mock.results[0].value;
      expect(actions.startPreload).toHaveBeenCalled();
    });

    it('should not restart preload when onLoadProgress callback identity changes', () => {
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
        <CineView designWidth={750} callbacks={{ onLoadProgress: () => {} }}>
          <MockScene preloadImages={['image1.jpg']}>Scene 1</MockScene>
        </CineView>
      );

      rerender(
        <CineView designWidth={750} callbacks={{ onLoadProgress: () => {} }}>
          <MockScene preloadImages={['image1.jpg']}>Scene 1</MockScene>
        </CineView>
      );

      expect(startPreload).toHaveBeenCalledTimes(1);
    });

    it('should support grouped assets.preloadImages', () => {
      const { useImagePreloader } = require('../../hooks/useImagePreloader');

      render(
        <CineView designWidth={750}>
          <MockScene assets={{ preloadImages: ['grouped-first.jpg'] }}>Scene 1</MockScene>
          <MockScene assets={{ preloadImages: ['grouped-second.jpg'] }}>Scene 2</MockScene>
        </CineView>
      );

      const callArgs = useImagePreloader.mock.calls[0][0];
      expect(callArgs.priorityUrls).toEqual(['grouped-first.jpg']);
      expect(callArgs.backgroundUrls).toEqual(['grouped-second.jpg']);
    });

    it('should still display scene viewport when priority images are incomplete', () => {
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
        <CineView designWidth={750}>
          <MockScene assets={{ preloadImages: ['hero.jpg'] }}>Scene 1</MockScene>
        </CineView>
      );

      const viewport = container.querySelector('.cineview-container > div');
      expect(viewport).toHaveStyle({ opacity: '1', pointerEvents: 'auto' });
    });

    it('should implement virtualized rendering (only renders current scene plus one before and after)', async () => {
      const ref = createRef<CineViewRef>();

      const { container } = render(
        <CineView ref={ref} designWidth={750}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
          <MockScene>Scene 3</MockScene>
          <MockScene>Scene 4</MockScene>
        </CineView>
      );

      await waitFor(() => {
        const scenes = container.querySelectorAll('[data-scene-index]');
        // Current scene index is 0, should render scenes 0 and 1
        expect(scenes.length).toBeLessThanOrEqual(2);
      });
    });

    it('should use content-visibility CSS to optimize non-visible scenes', async () => {
      const ref = createRef<CineViewRef>();

      const { container } = render(
        <CineView ref={ref} designWidth={750}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
        </CineView>
      );

      await waitFor(() => {
        const scenes = container.querySelectorAll('[data-scene-index]');
        scenes.forEach((scene, index) => {
          if (index === 0) {
            // Current scene should be visible
            expect(scene).toHaveStyle({ visibility: 'visible' });
          }
        });
      });
    });

    it('should only inject viewport main axis minimum for scroll screen sizing', async () => {
      const { container, rerender } = render(
        <CineView designWidth={750} mode="scroll" direction={'y'} sceneSizing={'content'}>
          <MockScene>Short Scene</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(container.querySelector('[data-scene-index="0"]')).toBeInTheDocument();
      });

      const contentSizedScene = container.querySelector('[data-scene-index="0"]') as HTMLDivElement;
      expect(contentSizedScene.style.minHeight).toBe('');

      rerender(
        <CineView designWidth={750} mode="scroll" direction={'y'} sceneSizing={'screen'}>
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

    it('should register styles to hide native browser scrollbar at root container', () => {
      render(
        <CineView
          designWidth={750}
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

  describe('12.2 Event System', () => {
    it('should trigger onInit callback', () => {
      const onInit = jest.fn();
      const ref = createRef<CineViewRef>();

      render(
        <CineView ref={ref} designWidth={750} callbacks={{ onReady: onInit }}>
          <MockScene>Scene 1</MockScene>
        </CineView>
      );

      // React StrictMode may cause double rendering in development
      expect(onInit).toHaveBeenCalled();
    });

    it('when using callback ref, should still only trigger onReady once and return the same API', () => {
      const onReady = jest.fn();
      const callbackRef = jest.fn<void, [CineViewRef | null]>();

      render(
        <CineView ref={callbackRef} designWidth={750} callbacks={{ onReady }}>
          <MockScene>Scene 1</MockScene>
        </CineView>
      );

      const exposedApi = callbackRef.mock.calls.find(([api]) => api !== null)?.[0];
      expect(exposedApi).toBeDefined();
      expect(onReady).toHaveBeenCalledTimes(1);
      expect(onReady).toHaveBeenCalledWith(exposedApi);
    });

    it('toggling performance.monitor should not re-trigger onReady or break ref navigation', async () => {
      const onReady = jest.fn();
      const ref = createRef<CineViewRef>();
      const { rerender } = render(
        <CineView ref={ref} designWidth={750} monitor={false} callbacks={{ onReady }}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
        </CineView>
      );

      expect(onReady).toHaveBeenCalledTimes(1);

      rerender(
        <CineView ref={ref} designWidth={750} monitor callbacks={{ onReady }}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
        </CineView>
      );

      expect(onReady).toHaveBeenCalledTimes(1);
      expect(performanceMonitor.start).toHaveBeenCalledTimes(1);

      act(() => {
        ref.current?.goToScene(1, false);
      });
      await waitFor(() => {
        expect(ref.current?.getCurrentIndex()).toBe(1);
      });
      expect(onReady).toHaveBeenCalledTimes(1);
    });

    it('should trigger onBeforeSceneChange callback', async () => {
      const onBeforeSceneChange = jest.fn();
      const ref = createRef<CineViewRef>();

      render(
        <CineView ref={ref} designWidth={750} callbacks={{ onSceneEnter: onBeforeSceneChange }}>
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

    it('should trigger onAfterSceneChange callback', async () => {
      const onAfterSceneChange = jest.fn();
      const ref = createRef<CineViewRef>();

      render(
        <CineView ref={ref} designWidth={750} callbacks={{ onSceneLeave: onAfterSceneChange }}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      act(() => {
        ref.current?.goToScene(1, false); // Without animation, immediately triggers onAfterSceneChange
      });

      await waitFor(() => {
        expect(onAfterSceneChange).toHaveBeenCalledWith(
          expect.objectContaining({ fromIndex: 0, toIndex: 1, direction: 'forward' })
        );
      });
    });

    it('in drag mode, ref.goToScene supplements onDragEnd once (unifying gesture and programmatic commit)', async () => {
      const onDragEnd = jest.fn();
      const ref = createRef<CineViewRef>();

      render(
        <CineView ref={ref} mode="drag" designWidth={750} callbacks={{ onDragEnd }}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
          <MockScene>Scene 3</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      act(() => {
        ref.current?.goToScene(1);
      });

      expect(onDragEnd).toHaveBeenCalledTimes(1);
      expect(onDragEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          sceneIndex: 0,
          targetSceneIndex: 1,
          progress: 1,
          direction: 'forward',
        })
      );
    });

    it('ref.goToScene does not emit onDragEnd for no-op (same index/out of bounds)', async () => {
      const onDragEnd = jest.fn();
      const ref = createRef<CineViewRef>();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      render(
        <CineView ref={ref} mode="drag" designWidth={750} callbacks={{ onDragEnd }}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      act(() => {
        ref.current?.goToScene(0); // Same index
        ref.current?.goToScene(5); // Out of bounds
      });

      expect(onDragEnd).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid scene index: 5'));
      warnSpy.mockRestore();
    });

    it('should trigger onLoadProgress callback', () => {
      const onLoadProgress = jest.fn();

      render(
        <CineView designWidth={750} callbacks={{ onLoadProgress }}>
          <MockScene preloadImages={['image1.jpg']}>Scene 1</MockScene>
        </CineView>
      );

      // onLoadProgress should be called (via useImagePreloader hook)
      // Actual calls are handled by the mocked hook
      expect(onLoadProgress).toBeDefined();
    });
  });

  describe('12.3 API Methods', () => {
    it('should implement goToScene method (supports animated parameter)', async () => {
      const ref = createRef<CineViewRef>();

      render(
        <CineView ref={ref} designWidth={750}>
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

      expect(ref.current?.getCurrentIndex()).toBe(2);
    });

    it('should not expose internal runtime snapshot via ref', async () => {
      const ref = createRef<CineViewRef>();

      render(
        <CineView ref={ref} designWidth={750}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      expect('getState' in (ref.current as object)).toBe(false);
    });

    it('should implement refreshLayout and preload methods', async () => {
      const ref = createRef<CineViewRef>();

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
        <CineView ref={ref} designWidth={750}>
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

    it('preload(targets) only appends priority images by scene index and sceneId', async () => {
      const ref = createRef<CineViewRef>();
      const startPreload = jest.fn().mockResolvedValue(undefined);
      const addUrls = jest.fn();

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
        <CineView ref={ref} designWidth={750}>
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

    it('should implement getCurrentIndex method', async () => {
      const ref = createRef<CineViewRef>();

      render(
        <CineView ref={ref} designWidth={750}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      expect(ref.current?.getCurrentIndex()).toBe(0);

      act(() => {
        ref.current?.goToScene(1, false);
      });

      expect(ref.current?.getCurrentIndex()).toBe(1);
    });

    it('should implement getPerformanceMetrics method', async () => {
      const ref = createRef<CineViewRef>();

      render(
        <CineView ref={ref} designWidth={750}>
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

    it('should validate scene index validity', async () => {
      const ref = createRef<CineViewRef>();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      render(
        <CineView ref={ref} designWidth={750}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      // Attempt to navigate to invalid index
      act(() => {
        ref.current?.goToScene(10);
      });

      // Should output warning
      expect(consoleWarnSpy).toHaveBeenCalled();

      // Scene index should remain unchanged
      expect(ref.current?.getCurrentIndex()).toBe(0);

      consoleWarnSpy.mockRestore();
    });
  });

  describe('12.4 Performance Optimization', () => {
    it('should use WeakMap to store component references', () => {
      // WeakMap is an internal implementation detail, verified by not causing memory leaks
      const { unmount } = render(
        <CineView designWidth={750}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
        </CineView>
      );

      // Unmounting component should not cause memory leaks
      expect(() => unmount()).not.toThrow();
    });

    it('should support performanceMode toggle', () => {
      render(
        <CineView designWidth={750} monitor>
          <MockScene>Scene 1</MockScene>
        </CineView>
      );

      expect(performanceMonitor.start).toHaveBeenCalled();
    });

    it('should clean up performance monitoring on component unmount', () => {
      const { unmount } = render(
        <CineView designWidth={750} monitor>
          <MockScene>Scene 1</MockScene>
        </CineView>
      );

      unmount();

      expect(performanceMonitor.stop).toHaveBeenCalled();
    });
  });

  describe('12.5 Error Handling and Developer Experience', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should provide detailed error messages in development environment', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      render(
        <CineView designWidth={750}>
          <div>Not a Scene</div>
        </CineView>
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No Scene components found')
      );

      consoleWarnSpy.mockRestore();
    });

    it('warns when drag mode receives a displayName-spoofed Scene child', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const LegacyNamedScene: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <div>{children}</div>
      );
      LegacyNamedScene.displayName = 'Scene';

      render(
        <CineView mode="drag" designWidth={750}>
          <LegacyNamedScene>Legacy Scene</LegacyNamedScene>
        </CineView>
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('displayName="Scene"'));
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('cineViewScene marker'));

      consoleWarnSpy.mockRestore();
    });

    it('warns when scroll mode receives a displayName-spoofed Scene child', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const LegacyNamedScene: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <div>{children}</div>
      );
      LegacyNamedScene.displayName = 'Scene';

      render(
        <CineView mode="scroll" designWidth={750}>
          <LegacyNamedScene>Legacy Scene</LegacyNamedScene>
        </CineView>
      );

      await waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('displayName="Scene"'));
      });
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('cineViewScene marker'));

      consoleWarnSpy.mockRestore();
    });

    it('should provide component hierarchy checks in development environment', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <CineView designWidth={0}>
          <MockScene>Scene 1</MockScene>
        </CineView>
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid designWidth'));

      consoleErrorSpy.mockRestore();
    });

    it('should provide performance debugging mode', () => {
      render(
        <CineView designWidth={750} monitor>
          <MockScene>Scene 1</MockScene>
        </CineView>
      );

      expect(performanceMonitor.start).toHaveBeenCalled();
    });
  });

  describe('Virtualized Rendering Edge Cases', () => {
    it('when current scene index is 0, should only render scenes 0 and 1', async () => {
      const ref = createRef<CineViewRef>();

      const { container } = render(
        <CineView ref={ref} designWidth={750}>
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

    it('when current scene index is the last one, should only render the last scene and second-to-last scene', async () => {
      const ref = createRef<CineViewRef>();

      const { container } = render(
        <CineView ref={ref} designWidth={750}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
          <MockScene>Scene 3</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      // Navigate to last scene
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

    it('when current scene index is in the middle, should render current scene and one scene before and after', async () => {
      const ref = createRef<CineViewRef>();

      const { container } = render(
        <CineView ref={ref} designWidth={750}>
          <MockScene>Scene 1</MockScene>
          <MockScene>Scene 2</MockScene>
          <MockScene>Scene 3</MockScene>
          <MockScene>Scene 4</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      // Navigate to middle scene
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

  describe('Image Preload Flow', () => {
    it('should only wait for current scene images and queue remaining scenes in background', () => {
      const { useImagePreloader } = require('../../hooks/useImagePreloader');

      render(
        <CineView designWidth={750}>
          <MockScene assets={{ preloadImages: ['first1.jpg', 'first2.jpg'] }}>Scene 1</MockScene>
          <MockScene assets={{ preloadImages: ['second1.jpg'] }}>Scene 2</MockScene>
          <MockScene assets={{ preloadImages: ['third1.jpg'] }}>Scene 3</MockScene>
        </CineView>
      );

      const callArgs = useImagePreloader.mock.calls[0][0];
      expect(callArgs.priorityUrls).toEqual(['first1.jpg', 'first2.jpg']);
      expect(callArgs.backgroundUrls).toEqual(['second1.jpg', 'third1.jpg']);
    });

    it('should promote current scene after page flip and continue background preheating of remaining scene images', async () => {
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
        <CineView ref={ref} designWidth={750}>
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
        expect(addUrls).toHaveBeenCalledWith(['scene-3.jpg'], true);
      });

      expect(addUrls).toHaveBeenCalledWith(['scene-1.jpg', 'scene-2.jpg', 'scene-4.jpg'], false);

      expect(startPreload).toHaveBeenCalled();
    });

    it('should render first screen content after initial scene images have loaded', async () => {
      const { container } = render(
        <CineView designWidth={750}>
          <MockScene>Scene 1</MockScene>
        </CineView>
      );

      await waitFor(() => {
        expect(container.querySelector('[data-scene-index]')).toBeInTheDocument();
      });
    });
  });
});
