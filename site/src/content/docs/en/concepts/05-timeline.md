---
title: Timelines
eyebrow: CONCEPTS / TIMELINE
---

The elements of a scene sit on one timeline. Each declares its own duration, and `delay`, `after` or `at` decide where it starts. Scenes keep separate timelines.

## Duration and delay

| Attribute | Meaning |
| --- | --- |
| `duration` | Entrance length in ms; without it, the preset's own length |
| `delay` | How long to wait from the start |
| `exit`, `exit-duration` | What leaving looks like, and how long it takes |

```html
<cv-animate fx="rise(soft)" duration="600" delay="200"><p>Starts after 200 ms, plays for 600 ms</p></cv-animate>
```

## Follow another element

`after` starts an element when another element of the same scene finishes its entrance. The element it follows has a `name`:

```html
<cv-animate name="title" fx="rise(soft)" duration="600"><h2>Title</h2></cv-animate>
<cv-animate fx="fade" duration="400" after="title"><p>Starts when the title ends</p></cv-animate>
<cv-animate fx="fade" duration="400" after="title -200"><p>200 ms early, overlapping the title</p></cv-animate>
<cv-animate fx="fade" duration="400" after="title +300"><p>300 ms after the title ends</p></cv-animate>
```

- `after` waits for the other element's entrance, not its exit.
- Names belong to one scene. A name that matches nothing, two elements with one name, or a cycle dispatches `cv-error`.
- With `sequence` on the scene, elements without `after` each follow the one before; its value is the gap in ms and can be negative.
- In ordinary scroll the first element of an `after` chain decides when the chain starts; the elements after it do not wait to come into view themselves. For content far apart on the page that has to appear on its own, give each part its own entrance and `delay`.

## Place by share

`at` places an element in a share of the scene: `at="20% 60%"` plays it from 20% to 60% of the scene's length. One value sets only the start; `auto 80%` sets only the end. Every value carries `%`.

```html
<cv-scene zone>
  <cv-animate from="scale-x:0" to="scale-x:1" duration="2400" ease="linear"><span class="bar"></span></cv-animate>
  <cv-animate fx="fade" at="20% 40%"><p>Appears between 20% and 40% of the scene</p></cv-animate>
</cv-scene>
```

## How long a locked zone is

In a locked zone, 1 ms of timeline is 1 px of scroll. The scene is as long as its latest element: its `delay` plus `duration` (and any wait from `after`, and its exit). An element with `at` also counts its own duration toward the length, and is then placed by its share.

A common pattern is one anchor element whose `duration` sets the scene's length, with the other elements placed by `at` or `after`. In this example the bar's `duration` is 2400, so the scene takes 2400 px:

<!-- example:timeline -->

## Read a timeline

Every `cv-animate` has a `timeline` property to read its progress or subscribe to changes:

```js
const el = document.querySelector('#anchor');
await customElements.whenDefined('cv-animate');
const stop = el.timeline.subscribe((frame) => {
  console.log(frame.progress, frame.phase, frame.source);
});
```

`frame.progress` runs from 0 to 1; `frame.phase` is `idle`, `entering`, `entered`, `exiting` or `exited`. [Custom drawing](/docs/17-custom-drawing) uses it to drive a canvas.
