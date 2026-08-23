---
title: Container
eyebrow: BOX MODEL
---

Container converts width, height, and supported style lengths with the same design-width ruler.

## When to use

- You need a box that scales proportionally with viewport width without distortion (cards, panels, media frames).
- You want to write draft-measured box-model values (width/height, padding, radius, font size) straight into code and let the framework convert them.
- Paired with Position in the `Scene → Position → Container` layering — Position decides where, Container decides how big.

## Size without a second ruler

Use Container for box dimensions. Do not use it as a coordinate owner; Position remains responsible for placement.

```tsx
<Container width={520} height={300} style={{ padding: 24 }}>
  <Card />
</Container>
```

`scale = viewportWidth / config.size` (width-only): `width={520}` renders as 260px on a 375px viewport (scale 0.5), and the numeric lengths inside `style` (padding/margin/gap/borderRadius/fontSize/…) convert as one block via `convertStyle`. String values (`'50%'`, `'1rem'`) are not converted and pass through — write lengths that should scale as numbers.

Container only works under a CineView — the conversion depends on the context-injected `convert`, and rendering outside a CineView throws in development mode.

## Common misuse

- **Using it as a coordinate owner** — passing `left`/`top` is a responsibility misuse, and the converted result takes no part in the positioning chain.
- **Writing font sizes as `'28px'` strings** — they do not convert; write the draft-measured value as the number `28`.
- **Using it for Scene layout** — Scene's `layout.width`/`height` have their own semantics; Container is for the box model inside a Scene.

---

For the complete field reference and worked conversion examples see the [Container API](/docs/container-api).
