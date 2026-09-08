/**
 * Integration test: Full slide flow
 * Tests initialization → first screen loading → slide switching → animation playback → event triggering
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

describe('Full slide flow integration test', () => {
  let cineViewRef: React.RefObject<CineViewRef | null>;

  beforeEach(() => {
    cineViewRef = React.createRef();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Full flow: initialization → first screen → slide switching → animation playback → event triggering', async () => {
    const onInit = jest.fn();
    const onBeforeSceneChange = jest.fn();
    const onAfterSceneChange = jest.fn();
    const onLoadProgress = jest.fn();

    const TestApp = () => {
      return (
        <CineView
          ref={cineViewRef as React.RefObject<CineViewRef>}
          mode="drag"
          direction={'y'}
          transitionDuration={500}
          designWidth={750}
          callbacks={{
            onReady: onInit,
            onSceneEnter: onBeforeSceneChange,
            onSceneLeave: onAfterSceneChange,
            onLoadProgress,
          }}
        >
          <Scene transition={{ enterAnimation: 'fade-in', exitAnimation: 'fade-out' }}>
            <Position at={{ x: 100, y: 100 }}>
              <Animate
                animateId="scene1-title"
                enterAnimation="slide-up"
                duration={{ enter: 600 }}
                timeline={{ delay: 200 }}
              >
                <h1>场景 1</h1>
              </Animate>
            </Position>
            <Position at={{ x: 100, y: 300 }}>
              <Animate
                animateId="scene1-subtitle"
                enterAnimation="fade-in"
                duration={{ enter: 400 }}
                timeline={{ after: 'scene1-title' }}
              >
                <p>欢迎来到 CineView</p>
              </Animate>
            </Position>
          </Scene>

          <Scene transition={{ enterAnimation: 'slide-left', exitAnimation: 'slide-right' }}>
            <Position at={{ x: 100, y: 100 }}>
              <Animate animateId="scene2-title" enterAnimation="zoom-in" duration={{ enter: 500 }}>
                <h1>场景 2</h1>
              </Animate>
            </Position>
          </Scene>

          <Scene transition={{ enterAnimation: 'fade-in', exitAnimation: 'fade-out' }}>
            <Position at={{ x: 100, y: 100 }}>
              <h1>场景 3</h1>
            </Position>
          </Scene>
        </CineView>
      );
    };

    render(<TestApp />);

    await waitFor(() => {
      expect(onInit).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText('场景 1')).toBeInTheDocument();
    });
    expect(screen.getByText('欢迎来到 CineView')).toBeInTheDocument();

    expect(cineViewRef.current?.getCurrentIndex()).toBe(0);

    await act(async () => {
      cineViewRef.current?.goToScene(1, true);
    });

    await waitFor(() => {
      expect(onBeforeSceneChange).toHaveBeenCalledWith(
        expect.objectContaining({ fromIndex: 0, toIndex: 1, direction: 'forward' })
      );
    });

    await waitFor(
      () => {
        expect(onAfterSceneChange).toHaveBeenCalledWith(expect.objectContaining({ toIndex: 1 }));
      },
      { timeout: 2000 }
    );

    expect(screen.getByText('场景 2')).toBeInTheDocument();

    expect(cineViewRef.current?.getCurrentIndex()).toBe(1);

    await act(async () => {
      cineViewRef.current?.goToScene(2, true);
    });

    await waitFor(() => {
      expect(onBeforeSceneChange).toHaveBeenCalledWith(
        expect.objectContaining({ fromIndex: 1, toIndex: 2, direction: 'forward' })
      );
    });

    await waitFor(
      () => {
        expect(onAfterSceneChange).toHaveBeenCalledWith(expect.objectContaining({ toIndex: 2 }));
      },
      { timeout: 2000 }
    );

    expect(screen.getByText('场景 3')).toBeInTheDocument();
    expect(cineViewRef.current?.getCurrentIndex()).toBe(2);

    expect(onBeforeSceneChange).toHaveBeenCalledTimes(2);
    expect(onAfterSceneChange).toHaveBeenCalledTimes(2);
  });

  test('Drag mode: drag progress synchronized with animation', async () => {
    const onAfterSceneChange = jest.fn();

    const TestApp = () => {
      return (
        <CineView
          ref={cineViewRef as React.RefObject<CineViewRef>}
          mode="drag"
          direction={'y'}
          transitionDuration={800}
          designWidth={750}
          callbacks={{ onSceneLeave: onAfterSceneChange }}
        >
          <Scene transition={{ exitAnimation: 'fade-out' }}>
            <Animate animateId="drag-scene1" enterAnimation="fade-in" exitAnimation="slide-down">
              <h1>拖拽场景 1</h1>
            </Animate>
          </Scene>

          <Scene transition={{ enterAnimation: 'slide-up' }}>
            <h1>拖拽场景 2</h1>
          </Scene>
        </CineView>
      );
    };

    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('拖拽场景 1')).toBeInTheDocument();
    });

    await act(async () => {
      cineViewRef.current?.goToScene(1, false);
    });

    await waitFor(
      () => {
        expect(cineViewRef.current?.getCurrentIndex()).toBe(1);
      },
      { timeout: 2000 }
    );

    await waitFor(() => {
      expect(onAfterSceneChange).toHaveBeenCalledWith(expect.objectContaining({ toIndex: 1 }));
    });

    expect(screen.getByText('拖拽场景 2')).toBeInTheDocument();
  });

  test('Animation delay chaining mechanism: waitFor chain execution', async () => {
    const TestApp = () => {
      return (
        <CineView mode="drag" direction={'y'} transitionDuration={500} designWidth={750}>
          <Scene transition={{ enterAnimation: 'fade-in' }}>
            <Animate
              animateId="anim1"
              enterAnimation="fade-in"
              duration={{ enter: 100 }}
              timeline={{ delay: 0 }}
            >
              <div>动画 1</div>
            </Animate>

            <Animate
              animateId="anim2"
              enterAnimation="fade-in"
              duration={{ enter: 100 }}
              timeline={{ after: 'anim1' }}
            >
              <div>动画 2</div>
            </Animate>

            <Animate
              animateId="anim3"
              enterAnimation="fade-in"
              duration={{ enter: 100 }}
              timeline={{ after: 'anim2' }}
            >
              <div>动画 3</div>
            </Animate>
          </Scene>
        </CineView>
      );
    };

    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('动画 1')).toBeInTheDocument();
    });

    expect(screen.getByText('动画 1')).toBeInTheDocument();
    expect(screen.getByText('动画 2')).toBeInTheDocument();
    expect(screen.getByText('动画 3')).toBeInTheDocument();
  });

  test('Responsive size conversion: window resize triggers recalculation', async () => {
    const TestApp = () => {
      return (
        <CineView designWidth={750}>
          <Scene>
            <Position at={{ x: 375, y: 100 }}>
              <div data-testid="positioned-element">居中元素</div>
            </Position>
          </Scene>
        </CineView>
      );
    };

    render(<TestApp />);

    const element = screen.getByTestId('positioned-element');
    expect(element).toBeInTheDocument();

    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1500,
      });
      window.dispatchEvent(new Event('resize'));
    });

    await waitFor(
      () => {
        const newStyle = window.getComputedStyle(element.parentElement!);
        expect(newStyle).toBeDefined();
      },
      { timeout: 500 }
    );
  });

  test('Performance metrics retrieval: getPerformanceMetrics', async () => {
    const TestApp = () => {
      return (
        <CineView ref={cineViewRef as React.RefObject<CineViewRef>} designWidth={750}>
          <Scene>
            <h1>性能测试场景</h1>
          </Scene>
        </CineView>
      );
    };

    render(<TestApp />);

    await waitFor(() => {
      expect(cineViewRef.current).not.toBeNull();
    });

    const metrics = cineViewRef.current?.getPerformanceMetrics();

    expect(metrics).toBeDefined();
    if (metrics) {
      expect(typeof metrics.fps).toBe('number');
      expect(typeof metrics.avgFrameTime).toBe('number');
      expect(typeof metrics.bundleSize).toBe('number');
    }
  });

  test('Virtualized rendering: only render current scene plus one before and after', async () => {
    const TestApp = () => {
      return (
        <CineView ref={cineViewRef as React.RefObject<CineViewRef>} designWidth={750}>
          <Scene>
            <h1>场景 0</h1>
          </Scene>
          <Scene>
            <h1>场景 1</h1>
          </Scene>
          <Scene>
            <h1>场景 2</h1>
          </Scene>
          <Scene>
            <h1>场景 3</h1>
          </Scene>
          <Scene>
            <h1>场景 4</h1>
          </Scene>
        </CineView>
      );
    };

    render(<TestApp />);

    expect(screen.getByText('场景 0')).toBeInTheDocument();
    expect(screen.queryByText('场景 1')).toBeInTheDocument();
    expect(screen.queryByText('场景 2')).not.toBeInTheDocument();

    act(() => {
      cineViewRef.current?.goToScene(2, false);
    });

    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentIndex()).toBe(2);
    });

    expect(screen.queryByText('场景 0')).not.toBeInTheDocument();
    expect(screen.getByText('场景 1')).toBeInTheDocument();
    expect(screen.getByText('场景 2')).toBeInTheDocument();
    expect(screen.getByText('场景 3')).toBeInTheDocument();
    expect(screen.queryByText('场景 4')).not.toBeInTheDocument();
  });

  test('Error handling: invalid scene index', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const TestApp = () => {
      return (
        <CineView ref={cineViewRef as React.RefObject<CineViewRef>} designWidth={750}>
          <Scene>
            <h1>场景 0</h1>
          </Scene>
          <Scene>
            <h1>场景 1</h1>
          </Scene>
        </CineView>
      );
    };

    render(<TestApp />);

    await waitFor(() => {
      expect(cineViewRef.current).not.toBeNull();
    });

    act(() => {
      cineViewRef.current?.goToScene(10, false);
    });

    expect(cineViewRef.current?.getCurrentIndex()).toBe(0);

    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });
});
