---
title: Position
eyebrow: COMPONENTS / POSITION
---

Position places content inside a Scene using design-pixel coordinates. Use [Container](/docs/07-container) for responsive dimensions and spacing.

## Props

| prop        | Type                                             | Notes                                                     |
| ----------- | ------------------------------------------------ | --------------------------------------------------------- |
| `at`        | `{ x?, y?, offsetX?, offsetY?, anchor? }`        | Coordinate declaration, all values in design px           |
| `fixed`     | boolean                                          | Fixed to the screen in scroll mode; leaves with its Scene |
| `children`  | ReactNode                                        | Required                                                  |
| `style`     | CSSProperties                                    | Applied to the root div                                   |
| `className` | string                                           | Root div class                                            |
| rest        | HTMLAttributes (except children/style/className) | Passed through to the root div                            |

The forwarded `ref` points to the root div.

### at fields

| Field                 | Type                                   | Semantics                                                          |
| --------------------- | -------------------------------------- | ------------------------------------------------------------------ |
| `x` / `y`             | number                                 | Absolute design coordinates, converted against the conversion base |
| `offsetX` / `offsetY` | number                                 | Delta from the nearest enclosing Position (design px)              |
| `anchor`              | `'center' \| 'center-x' \| 'center-y'` | Centers the selected axes within the containing block              |

### Positioning precedence

Each axis resolves in priority order, highest first:

1. **Centered**: an axis selected by `anchor` is centered in its containing block.
2. **Absolute**: either `x` or `y` present; a missing axis defaults to `0`.
3. **Relative coordinates**: with only `offsetX` / `offsetY`, add these values to the nearest enclosing Position coordinates. Declaring either `x` or `y` makes both offsets ineffective.
4. None given → `(0, 0)`.

## Centering anchors

`anchor: 'center'` centers both axes. `'center-x'` and `'center-y'` center one axis; the other retains its normal coordinate rules.

After centering, `x` / `y` on a centered axis become "offset from center" values (design px, still converted against the conversion base): `anchor: 'center', y: -100` means centered, then shifted up by 100. A centered axis ignores `offsetX` / `offsetY`.

Position adds the centering transform first, then combines it with `style.transform`:

```tsx
<Position at={{ anchor: 'center' }} style={{ transform: 'rotate(8deg)' }}>
  <Container width={320}>…</Container>
</Position>
```

## Fixed elements that follow a Scene

In scroll mode, `fixed` places content in the Scene's fixed layer. It keeps a screen-aligned position while that Scene is visible and leaves with the Scene. Without a fixed-layer host, it uses sticky positioning.

A transformed ancestor changes the containing block for native `position: fixed`. Use the `fixed` prop inside a Scene; see [Fixed elements](/docs/04-fixed-layer).

Place UI that must persist across Scenes outside Cineview.

## Usage notes

- Use Position for design-coordinate placement and Container for dimensions and spacing.
- Use `at.anchor` for centering so custom transforms compose with it.
- Put persistent navigation outside Cineview.

---

See [Responsive conversion](/docs/05-responsive) for width-based scaling and [Fixed elements](/docs/04-fixed-layer) for scrolling behavior.
