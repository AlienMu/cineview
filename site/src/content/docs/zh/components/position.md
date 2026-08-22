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
