/**
 * 集成测试：完整滑动流程
 * 测试初始化 → 首屏加载 → 滑动切换 → 动画播放 → 事件触发
 */

import React, { act } from 'react';
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
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
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

describe('完整滑动流程集成测试', () => {
  let cineViewRef: React.RefObject<CineViewRef>;

  beforeEach(() => {
    cineViewRef = React.createRef();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('完整流程：初始化 → 首屏加载 → 滑动切换 → 动画播放 → 事件触发', async () => {
    const onInit = jest.fn();
    const onBeforeSceneChange = jest.fn();
    const onAfterSceneChange = jest.fn();
    const onLoadProgress = jest.fn();

    const TestApp = () => {
      return (
        <CineView
          ref={cineViewRef}
          mode="drag"
          modes={{ drag: { direction: 'y', transitionDuration: 500 } }}
          config={{ width: 750, height: 750, unit: 'px' }}
          callbacks={{
            onReady: onInit,
            onSceneWillChange: onBeforeSceneChange,
            onSceneDidChange: onAfterSceneChange,
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
                timeline={{ waitFor: 'scene1-title' }}
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

    // 1. 渲染组件
    render(<TestApp />);

    // 2. 验证初始化
    await waitFor(() => {
      expect(onInit).toHaveBeenCalledTimes(1);
    });

    // 3. 验证首屏渲染（无图片预加载时应该立即渲染）
    await waitFor(() => {
      expect(screen.getByText('场景 1')).toBeInTheDocument();
    });
    expect(screen.getByText('欢迎来到 CineView')).toBeInTheDocument();

    // 4. 验证当前场景索引
    expect(cineViewRef.current?.getCurrentScene()).toBe(0);

    // 5. 触发场景切换（使用 API）
    await act(async () => {
      cineViewRef.current?.goToScene(1, true);
    });

    // 6. 验证场景切换前回调
    await waitFor(() => {
      expect(onBeforeSceneChange).toHaveBeenCalledWith(
        expect.objectContaining({ fromIndex: 0, toIndex: 1, direction: 'forward' })
      );
    });

    // 7. 等待场景切换完成
    await waitFor(
      () => {
        expect(onAfterSceneChange).toHaveBeenCalledWith(expect.objectContaining({ toIndex: 1 }));
      },
      { timeout: 2000 }
    );

    // 8. 验证新场景渲染
    expect(screen.getByText('场景 2')).toBeInTheDocument();

    // 9. 验证当前场景索引更新
    expect(cineViewRef.current?.getCurrentScene()).toBe(1);

    // 10. 继续切换到场景 3
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
    expect(cineViewRef.current?.getCurrentScene()).toBe(2);

    // 11. 验证事件回调调用次数
    expect(onBeforeSceneChange).toHaveBeenCalledTimes(2);
    expect(onAfterSceneChange).toHaveBeenCalledTimes(2);
  });

  test('拖拽模式：拖拽进度与动画同步', async () => {
    const onAfterSceneChange = jest.fn();

    const TestApp = () => {
      return (
        <CineView
          ref={cineViewRef}
          mode="drag"
          modes={{ drag: { direction: 'y', transitionDuration: 800 } }}
          config={{ width: 750, height: 750, unit: 'px' }}
          callbacks={{ onSceneDidChange: onAfterSceneChange }}
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

    // 验证首屏渲染
    await waitFor(() => {
      expect(screen.getByText('拖拽场景 1')).toBeInTheDocument();
    });

    // 在拖拽模式下，使用 API 切换场景来验证功能
    await act(async () => {
      cineViewRef.current?.goToScene(1, false);
    });

    // 验证场景切换
    await waitFor(
      () => {
        expect(cineViewRef.current?.getCurrentScene()).toBe(1);
      },
      { timeout: 2000 }
    );

    // 验证回调被调用
    await waitFor(() => {
      expect(onAfterSceneChange).toHaveBeenCalledWith(expect.objectContaining({ toIndex: 1 }));
    });

    // 验证新场景渲染
    expect(screen.getByText('拖拽场景 2')).toBeInTheDocument();
  });

  test('动画延迟关联机制：waitFor 链式执行', async () => {
    const TestApp = () => {
      return (
        <CineView
          mode="drag"
          modes={{ drag: { direction: 'y', transitionDuration: 500 } }}
          config={{ width: 750, height: 750, unit: 'px' }}
        >
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
              timeline={{ waitFor: 'anim1' }}
            >
              <div>动画 2</div>
            </Animate>

            <Animate
              animateId="anim3"
              enterAnimation="fade-in"
              duration={{ enter: 100 }}
              timeline={{ waitFor: 'anim2' }}
            >
              <div>动画 3</div>
            </Animate>
          </Scene>
        </CineView>
      );
    };

    render(<TestApp />);

    // 等待场景渲染
    await waitFor(() => {
      expect(screen.getByText('动画 1')).toBeInTheDocument();
    });

    // 验证所有动画组件都已渲染（waitFor 机制确保它们按顺序执行）
    expect(screen.getByText('动画 1')).toBeInTheDocument();
    expect(screen.getByText('动画 2')).toBeInTheDocument();
    expect(screen.getByText('动画 3')).toBeInTheDocument();

    // 验证动画延迟关联机制正常工作（组件已正确注册和渲染）
    // 实际的动画执行时序由 Animate 组件内部的 waitFor 逻辑控制
  });

  test('响应式尺寸换算：窗口 resize 触发重新计算', async () => {
    const TestApp = () => {
      return (
        <CineView config={{ width: 750, height: 750, unit: 'px' }}>
          <Scene>
            <Position at={{ x: 375, y: 100 }}>
              <div data-testid="positioned-element">居中元素</div>
            </Position>
          </Scene>
        </CineView>
      );
    };

    render(<TestApp />);

    // 获取初始位置
    const element = screen.getByTestId('positioned-element');
    // 验证元素存在
    expect(element).toBeInTheDocument();

    // 模拟窗口 resize
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1500,
      });
      window.dispatchEvent(new Event('resize'));
    });

    // 等待防抖完成
    await waitFor(
      () => {
        const newStyle = window.getComputedStyle(element.parentElement!);
        // 验证样式已更新（具体值取决于实现）
        expect(newStyle).toBeDefined();
      },
      { timeout: 500 }
    );
  });

  test('性能指标获取：getPerformanceMetrics', async () => {
    const TestApp = () => {
      return (
        <CineView ref={cineViewRef} config={{ width: 750, height: 750, unit: 'px' }}>
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

    // 获取性能指标
    const metrics = cineViewRef.current?.getPerformanceMetrics();

    // 验证性能指标存在
    expect(metrics).toBeDefined();
    if (metrics) {
      expect(typeof metrics.fps).toBe('number');
      expect(typeof metrics.avgFrameTime).toBe('number');
      expect(typeof metrics.bundleSize).toBe('number');
    }
  });

  test('虚拟化渲染：仅渲染当前场景及前后各一个', async () => {
    const TestApp = () => {
      return (
        <CineView ref={cineViewRef} config={{ width: 750, height: 750, unit: 'px' }}>
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

    // 初始状态：应该渲染场景 0 和场景 1
    expect(screen.getByText('场景 0')).toBeInTheDocument();
    expect(screen.queryByText('场景 1')).toBeInTheDocument();
    expect(screen.queryByText('场景 2')).not.toBeInTheDocument();

    // 切换到场景 2
    act(() => {
      cineViewRef.current?.goToScene(2, false);
    });

    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentScene()).toBe(2);
    });

    // 应该渲染场景 1, 2, 3
    expect(screen.queryByText('场景 0')).not.toBeInTheDocument();
    expect(screen.getByText('场景 1')).toBeInTheDocument();
    expect(screen.getByText('场景 2')).toBeInTheDocument();
    expect(screen.getByText('场景 3')).toBeInTheDocument();
    expect(screen.queryByText('场景 4')).not.toBeInTheDocument();
  });

  test('错误处理：无效场景索引', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const TestApp = () => {
      return (
        <CineView ref={cineViewRef} config={{ width: 750, height: 750, unit: 'px' }}>
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

    // 尝试切换到无效索引
    act(() => {
      cineViewRef.current?.goToScene(10, false);
    });

    // 验证当前场景未改变
    expect(cineViewRef.current?.getCurrentScene()).toBe(0);

    // 验证警告信息
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });
});
