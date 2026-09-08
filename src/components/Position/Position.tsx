/**
 * Position component
 * Provides absolute and relative positioning using a percentage-based responsive layout system.
 *
 * Design principles:
 * - All positions and sizes are converted from design-canvas coordinates to percentages
 * - Absolute positioning: design coordinates map directly to percentages
 * - Relative positioning: accumulated from parent positions, then converted to percentages
 * - Ensures consistent layout across any screen size
 */

import React, { useMemo, useContext, createContext, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { useCineViewContext } from '../../context/CineViewContext';
import type { PositionProps } from '../../types';
import { useCineViewRuntimeContext } from '../runtime/runtimeContext';

interface PositionLegacyCompatProps {
  x?: number;
  y?: number;
  offsetX?: number;
  offsetY?: number;
  fixed?: boolean;
}

export type PositionInternalProps = PositionProps & PositionLegacyCompatProps;

interface PositionContextValue {
  lastX: number; // Design-canvas coordinates (not percentages)
  lastY: number; // Design-canvas coordinates (not percentages)
}

const PositionContext = createContext<PositionContextValue>({ lastX: 0, lastY: 0 });
export const SceneFixedLayerContext = createContext<HTMLElement | null>(null);

export const Position = forwardRef<HTMLDivElement, PositionInternalProps>(function Position(
  { at, x, y, offsetX, offsetY, fixed = false, children, style, className, ...restProps },
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
  const resolvedFixed = fixed;
  const anchor = at?.anchor;
  const centerX = anchor === 'center' || anchor === 'center-x';
  const centerY = anchor === 'center' || anchor === 'center-y';
  const shouldUseStickyLayer = resolvedFixed && cineViewRuntime?.mode === 'scroll' && !fixedLayer;

  // Calculate final position - px2vw converts design coordinates to actual pixel coordinates using a single ruler (both x/y use `convert`, based on width).
  // Centered axes use `calc(50% + offset)` + translate(-50%) (see positionStyle),
  // so finalLeft/finalTop here only serve as non-centered fallback and are overridden when centering is active.
  const { finalLeft, finalTop, finalX, finalY } = useMemo(() => {
    const convert = context?.convert ?? ((size: number): number => size);

    // Absolute positioning takes priority
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

    // Relative positioning (based on previous component position)
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

    // Default position
    return {
      finalLeft: 0,
      finalTop: 0,
      finalX: 0,
      finalY: 0,
    };
  }, [context, parentPosition, resolvedOffsetX, resolvedOffsetY, resolvedX, resolvedY]);

  // left/top + transform for centered axes. When centering, x/y acts as "offset from center" (design px).
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

  // Update context (passed to child components)
  const contextValue = useMemo<PositionContextValue>(
    () => ({
      lastX: finalX,
      lastY: finalY,
    }),
    [finalX, finalY]
  );

  // Build style
  const positionStyle = useMemo(() => {
    // Merge center transform with user-provided transform (center first, user's appended after).
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
