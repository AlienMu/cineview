---
title: 介绍
eyebrow: GETTING STARTED / INTRODUCTION
---

CineView 是用于全屏场景切换的 React 库，支持由拖拽或滚动驱动动画。声明场景、动画时序与设计稿宽度后，CineView 负责导航，并按视窗宽度换算数值型设计长度。

## 两种模式

通过根组件的 `mode` 选择交互方式：

- **drag**：全屏分页，可通过指针手势、键盘或 ref 方法切换场景。
- **scroll**：内容在原生滚动容器中移动。带锁定区（locked zone）的场景会保持位置，由滚动推进内部动画。

两种模式共用同一套 Scene / Animate / Position 组件。两种模式的时间轴语义不同，状态不能跨模式复用。详见 [模式](/docs/01-modes) 和 [选择模式](/docs/04-choosing-mode)。

## 核心概念

**响应式长度。** 将 `designWidth` 设为设计稿宽度，默认值为 750。两个方向的数值型设计长度都按 `scale = viewportWidth / designWidth` 换算。详见[响应式换算](/docs/05-responsive)。

**场景与时间轴。** `Scene` 组织共享布局与转场行为的内容，`Animate` 配置元素动画及其时序。在 drag 模式下，页面位移完成时，元素可能仍在入场。

**1ms = 1px。** 锁定区内，声明的动画时长每 1 毫秒对应 1 像素的滚动距离。反向滚动时，动画沿同一区间回退。详见 [center-lock](/docs/01-centerlock)。

## 两个场景的示例

```tsx
import { CineView, Scene, Animate } from 'cineview';

export default function App() {
  return (
    <CineView designWidth={750} mode="drag">
      <Scene sceneId="hero">
        <Animate enterAnimation="fade-in" duration={{ enter: 800 }}>
          <h1>第一幕</h1>
        </Animate>
      </Scene>
      <Scene sceneId="closing">
        <Animate enterAnimation="slide-up" duration={{ enter: 800 }}>
          <h1>谢幕</h1>
        </Animate>
      </Scene>
    </CineView>
  );
}
```

`designWidth={750}` 设置设计稿宽度。每个 `Scene` 包含一个使用预设入场动画的标题，可通过拖拽手势或键盘在两个场景之间切换。

## 下一步

- [安装](/docs/02-installation)：依赖安装、peer 依赖与按模式入口选择。
- [快速上手](/docs/03-quickstart)：包含定位与顺序动画的双场景示例。
- [选择模式](/docs/04-choosing-mode)：比较 drag 与 scroll 的行为。
