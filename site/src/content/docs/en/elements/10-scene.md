---
title: cv-scene
eyebrow: ELEMENTS / SCENE
---

`cv-scene` is one scene: one point, one timeline. It is a direct child of `cv-stage` and holds the content and its `cv-animate` and other elements.

```html
<cv-scene id="story" zone theme="dark">
  <cv-animate fx="rise(line)" duration="900"><h2>Title</h2></cv-animate>
</cv-scene>
```

## Attributes

| Attribute | Notes |
| --- | --- |
| `zone` | A locked zone: the screen holds and the scroll distance moves the scene's time; see [timelines](/docs/05-timeline) |
| `track="x"` | The content lays out in a row that moves sideways with the scroll |
| `stack` | The scene stays in place while the next one slides over it |
| `covered` | How it looks while covered: `dim` darkens, `recede` darkens and shrinks |
| `theme` | While this scene is current, the stage's `data-cv-theme` takes this value |
| `sequence` | Elements without `after` each follow the one before; the value is the gap in ms |
| `preload` | The first screen waits for this scene's assets; see [first screen](/docs/07-first-screen) |
| `drag="off"` | Drag mode: the scene cannot be dragged into, only reached by a link or a script |
| `unit`, `scale` | Drag mode: a mapping for this scene only |

## Locked zones

A `zone` scene holds the screen when it is reached, and the scroll distance is its time, 1 ms per pixel: stop and it holds, scroll back and it reverses. It is as long as the element that ends last; [timelines](/docs/05-timeline) has the details and an example.

## Moving sideways

A `track="x"` scene lays its content out in a row and moves it sideways as the page scrolls down, by as much as the row is wider than the screen. The screen holds while the row passes, then the page scrolls on.

## Stacking and the veil

When a `stack` scene is covered by the next one, `covered` sets its look. The veil is black by default: `dim` reaches 50%, `recede` reaches 30% and shrinks to 92%. Setting `--cv-veil` on the scene or an ancestor uses the page's own color instead, and the color's alpha is then the depth at full cover:

```css
#intro { --cv-veil: rgb(154 102 64 / 30%); }
```

## Scene changes

The current scene is the one across the middle of the screen. On a change, the scene left dispatches `cv-leave`, the scene entered dispatches `cv-enter`, and the stage's `data-cv-direction` records the direction.

A scene's `theme` goes onto the stage's `data-cv-theme` as the scene becomes current: when it crosses the middle of the screen in scroll, and once the page is past halfway in drag, before the slide lands. A scene without a `theme` clears the attribute. Use it for a page-wide palette:

```html
<cv-scene id="night" theme="dark">…</cv-scene>
```

```css
cv-stage[data-cv-theme="dark"] { --ground: #0b0e1a; --ink: #eef1ff; }
```
