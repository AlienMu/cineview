/**
 * CineView Context
 * 提供全局响应式尺寸换算上下文
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { debounce } from '../utils/debounce';
import { convertSize } from '../utils/sizeConverter';
import type { SizeUnit } from '../types';

export interface CineViewContextValue {
  designSize: number;
  unit: SizeUnit;
  scale: number;
  viewportWidth: number;
  viewportHeight: number;
  convertSize: (size: number) => number;
}

const CineViewContext = createContext<CineViewContextValue | null>(null);

// Export the context for testing purposes
export { CineViewContext };

export interface CineViewProviderProps {
  designSize?: number;
  unit?: SizeUnit;
  children: React.ReactNode;
}

export const CineViewProvider: React.FC<CineViewProviderProps> = ({
  designSize = 750,
  unit = 'px',
  children,
}) => {
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 750
  );
  const [viewportHeight, setViewportHeight] = useState<number>(
    typeof window !== 'undefined' ? window.innerHeight : 1334
  );

  // 计算换算比例
  const scale = useMemo(() => {
    if (unit === 'px') return 1;
    return viewportWidth / designSize;
  }, [viewportWidth, designSize, unit]);

  // 尺寸换算函数
  const convertSizeFn = useCallback(
    (size: number): number => {
      return convertSize(size, designSize, viewportWidth, unit);
    },
    [designSize, viewportWidth, unit]
  );

  // 处理窗口 resize 事件
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = debounce(() => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    }, 150);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const contextValue = useMemo<CineViewContextValue>(
    () => ({
      designSize,
      unit,
      scale,
      viewportWidth,
      viewportHeight,
      convertSize: convertSizeFn,
    }),
    [designSize, unit, scale, viewportWidth, viewportHeight, convertSizeFn]
  );

  // 设置 CSS 变量，让所有子元素可以使用响应式单位
  const containerStyle = useMemo<React.CSSProperties>(
    () =>
      ({
        '--cineview-scale': scale,
        '--cineview-design-size': `${designSize}px`,
        '--cineview-viewport-width': `${viewportWidth}px`,
      }) as React.CSSProperties,
    [scale, designSize, viewportWidth]
  );

  return (
    <CineViewContext.Provider value={contextValue}>
      <div style={containerStyle} className="cineview-responsive-container">
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
 * 便捷 hook，用于在组件中直接获取 convertSize 函数
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

  return context.convertSize;
};
