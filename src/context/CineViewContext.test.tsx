/**
 * CineViewContext test (px2vw single-ruler model)
 *
 * Conversion engine uses width only: `scale = viewportWidth / designSize`, `convert(size) = size * scale`.
 * `viewportHeight` does not affect `scale` (see CineViewContext.tsx header).
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { CineViewProvider, useCineViewContext } from './CineViewContext';

describe('CineViewContext', () => {
  describe('CineViewProvider', () => {
    it('should default to designSize 750 when no props are passed (scale reflects it)', (): void => {
      // Context no longer exposes designSize; default 750 is verified indirectly via scale = viewportWidth/750.
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 750,
      });

      const { result } = renderHook(() => useCineViewContext(), {
        wrapper: ({ children }) => <CineViewProvider>{children}</CineViewProvider>,
      });

      // Default designSize=750, viewport=750 → scale=1
      expect(result.current!.scale).toBe(1);
    });

    it('should honor a custom designSize (scale = viewport / designSize)', (): void => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 960,
      });

      const { result } = renderHook(() => useCineViewContext(), {
        wrapper: ({ children }) => (
          <CineViewProvider designSize={1920}>{children}</CineViewProvider>
        ),
      });

      // scale = 960 / 1920 = 0.5
      expect(result.current!.scale).toBe(0.5);
    });

    it('should expose the resolved design-pixel length as --cineview-unit', async (): Promise<void> => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 960,
      });

      const { container } = render(
        <CineViewProvider designSize={1920}>
          <div />
        </CineViewProvider>
      );
      const responsiveRoot = container.querySelector<HTMLElement>('.cineview-responsive-container');

      expect(responsiveRoot?.style.getPropertyValue('--cineview-unit')).toBe('0.5px');

      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 480,
      });
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      await waitFor(() => {
        expect(responsiveRoot?.style.getPropertyValue('--cineview-unit')).toBe('0.25px');
      });
    });

    it('should calculate scale from viewport width only (px2vw)', (): void => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 750,
      });

      const TestComponent = (): React.JSX.Element => {
        const context = useCineViewContext();
        return <div data-testid="scale">{context?.scale}</div>;
      };

      render(
        <CineViewProvider designSize={750}>
          <TestComponent />
        </CineViewProvider>
      );

      // scale = 750 / 750 = 1
      expect(screen.getByTestId('scale')).toHaveTextContent('1');
    });

    it('should scale down when viewport is narrower than design size', (): void => {
      const TestComponent = (): React.JSX.Element => {
        const context = useCineViewContext();
        return <div data-testid="scale">{context?.scale}</div>;
      };

      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <CineViewProvider designSize={750}>
          <TestComponent />
        </CineViewProvider>
      );

      const scale = screen.getByTestId('scale').textContent;
      expect(parseFloat(scale || '0')).toBe(0.5);
    });

    it('should NOT let viewportHeight affect scale', (): void => {
      // px2vw uses width only: even when viewport height differs drastically, scale is determined solely by width.
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
        wrapper: ({ children }) => <CineViewProvider designSize={750}>{children}</CineViewProvider>,
      });

      // scale = 750 / 750 = 1, unaffected by viewportHeight(100).
      expect(result.current!.scale).toBe(1);
    });

    it('should recompute scale on window resize (width-driven)', async (): Promise<void> => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 750,
      });

      const TestComponent = (): React.JSX.Element => {
        const context = useCineViewContext();
        return <div data-testid="scale">{context?.scale}</div>;
      };

      render(
        <CineViewProvider designSize={750}>
          <TestComponent />
        </CineViewProvider>
      );

      expect(screen.getByTestId('scale')).toHaveTextContent('1');

      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1500,
      });
      // Height change should not affect scale (width-only) — dispatch both to verify only width takes effect.
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

      const TestComponent = (): React.JSX.Element => {
        const context = useCineViewContext();
        const converted = context?.convert(100);
        return <div data-testid="converted">{converted}</div>;
      };

      render(
        <CineViewProvider designSize={750}>
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
      const wrapper = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
        <CineViewProvider designSize={750}>{children}</CineViewProvider>
      );

      const { result } = renderHook(() => useCineViewContext(), { wrapper });

      expect(result.current).not.toBeNull();
      // Context exposes only conversion kernel { scale, convert }; designSize is provider's private input.
      expect(typeof result.current?.scale).toBe('number');
      expect(typeof result.current?.convert).toBe('function');
    });
  });
});

describe('SSR Support', () => {
  it('should not crash when window is present (SSR-safe guard)', (): void => {
    const TestComponent = (): React.JSX.Element => {
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
      wrapper: ({ children }) => <CineViewProvider designSize={750}>{children}</CineViewProvider>,
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

  it('should compute scale = viewportWidth / designSize for varied design sizes', (): void => {
    const designSizes = [375, 750, 1920];

    designSizes.forEach((designSize) => {
      const { result } = renderHook(() => useCineViewContext(), {
        wrapper: ({ children }) => (
          <CineViewProvider designSize={designSize}>{children}</CineViewProvider>
        ),
      });

      // scale = window.innerWidth / designSize (jsdom innerWidth is the viewport)
      expect(result.current!.scale).toBe(window.innerWidth / designSize);
    });
  });

  it('should memoize convert function across rerenders without prop change', (): void => {
    const { result, rerender } = renderHook(() => useCineViewContext(), {
      wrapper: ({ children }) => <CineViewProvider designSize={750}>{children}</CineViewProvider>,
    });

    const firstConvert = result.current!.convert;
    rerender();
    expect(result.current!.convert).toBe(firstConvert);
  });

  it('should cleanup resize listener on unmount', (): void => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useCineViewContext(), {
      wrapper: ({ children }) => <CineViewProvider designSize={750}>{children}</CineViewProvider>,
    });

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    removeEventListenerSpy.mockRestore();
  });

  it('should add resize listener in browser environment', (): void => {
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

    const { result } = renderHook(() => useCineViewContext(), {
      wrapper: ({ children }) => <CineViewProvider designSize={750}>{children}</CineViewProvider>,
    });

    expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(result.current).not.toBeNull();

    addEventListenerSpy.mockRestore();
  });
});
