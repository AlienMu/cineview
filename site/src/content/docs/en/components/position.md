---
title: Position
eyebrow: COORDINATES
---

Position owns coordinates and scene-scoped fixed mounting. Container owns box dimensions.

## When to use

- An element must sit at a deterministic spot inside a Scene by draft coordinates (design px through the single ruler).
- You need relative-chain layout: several elements stacking offsets on top of the previous Position's coordinate.
- In scroll mode you need an overlay that stays fixed in the viewport while scrolling but only within its own scene (`layer.fixed`, scene-scoped, never floats across chapters).

## Coordinates and fixed layers

Coordinates go on `at` (`x`/`y`/`offsetX`/`offsetY`/`anchor`), all in design pixels; a fixed overlay is declared with `layer.fixed`, scoped to its Scene and never floating across chapters.

The three placement modes adjudicate by precedence: absolute (effective once either `x`/`y` is present, the missing axis falling back to `0`) > centering anchor (with `anchor` set, the centered axis centers against the viewport and `x`/`y` become offsets from the center) > relative chain (`offsetX`/`offsetY` only, accumulated on the previous Position). When they conflict the higher wins; once absolute positioning triggers, the offset chain yields entirely.

`layer.fixed` in scroll mode mounts the element into its Scene's fixed layer (a portal): it holds its viewport position through the scroll and exits with its host Scene. When the Scene has no fixed-layer host it degrades to `sticky`.

## Common misuse

- **Using Container for placement**: placement always belongs to Position; the layering is `Scene → Position → Container`.
- **Hand-writing `translate(-50%)` on fixed elements**: use `at.anchor`; the centering transform merges with the user transform automatically (centering first).
- **Expecting a fixed layer to float across scenes**: scene scoping is a hard boundary; a cross-scene persistent overlay is not part of this model.

---

For the complete field reference and the positioning-precedence adjudication see the [Position API](/docs/position-api).
