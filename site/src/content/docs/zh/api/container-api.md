---
title: Container
eyebrow: API REFERENCE
---

`<Container>` 用同一把设计宽度尺子换算 `width`、`height` 以及受支持的 style 长度。本页是全量字段参考；用法见 [Container 组件指南](/docs/container)。

## Props

字段与默认值逐项核对自 `src/types/index.ts` 的 `ContainerProps` 与 Container 实现。`Container` 还接受原生 `div` 属性（`Omit<HTMLAttributes, 'children' | 'style' | 'className'>`），且只能在 CineView 下使用（开发模式下缺上下文直接抛错）。

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `width` | `number` | — | 容器宽度（设计 px），经单尺子 `convert` 换算。 |
| `height` | `number` | — | 容器高度（设计 px），同上。 |
| `children` | `ReactNode` | `required` | 内容。 |
| `style` | `React.CSSProperties` | — | 额外样式；其中所有长度量（padding/margin/gap/borderRadius/fontSize/…）按设计 px 经 `convertStyle` 整块换算。 |
| `className` | `string` | — | CSS 类名。 |

## 换算语义

`width` / `height` 与 `style` 内的数值长度共用同一把尺子：`scale = viewportWidth / config.size`（默认 750），认宽不认高、绝不形变。换算只发生在挂载时由 CineViewContext 提供的 `convert` / `convertStyle` 上，`Container` 自身不持有第二把尺子。

```tsx
<CineView config={{ size: 750 }}>
  {/* On a 375px viewport (scale 0.5): rendered 260×150, padding 12, radius 10 */}
  <Container width={520} height={300} style={{ padding: 24, borderRadius: 20 }}>
    <Card />
  </Container>
</CineView>
```

`convertStyle` 是**整块**换算：遍历 style 对象里的数值型长度字段逐一乘 `scale`，非长度字段（`color`、`display`、`zIndex`…）原样透传；字符串值（`'50%'`、`'1rem'`）不换算、原样透传——需要响应式换算的长度请用数值书写。

同一组设计值在不同视口宽度下的渲染结果（`config.size = 750`）：

| 视口宽度 | `scale` | `width={520}` | `height={300}` | `padding: 24` | `borderRadius: 20` |
| --- | --- | --- | --- | --- | --- |
| 375px | 0.5 | 260px | 150px | 12px | 10px |
| 750px | 1.0 | 520px | 300px | 24px | 20px |
| 1125px | 1.5 | 780px | 450px | 36px | 30px |

## 约束与常见误用

- **Container 不是坐标所有者。** 定位（`position` / `left` / `top` / 居中）始终归 `Position`；给 Container 传定位样式属于职责误用，换算结果也不受定位链裁决。
- **必须在 CineView 下使用。** 换算依赖 CineViewContext 注入的 `convert`；脱离 CineView 渲染时开发模式直接抛错（生产模式行为未定义）。
- **不要用它做 Scene 布局。** Scene 的 `layout.width` / `layout.height` 有自己的语义（数字同样走单尺子）；Container 面向 Scene 内部的盒模型。层级是 `Scene → Position → Container`。
- **字体大小也会被换算。** `style={{ fontSize: 28 }}` 按设计 px 换算——设计稿量出的字号直接写数值即可；写 `'28px'` 字符串则不换算。

## 相关页面

- 单尺子换算模型（认宽不认高）→ [响应式概念页](/docs/responsive)
- 坐标定位（Container 的对偶）→ [Position API](/docs/position-api)
- 盒尺寸的用法教程 → [Container 组件指南](/docs/container)
