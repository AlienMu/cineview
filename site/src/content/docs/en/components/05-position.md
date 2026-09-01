---
title: Position
eyebrow: COMPONENTS / POSITION
---

Position owns where an element sits inside a Scene. Coordinates are written in design px and converted against the px2vw conversion base; box sizing belongs to [Container](/docs/07-container). The hierarchy is fixed: `Scene → Position → Container`.

## Props

| prop        | Type                                             | Notes                                                   |
| ----------- | ------------------------------------------------ | ------------------------------------------------------- |
| `at`        | `{ x?, y?, offsetX?, offsetY?, anchor? }`        | Coordinate declaration, all values in design px         |
| `fixed`     | boolean                                          | Mounts into the scene-scoped fixed layer in scroll mode |
| `children`  | ReactNode                                        | Required                                                |
| `style`     | CSSProperties                                    | Applied to the root div                                 |
| `className` | string                                           | Root div class                                          |
| rest        | HTMLAttributes (except children/style/className) | Passed through to the root div                          |

forwardRef points at the root div.

### at fields

| Field                 | Type                                   | Semantics                                                          |
| --------------------- | -------------------------------------- | ------------------------------------------------------------------ |
| `x` / `y`             | number                                 | Absolute design coordinates, converted against the conversion base |
| `offsetX` / `offsetY` | number                                 | Delta from the nearest enclosing Position (design px)              |
| `anchor`              | `'center' \| 'center-x' \| 'center-y'` | Centering anchor; centered axes align to the viewport center       |

### Positioning precedence

Each axis resolves in priority order, highest first:

1. **Centered**: the axis is named by `anchor` → centered on the viewport (see "Centering anchors").
2. **Absolute**: either `x` or `y` present; a missing axis defaults to `0`.
3. **Relative chain**: only `offsetX` / `offsetY` given → accumulated on top of the nearest enclosing Position. Once absolute positioning triggers, the offset chain yields entirely.
4. None given → `(0, 0)`.

## Centering anchors

`anchor: 'center'` centers horizontally and vertically; `'center-x'` / `'center-y'` center one axis while the other stays an absolute coordinate.

After centering, `x` / `y` on a centered axis become "offset from center" values (design px, still converted against the conversion base): `anchor: 'center', y: -100` means centered, then shifted up by 100. A centered axis ignores the `offsetX` / `offsetY` relative chain.

No hand-written `translate(-50%, -50%)` needed; the framework composes it, placing the centering transform first and custom `style.transform` after it:

```tsx
<Position at={{ anchor: 'center' }} style={{ transform: 'rotate(8deg)' }}>
  <Container width={320}>…</Container>
</Position>
```

## Scene-scoped fixed layer

In scroll mode, `fixed` portals the element into its Scene's fixed layer host: it holds its viewport position while scrolling and exits together with its host Scene. When the Scene has no fixed layer host, it degrades to `sticky`.

> Never write raw `position: fixed` inside a locked zone: the zone moves content with real transforms, so fixed no longer resolves against the viewport and lands inside the ancestor transform. Use the `fixed` prop instead.

Scene-scoped is a strict boundary: the fixed layer is scoped to its Scene, and persistent overlays that float across scenes are not part of this model.

## Common mistakes

- **Positioning with Container**: positioning always belongs to Position; Container only owns how big the box is.
- **Hand-written `translate(-50%)` on fixed elements**: use `at.anchor` instead.
- **Expecting the fixed layer to float across scenes**: it doesn't, by design.

---

For the conversion base itself (width-only scaling), see the [responsive model](/docs/05-responsive); for fixed-layer mechanics and considerations, see [Fixed Layer](/docs/04-fixed-layer).
