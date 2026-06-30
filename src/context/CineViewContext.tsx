/**
 * CineView Context
 * 提供全局响应式尺寸换算上下文。
 *
 * 换算模型：px2vw 单尺子（认宽不认高）。设计稿只有一个单位（设计 px），
 * 故整张画布锁定 `scale = viewportWidth / designWidth` 等比缩放——横向 1px 与
 * 纵向 1px 乘同一个 `scale`，正方形永远是正方形，圆永远是圆，绝不形变。
 * 高度方向超出的部分交给自然文档流 / 滚动延展（与 scroll 模式天然契合）。
 *
 * 本上下文只暴露换算内核 `{ scale, convert }`。设计高度 / 视口高度不参与换算：
 * scroll 场景「数字长度 → 滚动预算」换算走 `config.height`（属视口-extent 语义，
 * 由 directScrollHelpers.resolveTakeoverSceneSpan 直接消费 viewport 尺寸，不经过本
 * 上下文）。故 provider 只接收 `designWidth`，只跟踪 `viewportWidth`。
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { debounce } from '../utils/debounce';

export interface CineViewContextValue {
  /** px2vw 单尺子比例：`viewportWidth / designWidth`。仅 useAnimateScroll 的 gate margin 换算读它。 */
  scale: number;
  /** px2vw 单尺子换算：设计 px → 物理 px（`size * scale`）。所有长度量共用。 */
  convert: (size: number) => number;
}

const CineViewContext = createContext<CineViewContextValue | null>(null);

// Export the context for testing purposes
export { CineViewContext };

export interface CineViewProviderProps {
  designWidth?: number;
  /**
   * 设计画布高度。不参与 px2vw 换算（单尺子只认宽度），provider 层不消费；
   * 保留在 props 上仅为与 `config.height` 语义对齐 / 向后兼容调用点。
   */
  designHeight?: number;
  children: React.ReactNode;
}

export const CineViewProvider: React.FC<CineViewProviderProps> = ({ designWidth, children }) => {
  const resolvedDesignWidth = designWidth ?? 750;
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 750
  );

  // px2vw 单尺子：只认宽度。设计高度 / 视口高度不参与换算。
  const scale = useMemo(
    () => viewportWidth / resolvedDesignWidth,
    [viewportWidth, resolvedDesignWidth]
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

  return (
    <CineViewContext.Provider value={contextValue}>
      <div className="cineview-responsive-container">{children}</div>
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
