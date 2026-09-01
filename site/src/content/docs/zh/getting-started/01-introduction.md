---
title: 介绍
eyebrow: GETTING STARTED / INTRODUCTION
---

CineView 是面向影院级全屏叙事体验的 React 动画框架。开发者声明场景、动画规范与设计稿宽度，场景切换、时间轴调度与单轴响应式换算均由引擎统一处理。

## 两种模式

CineView 有两套引擎，用根组件的 `mode` prop 选一个：

- **drag**：拖拽分页。一次手势翻一屏，每屏是一个叙事节拍。
- **scroll**：真实文档流滚动。页面正常滚动；进到带锁定区（locked zone）的场景时，这段滚动改去驱动一条跟随滚动的时间轴（center-lock）。

两种模式共用同一套 Scene / Animate / Position 组件。两种模式的时间轴语义不同，状态不能跨模式复用。详见 [模式](/docs/01-modes) 和 [选择模式](/docs/04-choosing-mode)。

## 三个核心概念

**px2vw 单轴响应式基准。** 全站采用统一的视窗缩放换算：`designWidth`（设计稿宽度，默认 750）。所有坐标与盒模型长度均按 `scale = viewportWidth / designWidth` 换算。缩放仅以视窗宽度为单一基准，高度按同一比例联动，元素在各尺寸下保持原始宽高比。见 [响应式](/docs/05-responsive)。

**场景与时间轴。** `Scene` 是章节边界，`Animate` 消费当前模式的时间轴语义。drag 下切换场景的默认时长是 `transitionDuration: 800` ms。

**1ms = 1px。** 锁定区的时长预算等价于真实滚动距离：`duration` 中的 1 毫秒对应 1 像素的物理滚动距离。反向滚动返回该区间时，进度从 100% 平滑递减至 0%，保持平稳连续过渡。见 [center-lock](/docs/01-centerlock)。

## 30 秒最小示例

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

`designWidth: 750` 声明设计稿基准宽度。`Scene` 划定章节布局边界，`Animate` 调度内部元素按预设动画进场。drag 模式下通过手势在两屏之间完成切屏过渡。

## 下一步

- [安装](/docs/02-installation)：依赖安装、peer 依赖与按模式入口选择。
- [快速上手](/docs/03-quickstart)：完整的最小场景示例与逐项参数解析。
- [选择模式](/docs/04-choosing-mode)：两套引擎的核心差异与选型决策表。
