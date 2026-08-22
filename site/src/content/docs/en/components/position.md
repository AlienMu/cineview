---
title: Position
eyebrow: COORDINATES
---

Position owns coordinates and scene-scoped fixed mounting. Container owns box dimensions.

## Coordinates and fixed layers

Position coordinates are design pixels. A fixed layer is scoped to its Scene and never floats across chapters.

```tsx
<Position at={{ x: 100, y: 220, offsetX: 8 }}>
  <Container width={420} height={180}>...</Container>
</Position>

<Position at={{ x: 0, y: 0 }} layer={{ fixed: true }}>
  <Overlay />
</Position>
```
