---
title: Position
eyebrow: COMPONENTS / POSITION
---

Position 使用设计像素坐标在 Scene 内放置内容。响应式宽高与间距使用 [Container](/docs/07-container)。

## Props

| prop        | 类型                                          | 说明                                       |
| ----------- | --------------------------------------------- | ------------------------------------------ |
| `at`        | `{ x?, y?, offsetX?, offsetY?, anchor? }`     | 坐标声明，数值均为设计 px                  |
| `fixed`     | boolean                                       | scroll 模式下挂进 scene-scoped fixed layer |
| `children`  | ReactNode                                     | 必填                                       |
| `style`     | CSSProperties                                 | 附加到根 div                               |
| `className` | string                                        | 根 div 类名                                |
| 其余        | HTMLAttributes（除 children/style/className） | 透传根 div                                 |

转发的 `ref` 指向根 div。

### at 字段

| 字段                  | 类型                                   | 语义                                        |
| --------------------- | -------------------------------------- | ------------------------------------------- |
| `x` / `y`             | number                                 | 绝对设计坐标，按设计比例换算                |
| `offsetX` / `offsetY` | number                                 | 相对最近上层 Position 的坐标增量（设计 px） |
| `anchor`              | `'center' \| 'center-x' \| 'center-y'` | 在定位包含块中对所选轴居中                  |

### 定位裁决

每个轴按优先级解析，高者优先：

1. **居中**：`anchor` 选中的轴在定位包含块内居中。
2. **绝对**：`x` / `y` 任一存在即触发，未给的轴补 `0`。
3. **相对链**：仅给了 `offsetX` / `offsetY` → 在最近上层 Position 的坐标上累加。绝对定位一旦触发，offset 链整体让位。
4. 都不给 → `(0, 0)`。

## 居中对齐

`anchor: 'center'` 在两个轴上居中。`'center-x'` 和 `'center-y'` 只居中一个轴，另一轴保留正常坐标规则。

居中之后，被居中轴上的 `x` / `y` 改作「相对中心的偏移量」（设计 px，同样按设计比例换算）：`anchor: 'center', y: -100` 表示整体居中再上移 100。被居中的轴忽略 `offsetX` / `offsetY` 相对链。

不需要手写 `translate(-50%, -50%)`，框架自己合成，并把居中 transform 排在第一位、`style.transform` 叠加在后：

```tsx
<Position at={{ anchor: 'center' }} style={{ transform: 'rotate(8deg)' }}>
  <Container width={320}>…</Container>
</Position>
```

## Scene 作用域固定层

scroll 模式的 `fixed` 将内容放入 Scene 固定层。该 Scene 可见期间，元素保持相对于屏幕的位置，并随 Scene 离开。没有固定层容器时使用 sticky 定位。

带 transform 的祖先会改变原生 `position: fixed` 的定位包含块。在 Scene 内使用 `fixed` 属性，详见[固定元素](/docs/04-fixed-layer)。

需要跨场景持续显示的 UI 放在 CineView 外部。

## 常见误用

- 用 Position 设置设计坐标，用 Container 设置宽高与间距。
- 用 `at.anchor` 居中，使自定义变换与居中变换组合。
- 常驻导航放在 CineView 外部。

---

宽度换算规则见[响应式模型](/docs/05-responsive)，固定元素的行为见[固定层](/docs/04-fixed-layer)。
