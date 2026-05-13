/**
 * useResponsive Hook 测试
 */

import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { useResponsive } from './useResponsive';

describe('useResponsive', () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    // 设置默认窗口尺寸
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 750,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 1334,
    });
  });

  afterEach(() => {
    // 恢复原始窗口尺寸
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
  });

  describe('初始化', () => {
    it('应该返回初始视口尺寸', () => {
      const { result } = renderHook(() => useResponsive());

      expect(result.current.viewportWidth).toBe(750);
      expect(result.current.viewportHeight).toBe(1334);
    });

    it('应该使用默认配置', () => {
      const { result } = renderHook(() => useResponsive());

      expect(result.current.scale).toBe(1); // 默认 unit 为 px，scale 为 1
    });

    it('应该使用自定义配置', () => {
      const { result } = renderHook(() => useResponsive({ width: 375, height: 375, unit: 'rem' }));

      expect(result.current.scale).toBe(750 / 375); // 750 / 375 = 2
    });
  });

  describe('换算比例计算', () => {
    it('unit 为 px 时，scale 应该为 1', () => {
      const { result } = renderHook(() => useResponsive({ width: 750, height: 750, unit: 'px' }));

      expect(result.current.scale).toBe(1);
    });

    it('unit 为 rem 时，应该正确计算 scale', () => {
      window.innerWidth = 375;

      const { result } = renderHook(() => useResponsive({ width: 750, height: 750, unit: 'rem' }));

      expect(result.current.scale).toBe(375 / 750); // 0.5
    });

    it('unit 为 vw 时，应该正确计算 scale', () => {
      window.innerWidth = 1920;

      const { result } = renderHook(() => useResponsive({ width: 750, height: 750, unit: 'vw' }));

      expect(result.current.scale).toBe(1920 / 750); // 2.56
    });
  });

  describe('设备类型判断', () => {
    it('viewportWidth < 768 时应该判断为 mobile', () => {
      window.innerWidth = 375;

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isMobile).toBe(true);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(false);
    });

    it('768 <= viewportWidth < 1024 时应该判断为 tablet', () => {
      window.innerWidth = 800;

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(true);
      expect(result.current.isDesktop).toBe(false);
    });

    it('viewportWidth >= 1024 时应该判断为 desktop', () => {
      window.innerWidth = 1920;

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(true);
    });
  });

  describe('窗口 resize 响应', () => {
    it('应该监听窗口 resize 事件', async () => {
      const { result } = renderHook(() => useResponsive({ debounceDelay: 50 }));

      expect(result.current.viewportWidth).toBe(750);

      // 触发 resize 事件
      act(() => {
        window.innerWidth = 375;
        window.innerHeight = 667;
        window.dispatchEvent(new Event('resize'));
      });

      // 等待防抖延迟
      await waitFor(
        () => {
          expect(result.current.viewportWidth).toBe(375);
          expect(result.current.viewportHeight).toBe(667);
        },
        { timeout: 200 }
      );
    });

    it('应该使用防抖处理 resize 事件', async () => {
      const { result } = renderHook(() => useResponsive({ debounceDelay: 100 }));

      // 快速触发多次 resize
      act(() => {
        window.innerWidth = 400;
        window.dispatchEvent(new Event('resize'));
      });

      act(() => {
        window.innerWidth = 500;
        window.dispatchEvent(new Event('resize'));
      });

      act(() => {
        window.innerWidth = 600;
        window.dispatchEvent(new Event('resize'));
      });

      // 等待防抖延迟
      await waitFor(
        () => {
          // 应该只更新最后一次的值
          expect(result.current.viewportWidth).toBe(600);
        },
        { timeout: 200 }
      );
    });

    it('resize 后应该重新计算 scale', async () => {
      const { result } = renderHook(() =>
        useResponsive({ width: 750, height: 750, unit: 'rem', debounceDelay: 50 })
      );

      expect(result.current.scale).toBe(750 / 750); // 1

      // 触发 resize
      act(() => {
        window.innerWidth = 375;
        window.dispatchEvent(new Event('resize'));
      });

      await waitFor(
        () => {
          expect(result.current.scale).toBe(375 / 750); // 0.5
        },
        { timeout: 200 }
      );
    });

    it('resize 后应该重新判断设备类型', async () => {
      window.innerWidth = 1920;

      const { result } = renderHook(() => useResponsive({ debounceDelay: 50 }));

      expect(result.current.isDesktop).toBe(true);

      // 触发 resize 到移动端尺寸
      act(() => {
        window.innerWidth = 375;
        window.dispatchEvent(new Event('resize'));
      });

      await waitFor(
        () => {
          expect(result.current.isMobile).toBe(true);
          expect(result.current.isDesktop).toBe(false);
        },
        { timeout: 200 }
      );
    });
  });

  describe('清理', () => {
    it('组件卸载时应该移除 resize 监听器', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useResponsive());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });
});
