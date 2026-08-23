---
title: Position
eyebrow: API REFERENCE
---

`<Position>` owns coordinate placement and scene-scoped fixed mounting; box dimensions belong to `Container`. This page is the complete field reference; usage lives in the [Position guide](/docs/position).

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

## Positioning precedence

The adjudication order of the three placement modes — when they conflict, the higher one wins:

1. **Absolute** — takes effect when either `at.x` / `at.y` is present; the missing axis falls back to `0`;
2. **Centering anchor** — with `at.anchor` set, the centered axis centers against the viewport, that axis's `x`/`y` become offsets from the center (design px), and that axis ignores the offset chain;
3. **Relative chain** — `at.offsetX` / `at.offsetY` only, accumulated on top of the previous `Position`'s coordinate.

```tsx
/* Absolute: x present, y defaults to 0 */
<Position at={{ x: 100, offsetY: 40 }}>...</Position>

/* Centered: x/y become offsets from the centered axes */
<Position at={{ anchor: 'center', y: -100 }}>...</Position>

/* Relative chain: stacked on the previous Position */
<Position at={{ offsetX: 24, offsetY: 0 }}>...</Position>
```

Note how `offsetY` is ignored in the first example — once absolute positioning triggers, the offset chain yields entirely, and the missing absolute axis falls back to `0` rather than back to the relative value.

## Types

### at.anchor

| Value | Meaning |
| --- | --- |
| `'center'` | Centers on both axes; `x` / `y` both become offsets from the center |
| `'center-x'` | Centers horizontally only; `y` remains an absolute design coordinate |
| `'center-y'` | Centers vertically only; `x` remains an absolute design coordinate |

A centered axis ignores the offset chain; the other axis keeps its usual rules. Example: `anchor: 'center', x: 0, y: -100` means horizontally centered, vertically centered then shifted up 100 design px.

### layer.fixed

Only meaningful in scroll mode: it mounts into **this Scene's** scene-scoped fixed layer (a portal), holding its viewport position through the scroll while never floating across chapters — it exits with its host Scene. When the Scene has no fixed-layer host it degrades to `sticky`. In drag mode the scenes are full-screen stacks already, so the field has no additional effect.

### Shared types

- Design px → viewport conversion (the single-ruler model) → [responsive concept page](/docs/responsive)
- The scene scoping model of fixed layers → [fixed layer concept page](/docs/fixed-layer)
