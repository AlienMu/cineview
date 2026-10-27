---
title: Custom drawing
eyebrow: GUIDES / CUSTOM DRAWING
---

For pictures that presets and `from`/`to` cannot make, such as a canvas, WebGL or SVG computed from progress, subscribe to an element's timeline and draw from its progress.

<!-- example:drawing -->

## Subscribe to a timeline

Pick a `cv-animate` as the anchor; its timeline sets the drawing's progress:

```html
<cv-scene zone>
  <cv-animate id="anchor" from="opacity:.35" to="opacity:1" duration="2000" ease="linear">
    <canvas id="art" aria-hidden="true"></canvas>
  </cv-animate>
</cv-scene>
```

```js
const anchor = document.getElementById('anchor');
await customElements.whenDefined('cv-animate');
const stop = anchor.timeline.subscribe((frame) => draw(frame.progress));
draw(anchor.timeline.progress);
```

- The callback runs at most once per frame, with `progress`, `phase` and `source`.
- Draw once from the current `timeline.progress` after subscribing, instead of waiting for the first change.
- In locked zones and drag scenes, progress follows the reader's scroll or finger. In ordinary scroll it is an entrance played on time, computed frame by frame only while it has subscribers.

## Where progress comes from

A timeline reflects time sources only (`scene`, `enter`, `eye`, `clock`). An element that uses only `view`, `page` or the speed and direction signals keeps an `idle` timeline, because its progress is a position, not a time. To draw from the scroll position, put the anchor in a locked zone, or read the scroll position in the page's own script.

## Start and stop

- Draw only when it is needed: a scene dispatches `cv-activate` when it enters the rendered range and `cv-deactivate` when it leaves, the places to start and stop your own animation loop.
- When the page removes this content, call the function `subscribe` returned, and stop your own `requestAnimationFrame` and observers.
- Keep the canvas sized to its element: a `ResizeObserver` resets the canvas's pixel size and redraws at the current progress.

## Accessibility and reduced motion

- A canvas means nothing to a screen reader: give it `aria-hidden="true"` and put what it conveys in real text.
- With reduced motion on, draw the final picture directly:

```js
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
anchor.timeline.subscribe((frame) => draw(still ? 1 : frame.progress));
```
