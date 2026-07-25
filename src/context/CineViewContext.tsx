/**
 * CineView Context
 * 提供全局响应式尺寸换算上下文。
 *
 * 换算模型：px2vw 单尺子（认宽不认高）。设计稿只有一个尺寸基准 `size`（设计 px），
 * 整张画布锁定 `scale = viewportWidth / size` 等比缩放——横向 1px 与纵向 1px 乘
 * 同一个 `scale`，正方形永远是正方形，圆永远是圆，绝不形变。高度方向超出的部分
 * 交给自然文档流 / 滚动延展（与 scroll 模式天然契合）。
 *
 * Context 只暴露换算内核 `{ scale, convert }`；Provider 根 DOM 同步输出长度型
 * `--cineview-unit: ${scale}px` 供外部 CSS 消费。不存在独立的高度基准。scroll takeover
 * 的时间预算独立按 `1ms = 1px` 结算，绝对场景跨度回退 DOM 实测；二者都不创建第二把
 * 设计尺子。故 provider 只接收 `designSize`，只跟踪 `viewportWidth`。
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { debounce } from '../utils/debounce';

export interface CineViewContextValue {
  /** px2vw 单尺子比例：`viewportWidth / size`。仅 useAnimateScroll 的 gate margin 换算读它。 */
  scale: number;
  /** px2vw 单尺子换算：设计 px → 物理 px（`size * scale`）。所有长度量共用。 */
  convert: (size: number) => number;
}

const CineViewContext = createContext<CineViewContextValue | null>(null);

// Export the context for testing purposes
export { CineViewContext };

export interface CineViewProviderProps {
  /** 设计稿尺寸基准（设计 px）。全站唯一换算尺子：`scale = viewportWidth / designSize`。 */
  designSize?: number;
  children: React.ReactNode;
}

export const CineViewProvider: React.FC<CineViewProviderProps> = ({ designSize, children }) => {
  const resolvedDesignSize = designSize ?? 750;
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 750
  );

  // px2vw 单尺子：只认宽度。不存在独立高度基准。
  const scale = useMemo(
    () => viewportWidth / resolvedDesignSize,
    [viewportWidth, resolvedDesignSize]
  );
  const convert = useCallback(
    (size: number): number => {
      return size * scale;
    },
    [scale]
  );

  // 处理窗口 resize 事件：只跟踪宽度（换算唯一输入）。
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = debounce(() => {
      setViewportWidth(window.innerWidth);
    }, 150);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const contextValue = useMemo<CineViewContextValue>(
    () => ({
      scale,
      convert,
    }),
    [scale, convert]
  );
  const responsiveStyle = useMemo(
    () =>
      ({
        '--cineview-unit': `${scale}px`,
      }) as React.CSSProperties,
    [scale]
  );

  return (
    <CineViewContext.Provider value={contextValue}>
      <div className="cineview-responsive-container" style={responsiveStyle}>
        {children}
      </div>
    </CineViewContext.Provider>
  );
};

/**
 * 使用 CineView 上下文
 */
export const useCineViewContext = (): CineViewContextValue | null => {
  const context = useContext(CineViewContext);
  return context;
};

/**
 * 使用尺寸换算函数
 * 便捷 hook，用于在组件中直接获取 convert 函数（px2vw 单尺子）。
 */
export const useConvertSize = (): ((size: number) => number) => {
  const context = useCineViewContext();

  if (!context) {
    // 如果不在 CineView 内部，返回一个不做换算的函数
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[CineView] useConvertSize must be used within a CineView component. ' +
          'Returning identity function (no conversion).'
      );
    }
    return (size: number) => size;
  }

  return context.convert;
};
