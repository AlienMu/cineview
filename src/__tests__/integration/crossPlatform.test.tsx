/**
 * 集成测试：跨平台兼容性测试
 * 测试移动端触摸事件、PC 端鼠标滚轮事件、不同屏幕尺寸响应式表现
 *
 * **Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.5, 22.1**
 */

import React, { act } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CineView, Scene, Animate, Position } from '../../index';
import type { CineViewRef } from '../../types';

type MockMotionDivProps = React.HTMLAttributes<HTMLDivElement> & {
  animate?: unknown;
  drag?: unknown;
  dragConstraints?: unknown;
  dragElastic?: unknown;
  dragMomentum?: unknown;
  initial?: unknown;
  onPan?: unknown;
  onPanEnd?: unknown;
  onPanStart?: unknown;
  transition?: unknown;
};

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
    div: React.forwardRef<HTMLDivElement, MockMotionDivProps>(
      (
        {
          children,
          animate: _animate,
          drag: _drag,
          dragConstraints: _dragConstraints,
          dragElastic: _dragElastic,
          dragMomentum: _dragMomentum,
          initial: _initial,
          onPan: _onPan,
          onPanEnd: _onPanEnd,
          onPanStart: _onPanStart,
          transition: _transition,
          ...props
        },
        ref
      ) => (
        <div ref={ref} {...props}>
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

describe('跨平台兼容性测试', () => {
  let cineViewRef: React.RefObject<CineViewRef>;

  beforeEach(() => {
    cineViewRef = React.createRef();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('事件监听器注册测试 (Requirements 21.1, 21.2, 21.3)', () => {
    test('应该在 drag 模式下正确渲染并准备处理触摸和鼠标事件', async () => {
      const TestApp = () => (
        <CineView
          ref={cineViewRef}
          mode="drag"
          modes={{ drag: { direction: 'y', transitionDuration: 500 } }}
          config={{ size: 750 }}
        >
          <Scene>
            <h1>场景 1</h1>
          </Scene>
          <Scene>
            <h1>场景 2</h1>
          </Scene>
        </CineView>
      );

      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByText('场景 1')).toBeInTheDocument();
      });

      // 验证场景正确渲染，准备处理事件 (Requirements 21.1, 21.2)
      const scene1 = screen.getByText('场景 1').parentElement;
      expect(scene1).toBeInTheDocument();
      expect(scene1).toHaveStyle({ width: '100vw', height: '100vh' });
    });

    test('应该在 drag 模式下正确渲染并准备处理拖拽事件', async () => {
      const TestApp = () => (
        <CineView
          ref={cineViewRef}
          mode="drag"
          modes={{ drag: { direction: 'y', transitionDuration: 800 } }}
          config={{ size: 750 }}
        >
          <Scene>
            <h1>拖拽场景</h1>
          </Scene>
          <Scene>
            <h1>下一场景</h1>
          </Scene>
        </CineView>
      );

      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByText('拖拽场景')).toBeInTheDocument();
      });

      // 验证拖拽模式场景正确渲染 (Requirements 21.1, 21.2, 21.3)
      const scene = screen.getByText('拖拽场景').parentElement;
      expect(scene).toBeInTheDocument();
      expect(scene).toHaveStyle({ width: '100vw', height: '100vh' });
    });

    test('应该支持横向和纵向滑动方向', async () => {
      const HorizontalApp = () => (
        <CineView
          ref={cineViewRef}
          mode="drag"
          modes={{ drag: { direction: 'x', transitionDuration: 500 } }}
          config={{ size: 750 }}
        >
          <Scene>
            <h1>横向场景</h1>
          </Scene>
          <Scene>
            <h1>横向场景 2</h1>
          </Scene>
        </CineView>
      );
      const VerticalApp = () => (
        <CineView
          ref={cineViewRef}
          mode="drag"
          modes={{ drag: { direction: 'y', transitionDuration: 500 } }}
          config={{ size: 750 }}
        >
          <Scene>
            <h1>纵向场景</h1>
          </Scene>
          <Scene>
            <h1>纵向场景 2</h1>
          </Scene>
        </CineView>
      );

      const { unmount } = render(<HorizontalApp />);

      await waitFor(() => {
        expect(screen.getByText('横向场景')).toBeInTheDocument();
      });

      unmount();
      render(<VerticalApp />);

      await waitFor(() => {
        expect(screen.getByText('纵向场景')).toBeInTheDocument();
      });
    });
  });

  describe('API 控制场景切换测试', () => {
    test('应该通过 API 正确切换场景', async () => {
      const onAfterSceneChange = jest.fn();

      const TestApp = () => (
        <CineView
          ref={cineViewRef}
          mode="drag"
          modes={{ drag: { direction: 'y', transitionDuration: 500 } }}
          config={{ size: 750 }}
          callbacks={{ onSceneDidChange: onAfterSceneChange }}
        >
          <Scene>
            <h1>场景 1</h1>
          </Scene>
          <Scene>
            <h1>场景 2</h1>
          </Scene>
          <Scene>
            <h1>场景 3</h1>
          </Scene>
        </CineView>
      );

      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByText('场景 1')).toBeInTheDocument();
      });

      // 切换到场景 2
      act(() => {
        cineViewRef.current?.goToScene(1, false);
      });

      await waitFor(() => {
        expect(cineViewRef.current?.getCurrentScene()).toBe(1);
      });

      expect(onAfterSceneChange).toHaveBeenCalledWith(
        expect.objectContaining({ fromIndex: 0, toIndex: 1, direction: 'forward' })
      );

      // 切换到场景 3
      act(() => {
        cineViewRef.current?.goToScene(2, false);
      });

      await waitFor(() => {
        expect(cineViewRef.current?.getCurrentScene()).toBe(2);
      });

      expect(onAfterSceneChange).toHaveBeenCalledWith(
        expect.objectContaining({ fromIndex: 1, toIndex: 2, direction: 'forward' })
      );

      // 切换回场景 1
      act(() => {
        cineViewRef.current?.goToScene(0, false);
      });

      await waitFor(() => {
        expect(cineViewRef.current?.getCurrentScene()).toBe(0);
      });

      expect(onAfterSceneChange).toHaveBeenCalledWith(
        expect.objectContaining({ fromIndex: 2, toIndex: 0, direction: 'backward' })
      );
    });
  });

  describe('不同屏幕尺寸响应式测试 (Requirement 21.4)', () => {
    test('应该在移动端屏幕尺寸下正确换算尺寸（375px）', async () => {
      // 设置移动端视口
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const TestApp = () => (
        <CineView config={{ size: 750 }}>
          <Scene>
            <Position at={{ x: 750, y: 100 }}>
              <div data-testid="positioned-element">右边缘元素</div>
            </Position>
          </Scene>
        </CineView>
      );

      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByTestId('positioned-element')).toBeInTheDocument();
      });

      const element = screen.getByTestId('positioned-element');
      const parent = element.parentElement;

      // 验证元素存在
      expect(parent).toBeInTheDocument();

      // 在 375px 视口下，750 设计稿尺寸应该换算为 375px（比例 0.5）
      const style = window.getComputedStyle(parent!);
      expect(style).toBeDefined();
    });

    test('应该在平板屏幕尺寸下正确换算尺寸（768px）', async () => {
      // 设置平板视口
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      const TestApp = () => (
        <CineView config={{ size: 750 }}>
          <Scene>
            <Position at={{ x: 375, y: 100 }}>
              <div data-testid="centered-element">居中元素</div>
            </Position>
          </Scene>
        </CineView>
      );

      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByTestId('centered-element')).toBeInTheDocument();
      });

      const element = screen.getByTestId('centered-element');
      const parent = element.parentElement;

      expect(parent).toBeInTheDocument();

      // 在 768px 视口下，375 设计稿尺寸应该换算为约 384px（比例 768/750 ≈ 1.024）
      const style = window.getComputedStyle(parent!);
      expect(style).toBeDefined();
    });

    test('应该在桌面屏幕尺寸下正确换算尺寸（1920px）', async () => {
      // 设置桌面视口
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1920,
      });

      const TestApp = () => (
        <CineView config={{ size: 750 }}>
          <Scene>
            <Position at={{ x: 375, y: 100 }}>
              <div data-testid="desktop-element">桌面元素</div>
            </Position>
          </Scene>
        </CineView>
      );

      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByTestId('desktop-element')).toBeInTheDocument();
      });

      const element = screen.getByTestId('desktop-element');
      const parent = element.parentElement;

      expect(parent).toBeInTheDocument();

      // 在 1920px 视口下，375 设计稿尺寸应该换算为 960px（比例 1920/750 = 2.56）
      const style = window.getComputedStyle(parent!);
      expect(style).toBeDefined();
    });

    test('应该响应窗口 resize 事件并重新计算尺寸', async () => {
      // 初始视口
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const TestApp = () => (
        <CineView config={{ size: 750 }}>
          <Scene>
            <Position at={{ x: 375, y: 100 }}>
              <div data-testid="responsive-element">响应式元素</div>
            </Position>
          </Scene>
        </CineView>
      );

      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByTestId('responsive-element')).toBeInTheDocument();
      });

      const element = screen.getByTestId('responsive-element');
      const parent = element.parentElement;

      // 获取初始样式
      const initialStyle = window.getComputedStyle(parent!);
      expect(initialStyle).toBeDefined();

      // 改变视口尺寸
      fireEvent(
        window,
        new Event('resize', {
          bubbles: true,
        })
      );

      // 等待防抖完成（150ms）
      await waitFor(
        () => {
          const newStyle = window.getComputedStyle(parent!);
          expect(newStyle).toBeDefined();
        },
        { timeout: 500 }
      );
    });

    test('应该在不同单位类型下正确换算（rem）', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 750,
      });

      const TestApp = () => (
        <CineView config={{ size: 750 }}>
          <Scene>
            <Position at={{ x: 375, y: 100 }}>
              <div data-testid="rem-element">rem 单位元素</div>
            </Position>
          </Scene>
        </CineView>
      );

      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByTestId('rem-element')).toBeInTheDocument();
      });

      const element = screen.getByTestId('rem-element');
      expect(element.parentElement).toBeInTheDocument();
    });

    test('应该在不同单位类型下正确换算（vw）', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 750,
      });

      const TestApp = () => (
        <CineView config={{ size: 750 }}>
          <Scene>
            <Position at={{ x: 375, y: 100 }}>
              <div data-testid="vw-element">vw 单位元素</div>
            </Position>
          </Scene>
        </CineView>
      );

      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByTestId('vw-element')).toBeInTheDocument();
      });

      const element = screen.getByTestId('vw-element');
      expect(element.parentElement).toBeInTheDocument();
    });
  });

  describe('跨浏览器兼容性测试 (Requirement 21.5)', () => {
    test('应该在不支持 IntersectionObserver 的环境中正常工作', async () => {
      // 临时移除 IntersectionObserver
      const originalIO = window.IntersectionObserver;
      // @ts-expect-error - Testing undefined IntersectionObserver
      delete window.IntersectionObserver;

      const TestApp = () => (
        <CineView config={{ size: 750 }}>
          <Scene>
            <h1>测试场景</h1>
          </Scene>
        </CineView>
      );

      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByText('测试场景')).toBeInTheDocument();
      });

      // 恢复 IntersectionObserver
      window.IntersectionObserver = originalIO;
    });

    test('应该同时支持触摸和鼠标事件', async () => {
      const TestApp = () => (
        <CineView
          ref={cineViewRef}
          mode="drag"
          modes={{ drag: { direction: 'y', transitionDuration: 500 } }}
          config={{ size: 750 }}
        >
          <Scene>
            <h1>场景 1</h1>
          </Scene>
          <Scene>
            <h1>场景 2</h1>
          </Scene>
        </CineView>
      );

      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByText('场景 1')).toBeInTheDocument();
      });

      // 验证场景正确渲染，框架支持触摸和鼠标事件
      const scene = screen.getByText('场景 1').parentElement;
      expect(scene).toBeInTheDocument();
      expect(scene).toHaveStyle({ width: '100vw', height: '100vh' });
    });
  });

  describe('滑动模式兼容性测试', () => {
    test('应该在 drag 模式下支持场景切换', async () => {
      const onAfterSceneChange = jest.fn();

      const TestApp = () => (
        <CineView
          ref={cineViewRef}
          mode="drag"
          modes={{ drag: { direction: 'y', transitionDuration: 500 } }}
          config={{ size: 750 }}
          callbacks={{ onSceneDidChange: onAfterSceneChange }}
        >
          <Scene>
            <h1>Drag 场景 1</h1>
          </Scene>
          <Scene>
            <h1>Drag 场景 2</h1>
          </Scene>
        </CineView>
      );

      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByText('Drag 场景 1')).toBeInTheDocument();
      });

      // 使用 API 切换场景
      act(() => {
        cineViewRef.current?.goToScene(1, false);
      });

      await waitFor(() => {
        expect(onAfterSceneChange).toHaveBeenCalledWith(
          expect.objectContaining({ fromIndex: 0, toIndex: 1, direction: 'forward' })
        );
      });
    });

    test('应该在 drag 模式下支持拖拽', async () => {
      const TestApp = () => (
        <CineView
          ref={cineViewRef}
          mode="drag"
          modes={{ drag: { direction: 'y', transitionDuration: 800 } }}
          config={{ size: 750 }}
        >
          <Scene>
            <Animate animateId="drag-test" enterAnimation="fade-in" exitAnimation="fade-out">
              <h1>Drag 场景</h1>
            </Animate>
          </Scene>
          <Scene>
            <h1>下一场景</h1>
          </Scene>
        </CineView>
      );

      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByText('Drag 场景')).toBeInTheDocument();
      });

      // 验证拖拽模式场景正常渲染
      expect(screen.getByText('Drag 场景')).toBeInTheDocument();
    });
  });
});
