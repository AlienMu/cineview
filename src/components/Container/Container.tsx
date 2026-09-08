/**
 * Container component — px-to-vw box-model conversion wrapper.
 *
 * Responsibility boundary (orthogonal to Position):
 * - Position handles "where the element is placed" (x/y coordinates, converted via `convert`).
 * - Container handles "box dimensions + internal spacing": width/height convenience props, and all
 *   length values in `style` (padding/margin/gap/borderRadius/fontSize/...) are automatically
 *   converted from design px via the single-ruler `convert`. Authors write the entire box model
 *   in design-spec units; Container faithfully scales to any screen — squares stay square.
 *
 * Must be used within CineView (requires conversion context).
 */

import { forwardRef, useMemo } from 'react';
import { useCineViewContext } from '../../context/CineViewContext';
import { convertStyle } from '../../utils/styleConvert';
import type { ContainerProps } from '../../types';

export const Container = forwardRef<HTMLDivElement, ContainerProps>(function Container(
  { width, height, children, style, className, ...restProps },
  ref
) {
  const context = useCineViewContext();

  // Development check: must be used within CineView
  if (process.env.NODE_ENV === 'development' && !context) {
    throw new Error(
      '[CineView] Container must be used within a CineView component. ' +
        'Please wrap your Container with <CineView>.'
    );
  }

  // px-to-vw box-model conversion: width/height convenience props via `convert`;
  // all length values in style via convertStyle (padding/margin/gap/borderRadius/fontSize/... all scaled).
  const containerStyle = useMemo(() => {
    if (!context) return style;

    const convertedStyle = convertStyle(style, context);
    const widthPx = width !== undefined ? context.convert(width) : undefined;
    const heightPx = height !== undefined ? context.convert(height) : undefined;

    return {
      ...convertedStyle,
      ...(width !== undefined ? { width: widthPx } : {}),
      ...(height !== undefined ? { height: heightPx } : {}),
    };
  }, [context, width, height, style]);

  return (
    <div ref={ref} style={containerStyle} className={className} {...restProps}>
      {children}
    </div>
  );
});

Container.displayName = 'Container';
