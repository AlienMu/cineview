---
title: 快速上手
eyebrow: GETTING STARTED / QUICKSTART
---

这个示例用两个场景演示拖拽翻页。Position 放置标题，`timeline.after` 让副标题在主标题入场后开始。

## 完整示例

```tsx
import { CineView, Scene, Animate, Position } from 'cineview';

export default function App() {
  return (
    <CineView designWidth={750} mode="drag" direction="y" transitionDuration={800}>
      <Scene
        sceneId="hero"
        layout={{ width: '100%', height: '100vh', anchor: 'top-center', overflow: 'hidden' }}
      >
        <Position at={{ x: 60, y: 200 }}>
          <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 800 }}>
            <h1>第一幕</h1>
          </Animate>
        </Position>
        <Position at={{ x: 60, y: 320 }}>
          <Animate
            animateId="subtitle"
            enterAnimation="slide-up"
            duration={{ enter: 600 }}
            timeline={{ after: 'title' }}
          >
            <p>跟着标题入场的副标题</p>
          </Animate>
        </Position>
      </Scene>
      <Scene
        sceneId="closing"
        layout={{ width: '100%', height: '100vh', anchor: 'top-center', overflow: 'hidden' }}
      >
        <Position at={{ x: 60, y: 200 }}>
          <Animate animateId="end-title" enterAnimation="fade-in" duration={{ enter: 800 }}>
            <h1>谢幕</h1>
          </Animate>
        </Position>
      </Scene>
    </CineView>
  );
}
```

## 核心参数解析

- `designWidth={750}`：数值型设计长度按 `viewportWidth / 750` 换算，默认设计稿宽度为 750。
- `mode="drag"`：启用拖拽导航，也是默认模式。
- `direction="y"`：竖向手势；横向手势使用 `"x"`。
- `transitionDuration={800}`：配置 `ref.goToScene()` 的程序化导航时序，手势时序由框架单独处理。
- `sceneId`：供 `ref.preload()` 定位场景，也可作为锁定区标识的默认值。
- `layout.anchor: 'top-center'`：对齐场景内容。`overflow: 'hidden'` 裁切超出边界的内容。
- `at={{ x: 60, y: 200 }}`：设计稿坐标，单位 px，按 `designWidth` 换算。
- `animateId` / `timeline.after: 'title'`：副标题在 `title` 入场后开始。目标不存在时报告 `INVALID_ANIMATION`，依赖成环时报告 `CIRCULAR_DEPENDENCY`。
- `duration={{ enter: 800 }}`：入场 800ms。

## 换成 scroll 模式

将 `mode` 设为 `"scroll"`，删除 drag 专属的 `transitionDuration` 属性，并为目标场景添加 `scroll={{ zoneId: 'hero-seq', trigger: 'center-lock' }}`。内部动画随后按 `1ms = 1px` 跟随滚动距离。scroll 模式可添加 `scrollbar={{}}` 显示自绘滚动条。详见[选择模式](/docs/04-choosing-mode)与 [center-lock](/docs/01-centerlock)。

## 下一步

- [CineView 参考](/docs/01-cineview)：根组件全部 props 与 ref 方法。
- [Scene 参考](/docs/02-scene)：布局、转场与资源配置。
- [Animate 参考](/docs/03-animate)：时间轴推断、enterRef/exitRef、stagger。
