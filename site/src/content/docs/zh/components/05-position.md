---
title: Position
eyebrow: COMPONENTS / POSITION
---

Position 负责 Scene 内部元素的空间坐标定位。所有坐标均按设计稿 px 声明并经由 px2vw 响应式比例等比换算；盒模型尺寸由 [Container](/docs/07-container) 管理，标准嵌套层级为 `Scene → Position → Container`。

## Props

| prop        | 类型                                          | 说明                                       |
| ----------- | --------------------------------------------- | ------------------------------------------ |
| `at`        | `{ x?, y?, offsetX?, offsetY?, anchor? }`     | 坐标声明，数值均为设计 px                  |
| `fixed`     | boolean                                       | scroll 模式下挂进 scene-scoped fixed layer |
| `children`  | ReactNode                                     | 必填                                       |
| `style`     | CSSProperties                                 | 附加到根 div                               |
| `className` | string                                        | 根 div 类名                                |
| 其余        | HTMLAttributes（除 children/style/className） | 透传根 div                                 |

forwardRef 指向根 div。

### at 字段

| 字段                  | 类型                                   | 语义                                        |
| --------------------- | -------------------------------------- | ------------------------------------------- |
| `x` / `y`             | number                                 | 绝对设计坐标，按设计比例换算                |
| `offsetX` / `offsetY` | number                                 | 相对最近上层 Position 的坐标增量（设计 px） |
| `anchor`              | `'center' \| 'center-x' \| 'center-y'` | 居中对齐基准，被居中的轴相对可视区域居中    |

### 定位裁决

每个轴按优先级解析，高者优先：

1. **居中**：该轴在 `anchor` 中被声明 → 相对可视区域居中（见「居中对齐」小节）。
2. **绝对**：`x` / `y` 任一存在即触发，未给的轴补 `0`。
3. **相对链**：仅给了 `offsetX` / `offsetY` → 在最近上层 Position 的坐标上累加。绝对定位一旦触发，offset 链整体让位。
4. 都不给 → `(0, 0)`。

## 居中对齐

`anchor: 'center'` 水平 + 垂直双向居中；`'center-x'` / `'center-y'` 只居中一个轴，另一轴仍是绝对坐标。

居中之后，被居中轴上的 `x` / `y` 改作「相对中心的偏移量」（设计 px，同样按设计比例换算）：`anchor: 'center', y: -100` 表示整体居中再上移 100。被居中的轴忽略 `offsetX` / `offsetY` 相对链。

不需要手写 `translate(-50%, -50%)`，框架自己合成，并把居中 transform 排在第一位、`style.transform` 叠加在后：

```tsx
<Position at={{ anchor: 'center' }} style={{ transform: 'rotate(8deg)' }}>
  <Container width={320}>…</Container>
</Position>
```

## scene-scoped fixed layer

scroll 模式下传 `fixed`，元素 portal 进本 Scene 的 fixed layer 宿主：滚动时保持屏幕固定位置，离开宿主 Scene 随之退场。Scene 没有 fixed layer 宿主时降级为 `sticky`。

> 不要在 scroll 锁定区里直接声明原生 `position: fixed`：锁定区用真实 transform 移动内容，`fixed` 不再相对于浏览器窗口解析，而是相对带 transform 的祖先。正确做法是传 `fixed` prop。

scene-scoped 是严格边界：fixed layer 以 Scene 为作用域，跨场景的常驻漂浮不属于这套模型。

## 常见误用

- **拿 Container 做定位**：定位始终归 Position，Container 只管盒子多大。
- **给 fixed 元素手写 `translate(-50%)` 居中**：用 `at.anchor`。
- **期望 fixed layer 跨场景漂浮**：不会，也不支持。

---

响应式换算模型（仅按宽度等比换算、比例保持一致）详见 [响应式模型](/docs/05-responsive)；fixed layer 的机制与限制详见 [Fixed Layer](/docs/04-fixed-layer)。
