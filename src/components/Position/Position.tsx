/**
 * Position 组件
 * 提供绝对定位和相对定位功能，完全基于百分比系统实现响应式布局
 * 
 * 设计理念：
 * - 所有位置和尺寸都基于设计稿尺寸转换为百分比
 * - 绝对定位：直接将设计稿坐标转换为百分比
 * - 相对定位：基于父组件位置累加，最终也转换为百分比
 * - 这样可以完美适配任何屏幕尺寸
 */

import React, { useMemo, useContext, createContext } from 'react';
import { useCineViewContext } from '../../context/CineViewContext';
import type { PositionProps } from '../../types';

interface PositionContextValue {
  lastX: number; // 记录的是设计稿坐标（非百分比）
  lastY: number; // 记录的是设计稿坐标（非百分比）
}

const PositionContext = createContext<PositionContextValue>({ lastX: 0, lastY: 0 });

export const Position: React.FC<PositionProps> = ({
  x,
  y,
  offsetX,
  offsetY,
  children,
  style,
  className,
}) => {
  const context = useCineViewContext();
  const parentPosition = useContext(PositionContext);

  // 计算最终位置 - 统一使用百分比
  const { finalLeft, finalTop, finalX, finalY } = useMemo(() => {
    const designSize = context?.designSize || 750;

    // 绝对定位优先 - 直接转换为百分比
    if (x !== undefined || y !== undefined) {
      const xValue = x !== undefined ? x : 0;
      const yValue = y !== undefined ? y : 0;
      
      // 转换为百分比：(设计稿坐标 / 设计稿尺寸) * 100
      const xPercent = (xValue / designSize) * 100;
      const yPercent = (yValue / designSize) * 100;

      return {
        finalLeft: `${xPercent}%`,
        finalTop: `${yPercent}%`,
        finalX: xValue, // 记录设计稿坐标，供子组件使用
        finalY: yValue,
      };
    }

    // 相对定位（基于上一个组件的位置）
    if (offsetX !== undefined || offsetY !== undefined) {
      // 累加设计稿坐标
      const calcX = parentPosition.lastX + (offsetX !== undefined ? offsetX : 0);
      const calcY = parentPosition.lastY + (offsetY !== undefined ? offsetY : 0);
      
      // 转换为百分比
      const xPercent = (calcX / designSize) * 100;
      const yPercent = (calcY / designSize) * 100;

      return {
        finalLeft: `${xPercent}%`,
        finalTop: `${yPercent}%`,
        finalX: calcX, // 记录设计稿坐标
        finalY: calcY,
      };
    }

    // 默认位置
    return {
      finalLeft: '0%',
      finalTop: '0%',
      finalX: 0,
      finalY: 0,
    };
  }, [x, y, offsetX, offsetY, context, parentPosition]);

  // 更新上下文（传递给子组件）
  const contextValue = useMemo<PositionContextValue>(
    () => ({
      lastX: finalX,
      lastY: finalY,
    }),
    [finalX, finalY]
  );

  // 构建样式
  const positionStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left: finalLeft,
      top: finalTop,
      ...style,
    }),
    [finalLeft, finalTop, style]
  );

  return (
    <PositionContext.Provider value={contextValue}>
      <div style={positionStyle} className={className}>
        {children}
      </div>
    </PositionContext.Provider>
  );
};

Position.displayName = 'Position';
