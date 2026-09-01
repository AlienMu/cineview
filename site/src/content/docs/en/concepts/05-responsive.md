---
title: Responsive conversion base
eyebrow: CONCEPTS / RESPONSIVE
---

CineView's responsive model relies on a single conversion base: `designWidth` (design width, default 750). Every layout value converts by `scale = viewportWidth / designWidth`, and both axes share this ratio: layout scales strictly by width and height follows, preserving original proportions.

## Conversion rules

```tsx
<CineView designWidth={750}>   // design file is 750px wide
```

- At a 750px viewport, scale = 1: one design px is one screen px.
- At a 1500px viewport, scale = 2: everything doubles, aspect ratios hold.
- The y-axis uses the same width-derived scale. Elements do not stretch vertically on a taller screen.

## Which values convert

Two components consume the same baseline with distinct roles:

- `Position`: `at.x / at.y / at.offsetX / at.offsetY`, **where** an element sits.
- `Container`: `width` / `height` shortcuts, plus every length inside `style` (padding/margin/gap/borderRadius/fontSize …), **how big the box is**.

```tsx
<Position at={{ x: 96, y: 160 }}>
  <Container width={420} height={240} style={{ padding: 24, gap: 12 }}>
    {/* all converted against the 750 design width */}
  </Container>
</Position>
```

`Image`'s numeric width/height goes through the same base. A number means design px; write percentages, `auto`, or CSS functions in style and they pass through untouched.

## Vertical overflow goes to the document flow

Converting on width alone does not guarantee everything fits vertically. When scene content exceeds viewport height, let it overflow into the document flow. Avoid shrinking elements to fit the vertical space, which compromises geometric ratios. Pacing between narrative beats belongs to scene management, not responsive scaling.

## Center alignment and baseline configuration

`Position`'s `at.anchor` accepts `'center' | 'center-x' | 'center-y'`:

```tsx
<Position at={{ anchor: 'center' }}>   {/* viewport center */}
<Position at={{ anchor: 'center-x', y: 120 }}>   {/* centered horizontally, y from top */}
```

Once an axis is centered, its `x`/`y` becomes an offset from center (still design px, converted accordingly) and that axis's offset chain is ignored. It renders as `calc(50% + converted offset)` plus `translate(-50%)`, eliminating manual size compensation.

## Next steps

- [Position API](/docs/05-position): full prop table for coordinates and anchors
- [Container API](/docs/07-container): full box-model conversion behavior
- [Modes](/docs/01-modes): the shared layout premise under drag and scroll
