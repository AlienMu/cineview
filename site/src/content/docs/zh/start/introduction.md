---
title: 介绍
eyebrow: START HERE
---

CineView 是一个面向「精心编排的拖拽分页」与「真实文档流滚动接管」的 React 场景运行时。

## 心智模型

CineView 拥有场景切换与时间轴所有权；Scene 拥有章节级布局；Animate 消费当前模式的时间轴。普通 React 内容可以安放在 scroll 接管场景之间。

## 一个最小的场景

从一个根节点、一个模式和明确的设计稿宽度开始。只在需要章节级行为的地方使用 Scene。

```tsx
<CineView config={{ size: 750 }} mode="drag">
  <Scene sceneId="hero">
    <Animate enterAnimation="fade-in">
      <h1>Opening frame</h1>
    </Animate>
  </Scene>
</CineView>
```
