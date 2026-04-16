/**
 * Container 组件
 * 提供响应式容器，完全基于百分比系统
 * 只能在 CineView 下使用
 * 
 * 设计理念：
 * - 宽高都转换为相对于设计稿的百分比
 * - 这样可以完美适配任何屏幕尺寸
 */

import React, { useMemo } from 'react';
import { useCineViewContext } from '../../context/CineViewContext';
import type { ContainerProps } from '../../types';

export const Container: React.FC<ContainerProps> = ({
  width,
  height,
  children,
  style,
  className,
  ...restProps
}) => {
  const context = useCineViewContext();

  // 开发环境检查：必须在 CineView 下使用
  if (process.env.NODE_ENV === 'development' && !context) {
    throw new Error(
      '[CineView] Container must be used within a CineView component. ' +
        'Please wrap your Container with <CineView>.'
    );
  }

  // 计算响应式尺寸 - 使用百分比
  const containerStyle = useMemo(() => {
    if (!context) return style;

    const { designSize } = context;

    // 将设计稿尺寸转换为百分比
    const widthPercent = width !== undefined ? (width / designSize) * 100 : undefined;
    const heightPercent = height !== undefined ? (height / designSize) * 100 : undefined;

    return {
      width: widthPercent !== undefined ? `${widthPercent}%` : undefined,
      height: heightPercent !== undefined ? `${heightPercent}%` : undefined,
      ...style,
    };
  }, [context, width, height, style]);

  return (
    <div style={containerStyle} className={className} {...restProps}>
      {children}
    </div>
  );
};

Container.displayName = 'Container';
