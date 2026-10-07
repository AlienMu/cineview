import { render, renderHook } from '@testing-library/react';
import { CineviewProvider, useCineviewContext } from './CineviewContext';

describe('Cineview width conversion', () => {
  it.each([
    [750, 375, 0.5],
    [750, 750, 1],
    [500, 500, 1],
    [1920, 1440, 0.75],
  ])(
    'converts a %s design using the measured content width %s',
    (designSize, viewportWidth, scale) => {
      const { result } = renderHook(() => useCineviewContext(), {
        wrapper: ({ children }) => (
          <CineviewProvider designSize={designSize} viewportWidth={viewportWidth}>
            {children}
          </CineviewProvider>
        ),
      });
      expect(result.current?.scale).toBe(scale);
      expect(result.current?.convert(100)).toBe(100 * scale);
    }
  );

  it('uses parent content width even when the browser is wider', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 1920,
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useCineviewContext(), {
      wrapper: ({ children }) => (
        <CineviewProvider designSize={750} viewportWidth={360}>
          {children}
        </CineviewProvider>
      ),
    });
    expect(result.current?.convert(100)).toBe(48);
  });

  it('keeps CSS conversion and the resize publication in sync', () => {
    const { container, rerender } = render(
      <CineviewProvider designSize={750} viewportWidth={375}>
        <div />
      </CineviewProvider>
    );
    const root = container.querySelector<HTMLElement>('.cineview-responsive-container')!;
    expect(root.style.getPropertyValue('--cineview-unit')).toBe('0.5px');
    rerender(
      <CineviewProvider designSize={750} viewportWidth={600}>
        <div />
      </CineviewProvider>
    );
    expect(root.style.getPropertyValue('--cineview-unit')).toBe('0.8px');
  });

  it('centers and caps the stage without a minimum', () => {
    const { container } = render(
      <CineviewProvider designSize={500}>
        <div />
      </CineviewProvider>
    );
    const stage = container.querySelector<HTMLElement>('.cineview-stage')!;
    expect(stage.style.maxWidth).toBe('500px');
    expect(stage.style.marginInline).toBe('auto');
    expect(stage.style.width).toBe('100%');
    expect(container.firstElementChild).not.toHaveAttribute('tabindex');
  });

  it('provides reachable overflow for a minimum width', () => {
    const { container } = render(
      <CineviewProvider designSize={1920} minWidth={1440} viewportWidth={1440}>
        <div />
      </CineviewProvider>
    );
    const root = container.querySelector<HTMLElement>('.cineview-responsive-container')!;
    const stage = container.querySelector<HTMLElement>('.cineview-stage')!;
    expect(stage.style.minWidth).toBe('1440px');
    expect(stage.style.maxWidth).toBe('1920px');
    expect(root.style.overflowX).toBe('auto');
    expect(root.tabIndex).toBe(0);
    expect(root.style.getPropertyValue('--cineview-unit')).toBe('0.75px');
  });

  it.each([-1, 751, Infinity, NaN])(
    'ignores an invalid minimum %s instead of exceeding the cap',
    (minWidth) => {
      const { container } = render(
        <CineviewProvider designSize={750} minWidth={minWidth}>
          <div />
        </CineviewProvider>
      );
      expect(container.querySelector<HTMLElement>('.cineview-stage')!.style.minWidth).toBe('0');
    }
  );

  it('keeps the conversion identity stable when measured width is unchanged', () => {
    const { result, rerender } = renderHook(() => useCineviewContext(), {
      wrapper: ({ children }) => (
        <CineviewProvider designSize={750} viewportWidth={750}>
          {children}
        </CineviewProvider>
      ),
    });
    const previous = result.current;
    Object.defineProperty(window, 'innerWidth', {
      value: 2560,
      writable: true,
      configurable: true,
    });
    rerender();
    expect(result.current).toBe(previous);
    expect(result.current?.scale).toBe(1);
  });

  it('does not add a second resize listener', () => {
    const listener = jest.spyOn(window, 'addEventListener');
    const { unmount } = render(
      <CineviewProvider viewportWidth={750}>
        <div />
      </CineviewProvider>
    );
    expect(listener.mock.calls.filter(([event]) => event === 'resize')).toHaveLength(0);
    unmount();
    listener.mockRestore();
  });

  it('returns null outside the provider', () => {
    const { result } = renderHook(() => useCineviewContext());
    expect(result.current).toBeNull();
  });
});
