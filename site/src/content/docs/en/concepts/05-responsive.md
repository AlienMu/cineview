---
title: Responsive conversion base
eyebrow: CONCEPTS / RESPONSIVE
---

CineView's whole responsive model has one conversion base: `designWidth` (design width, default 750). Every layout value converts by `scale = viewportWidth / size`, and x and y share that same ratio: layout scales by width alone and height follows, so shapes keep their proportions.

## The conversion rule

```tsx
<CineView designWidth={750}>   // design file is 750px wide
```

- At a 750px viewport, scale = 1: one design px is one screen px.
- At a 1500px viewport, scale = 2: everything doubles, aspect ratios hold.
- The y axis uses the same width-derived scale. Elements never stretch vertically on a taller screen. A square stays a square.

## Which values convert

Two components consume the same base, with orthogonal jobs:

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

Converting on width alone doesn't guarantee everything fits vertically. When a scene's content runs taller than the screen, let it overflow into the document flow. Don't shrink elements to fit the height; that breaks the proportions. Pacing between beats is drag paging's job, not scaling's.

## Center anchors

`Position`'s `at.anchor` accepts `'center' | 'center-x' | 'center-y'`:

```tsx
<Position at={{ anchor: 'center' }}>   {/* dead center */}
<Position at={{ anchor: 'center-x', y: 120 }}>   {/* centered horizontally, y from top */}
```

Once an axis is centered, its `x`/`y` becomes an offset _from center_ (still design px, still converted) and that axis's offset chain is ignored. It renders as `calc(50% + converted offset)` plus `translate(-50%)`, so you don't compensate for element size yourself.

## Next steps

- [Position API](/docs/05-position): full prop table for coordinates and anchors
- [Container API](/docs/07-container): full box-model conversion behavior
- [Modes](/docs/01-modes): the shared layout premise under drag and scroll
