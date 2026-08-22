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

## Props

Every field and default below is checked against `PositionProps` in `src/types/index.ts` and the Position implementation. `Position` also accepts native `div` attributes (`Omit<HTMLAttributes, 'children' | 'style' | 'className'>`).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `at.x` | `number` | `0` | Absolute x coordinate (design px, converted through the single-ruler `convert`). If either `x` or `y` is present, absolute positioning applies and the missing axis falls back to `0`; absolute positioning takes precedence over the offset chain. |
| `at.y` | `number` | `0` | Absolute y coordinate (design px). |
| `at.offsetX` | `number` | — | Relative x offset: accumulated on top of the previous `Position`'s coordinate (the relative chain). Applies only when neither `x` nor `y` is given. |
| `at.offsetY` | `number` | — | Relative y offset, same rule. |
| `at.anchor` | `'center' \| 'center-x' \| 'center-y'` | — | Centering anchor. When set, the axis centers against the viewport (no hand-written `translate(-50%)`), and that axis's `x`/`y` become offsets from the center (design px); a centered axis ignores the offset chain. |
| `layer.fixed` | `boolean` | `false` | In scroll mode, mounts into this Scene's scene-scoped fixed layer (portal, never floats across chapters); degrades to sticky when the Scene has no fixed-layer host. |
| `children` | `ReactNode` | `required` | Content. |
| `style` | `React.CSSProperties` | — | Extra styles. `position`/`left`/`top` are owned by Position; the user `transform` is merged with the centering transform (centering first). |
| `className` | `string` | — | CSS class name. |
