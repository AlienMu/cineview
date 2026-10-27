---
title: Stack, fixed layer and pause
eyebrow: ELEMENTS / STACK FIXED PAUSE
---

Each of these elements does one job: `cv-stack` brings cards in one after another, `cv-fixed` holds content on the screen while its scene passes, and `cv-pause` is a button that pauses motion.

## cv-stack

Each child of `cv-stack` is a card.

```html
<cv-scene zone>
  <cv-stack step="52" duration="600" covered="recede">
    <article class="card">…</article>
    <article class="card">…</article>
    <article class="card">…</article>
  </cv-stack>
</cv-scene>
```

| Attribute | Notes |
| --- | --- |
| `step` | How many px of each covered card stay visible |
| `covered` | How a covered card looks: `dim` or `recede` |
| `duration` | How long each card takes to arrive |
| `delay`, `after`, `name`, `at`, `ease` | As on `cv-animate` |

- In locked zones and drag mode the first card is there from the start, and the others rise from below one after another along the scene's timeline and settle on the deck. `cv-stack` then has `data-cv-dealt`.
- In ordinary scroll each card sticks `step` px lower than the one before, and later cards scroll over earlier ones.
- A card covered entirely is not painted.

<!-- example:stack -->

## cv-fixed

`cv-fixed` is the scene's fixed layer: while the scene passes the screen, its content holds still, and it shows only within that scene.

```html
<cv-scene>
  <cv-fixed><nav class="chapter">Chapter two</nav></cv-fixed>
  <section>…</section>
</cv-scene>
```

- It covers the whole scene and clips whatever goes past it; its content sticks to the top of the screen, one screen high.
- Until the scene's top reaches the top of the screen, the layer sits at the scene's top; the scene's bottom edge carries it away.
- The layer takes no pointer events; its content does.
- Navigation for the whole page goes outside `cv-stage`.

## cv-pause

`cv-pause` is a toggle button that pauses and resumes motion the stage plays on time (entrances and loops), for WCAG 2.2.2. The reader's own scroll and drag keep working.

```html
<cv-pause>Pause motion</cv-pause>
<cv-pause for="story">Pause</cv-pause>
```

- Without `for` it controls the closest stage, or else the first in the document; with `for` it controls the stage with that id.
- Without content it shows Pause motion and Play motion.
- `aria-pressed` follows the stage, for styling: `cv-pause[aria-pressed="true"]`.
- A page with loops or autoplay longer than 5 seconds offers one.
