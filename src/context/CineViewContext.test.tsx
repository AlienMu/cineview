/**
 * CineViewContext 测试（px2vw 单尺子模型）
 *
 * 换算内核只认宽度：`scale = viewportWidth / designWidth`，`convert(size) = size * scale`。
 * `designHeight` / `viewportHeight` 不参与 `scale`（见 CineViewContext.tsx 头注）。
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { CineViewProvider, useCineViewContext } from './CineViewContext';

describe('CineViewContext', () => {
  describe('CineViewProvider', () => {
    it('should default to designWidth 750 when no props are passed (scale reflects it)', (): void => {
      // context 不再暴露 designWidth；默认 750 通过 scale = viewportWidth/750 间接验证。
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 750,
      });

      const { result } = renderHook(() => useCineViewContext(), {
        wrapper: ({ children }) => <CineViewProvider>{children}</CineViewProvider>,
      });

      // 默认 designWidth=750，viewport=750 → scale=1
      expect(result.current!.scale).toBe(1);
    });

    it('should honor a custom designWidth (scale = viewport / designWidth)', (): void => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 960,
      });

      const { result } = renderHook(() => useCineViewContext(), {
        wrapper: ({ children }) => (
          <CineViewProvider designWidth={1920} designHeight={1080}>
            {children}
          </CineViewProvider>
        ),
      });

      // scale = 960 / 1920 = 0.5；designHeight 传入但不影响换算
      expect(result.current!.scale).toBe(0.5);
    });

    it('should calculate scale from viewport width only (px2vw)', (): void => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 750,
      });

      const TestComponent = (): JSX.Element => {
        const context = useCineViewContext();
        return <div data-testid="scale">{context?.scale}</div>;
      };

      render(
        <CineViewProvider designWidth={750} designHeight={750}>
          <TestComponent />
        </CineViewProvider>
      );

      // scale = 750 / 750 = 1
      expect(screen.getByTestId('scale')).toHaveTextContent('1');
    });

    it('should scale down when viewport is narrower than design width', (): void => {
      const TestComponent = (): JSX.Element => {
        const context = useCineViewContext();
        return <div data-testid="scale">{context?.scale}</div>;
      };

      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <CineViewProvider designWidth={750} designHeight={750}>
          <TestComponent />
        </CineViewProvider>
      );

      const scale = screen.getByTestId('scale').textContent;
      expect(parseFloat(scale || '0')).toBe(0.5);
    });

    it('should NOT let designHeight/viewportHeight affect scale', (): void => {
      // px2vw 认宽不认高：即使设计高与视口高比例悬殊，scale 只由宽度决定。
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 750,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 100,
      });

      const { result } = renderHook(() => useCineViewContext(), {
        wrapper: ({ children }) => (
          <CineViewProvider designWidth={750} designHeight={9999}>
            {children}
          </CineViewProvider>
        ),
      });

      // scale = 750 / 750 = 1，与 designHeight(9999) / viewportHeight(100) 无关。
      expect(result.current!.scale).toBe(1);
    });

    it('should recompute scale on window resize (width-driven)', async (): Promise<void> => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 750,
      });

      const TestComponent = (): JSX.Element => {
        const context = useCineViewContext();
        return <div data-testid="scale">{context?.scale}</div>;
      };

      render(
        <CineViewProvider designWidth={750} designHeight={750}>
          <TestComponent />
        </CineViewProvider>
      );

      expect(screen.getByTestId('scale')).toHaveTextContent('1');

      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1500,
      });
      // 高度变化不应影响 scale（认宽不认高）——一并派发验证只有宽度生效。
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 768,
      });
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      // The resize handler is debounced (150ms); poll until the debounced commit
      // flushes to the DOM rather than asserting after a fixed delay.
      await waitFor(() => {
        // scale = 1500 / 750 = 2
        expect(screen.getByTestId('scale')).toHaveTextContent('2');
      });
    });

    it('should provide a convert function (single scale)', (): void => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 750,
      });

      const TestComponent = (): JSX.Element => {
        const context = useCineViewContext();
        const converted = context?.convert(100);
        return <div data-testid="converted">{converted}</div>;
      };

      render(
        <CineViewProvider designWidth={750} designHeight={750}>
          <TestComponent />
        </CineViewProvider>
      );

      // scale = 750 / 750 = 1, 100 * 1 = 100
      expect(screen.getByTestId('converted')).toHaveTextContent('100');
    });
  });

  describe('useCineViewContext', () => {
    it('should return null when used outside CineViewProvider', (): void => {
      const { result } = renderHook(() => useCineViewContext());
      expect(result.current).toBeNull();
    });

    it('should return context value when used inside CineViewProvider', (): void => {
      const wrapper = ({ children }: { children: React.ReactNode }): JSX.Element => (
        <CineViewProvider designWidth={750} designHeight={750}>
          {children}
        </CineViewProvider>
      );

      const { result } = renderHook(() => useCineViewContext(), { wrapper });

      expect(result.current).not.toBeNull();
      // context 只暴露换算内核 { scale, convert }；designWidth 是 provider 私有输入。
      expect(typeof result.current?.scale).toBe('number');
      expect(typeof result.current?.convert).toBe('function');
    });
  });
});

describe('SSR Support', () => {
  it('should not crash when window is present (SSR-safe guard)', (): void => {
    const TestComponent = (): JSX.Element => {
      const context = useCineViewContext();
      return <div data-testid="scale">{context?.scale}</div>;
    };

    render(
      <CineViewProvider>
        <TestComponent />
      </CineViewProvider>
    );

    expect(screen.getByTestId('scale')).toBeInTheDocument();
  });
});

describe('Scale recalculation', () => {
  it('should recalculate scale when viewport width changes', async (): Promise<void> => {
    const { result } = renderHook(() => useCineViewContext(), {
      wrapper: ({ children }) => (
        <CineViewProvider designWidth={750} designHeight={750}>
          {children}
        </CineViewProvider>
      ),
    });

    const initialScale = result.current!.scale;

    Object.defineProperty(window, 'innerWidth', {
      value: 1500,
      writable: true,
      configurable: true,
    });
    window.dispatchEvent(new Event('resize'));

    await waitFor(
      () => {
        expect(result.current!.scale).not.toBe(initialScale);
      },
      { timeout: 300 }
    );

    expect(result.current!.scale).toBe(1500 / 750);
  });

  it('should compute scale = viewportWidth / designWidth for varied design widths', (): void => {
    const designWidths = [375, 750, 1920];

    designWidths.forEach((designWidth) => {
      const { result } = renderHook(() => useCineViewContext(), {
        wrapper: ({ children }) => (
          <CineViewProvider designWidth={designWidth} designHeight={designWidth}>
            {children}
          </CineViewProvider>
        ),
      });

      // scale = window.innerWidth / designWidth (jsdom innerWidth is the viewport)
      expect(result.current!.scale).toBe(window.innerWidth / designWidth);
    });
  });

  it('should memoize convert function across rerenders without prop change', (): void => {
    const { result, rerender } = renderHook(() => useCineViewContext(), {
      wrapper: ({ children }) => (
        <CineViewProvider designWidth={750} designHeight={750}>
          {children}
        </CineViewProvider>
      ),
    });

    const firstConvert = result.current!.convert;
    rerender();
    expect(result.current!.convert).toBe(firstConvert);
  });

  it('should cleanup resize listener on unmount', (): void => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useCineViewContext(), {
      wrapper: ({ children }) => (
        <CineViewProvider designWidth={750} designHeight={750}>
          {children}
        </CineViewProvider>
      ),
    });

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    removeEventListenerSpy.mockRestore();
  });

  it('should add resize listener in browser environment', (): void => {
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

    const { result } = renderHook(() => useCineViewContext(), {
      wrapper: ({ children }) => (
        <CineViewProvider designWidth={750} designHeight={750}>
          {children}
        </CineViewProvider>
      ),
    });

    expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(result.current).not.toBeNull();

    addEventListenerSpy.mockRestore();
  });
});
