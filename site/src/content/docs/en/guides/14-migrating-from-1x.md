---
title: Migrating from 1.x
eyebrow: GUIDES / MIGRATING
---

1.x is a set of React components and 2.0 is a set of custom elements. The structure of a page maps one to one: stage, scene, element and timeline all carry over, and props become attributes.

## Side by side

| 1.x | 2.0 |
| --- | --- |
| `<Cineview mode="scroll">`, `mode="drag"` | `<cv-stage>`, `<cv-stage input="drag">` |
| `<Scene sceneId="intro">` | `<cv-scene id="intro">` |
| `scroll={{ zoneId: 'story' }}` on `Scene` | `<cv-scene zone>` |
| `<Animate animateId="title">` | `<cv-animate name="title">` |
| `enterAnimation="slide-up"` | `fx="slide-up"`, or a 2.0 preset such as `fx="rise"` |
| `exitAnimation`, `duration={{ exit }}` | `exit`, `exit-duration` |
| `duration={{ enter: 600 }}` | `duration="600"` |
| `timeline={{ delay: 200, after: 'title' }}` | `delay="200" after="title"` |
| `timeline={{ phase: { start: 0.2, end: 0.6 } }}` | `at="20% 60%"` |
| `timeline={{ driver: 'clock' }}` | `on="clock"` |
| `visibility={{ replay: true }}` | `replay` |
| `loopAnimation` | `loop` |
| `stagger={{ each: 80, from: 'center' }}` | `stagger="80 center"` |
| `<Position fixed>` | `<cv-fixed>` |
| `<AnimateVideo>` | `<cv-video>` |
| The MotionValues from `useAnimateTimeline()` | `el.timeline.subscribe()` |
| `onReady`, `onSceneEnter`, `onSceneLeave` | The `cv-ready`, `cv-enter` and `cv-leave` events |
| `onDragStart`, `onDragEnd`, `onDragCancel`, `onDragBlocked` | The `cv-dragstart`, `cv-dragend`, `cv-dragcancel` and `cv-dragblocked` events |
| `onError` | The `cv-error` event |

## What changes in practice

- In 1.x `replay` is on by default; in 2.0 an entrance plays once unless the element has `replay`.
- 2.0 adds what 1.x does not have: negative `after` offsets (overlapping the element before), the scene's `sequence`, and `split`.
- 1.x `stagger` plays on time only. 2.0 `stagger` spreads the children as shares of the element's own progress, so in locked zones and drag mode it follows the scroll and the finger too.
- The 1.x preset names (`fade-in`, `slide-up`, `zoom-in`, `rotate-in`, `blur-in`) still work in 2.0, with the 1.x values.

## Easing

1.x plays its presets with `ease-in-out`. In 2.0 those compatibility presets also play with `ease-in-out`, while the 2.0 presets each have their own default easing (mostly `settle`). If the pace feels different after migrating, check the easing first:

- To match 1.x, write `ease="ease-in-out"`.
- For motion that follows the scroll or the finger, write `ease="linear"`, so the picture moves exactly with the reader.

## Canvas and your own drawing

1.x hands out progress as MotionValues; 2.0 uses `el.timeline.subscribe()`, as [custom drawing](/docs/13-custom-drawing) shows. For a scene leaving in drag mode, `frame.progress` is the progress of the whole page move. An exit meant to finish within the first part of that move can convert it:

```js
const exitProgress = Math.min(1, (frame.progress * transitionDuration) / exitDuration);
```

Here `transitionDuration` is the stage's `transition-duration` and `exitDuration` is the exit's own length.

## Using it in React

2.0 elements are ordinary custom elements: write them in JSX and listen to events with a `ref` and `addEventListener`. The type declarations are in `dist/types/jsx.d.ts`. After server-rendered markup hydrates, await `stage.ready` before reading state.
