import type { ReactNode } from 'react';
import { Container } from 'cineview';

/**
 * 首页统一设计画布。
 *
 * CineView 的 `config.size=1440` 是唯一换算尺子；这里用 Container 声明 1440×900
 * 设计盒模型，供 Capability / DemoVideo 这类 `width/height:100%` 的相对布局根消费。
 * Container 不建立新的 positioned containing block：Position 继续唯一拥有坐标，Hero
 * 的 viewport-center 语义也保持不变。Scene 仍是实际 viewport 高度，不改变 takeover 测量。
 *
 * `height` 可选（默认 900）：手机上第三幕需要「画布 = 一个视口高」才能让六块用满竖屏
 * （见 `useDesignCanvasHeight` 与 task-flow `2026-08-04-act3-phone-layout.md`）。
 * 走 Container 自己的 `height` 便捷属性（框架原生换算），不覆盖行内样式。
 * 不传该属性的调用点行为逐字节不变。
 */
export function HomeSceneCanvas({
  children,
  height = 900,
}: {
  children: ReactNode;
  height?: number;
}): JSX.Element {
  return (
    <Container width={1440} height={height} className="home-scene-canvas">
      {children}
    </Container>
  );
}
