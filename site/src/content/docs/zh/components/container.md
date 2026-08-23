---
title: Container
eyebrow: BOX MODEL
---

Container 用同一把设计宽度尺子换算 width、height 以及受支持的 style 长度。

## When to use

- 需要一个尺寸随视口宽度等比缩放、但不形变的盒子（卡片、面板、媒体框）。
- 设计稿上的盒模型数值（宽高、padding、圆角、字号）想原样写进代码，由框架换算。
- 与 Position 搭配组成 `Scene → Position → Container` 层级：Position 管放哪，Container 管多大。

## 尺寸不另设尺子

盒尺寸交给 Container，不要把它当坐标所有者用；定位始终归 Position。

`scale = viewportWidth / config.size`（认宽不认高）：`width={520}` 在 375px 视口（scale 0.5）渲染为 260px，`style` 里的数值长度（padding/margin/gap/borderRadius/fontSize…）经 `convertStyle` 整块换算。字符串值（`'50%'`、`'1rem'`）不换算、原样透传，需要响应式换算的长度用数值书写。

Container 只能在 CineView 下使用：换算依赖上下文注入的 `convert`，脱离 CineView 渲染时开发模式直接抛错。

## 常见误用

- **当坐标所有者用**：给它传 `left`/`top` 属于职责误用，换算结果也不参与定位链裁决。
- **字号写 `'28px'` 字符串**：不换算；设计稿量出的字号直接写数值 `28`。
- **拿它做 Scene 布局**：Scene 的 `layout.width`/`height` 有自己的语义，Container 面向 Scene 内部的盒模型。

---

完整字段与换算算例见 [Container API](/docs/container-api)。
