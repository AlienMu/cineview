---
title: Position
eyebrow: COORDINATES
---

Position 拥有坐标与 scene-scoped fixed 挂载；Container 拥有盒尺寸。

## When to use

- 元素需要按设计稿坐标（设计 px，单尺子换算）放置在 Scene 内的确定位置时。
- 需要相对链排版——多个元素基于上一个 Position 的坐标累加偏移时。
- scroll 模式下需要「跟随滚动固定在视口、但只在本场景内」的覆盖层时（`layer.fixed`，scene-scoped，绝不跨章节漂浮）。

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

三种定位方式按优先级裁决：绝对定位（`x`/`y` 任一存在即生效，未给的轴补 `0`）> 居中锚点（`anchor` 设定后被居中的轴相对视口居中，`x`/`y` 改作相对中心的偏移量）> 相对链（仅 `offsetX`/`offsetY`，基于上一个 Position 累加）。冲突时高者优先——绝对定位一旦触发，offset 链整体让位。

`layer.fixed` 在 scroll 模式把元素挂进本 Scene 的 fixed layer（portal 实现）：滚动时保持视口位置，离开宿主 Scene 随之退场。Scene 没有 fixed layer 宿主时降级为 `sticky`。

## 常见误用

- **拿 Container 做定位**——定位始终归 Position；层级是 `Scene → Position → Container`。
- **给 fixed 元素手写 `translate(-50%)` 居中**——用 `at.anchor`，居中 transform 与用户 transform 会自动合并（居中在前）。
- **期望 fixed layer 跨场景漂浮**——scene-scoped 是硬边界；跨场景的常驻覆盖层不属于这套模型。

---

完整字段与定位优先级裁决见 [Position API](/docs/position-api)。
