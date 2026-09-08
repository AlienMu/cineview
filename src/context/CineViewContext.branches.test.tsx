/**
 * CineViewContext branch coverage test
 * Covers useConvertSize fallback identity path outside Provider (lines 185-198),
 * including NODE_ENV === 'development' console.warn branch and inside-provider branch.
 */

import { render, renderHook } from '@testing-library/react';
import React from 'react';
import { CineViewProvider, useConvertSize } from './CineViewContext';

function setInnerWidth(value: number): void {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value,
  });
}

describe('useConvertSize fallback (outside provider)', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('returns an identity function and warns in development when used outside a provider', () => {
    process.env.NODE_ENV = 'development';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useConvertSize());

    expect(result.current(123)).toBe(123);
    expect(result.current(0)).toBe(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0].join(' ')).toContain(
      '[CineView] useConvertSize must be used within'
    );
  });

  it('returns an identity function WITHOUT warning when NODE_ENV is not development', () => {
    process.env.NODE_ENV = 'production';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useConvertSize());

    expect(result.current(42)).toBe(42);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns the context convertSize when used inside a provider', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    const wrapper = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
      <CineViewProvider designSize={750}>{children}</CineViewProvider>
    );

    const { result } = renderHook(() => useConvertSize(), { wrapper });

    expect(result.current(100)).toBeCloseTo(50);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('keeps a stable identity-function reference and does not warn again on later mounts', () => {
    process.env.NODE_ENV = 'development';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const first = renderHook(() => useConvertSize());
    const firstRef = first.result.current;
    first.rerender();

    expect(first.result.current).toBe(firstRef);

    const second = renderHook(() => useConvertSize());
    expect(second.result.current).toBe(firstRef);

    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('CineViewProvider designSize guard', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('falls back to 750 and console.errors once (dev) when designSize is not a positive finite number', () => {
    process.env.NODE_ENV = 'development';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    setInnerWidth(375);

    const wrapper = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
      <CineViewProvider designSize={0}>{children}</CineViewProvider>
    );
    const { result } = renderHook(() => useConvertSize(), { wrapper });

    expect(result.current(100)).toBeCloseTo(50);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0].join(' ')).toContain('[CineView] Invalid designSize');

    const wrapperNegative = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
      <CineViewProvider designSize={-5}>{children}</CineViewProvider>
    );
    const second = renderHook(() => useConvertSize(), { wrapper: wrapperNegative });
    expect(second.result.current(100)).toBeCloseTo(50);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to 750 for non-finite designSize without erroring outside development', () => {
    process.env.NODE_ENV = 'production';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    setInnerWidth(375);

    const wrapper = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
      <CineViewProvider designSize={Number.NaN}>{children}</CineViewProvider>
    );
    const { result } = renderHook(() => useConvertSize(), { wrapper });

    expect(result.current(100)).toBeCloseTo(50);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('CineViewProvider resize debounce cleanup', () => {
  it('cancels the pending debounced resize commit when unmounted mid-debounce', () => {
    jest.useFakeTimers();
    try {
      const { unmount } = render(
        <CineViewProvider designSize={750}>
          <div />
        </CineViewProvider>
      );

      const baselineTimerCount = jest.getTimerCount();
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      expect(jest.getTimerCount()).toBe(baselineTimerCount + 1);

      unmount();

      expect(jest.getTimerCount()).toBe(baselineTimerCount);
    } finally {
      jest.useRealTimers();
    }
  });
});
