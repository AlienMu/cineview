/**
 * CineViewContext 分支补充测试
 * 覆盖 useConvertSize 在 Provider 外的 fallback identity 路径（lines 185-198），
 * 含 NODE_ENV === 'development' 的 console.warn 分支与 inside-provider 分支。
 */

import { renderHook } from '@testing-library/react';
import React from 'react';
import { CineViewProvider, useConvertSize } from './CineViewContext';

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
});
