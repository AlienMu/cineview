---
title: Responsive conversion base
eyebrow: CONCEPTS / RESPONSIVE
---

Set `designWidth` to the design width and maximum displayed width (default 750). The page adapts to its parent and centers at its width limit. Numeric lengths use `contentWidth / designWidth`, where `contentWidth` is the actual available page width.

## Conversion rules

```tsx
<Cineview designWidth={750}>   // design file is 750px wide
```

- In a 375px parent, the page is 375px wide and scale = 0.5.
- In a 1500px parent, the page stops at 750px and centers, with scale = 1. Space reserved for native scrollbars is subtracted from the content width.
- Vertical design values in `Position`, `Container`, and `Image` use the same width-derived ratio. `Scene.layout.height` does not.

## Minimum adaptive width

```tsx
<Cineview designWidth={1920} minWidth={1440}>
  <Scene>{/* Content */}</Scene>
</Cineview>
```

A 1000px parent keeps a 1440px layout; an 1800px parent uses 1800px. Above 1920px, the page stops growing and centers. On narrower screens, use the outer horizontal scrollbar to reach overflowing content. Horizontal dragging still navigates scenes.

Set both values to 1440 for a fixed width. Optional `minWidth` must be between 0 and `designWidth`; invalid values are ignored. Browser zoom remains native, and these limits use CSS pixels.

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

`Scene.layout.width` and `layout.height` differ from those components: numbers are CSS px, and CSS strings pass through unchanged. In drag mode, `layout.height` changes the content box without changing the full-screen navigation distance.

Numeric `x` and `y` in custom `Animate` variants use CSS pixels and do not use this design-size conversion.

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
