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

  // 计算响应式尺寸 - 使用双轴设计基准换算
  const containerStyle = useMemo(() => {
    if (!context) return style;

    const widthPx = width !== undefined ? context.convertX(width) : undefined;
    const heightPx = height !== undefined ? context.convertY(height) : undefined;

    return {
      width: widthPx,
      height: heightPx,
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
