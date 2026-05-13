/**
 * CineView Context
 * 提供全局响应式尺寸换算上下文
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { debounce } from '../utils/debounce';
import { convertSize } from '../utils/sizeConverter';
import type { SizeUnit } from '../types';

export interface CineViewContextValue {
  designWidth: number;
  designHeight: number;
  designSize: number;
  unit: SizeUnit;
  scaleX: number;
  scaleY: number;
  scale: number;
  viewportWidth: number;
  viewportHeight: number;
  convertX: (size: number) => number;
  convertY: (size: number) => number;
  convertSize: (size: number) => number;
}

const CineViewContext = createContext<CineViewContextValue | null>(null);

// Export the context for testing purposes
export { CineViewContext };

export interface CineViewProviderProps {
  designWidth?: number;
  designHeight?: number;
  unit?: SizeUnit;
  children: React.ReactNode;
}

export const CineViewProvider: React.FC<CineViewProviderProps> = ({
  designWidth,
  designHeight,
  unit,
  children,
}) => {
  const resolvedDesignWidth = designWidth ?? 750;
  const resolvedDesignHeight = designHeight ?? 1334;
  const resolvedDesignSize = resolvedDesignWidth;
  const resolvedUnit = unit ?? 'px';
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 750
  );
  const [viewportHeight, setViewportHeight] = useState<number>(
    typeof window !== 'undefined' ? window.innerHeight : 1334
  );

  // 计算换算比例
  const scaleX = useMemo(
    () => viewportWidth / resolvedDesignWidth,
    [viewportWidth, resolvedDesignWidth]
  );
  const scaleY = useMemo(
    () => viewportHeight / resolvedDesignHeight,
    [viewportHeight, resolvedDesignHeight]
  );
  const scale = useMemo(() => {
    if (resolvedUnit === 'px') return 1;
    return scaleX;
  }, [resolvedUnit, scaleX]);

  const convertXFn = useCallback(
    (size: number): number => {
      return size * scaleX;
    },
    [scaleX]
  );

  const convertYFn = useCallback(
    (size: number): number => {
      return size * scaleY;
    },
    [scaleY]
  );

  // 尺寸换算函数
  const convertSizeFn = useCallback(
    (size: number): number => {
      return convertSize(size, resolvedDesignWidth, viewportWidth, resolvedUnit);
    },
    [resolvedDesignWidth, viewportWidth, resolvedUnit]
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
      designWidth: resolvedDesignWidth,
      designHeight: resolvedDesignHeight,
      designSize: resolvedDesignSize,
      unit: resolvedUnit,
      scaleX,
      scaleY,
      scale,
      viewportWidth,
      viewportHeight,
      convertX: convertXFn,
      convertY: convertYFn,
      convertSize: convertSizeFn,
    }),
    [
      resolvedDesignWidth,
      resolvedDesignHeight,
      resolvedDesignSize,
      resolvedUnit,
      scaleX,
      scaleY,
      scale,
      viewportWidth,
      viewportHeight,
      convertXFn,
      convertYFn,
      convertSizeFn,
    ]
  );

  // 设置 CSS 变量，让所有子元素可以使用响应式单位
  const containerStyle = useMemo<React.CSSProperties>(
    () =>
      ({
        '--cineview-scale': scale,
        '--cineview-scale-x': scaleX,
        '--cineview-scale-y': scaleY,
        '--cineview-design-width': `${resolvedDesignWidth}px`,
        '--cineview-design-height': `${resolvedDesignHeight}px`,
        '--cineview-design-size': `${resolvedDesignSize}px`,
        '--cineview-viewport-width': `${viewportWidth}px`,
        '--cineview-viewport-height': `${viewportHeight}px`,
      }) as React.CSSProperties,
    [
      scale,
      scaleX,
      scaleY,
      resolvedDesignWidth,
      resolvedDesignHeight,
      resolvedDesignSize,
      viewportWidth,
      viewportHeight,
    ]
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
