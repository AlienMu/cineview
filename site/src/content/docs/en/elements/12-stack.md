---
title: cv-stack
eyebrow: ELEMENTS / STACK
---

`cv-stack` brings cards in one after another. Each of its children is a card.

```html
<cv-scene zone>
  <cv-stack step="52" duration="600" covered="recede">
    <article class="card">…</article>
    <article class="card">…</article>
    <article class="card">…</article>
  </cv-stack>
</cv-scene>
```

<!-- example:stack -->

## Attributes

| Attribute | Notes |
| --- | --- |
| `step` | How many px of each covered card stay visible |
| `covered` | How a covered card looks: `dim` or `recede` |
| `duration` | How long each card takes to arrive |
| `delay`, `after`, `name`, `at`, `ease` | As on `cv-animate` |

## Two behaviors

- In locked zones and drag mode the first card is there from the start, and the others rise from below one after another along the scene's timeline and settle on the deck. `cv-stack` then has `data-cv-dealt`.
- In ordinary scroll each card sticks `step` px lower than the one before, and later cards scroll over earlier ones.
- A card covered entirely is not painted.

## Veil color

Covered cards darken by default. With `--cv-veil` set on the `cv-stack` or an ancestor, a covered card is tinted with that color instead, its text included; the color's alpha is the depth at full cover:

```css
.deck { --cv-veil: rgb(200 120 80 / 45%); }
```
