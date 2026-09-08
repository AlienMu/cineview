---
title: Container
eyebrow: COMPONENTS / CONTAINER
---

Container scales numeric dimensions and supported style lengths by `viewportWidth / designWidth`. Width and height use the same ratio.

## Props

| prop        | Type                                             | Notes                                                               |
| ----------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| `width`     | number                                           | Container width (design px)                                         |
| `height`    | number                                           | Container height (design px)                                        |
| `style`     | CSSProperties                                    | Whole style block; numeric length values are converted as design px |
| `className` | string                                           | Root div class                                                      |
| `children`  | ReactNode                                        | Required                                                            |
| rest        | HTMLAttributes (except children/style/className) | Passed through to the root div                                      |

The forwarded `ref` points to the root div.

Container only works under `<CineView>`: conversion depends on the context. Rendering it outside CineView throws in development builds.

## Conversion behavior

`scale = viewportWidth / designWidth` (`designWidth` defaults to 750). `width={520}` renders as 260px in a 375px viewport (scale 0.5).

Numeric values in `style` are converted through an explicit property allowlist, covering:

- Sizing: `width` / `height` / `minWidth` / `maxWidth` / `minHeight` / `maxHeight`
- Positioning and inset: `top` / `right` / `bottom` / `left` / `inset*`
- Margins and padding: `margin*` / `padding*`
- Borders: `borderWidth*` / `borderRadius*`
- Spacing and type: `gap` / `columnGap` / `rowGap` / `fontSize` / `letterSpacing` / `outlineWidth` / `outlineOffset`

CSS strings such as `'50%'` and `'1rem'` pass through unchanged. Unitless numbers such as `zIndex`, `opacity`, `fontWeight`, and `lineHeight` are not scaled.

```tsx
<Container width={520} style={{ padding: 24, borderRadius: 12, fontSize: 28 }}>
  …
</Container>
```

## Common mistakes

- Use [Position](/docs/05-position) to place content by design coordinates. Container does not set a positioning mode.
- Use numeric `fontSize: 28` to scale a design font size. The string `'28px'` stays at 28 CSS pixels.
- Use `Scene.layout` for scene dimensions and Container for content inside it.

---

See [Responsive conversion](/docs/05-responsive) for the design-width calculation.
