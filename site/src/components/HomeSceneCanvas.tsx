import type { ReactNode } from 'react';
import { Container } from 'cineview';

/**
 * 首页统一设计画布。
 *
 * CineView 的 `config.size=1440` 是唯一换算尺子；这里用 Container 声明 1440×900
 * 设计盒模型，供 Capability / DemoVideo 这类 `width/height:100%` 的相对布局根消费。
 * Container 不建立新的 positioned containing block：Position 继续唯一拥有坐标，Hero
 * 的 viewport-center 语义也保持不变。Scene 仍是实际 viewport 高度，不改变 takeover 测量。
 */
export function HomeSceneCanvas({ children }: { children: ReactNode }): JSX.Element {
  return (
    <Container width={1440} height={900} className="home-scene-canvas">
      {children}
    </Container>
  );
}
