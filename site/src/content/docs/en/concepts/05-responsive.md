---
title: Responsive conversion base
eyebrow: CONCEPTS / RESPONSIVE
---

Set `designWidth` to the design's width (default 750). Numeric design lengths scale by `viewportWidth / designWidth` on both axes.

## Conversion rules

```tsx
<CineView designWidth={750}>   // design file is 750px wide
```

- At a 750px viewport, scale = 1: one design px is one screen px.
- At a 1500px viewport, scale = 2: numeric design lengths double.
- Height uses the same width-derived ratio.

## Which values convert

`Position` converts design coordinates. `Container` converts numeric dimensions and supported length properties in `style`, such as padding, margin, gap, border radius, and font size.

```tsx
<Position at={{ x: 96, y: 160 }}>
  <Container width={420} height={240} style={{ padding: 24, gap: 12 }}>
    {/* all converted against the 750 design width */}
  </Container>
</Position>
```

`Image`'s numeric width/height goes through the same base. A number means design px; write percentages, `auto`, or CSS functions in style and they pass through untouched.

## Content taller than the viewport

Width-based scaling does not guarantee that content fits vertically. Use ordinary scroll scenes for long content, or split a full-screen presentation into scenes. Configure scene height and overflow for the intended layout.

## Center alignment and baseline configuration

`Position`'s `at.anchor` accepts `'center' | 'center-x' | 'center-y'`:

```tsx
<Position at={{ anchor: 'center' }}>{/* containing block center */}</Position>
<Position at={{ anchor: 'center-x', y: 120 }}>{/* centered horizontally */}</Position>
```

Centering uses the containing block, usually the Scene or fixed-layer host. On a centered axis, `x` or `y` becomes an offset from center in design pixels, and `offsetX` or `offsetY` is ignored. Position applies the centering transform before any custom `style.transform`.

## Next steps

- [Position API](/docs/05-position): full prop table for coordinates and anchors
- [Container API](/docs/07-container): full box-model conversion behavior
- [Modes](/docs/01-modes): the shared layout premise under drag and scroll
