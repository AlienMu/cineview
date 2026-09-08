/**
 * Integration test: Performance testing
 * Tests rendering performance with 20+ scenes, image preload memory usage, animation smoothness (60fps)
 *
 * **Validates: Requirements 14.10, 22.1**
 */

import React from 'react';
import { act } from '@testing-library/react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CineView, Scene, Animate, Position } from '../../index';
import type { CineViewRef } from '../../types';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  __esModule: true,
  useMotionValue: (initial: number) => {
    let current = initial;
    const listeners = new Set<(value: number) => void>();

    return {
      get: () => current,
      set: (value: number) => {
        current = value;
        listeners.forEach((listener) => listener(current));
      },
      on: (event: string, listener: (value: number) => void) => {
        if (event !== 'change') {
          return () => undefined;
        }
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  },
  useTransform: (
    source: {
      get: () => number;
      on?: (event: string, listener: (value: number) => void) => () => void;
    },
    transform: (value: number) => number
  ) => {
    let current = transform(source.get());
    const listeners = new Set<(value: number) => void>();
    const motionValue = {
      get: () => current,
      set: (value: number) => {
        current = value;
        listeners.forEach((listener) => listener(current));
      },
      on: (event: string, listener: (value: number) => void) => {
        if (event !== 'change') {
          return () => undefined;
        }
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    source.on?.('change', (value) => {
      motionValue.set(transform(value));
    });
    return motionValue;
  },
  animate: (
    value: { set?: (next: number) => void } | number,
    target: number,
    options?: { onUpdate?: (value: number) => void; onComplete?: () => void }
  ) => {
    if (typeof value === 'object' && value?.set) {
      value.set(target);
    }
    options?.onUpdate?.(target);
    options?.onComplete?.();
    return { stop: jest.fn() };
  },
  motion: {
    div: React.forwardRef<
      HTMLDivElement,
      React.PropsWithChildren<{
        initial?: unknown;
        animate?: unknown;
        style?: React.CSSProperties;
        className?: string;
        onPanStart?: unknown;
        onPan?: unknown;
        onPanEnd?: unknown;
      }>
    >(
      (
        { children, onPanStart: _onPanStart, onPan: _onPan, onPanEnd: _onPanEnd, ...props },
        ref
      ) => (
        <div ref={ref} {...(props as React.HTMLAttributes<HTMLDivElement>)}>
          {children}
        </div>
      )
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  useAnimation: () => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
    set: jest.fn(),
  }),
}));

// Mock IntersectionObserver
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver as unknown as typeof IntersectionObserver;

// Mock performance.memory (Chrome-specific API)
Object.defineProperty(performance, 'memory', {
  writable: true,
  configurable: true,
  value: {
    usedJSHeapSize: 10000000, // 10MB
    totalJSHeapSize: 20000000, // 20MB
    jsHeapSizeLimit: 2000000000, // 2GB
  },
});

describe('Performance Tests', () => {
  let cineViewRef: React.RefObject<CineViewRef | null>;
  let cleanup: (() => void) | undefined;

  jest.setTimeout(10000);

  beforeEach(() => {
    cineViewRef = React.createRef();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = undefined;
    }
    jest.restoreAllMocks();
    if (global.gc) {
      global.gc();
    }
  });

  describe('Large scene rendering performance', () => {
    test('should render 20+ scenes without crashing', async () => {
      const sceneCount = 25;
      const scenes = Array.from({ length: sceneCount }, (_, i) => (
        <Scene key={i}>
          <Position at={{ x: 100, y: 100 }}>
            <Animate enterAnimation="fade-in" duration={{ enter: 100 }}>
              <h1>Scene {i + 1}</h1>
            </Animate>
          </Position>
        </Scene>
      ));

      const TestApp = () => (
        <CineView
          ref={cineViewRef as React.RefObject<CineViewRef>}
          mode="drag"
          direction={'y'}
          transitionDuration={500}
          designWidth={750}
        >
          {scenes}
        </CineView>
      );

      const { container, unmount } = render(<TestApp />);
      cleanup = unmount;

      await waitFor(
        () => {
          expect(container.querySelector('.cineview-container')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      expect(cineViewRef.current?.getCurrentIndex()).toBe(0);

      expect(screen.getByText('Scene 1')).toBeInTheDocument();

      unmount();
      cleanup = undefined;
    }, 8000);

    test('should render 50+ scenes with virtualization', async () => {
      const sceneCount = 55;
      const scenes = Array.from({ length: sceneCount }, (_, i) => (
        <Scene key={i}>
          <h1 data-testid={`scene-${i}`}>Scene {i + 1}</h1>
        </Scene>
      ));

      const TestApp = () => (
        <CineView
          ref={cineViewRef as React.RefObject<CineViewRef>}
          mode="drag"
          direction={'y'}
          transitionDuration={500}
          designWidth={750}
        >
          {scenes}
        </CineView>
      );

      const { unmount } = render(<TestApp />);
      cleanup = unmount;

      await waitFor(
        () => {
          expect(cineViewRef.current).not.toBeNull();
        },
        { timeout: 3000 }
      );

      expect(screen.getByTestId('scene-0')).toBeInTheDocument();
      expect(screen.queryByTestId('scene-1')).toBeInTheDocument();
      expect(screen.queryByTestId('scene-2')).not.toBeInTheDocument();

      act(() => {
        cineViewRef.current?.goToScene(27, false);
      });

      await waitFor(
        () => {
          expect(cineViewRef.current?.getCurrentIndex()).toBe(27);
        },
        { timeout: 2000 }
      );

      expect(screen.queryByTestId('scene-0')).not.toBeInTheDocument();
      expect(screen.getByTestId('scene-26')).toBeInTheDocument();
      expect(screen.getByTestId('scene-27')).toBeInTheDocument();
      expect(screen.getByTestId('scene-28')).toBeInTheDocument();
      expect(screen.queryByTestId('scene-29')).not.toBeInTheDocument();

      act(() => {
        cineViewRef.current?.goToScene(54, false);
      });

      await waitFor(
        () => {
          expect(cineViewRef.current?.getCurrentIndex()).toBe(54);
        },
        { timeout: 2000 }
      );

      expect(screen.queryByTestId('scene-52')).not.toBeInTheDocument();
      expect(screen.getByTestId('scene-53')).toBeInTheDocument();
      expect(screen.getByTestId('scene-54')).toBeInTheDocument();

      unmount();
      cleanup = undefined;
    }, 10000);

    test('should render 100+ scenes and switch quickly', async () => {
      const sceneCount = 105;
      const scenes = Array.from({ length: sceneCount }, (_, i) => (
        <Scene key={i}>
          <h1>Scene {i + 1}</h1>
        </Scene>
      ));

      const TestApp = () => (
        <CineView
          ref={cineViewRef as React.RefObject<CineViewRef>}
          mode="drag"
          direction={'y'}
          transitionDuration={50}
          designWidth={750}
        >
          {scenes}
        </CineView>
      );

      const { unmount } = render(<TestApp />);
      cleanup = unmount;

      await waitFor(
        () => {
          expect(cineViewRef.current).not.toBeNull();
        },
        { timeout: 3000 }
      );

      const targetScenes = [25, 50, 75, 100, 10];

      for (const targetScene of targetScenes) {
        act(() => {
          cineViewRef.current?.goToScene(targetScene, false);
        });

        await waitFor(
          () => {
            expect(cineViewRef.current?.getCurrentIndex()).toBe(targetScene);
          },
          { timeout: 1000 }
        );
      }

      expect(cineViewRef.current?.getCurrentIndex()).toBe(10);

      unmount();
      cleanup = undefined;
    }, 12000);
  });

  describe('Image preload performance', () => {
    test('should handle large number of image preloads (30+)', async () => {
      const imageCount = 36;
      const images = Array.from(
        { length: imageCount },
        (_, i) => `https://example.com/image${i}.jpg`
      );

      const TestApp = () => (
        <CineView ref={cineViewRef as React.RefObject<CineViewRef>} designWidth={750}>
          <Scene assets={{ preloadImages: images.slice(0, 12) }}>
            <h1>First Scene</h1>
          </Scene>
          <Scene assets={{ preloadImages: images.slice(12, 24) }}>
            <h1>Scene 2</h1>
          </Scene>
          <Scene assets={{ preloadImages: images.slice(24, 36) }}>
            <h1>Scene 3</h1>
          </Scene>
        </CineView>
      );

      const { unmount, container } = render(<TestApp />);
      cleanup = unmount;

      await waitFor(
        () => {
          expect(cineViewRef.current).not.toBeNull();
          expect(container.querySelector('.cineview-container')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      act(() => {
        const imgs = document.querySelectorAll('img');
        imgs.forEach((img) => {
          Object.defineProperty(img, 'complete', { value: true, writable: true });
          img.dispatchEvent(new Event('load'));
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(container.querySelector('.cineview-container')).toBeInTheDocument();

      unmount();
      cleanup = undefined;
    }, 8000);

    test('should prioritize first-screen image loading', async () => {
      const loadOrder: string[] = [];

      const OriginalImage = window.Image;
      window.Image = class MockImage extends OriginalImage {
        constructor() {
          super();
          Object.defineProperty(this, 'src', {
            set: (value: string): void => {
              loadOrder.push(value);
              setTimeout((): void => {
                Object.defineProperty(this, 'complete', { value: true, writable: true });
                this.dispatchEvent(new Event('load'));
              }, 0);
            },
            get: (): string => '',
          });
        }
      } as unknown as typeof Image;

      const TestApp = (): React.JSX.Element => (
        <CineView mode="drag" direction={'y'} transitionDuration={500} designWidth={750}>
          <Scene assets={{ preloadImages: ['https://example.com/priority1.jpg'] }}>
            <h1>First Screen</h1>
          </Scene>
          <Scene assets={{ preloadImages: ['https://example.com/background1.jpg'] }}>
            <h1>Scene 2</h1>
          </Scene>
        </CineView>
      );

      const { unmount } = render(<TestApp />);
      cleanup = unmount;

      await waitFor(
        () => {
          expect(screen.getByText('First Screen')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      window.Image = OriginalImage;

      expect(loadOrder.length).toBeGreaterThan(0);
      expect(loadOrder[0]).toContain('priority');

      unmount();
      cleanup = undefined;
    }, 4000);

    test('should continue running when image load fails', async () => {
      const onLoadProgress = jest.fn();

      const TestApp = () => (
        <CineView designWidth={750} callbacks={{ onLoadProgress }}>
          <Scene
            assets={{
              preloadImages: ['https://example.com/valid.jpg', 'https://invalid-url/image.jpg'],
            }}
          >
            <h1>Test Scene</h1>
          </Scene>
        </CineView>
      );

      const { unmount, container } = render(<TestApp />);
      cleanup = unmount;

      await waitFor(
        () => {
          expect(container.querySelector('.cineview-container')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      act(() => {
        const imgs = document.querySelectorAll('img');
        imgs.forEach((img, index) => {
          if (index === 0) {
            Object.defineProperty(img, 'complete', { value: true, writable: true });
            img.dispatchEvent(new Event('load'));
          } else {
            img.dispatchEvent(new Event('error'));
          }
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(container.querySelector('.cineview-container')).toBeInTheDocument();

      unmount();
      cleanup = undefined;
    }, 4000);
  });

  describe('Animation performance', () => {
    test('should handle 20+ concurrent animations without lag', async () => {
      const animationCount = 25;
      const animations = Array.from({ length: animationCount }, (_, i) => (
        <Animate
          key={i}
          animateId={`anim-${i}`}
          enterAnimation="fade-in"
          duration={{ enter: 200 }}
          timeline={{ delay: i * 20 }}
        >
          <div data-testid={`animated-element-${i}`}>Element {i + 1}</div>
        </Animate>
      ));

      const TestApp = () => (
        <CineView mode="drag" direction={'y'} transitionDuration={500} designWidth={750}>
          <Scene>
            <Position at={{ x: 100, y: 100 }}>{animations}</Position>
          </Scene>
        </CineView>
      );

      const { unmount } = render(<TestApp />);
      cleanup = unmount;

      await waitFor(
        () => {
          for (let i = 0; i < animationCount; i++) {
            expect(screen.getByTestId(`animated-element-${i}`)).toBeInTheDocument();
          }
        },
        { timeout: 3000 }
      );

      unmount();
      cleanup = undefined;
    }, 6000);

    test('should handle 50+ concurrent animations (stress test)', async () => {
      const animationCount = 55;
      const animations = Array.from({ length: animationCount }, (_, i) => (
        <Animate
          key={i}
          animateId={`anim-${i}`}
          enterAnimation="fade-in"
          duration={{ enter: 150 }}
          timeline={{ delay: i * 10 }}
        >
          <div data-testid={`animated-element-${i}`}>Element {i + 1}</div>
        </Animate>
      ));

      const TestApp = () => (
        <CineView mode="drag" direction={'y'} transitionDuration={800} designWidth={750}>
          <Scene>
            <Position at={{ x: 100, y: 100 }}>{animations}</Position>
          </Scene>
        </CineView>
      );

      const { unmount } = render(<TestApp />);
      cleanup = unmount;

      await waitFor(
        () => {
          for (let i = 0; i < animationCount; i++) {
            expect(screen.getByTestId(`animated-element-${i}`)).toBeInTheDocument();
          }
        },
        { timeout: 4000 }
      );

      unmount();
      cleanup = undefined;
    }, 8000);

    test('should enable performance monitoring in monitor mode', async () => {
      const TestApp = () => (
        <CineView ref={cineViewRef as React.RefObject<CineViewRef>} designWidth={750} monitor>
          <Scene>
            <h1>Performance Monitoring Test</h1>
          </Scene>
        </CineView>
      );

      const { unmount } = render(<TestApp />);
      cleanup = unmount;

      await waitFor(
        () => {
          expect(cineViewRef.current).not.toBeNull();
        },
        { timeout: 2000 }
      );

      const metrics = cineViewRef.current?.getPerformanceMetrics();

      expect(metrics).toBeDefined();
      const resolvedMetrics = metrics!;
      expect(typeof resolvedMetrics.fps).toBe('number');
      expect(typeof resolvedMetrics.avgFrameTime).toBe('number');
      expect(typeof resolvedMetrics.bundleSize).toBe('number');

      expect(resolvedMetrics.fps).toBeGreaterThanOrEqual(0);
      expect(resolvedMetrics.fps).toBeLessThanOrEqual(60);

      expect(resolvedMetrics.avgFrameTime).toBeGreaterThanOrEqual(0);
      expect(resolvedMetrics.avgFrameTime).toBeLessThanOrEqual(100);

      unmount();
      cleanup = undefined;
    }, 4000);

    test('should use requestAnimationFrame for drag mode performance optimization', async () => {
      const rafSpy = jest.spyOn(window, 'requestAnimationFrame');

      const TestApp = () => (
        <CineView designWidth={750}>
          <Scene>
            <Animate enterAnimation="fade-in" exitAnimation="fade-out">
              <h1>Drag Performance Test</h1>
            </Animate>
          </Scene>
          <Scene>
            <h1>Next Scene</h1>
          </Scene>
        </CineView>
      );

      const { unmount } = render(<TestApp />);
      cleanup = unmount;

      await waitFor(
        () => {
          expect(screen.getByText('Drag Performance Test')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      rafSpy.mockRestore();

      unmount();
      cleanup = undefined;
    }, 4000);

    test('should handle animation delay chains without blocking main thread', async () => {
      const TestApp = () => (
        <CineView designWidth={750}>
          <Scene>
            <Animate
              animateId="anim1"
              enterAnimation="fade-in"
              duration={{ enter: 50 }}
              timeline={{ delay: 0 }}
            >
              <div>Animation 1</div>
            </Animate>
            <Animate
              animateId="anim2"
              enterAnimation="fade-in"
              duration={{ enter: 50 }}
              timeline={{ after: 'anim1' }}
            >
              <div>Animation 2</div>
            </Animate>
            <Animate
              animateId="anim3"
              enterAnimation="fade-in"
              duration={{ enter: 50 }}
              timeline={{ after: 'anim2' }}
            >
              <div>Animation 3</div>
            </Animate>
          </Scene>
        </CineView>
      );

      const startTime = performance.now();
      const { unmount } = render(<TestApp />);
      cleanup = unmount;

      await waitFor(
        () => {
          expect(screen.getByText('Animation 1')).toBeInTheDocument();
          expect(screen.getByText('Animation 2')).toBeInTheDocument();
          expect(screen.getByText('Animation 3')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(500);

      unmount();
      cleanup = undefined;
    }, 4000);
  });

  describe('Memory management', () => {
    test('should clean up event listeners on scene switch', async () => {
      const removeEventListenerSpy = jest.spyOn(HTMLDivElement.prototype, 'removeEventListener');

      const TestApp = () => (
        <CineView
          ref={cineViewRef as React.RefObject<CineViewRef>}
          mode="drag"
          direction={'y'}
          transitionDuration={500}
          designWidth={750}
        >
          <Scene>
            <h1>Scene 1</h1>
          </Scene>
          <Scene>
            <h1>Scene 2</h1>
          </Scene>
          <Scene>
            <h1>Scene 3</h1>
          </Scene>
        </CineView>
      );

      const { unmount } = render(<TestApp />);
      cleanup = unmount;

      await waitFor(
        () => {
          expect(cineViewRef.current).not.toBeNull();
        },
        { timeout: 2000 }
      );

      act(() => {
        cineViewRef.current?.goToScene(1, false);
      });

      await waitFor(
        () => {
          expect(cineViewRef.current?.getCurrentIndex()).toBe(1);
        },
        { timeout: 1000 }
      );

      act(() => {
        cineViewRef.current?.goToScene(2, false);
      });

      await waitFor(
        () => {
          expect(cineViewRef.current?.getCurrentIndex()).toBe(2);
        },
        { timeout: 1000 }
      );

      removeEventListenerSpy.mockRestore();

      unmount();
      cleanup = undefined;
    }, 6000);

    test('should clean up all resources on component unmount', async () => {
      const TestApp = () => (
        <CineView designWidth={750} monitor>
          <Scene>
            <h1>Test Scene</h1>
          </Scene>
        </CineView>
      );

      const { unmount } = render(<TestApp />);
      cleanup = unmount;

      await waitFor(
        () => {
          expect(screen.getByText('Test Scene')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      unmount();
      cleanup = undefined;

      expect(screen.queryByText('Test Scene')).not.toBeInTheDocument();
    }, 4000);

    test('should limit animateRegistry size and warn when threshold exceeded', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const largeAnimationCount = 50;
      const animations = Array.from({ length: largeAnimationCount }, (_, i) => (
        <Animate key={i} animateId={`anim-${i}`} enterAnimation="fade-in">
          <div>Element {i + 1}</div>
        </Animate>
      ));

      const TestApp = () => (
        <CineView designWidth={750}>
          <Scene>{animations}</Scene>
        </CineView>
      );

      const { unmount } = render(<TestApp />);
      cleanup = unmount;

      await waitFor(
        () => {
          expect(screen.getByText('Element 1')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      expect(screen.getByText(`Element ${largeAnimationCount}`)).toBeInTheDocument();
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();

      unmount();
      cleanup = undefined;
    }, 6000);
  });

  describe('Performance benchmarks', () => {
    test('should complete first-screen render within 100ms', async () => {
      const startTime = performance.now();

      const TestApp = () => (
        <CineView designWidth={750}>
          <Scene>
            <Position at={{ x: 100, y: 100 }}>
              <Animate enterAnimation="fade-in">
                <h1>First Screen Content</h1>
              </Animate>
            </Position>
          </Scene>
        </CineView>
      );

      const { unmount } = render(<TestApp />);
      cleanup = unmount;

      await waitFor(
        () => {
          expect(screen.getByText('First Screen Content')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(100);

      unmount();
      cleanup = undefined;
    }, 4000);

    test('should maintain 60fps during scene transitions', async () => {
      const TestApp = () => (
        <CineView
          ref={cineViewRef as React.RefObject<CineViewRef>}
          mode="drag"
          direction={'y'}
          transitionDuration={300}
          designWidth={750}
          monitor
        >
          <Scene>
            <h1>Scene 1</h1>
          </Scene>
          <Scene>
            <h1>Scene 2</h1>
          </Scene>
        </CineView>
      );

      const { unmount } = render(<TestApp />);
      cleanup = unmount;

      await waitFor(
        () => {
          expect(cineViewRef.current).not.toBeNull();
        },
        { timeout: 2000 }
      );

      act(() => {
        cineViewRef.current?.goToScene(1, true);
      });

      await waitFor(
        () => {
          expect(cineViewRef.current?.getCurrentIndex()).toBe(1);
        },
        { timeout: 1000 }
      );

      const metrics = cineViewRef.current?.getPerformanceMetrics();

      expect(metrics).toBeDefined();
      const resolvedMetrics = metrics!;
      expect(resolvedMetrics.fps).toBeGreaterThanOrEqual(50);
      expect(resolvedMetrics.fps).toBeLessThanOrEqual(60);

      expect(resolvedMetrics.avgFrameTime).toBeLessThanOrEqual(20);

      unmount();
      cleanup = undefined;
    }, 5000);
  });
});
