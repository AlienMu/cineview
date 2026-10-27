---
title: cv-pause
eyebrow: ELEMENTS / PAUSE
---

`cv-pause` is a toggle button that pauses and resumes motion the stage plays on time (entrances and loops), for WCAG 2.2.2. The reader's own scroll and drag keep working.

```html
<cv-pause>Pause motion</cv-pause>
<cv-pause for="story">Pause</cv-pause>
```

## Usage

- Without `for` it controls the closest stage, or else the first in the document; with `for` it controls the stage with that id.
- Without content it shows Pause motion and Play motion.
- `aria-pressed` follows the stage, for styling: `cv-pause[aria-pressed="true"]`.
- A page with loops or autoplay longer than 5 seconds offers one.

## From a script

The stage's `stage.pause()` and `stage.play()`, or its `paused` attribute, do the same; the stage dispatches `cv-pause` and `cv-play` when it pauses and resumes. See [cv-stage](/docs/09-stage).
