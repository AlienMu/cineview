---
title: Stage and scene
eyebrow: ELEMENTS / STAGE AND SCENE
---

`cv-stage` is the page and `cv-scene` is one of its scenes. Scenes are direct children of the stage, and a stage needs at least one.

## cv-stage

| Attribute | Default | Notes |
| --- | --- | --- |
| `input` | `scroll` | `scroll` or `drag`; see [scroll and drag](/docs/v2/03-input-modes) |
| `design-width` | `750` | The design width in px. The stage's content area is at most this wide, centered; `--cv-unit` scales from it |
| `margin` | `50` | Entrance margin in design px; two values set entrance and exit separately |
| `first-scene-timeout` | `3000` | The longest first-screen wait for assets; see [first screen](/docs/v2/06-first-screen) |
| `paused` | `false` | Pauses motion played on time: entrances and loops |
| `fallback` | `false` | Turns off the browser's native scroll timelines and computes scroll motion in script; for testing |
| `transition-duration` | `800` | Drag mode: how long the switch after release takes, in ms |
| `threshold` | Not set | Drag mode: when a release switches; see [drag mode](/docs/v2/12-drag-mode) |
| `unit`, `scale` | `time`, `10` | Drag mode: how finger distance becomes time |

### Design width and units

Inside scenes, `--cv-unit` sizes things in design pixels. With `design-width="1200"`, `calc(var(--cv-unit) * 24)` is 24 px in a 1200 px wide content area and 12 px in a 600 px one:

```css
h1 { font-size: calc(var(--cv-unit) * 64); }
```

The content area is at most `design-width` wide, so a full-width page sets it large enough, such as `1920`.

## cv-scene

| Attribute | Notes |
| --- | --- |
| `zone` | A locked zone: the screen holds and the scroll distance moves the scene's time; see [timelines](/docs/v2/04-timeline) |
| `track="x"` | The content lays out in a row that moves sideways with the scroll |
| `stack` | The scene stays in place while the next one slides over it |
| `covered` | How it looks while covered: `dim` darkens, `recede` darkens and shrinks |
| `theme` | While this scene is current, the stage's `data-cv-theme` takes this value |
| `sequence` | Elements without `after` each follow the one before; the value is the gap in ms |
| `preload` | The first screen waits for this scene's assets; see [first screen](/docs/v2/06-first-screen) |
| `drag="off"` | Drag mode: the scene cannot be dragged into, only reached by a link or a script |
| `unit`, `scale` | Drag mode: a mapping for this scene only |

### Stacking and the veil

When a `stack` scene is covered by the next one, `covered` sets its look. The veil is black by default: `dim` reaches 50%, `recede` reaches 30% and shrinks to 92%. Setting `--cv-veil` on the scene or an ancestor uses the page's own color instead, and the color's alpha is then the depth at full cover:

```css
#intro { --cv-veil: rgb(154 102 64 / 30%); }
```

### Moving sideways

A `track="x"` scene lays its content out in a row and moves it sideways as the page scrolls down, by as much as the row is wider than the screen. The screen holds while the row passes, then the page scrolls on.

## Scene changes

The current scene is the one across the middle of the screen. On a change, the scene left dispatches `cv-leave`, the scene entered dispatches `cv-enter`, and the stage's `data-cv-direction` records the direction. A scene's `theme` goes onto the stage's `data-cv-theme` as the scene becomes current: when it crosses the middle of the screen in scroll, and once the page is past halfway in drag, before the slide lands. A scene without a `theme` clears the attribute. Use it for a page-wide palette:

```html
<cv-scene id="night" theme="dark">…</cv-scene>
```

```css
cv-stage[data-cv-theme="dark"] { --ground: #0b0e1a; --ink: #eef1ff; }
```
