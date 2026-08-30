---
title: Position
eyebrow: COMPONENTS / POSITION
---

Position 管「元素放在 Scene 内的哪个坐标」。坐标一律用设计稿 px 书写，按 px2vw 换算基准折算；盒尺寸归 [Container](/docs/07-container)，层级固定为 `Scene → Position → Container`。

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
| `x` / `y`             | number                                 | 绝对设计坐标，按换算基准折算                |
| `offsetX` / `offsetY` | number                                 | 相对最近上层 Position 的坐标增量（设计 px） |
| `anchor`              | `'center' \| 'center-x' \| 'center-y'` | 居中锚点，被居中的轴相对视口居中            |

### 定位裁决

每个轴按优先级解析，高者优先：

1. **居中**：该轴在 `anchor` 中被声明 → 相对视口居中（见「居中锚点」小节）。
2. **绝对**：`x` / `y` 任一存在即触发，未给的轴补 `0`。
3. **相对链**：仅给了 `offsetX` / `offsetY` → 在最近上层 Position 的坐标上累加。绝对定位一旦触发，offset 链整体让位。
4. 都不给 → `(0, 0)`。

## 居中锚点

`anchor: 'center'` 水平 + 垂直双向居中；`'center-x'` / `'center-y'` 只居中一个轴，另一轴仍是绝对坐标。

居中之后，被居中轴上的 `x` / `y` 改作「相对中心的偏移量」（设计 px，同样按换算基准折算）：`anchor: 'center', y: -100` 表示整体居中再上移 100。被居中的轴忽略 `offsetX` / `offsetY` 相对链。

不需要手写 `translate(-50%, -50%)`，框架自己合成，并把居中 transform 排在第一位、`style.transform` 叠加在后：

```tsx
<Position at={{ anchor: 'center' }} style={{ transform: 'rotate(8deg)' }}>
  <Container width={320}>…</Container>
</Position>
```

## scene-scoped fixed layer

scroll 模式下传 `fixed`，元素 portal 进本 Scene 的 fixed layer 宿主：滚动时保持视口位置，离开宿主 Scene 随之退场。Scene 没有 fixed layer 宿主时降级为 `sticky`。

> 不要在 scroll 锁定区里裸写 `position: fixed`：锁定区用真实 transform 移动内容，`fixed` 不再相对视口解析，而是相对带 transform 的祖先。正确做法是传 `fixed` prop。

scene-scoped 是严格边界：fixed layer 以 Scene 为作用域，跨场景的常驻漂浮不属于这套模型。

## 常见误用

- **拿 Container 做定位**：定位始终归 Position，Container 只管盒子多大。
- **给 fixed 元素手写 `translate(-50%)` 居中**：用 `at.anchor`。
- **期望 fixed layer 跨场景漂浮**：不会，也不支持。

---

换算基准本身的规则（只按宽度折算、比例不失真）见 [响应式模型](/docs/05-responsive)；fixed layer 的限制与机制见 [Fixed Layer](/docs/04-fixed-layer)。
