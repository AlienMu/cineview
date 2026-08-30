---
title: 介绍
eyebrow: GETTING STARTED / INTRODUCTION
---

CineView 是一个做影院式全屏叙事页的 React 框架。你声明场景、动画和设计稿宽度，切换、时间轴和响应式换算都由框架负责。

## 两种模式

CineView 有两套引擎，用根组件的 `mode` prop 选一个：

- **drag**：拖拽分页。一次手势翻一屏，每屏是一个叙事节拍。
- **scroll**：真实文档流滚动。页面正常滚动；进到带锁定区（locked zone）的场景时，这段滚动改去驱动一条跟随滚动的时间轴（center-lock）。

两种模式共用同一套 Scene / Animate / Position 组件。两种模式的时间轴语义不同，状态不能跨模式复用。详见 [模式](/docs/01-modes) 和 [选择模式](/docs/04-choosing-mode)。

## 三个核心概念

**px2vw 换算基准。** 全站只有一个换算基准：`designWidth`，即设计稿宽度，默认 750。所有坐标和盒模型长度按 `scale = viewportWidth / size` 换算。只认宽度，不认高度，内容不变形。见 [响应式](/docs/05-responsive)。

**场景与时间轴。** `Scene` 是章节边界，`Animate` 消费当前模式的时间轴语义。drag 下切换场景的默认时长是 `transitionDuration: 800` ms。

**1ms = 1px。** 锁定区的时长预算就是真实滚动距离：`duration` 里的 1 毫秒对应用户要滚过的 1 像素。反向滚回这一段时，进度从 100% 走回 0%，不会跳变。见 [center-lock](/docs/01-centerlock)。

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

`designWidth: 750` 声明设计稿宽度。`Scene` 圈出一个章节，`Animate` 让章节里的内容按预设动画入场。drag 模式下用手势在两屏之间翻页。

## 下一步

- [安装](/docs/02-installation)：装包、peer 依赖、按模式入口。
- [快速上手](/docs/03-quickstart)：一个完整可抄的最小场景，逐行讲 prop。
- [选择模式](/docs/04-choosing-mode)：drag 还是 scroll，一张表说明白。
