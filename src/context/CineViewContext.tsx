/**
 * CineView Context
 * 提供全局响应式尺寸换算上下文
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { debounce } from '../utils/debounce';
import type { SizeUnit } from '../types';

export interface CineViewContextValue {
  designWidth: number;
  designHeight: number;
  unit: SizeUnit;
  scaleX: number;
  scaleY: number;
  viewportWidth: number;
  viewportHeight: number;
  convertX: (size: number) => number;
  convertY: (size: number) => number;
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
      unit: resolvedUnit,
      scaleX,
      scaleY,
      viewportWidth,
      viewportHeight,
      convertX: convertXFn,
      convertY: convertYFn,
    }),
    [
      resolvedDesignWidth,
      resolvedDesignHeight,
      resolvedUnit,
      scaleX,
      scaleY,
      viewportWidth,
      viewportHeight,
      convertXFn,
      convertYFn,
    ]
  );

  // 设置 CSS 变量，让所有子元素可以使用响应式单位
  const containerStyle = useMemo<React.CSSProperties>(
    () =>
      ({
        '--cineview-scale-x': scaleX,
        '--cineview-scale-y': scaleY,
        '--cineview-design-width': `${resolvedDesignWidth}px`,
        '--cineview-design-height': `${resolvedDesignHeight}px`,
        '--cineview-viewport-width': `${viewportWidth}px`,
        '--cineview-viewport-height': `${viewportHeight}px`,
      }) as React.CSSProperties,
    [scaleX, scaleY, resolvedDesignWidth, resolvedDesignHeight, viewportWidth, viewportHeight]
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

  return context.convertX;
};
