---
title: Position
eyebrow: COORDINATES
---

Position 拥有坐标与 scene-scoped fixed 挂载；Container 拥有盒尺寸。

## 坐标与 fixed layer

Position 坐标是设计像素。fixed layer 的作用域限定在其 Scene 内，绝不跨章节漂浮。

```tsx
<Position at={{ x: 100, y: 220, offsetX: 8 }}>
  <Container width={420} height={180}>...</Container>
</Position>

<Position at={{ x: 0, y: 0 }} layer={{ fixed: true }}>
  <Overlay />
</Position>
```

## 属性

字段与默认值逐项核对自 `src/types/index.ts` 的 `PositionProps` 与 Position 实现。`Position` 还接受原生 `div` 属性（`Omit<HTMLAttributes, 'children' | 'style' | 'className'>`）。

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `at.x` | `number` | `0` | 绝对横坐标（设计 px，经单尺子 `convert` 换算）。`x`/`y` 任一存在即走绝对定位，未给的轴补 `0`；绝对定位优先于 offset 链。 |
| `at.y` | `number` | `0` | 绝对纵坐标（设计 px）。 |
| `at.offsetX` | `number` | — | 相对横偏移：基于上一个 `Position` 的坐标累加（相对定位链）。仅当 `x`/`y` 均未给时生效。 |
| `at.offsetY` | `number` | — | 相对纵偏移，同上。 |
| `at.anchor` | `'center' \| 'center-x' \| 'center-y'` | — | 居中锚点。设定后对应轴相对视口居中（无需手写 `translate(-50%)`），该轴的 `x`/`y` 改作相对中心的偏移量（设计 px）；被居中的轴忽略 offset 定位链。 |
| `layer.fixed` | `boolean` | `false` | scroll 模式下挂载到本 Scene 的 scene-scoped fixed layer（portal，绝不跨章节漂浮）；Scene 无 fixed layer 宿主时降级为 sticky。 |
| `children` | `ReactNode` | `required` | 内容。 |
| `style` | `React.CSSProperties` | — | 额外样式。`position`/`left`/`top` 由 Position 接管；用户 `transform` 与居中 transform 合并（居中在前）。 |
| `className` | `string` | — | CSS 类名。 |
