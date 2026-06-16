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
import { createPortal } from 'react-dom';
import { useCineViewContext } from '../../context/CineViewContext';
import type { PositionProps } from '../../types';
import { useCineViewRuntimeContext } from '../CineView/runtimeContext';

interface PositionLegacyCompatProps {
  x?: number;
  y?: number;
  offsetX?: number;
  offsetY?: number;
  fixed?: boolean;
}

export type PositionInternalProps = PositionProps & PositionLegacyCompatProps;

interface PositionContextValue {
  lastX: number; // 记录的是设计稿坐标（非百分比）
  lastY: number; // 记录的是设计稿坐标（非百分比）
}

const PositionContext = createContext<PositionContextValue>({ lastX: 0, lastY: 0 });
export const SceneFixedLayerContext = createContext<HTMLElement | null>(null);

export const Position: React.FC<PositionInternalProps> = ({
  at,
  layer,
  x,
  y,
  offsetX,
  offsetY,
  fixed = false,
  children,
  style,
  className,
}) => {
  const context = useCineViewContext();
  const cineViewRuntime = useCineViewRuntimeContext();
  const parentPosition = useContext(PositionContext);
  const fixedLayer = useContext(SceneFixedLayerContext);
  const resolvedX = at?.x ?? x;
  const resolvedY = at?.y ?? y;
  const resolvedOffsetX = at?.offsetX ?? offsetX;
  const resolvedOffsetY = at?.offsetY ?? offsetY;
  const resolvedFixed = layer?.fixed ?? fixed;
  const shouldUseStickyLayer =
    resolvedFixed && cineViewRuntime?.mode === 'scroll' && !fixedLayer;

  // 计算最终位置 - 使用双轴设计基准换算到实际像素坐标
  const { finalLeft, finalTop, finalX, finalY } = useMemo(() => {
    const convertX = context?.convertX ?? ((size: number): number => size);
    const convertY = context?.convertY ?? ((size: number): number => size);

    // 绝对定位优先
    if (resolvedX !== undefined || resolvedY !== undefined) {
      const xValue = resolvedX !== undefined ? resolvedX : 0;
      const yValue = resolvedY !== undefined ? resolvedY : 0;

      return {
        finalLeft: convertX(xValue),
        finalTop: convertY(yValue),
        finalX: xValue,
        finalY: yValue,
      };
    }

    // 相对定位（基于上一个组件的位置）
    if (resolvedOffsetX !== undefined || resolvedOffsetY !== undefined) {
      const calcX = parentPosition.lastX + (resolvedOffsetX !== undefined ? resolvedOffsetX : 0);
      const calcY = parentPosition.lastY + (resolvedOffsetY !== undefined ? resolvedOffsetY : 0);

      return {
        finalLeft: convertX(calcX),
        finalTop: convertY(calcY),
        finalX: calcX,
        finalY: calcY,
      };
    }

    // 默认位置
    return {
      finalLeft: 0,
      finalTop: 0,
      finalX: 0,
      finalY: 0,
    };
  }, [context, parentPosition, resolvedOffsetX, resolvedOffsetY, resolvedX, resolvedY]);

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
      position: (shouldUseStickyLayer ? 'sticky' : 'absolute') as React.CSSProperties['position'],
      left: finalLeft,
      top: finalTop,
      pointerEvents: resolvedFixed
        ? ('auto' as React.CSSProperties['pointerEvents'])
        : style?.pointerEvents,
      ...style,
    }),
    [shouldUseStickyLayer, resolvedFixed, finalLeft, finalTop, style]
  );
  const node = (
    <PositionContext.Provider value={contextValue}>
      <div style={positionStyle} className={className}>
        {children}
      </div>
    </PositionContext.Provider>
  );

  if (resolvedFixed && fixedLayer && !shouldUseStickyLayer) {
    return createPortal(node, fixedLayer);
  }

  return node;
};

Position.displayName = 'Position';
