---
title: Container
eyebrow: API REFERENCE
---

`<Container>` converts `width`, `height`, and supported style lengths with the same design-width ruler. This page is the complete field reference; usage lives in the [Container guide](/docs/container).

## Props

Every field and default below is checked against `ContainerProps` in `src/types/index.ts` and the Container implementation. `Container` also accepts native `div` attributes (`Omit<HTMLAttributes, 'children' | 'style' | 'className'>`), and it only works under a CineView (a missing context throws in development mode).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `width` | `number` | — | Container width (design px), converted through the single-ruler `convert`. |
| `height` | `number` | — | Container height (design px), same rule. |
| `children` | `ReactNode` | `required` | Content. |
| `style` | `React.CSSProperties` | — | Extra styles; every length inside (padding/margin/gap/borderRadius/fontSize/…) is converted as design px via `convertStyle` as one block. |
| `className` | `string` | — | CSS class name. |

## Conversion semantics

`width` / `height` and the numeric lengths inside `style` share one ruler: `scale = viewportWidth / config.size` (default 750) — width-only, never distorted. The conversion happens solely on the `convert` / `convertStyle` provided by CineViewContext at mount; `Container` itself holds no second ruler.

```tsx
<CineView config={{ size: 750 }}>
  {/* On a 375px viewport (scale 0.5): rendered 260×150, padding 12, radius 10 */}
  <Container width={520} height={300} style={{ padding: 24, borderRadius: 20 }}>
    <Card />
  </Container>
</CineView>
```

`convertStyle` converts **as one block**: it walks the numeric length fields of the style object and multiplies each by `scale`; non-length fields (`color`, `display`, `zIndex`, …) pass through unchanged; string values (`'50%'`, `'1rem'`) are not converted and pass through as-is — write lengths that should scale as numbers.

What one set of draft values renders to across viewport widths (`config.size = 750`):

| Viewport | `scale` | `width={520}` | `height={300}` | `padding: 24` | `borderRadius: 20` |
| --- | --- | --- | --- | --- | --- |
| 375px | 0.5 | 260px | 150px | 12px | 10px |
| 750px | 1.0 | 520px | 300px | 24px | 20px |
| 1125px | 1.5 | 780px | 450px | 36px | 30px |

## Constraints and common misuse

- **Container is not a coordinate owner.** Placement (`position` / `left` / `top` / centering) always belongs to `Position`; passing positioning styles to Container is a responsibility misuse, and the converted result is not adjudicated by the positioning chain.
- **Must be used under a CineView.** The conversion depends on the `convert` injected by CineViewContext; rendering outside a CineView throws in development mode (production behaviour is undefined).
- **Do not use it for Scene layout.** Scene's `layout.width` / `layout.height` have their own semantics (numbers go through the same ruler); Container is for the box model inside a Scene. The layering is `Scene → Position → Container`.
- **Font sizes are converted too.** `style={{ fontSize: 28 }}` converts as design px — write the value measured from the draft directly; the string `'28px'` would not convert.

## Related pages

- The single-ruler model (width-only) → [responsive concept page](/docs/responsive)
- Coordinate placement (Container's dual) → [Position API](/docs/position-api)
- The box-dimension tutorial → [Container guide](/docs/container)
