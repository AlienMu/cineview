---
title: Scroll and drag
eyebrow: GETTING STARTED / INPUT MODES
---

The `input` attribute of `cv-stage` decides how the reader moves forward: `scroll` (the default) scrolls like any web page; `drag` shows one scene per screen and switches scenes with the finger.

## Scroll

On a scrolling page the scenes follow document order, and several kinds can be mixed:

| Scene | What the reader sees |
| --- | --- |
| `<cv-scene>` | An ordinary section; its elements play their entrances on time once they are fully in view |
| `<cv-scene zone>` | A locked zone: the screen holds and the scroll distance moves the scene's time, 1 ms per pixel |
| `<cv-scene track="x">` | The content lays out in a row that moves sideways with the scroll |
| `<cv-scene stack>` | The scene stays in place while the next one slides over it |

A locked zone is as long as the element that ends last; [timelines](/docs/05-timeline) has an example.

## Drag

```html
<cv-stage input="drag" transition-duration="600">
  <cv-scene id="one">…</cv-scene>
  <cv-scene id="two">…</cv-scene>
</cv-stage>
```

Each scene fills the screen. While the finger moves, the next scene's entrance follows it; on release the page switches past the threshold and springs back short of it. The Up and Down arrow keys, Page Up, Page Down, Home and End switch scenes too. [Drag mode](/docs/16-drag-mode) covers it in full.

## Which one

- Long content, text to read, or readers who expect an ordinary web page: scroll.
- One picture per screen, mostly on phones, like flipping through photos or watching a short film: drag.
- Both for the same content: two pages can share the same scene markup and differ only in `input`.

## Jump to a scene

A link to a scene's id (`<a href="#two">`) goes to that scene in both modes. From a script, call `stage.goTo('two')` or `stage.goTo(1)`; pass `{ animated: false }` to jump without the transition.
