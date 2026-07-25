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

import React, { useMemo, useContext, createContext, forwardRef } from 'react';
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

export const Position = forwardRef<HTMLDivElement, PositionInternalProps>(function Position(
  { at, layer, x, y, offsetX, offsetY, fixed = false, children, style, className, ...restProps },
  ref
) {
  const context = useCineViewContext();
  const cineViewRuntime = useCineViewRuntimeContext();
  const parentPosition = useContext(PositionContext);
  const fixedLayer = useContext(SceneFixedLayerContext);
  const resolvedX = at?.x ?? x;
  const resolvedY = at?.y ?? y;
  const resolvedOffsetX = at?.offsetX ?? offsetX;
  const resolvedOffsetY = at?.offsetY ?? offsetY;
  const resolvedFixed = layer?.fixed ?? fixed;
  const anchor = at?.anchor;
  const centerX = anchor === 'center' || anchor === 'center-x';
  const centerY = anchor === 'center' || anchor === 'center-y';
  const shouldUseStickyLayer = resolvedFixed && cineViewRuntime?.mode === 'scroll' && !fixedLayer;

  // 计算最终位置 - px2vw 单尺子换算到实际像素坐标（x/y 共用 `convert`，认宽不认高）。
  // 居中轴改用 `calc(50% + offset)` + translate(-50%)（见 positionStyle），
  // 故此处对居中轴产出的 finalLeft/finalTop 仅作非居中回退，居中时被覆盖。
  const { finalLeft, finalTop, finalX, finalY } = useMemo(() => {
    const convert = context?.convert ?? ((size: number): number => size);

    // 绝对定位优先
    if (resolvedX !== undefined || resolvedY !== undefined) {
      const xValue = resolvedX !== undefined ? resolvedX : 0;
      const yValue = resolvedY !== undefined ? resolvedY : 0;

      return {
        finalLeft: convert(xValue),
        finalTop: convert(yValue),
        finalX: xValue,
        finalY: yValue,
      };
    }

    // 相对定位（基于上一个组件的位置）
    if (resolvedOffsetX !== undefined || resolvedOffsetY !== undefined) {
      const calcX = parentPosition.lastX + (resolvedOffsetX !== undefined ? resolvedOffsetX : 0);
      const calcY = parentPosition.lastY + (resolvedOffsetY !== undefined ? resolvedOffsetY : 0);

      return {
        finalLeft: convert(calcX),
        finalTop: convert(calcY),
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

  // 居中轴的 left/top + transform。居中时 x/y 作为「相对中心的偏移」(设计 px)。
  const { leftStyle, topStyle, centerTransform } = useMemo(() => {
    const convert = context?.convert ?? ((size: number): number => size);
    const transforms: string[] = [];

    let left: number | string = finalLeft;
    if (centerX) {
      const offsetPx = convert(resolvedX ?? 0);
      left = offsetPx === 0 ? '50%' : `calc(50% + ${offsetPx}px)`;
      transforms.push('translateX(-50%)');
    }

    let top: number | string = finalTop;
    if (centerY) {
      const offsetPx = convert(resolvedY ?? 0);
      top = offsetPx === 0 ? '50%' : `calc(50% + ${offsetPx}px)`;
      transforms.push('translateY(-50%)');
    }

    return {
      leftStyle: left,
      topStyle: top,
      centerTransform: transforms.length > 0 ? transforms.join(' ') : undefined,
    };
  }, [context, centerX, centerY, resolvedX, resolvedY, finalLeft, finalTop]);

  // 更新上下文（传递给子组件）
  const contextValue = useMemo<PositionContextValue>(
    () => ({
      lastX: finalX,
      lastY: finalY,
    }),
    [finalX, finalY]
  );

  // 构建样式
  const positionStyle = useMemo(() => {
    // 合并居中 transform 与用户传入的 transform（居中在前，用户的叠加在后）。
    const mergedTransform =
      [centerTransform, style?.transform].filter(Boolean).join(' ') || undefined;
    return {
      ...style,
      position: (shouldUseStickyLayer ? 'sticky' : 'absolute') as React.CSSProperties['position'],
      left: leftStyle,
      top: topStyle,
      pointerEvents: resolvedFixed ? (style?.pointerEvents ?? 'auto') : style?.pointerEvents,
      transform: mergedTransform,
    };
  }, [shouldUseStickyLayer, resolvedFixed, leftStyle, topStyle, centerTransform, style]);
  const node = (
    <PositionContext.Provider value={contextValue}>
      <div ref={ref} style={positionStyle} className={className} {...restProps}>
        {children}
      </div>
    </PositionContext.Provider>
  );

  if (resolvedFixed && fixedLayer && !shouldUseStickyLayer) {
    return createPortal(node, fixedLayer);
  }

  return node;
});

Position.displayName = 'Position';
