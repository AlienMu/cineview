/**
 * Container 组件 — px2vw 盒模型换算容器。
 *
 * 职责边界（与 Position 正交）：
 * - Position 管「元素放在哪」（坐标点 x/y，经 `convert` 换算）。
 * - Container 管「盒子多大 + 内部怎么呼吸」：width/height 便捷属性，以及整个 `style`
 *   里的所有长度量（padding/margin/gap/borderRadius/fontSize/...）都按设计 px 经
 *   px2vw 单尺子 `convert` 自动换算。作者用设计稿的一个单位书写整块盒模型，
 *   Container 忠实缩放到任何屏幕——正方形永远是正方形（单尺子不形变）。
 *
 * 只能在 CineView 下使用（需要换算上下文）。
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

  // 开发环境检查：必须在 CineView 下使用
  if (process.env.NODE_ENV === 'development' && !context) {
    throw new Error(
      '[CineView] Container must be used within a CineView component. ' +
        'Please wrap your Container with <CineView>.'
    );
  }

  // px2vw 盒模型换算：width/height 便捷属性走 `convert`；整个 style 的长度量交给
  // convertStyle 逐键换算（padding/margin/gap/borderRadius/fontSize/... 一并缩放）。
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
