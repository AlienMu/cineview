---
title: Container
eyebrow: COMPONENTS / CONTAINER
---

Container converts `width`, `height`, and all numeric length values in `style` against a unified design width baseline. Dimensions from design drafts can be specified directly in code; the framework scales containers proportionally across screen sizes. Both horizontal and vertical dimensions share the same scale factor, preserving aspect ratios.

## Props

| prop        | Type                                             | Notes                                                               |
| ----------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| `width`     | number                                           | Container width (design px)                                         |
| `height`    | number                                           | Container height (design px)                                        |
| `style`     | CSSProperties                                    | Whole style block; numeric length values are converted as design px |
| `className` | string                                           | Root div class                                                      |
| `children`  | ReactNode                                        | Required                                                            |
| rest        | HTMLAttributes (except children/style/className) | Passed through to the root div                                      |

forwardRef points at the root div.

Container only works under `<CineView>`: conversion depends on the context. Rendering it outside CineView throws in development builds.

## Conversion behavior

`scale = viewportWidth / designWidth` (`designWidth` defaults to 750). `width={520}` renders as 260px in a 375px viewport (scale 0.5).

Numeric values in `style` are converted through an explicit property allowlist, covering:

- Sizing: `width` / `height` / `minWidth` / `maxWidth` / `minHeight` / `maxHeight`
- Positioning and inset: `top` / `right` / `bottom` / `left` / `inset*` (but Container is not the coordinate owner; see "Common mistakes")
- Margins and padding: `margin*` / `padding*`
- Borders: `borderWidth*` / `borderRadius*`
- Spacing and type: `gap` / `columnGap` / `rowGap` / `fontSize` / `letterSpacing` / `outlineWidth` / `outlineOffset`

String values (`'50%'`, `'1rem'`) are not converted and pass through as-is; non-length numeric properties (`zIndex`, `opacity`, `fontWeight`, `lineHeight`, etc.) are not converted: they represent scalar quantities rather than physical lengths.

```tsx
<Container width={520} style={{ padding: 24, borderRadius: 12, fontSize: 28 }}>
  …
</Container>
```

## Common mistakes

- **Using it as the coordinate owner**: positioning always belongs to [Position](/docs/05-position); the hierarchy is `Scene → Position → Container`. Passing `top` / `left` to a Container is a category error.
- **Writing font sizes as `'28px'` strings**: not converted. Provide the raw design numeric value directly: `28`.
- **Using it for Scene layout**: Scene's `layout.width` / `layout.height` have their own semantics; Container targets box models inside a Scene.

---

For the full conversion model (width-only, vertical overflow goes to document flow), see the [responsive model](/docs/05-responsive).
