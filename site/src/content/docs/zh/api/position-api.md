---
title: Position
eyebrow: API REFERENCE
---

`<Position>` 拥有坐标定位与 scene-scoped fixed 挂载；盒尺寸归 `Container`。本页是全量字段参考；用法见 [Position 组件指南](/docs/position)。

## Props

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

## 定位优先级

三种定位方式的裁决顺序，冲突时高者优先：

1. **绝对定位**——`at.x` / `at.y` 任一存在即生效，未给的轴补 `0`；
2. **居中锚点**——`at.anchor` 设定后，被居中的轴相对视口居中，该轴上的 `x`/`y` 改作相对中心的偏移量（设计 px），且该轴忽略 offset 链；
3. **相对链**——仅 `at.offsetX` / `at.offsetY`，基于上一个 `Position` 的坐标累加。

```tsx
/* Absolute: x present, y defaults to 0 */
<Position at={{ x: 100, offsetY: 40 }}>...</Position>

/* Centered: x/y become offsets from the centered axes */
<Position at={{ anchor: 'center', y: -100 }}>...</Position>

/* Relative chain: stacked on the previous Position */
<Position at={{ offsetX: 24, offsetY: 0 }}>...</Position>
```

注意第一条例子里 `offsetY` 会被忽略——绝对定位一旦触发，offset 链整体让位，未给的绝对轴补 `0` 而不是回落到相对值。

## 类型

### at.anchor

| 取值 | 语义 |
| --- | --- |
| `'center'` | 水平 + 垂直双向居中；`x` / `y` 均改作相对中心的偏移量 |
| `'center-x'` | 仅水平居中；`y` 仍是绝对设计坐标 |
| `'center-y'` | 仅垂直居中；`x` 仍是绝对设计坐标 |

被居中的轴忽略 offset 定位链；未居中的轴保持原有规则。示例：`anchor: 'center', x: 0, y: -100}` 表示水平居中、垂直居中再上移 100 设计 px。

### layer.fixed

仅 scroll 模式有意义：挂载进**本 Scene** 的 scene-scoped fixed layer（portal 实现），滚动时保持视口位置但绝不跨章节漂浮——离开宿主 Scene 即随之退场。Scene 没有 fixed layer 宿主时降级为 `sticky`。drag 模式下场景本身就是全屏栈，该字段无额外效果。

### 共享类型

- 设计 px → 视口换算（单尺子语义）→ [响应式概念页](/docs/responsive)
- fixed layer 的 scene 作用域模型 → [Fixed layer 概念页](/docs/fixed-layer)
