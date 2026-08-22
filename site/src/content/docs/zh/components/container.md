---
title: Container
eyebrow: BOX MODEL
---

Container 用同一把设计宽度尺子换算 width、height 以及受支持的 style 长度。

## 尺寸不另设尺子

盒尺寸交给 Container。不要把它当坐标所有者用；定位始终归 Position。

```tsx
<Container width={520} height={300} style={{ padding: 24 }}>
  <Card />
</Container>
```

## 属性

字段与默认值逐项核对自 `src/types/index.ts` 的 `ContainerProps` 与 Container 实现。`Container` 还接受原生 `div` 属性（`Omit<HTMLAttributes, 'children' | 'style' | 'className'>`），且只能在 CineView 下使用（开发模式下缺上下文直接抛错）。

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `width` | `number` | — | 容器宽度（设计 px），经单尺子 `convert` 换算。 |
| `height` | `number` | — | 容器高度（设计 px），同上。 |
| `children` | `ReactNode` | `required` | 内容。 |
| `style` | `React.CSSProperties` | — | 额外样式；其中所有长度量（padding/margin/gap/borderRadius/fontSize/…）按设计 px 经 `convertStyle` 整块换算。 |
| `className` | `string` | — | CSS 类名。 |
