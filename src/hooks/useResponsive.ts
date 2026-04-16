/**
 * useResponsive Hook
 * 监听窗口尺寸变化并计算换算比例
 */

import { useState, useEffect, useMemo } from 'react';
import { debounce } from '../utils/debounce';
import type { SizeUnit } from '../types';

export interface UseResponsiveOptions {
  designSize?: number;
  unit?: SizeUnit;
  debounceDelay?: number;
}

export interface ResponsiveState {
  viewportWidth: number;
  viewportHeight: number;
  scale: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

export const useResponsive = (options: UseResponsiveOptions = {}): ResponsiveState => {
  const { designSize = 750, unit = 'px', debounceDelay = 150 } = options;

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

  // 判断设备类型
  const deviceType = useMemo(() => {
    return {
      isMobile: viewportWidth < 768,
      isTablet: viewportWidth >= 768 && viewportWidth < 1024,
      isDesktop: viewportWidth >= 1024,
    };
  }, [viewportWidth]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = debounce(() => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    }, debounceDelay);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [debounceDelay]);

  return {
    viewportWidth,
    viewportHeight,
    scale,
    ...deviceType,
  };
};
