---
title: cv-fixed
eyebrow: ELEMENTS / FIXED
---

`cv-fixed` is a scene's fixed layer: while the scene passes the screen, its content holds still, and it shows only within that scene. It suits chapter labels, notes that belong to one scene, and buttons that travel with one section.

```html
<cv-scene>
  <cv-fixed><nav class="chapter">Chapter two</nav></cv-fixed>
  <section>…</section>
</cv-scene>
```

## Behavior

- It covers the whole scene and clips whatever goes past it; its content sticks to the top of the screen, one screen high.
- Until the scene's top reaches the top of the screen, the layer sits at the scene's top; the scene's bottom edge carries it away.
- The layer takes no pointer events; its content does.

## Content for the whole page

`cv-fixed` belongs to its scene. Navigation or buttons that show across the whole page go outside `cv-stage`, with ordinary CSS fixed positioning.
