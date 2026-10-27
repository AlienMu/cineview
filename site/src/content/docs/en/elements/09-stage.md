---
title: cv-stage
eyebrow: ELEMENTS / STAGE
---

`cv-stage` is the page. Scenes (`cv-scene`) are its direct children, and it needs at least one. It decides whether the reader scrolls or drags, and it is the script interface.

```html
<cv-stage design-width="1200">
  <cv-scene>…</cv-scene>
  <cv-scene zone>…</cv-scene>
</cv-stage>
```

## Attributes

| Attribute | Default | Notes |
| --- | --- | --- |
| `input` | `scroll` | `scroll` or `drag`; see [scroll and drag](/docs/03-input-modes) |
| `design-width` | `750` | The design width in px. The stage's content area is at most this wide, centered; `--cv-unit` scales from it |
| `margin` | `50` | Entrance margin in design px; two values set entrance and exit separately |
| `first-scene-timeout` | `3000` | The longest first-screen wait for assets; see [first screen](/docs/07-first-screen) |
| `paused` | `false` | Pauses motion played on time: entrances and loops |
| `fallback` | `false` | Turns off the browser's native scroll timelines and computes scroll motion in script; for testing |
| `transition-duration` | `800` | Drag mode: how long the switch after release takes, in ms |
| `threshold` | Not set | Drag mode: when a release switches; see [drag mode](/docs/16-drag-mode) |
| `unit`, `scale` | `time`, `10` | Drag mode: how finger distance becomes time |

## Design width and units

Inside scenes, `--cv-unit` sizes things in design pixels. With `design-width="1200"`, `calc(var(--cv-unit) * 24)` is 24 px in a 1200 px wide content area and 12 px in a 600 px one:

```css
h1 { font-size: calc(var(--cv-unit) * 64); }
```

The content area is at most `design-width` wide, so a full-width page sets it large enough, such as `1920`.

## Script interface

| Member | Does |
| --- | --- |
| `stage.ready` | A Promise that settles when the first build is done; awaited after `cv-ready`, it settles at once |
| `stage.current` | The current scene's index, -1 before the first build |
| `stage.goTo(target, { animated })` | Go to a scene by index or id; `animated: false` jumps without the transition |
| `stage.pause()`, `stage.play()` | Pause and resume motion played on time (entrances and loops) |
| `stage.refresh()` | Measure again after a layout change the stage cannot see |

```js
const stage = document.querySelector('cv-stage');
await stage.ready;
stage.goTo('pricing');
```

The events the stage dispatches and the state attributes it carries are in [states and events](/docs/08-states-and-events).
