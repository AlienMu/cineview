/**
 * CineViewContext 分支补充测试
 * 覆盖 useConvertSize 在 Provider 外的 fallback identity 路径（lines 185-198），
 * 含 NODE_ENV === 'development' 的 console.warn 分支与 inside-provider 分支。
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

    // identity: no conversion applied
    expect(result.current(123)).toBe(123);
    expect(result.current(0)).toBe(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('[CineView] useConvertSize must be used within');
  });

  it('returns an identity function WITHOUT warning when NODE_ENV is not development', () => {
    process.env.NODE_ENV = 'production';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useConvertSize());

    expect(result.current(42)).toBe(42);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns the context convertSize when used inside a provider', () => {
    // designSize 750, viewport 750 (jsdom default may vary) -> convertSize is the
    // real context fn (not identity). Assert it is the context function path, not
    // the fallback: warn must NOT fire and the result scales with viewport/design.
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    const wrapper = ({ children }: { children: React.ReactNode }): JSX.Element => (
      <CineViewProvider designSize={750}>{children}</CineViewProvider>
    );

    const { result } = renderHook(() => useConvertSize(), { wrapper });

    // convertSize(size, designSize=750, viewportWidth=375, 'px') => size * 0.5
    expect(result.current(100)).toBeCloseTo(50);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // 依赖同文件测试顺序：首个 dev 分支测试已消费模块级 once 旗标。
  it('keeps a stable identity-function reference and does not warn again on later mounts', () => {
    process.env.NODE_ENV = 'development';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const first = renderHook(() => useConvertSize());
    const firstRef = first.result.current;
    first.rerender();

    // 稳定身份：跨渲染不换引用（可安全放进依赖数组 / memo）。
    expect(first.result.current).toBe(firstRef);

    const second = renderHook(() => useConvertSize());
    expect(second.result.current).toBe(firstRef);

    // warn 只在模块生命周期内发一次；本文件首个测试已触发过。
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

    const wrapper = ({ children }: { children: React.ReactNode }): JSX.Element => (
      <CineViewProvider designSize={0}>{children}</CineViewProvider>
    );
    const { result } = renderHook(() => useConvertSize(), { wrapper });

    // scale = viewportWidth / FALLBACK(750) = 0.5，而非 375 / 0 = Infinity。
    expect(result.current(100)).toBeCloseTo(50);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain('[CineView] Invalid designSize');

    // 一次性旗标：再次挂载另一个非法值不再重复报错。
    const wrapperNegative = ({ children }: { children: React.ReactNode }): JSX.Element => (
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

    const wrapper = ({ children }: { children: React.ReactNode }): JSX.Element => (
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
      // resize 派发后应挂起一个 150ms 的 debounce 定时器。
      expect(jest.getTimerCount()).toBe(baselineTimerCount + 1);

      unmount();
      // 卸载即 cancel：在途定时器被清除，150ms 后不会再对已卸载组件 setState。
      expect(jest.getTimerCount()).toBe(baselineTimerCount);
    } finally {
      jest.useRealTimers();
    }
  });
});
