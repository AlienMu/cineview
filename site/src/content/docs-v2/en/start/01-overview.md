---
title: Overview
eyebrow: GETTING STARTED / OVERVIEW
---

Cineview 2.0 writes landing pages in plain HTML with a set of custom elements (`cv-*`). A page is a series of scenes, each with its own timeline, and the reader's scroll or finger moves through it. 2.0 is not released yet: these pages describe the source in the repository's `v2/` directory. For the released 1.x React package, read the [1.x documentation](/docs/01-introduction).

## What a page is made of

| Element | Role |
| --- | --- |
| `cv-stage` | The page. It decides whether the reader scrolls or drags |
| `cv-scene` | One scene: one point, one timeline |
| `cv-animate` | An element in a scene, with its effects on that timeline |
| `cv-stack`, `cv-video`, `cv-fixed`, `cv-pause` | Stacked cards, a video on the timeline, a fixed layer, a pause button |

```html
<cv-stage>
  <cv-scene>
    <cv-animate fx="rise(line)" duration="900"><h1>One scene at a time</h1></cv-animate>
    <cv-animate fx="rise(soft)" duration="700" delay="400"><p>The title rises, then this line follows.</p></cv-animate>
  </cv-scene>
</cv-stage>
```

<!-- example:first-page -->

## Three ideas

- Timelines: the elements of a scene sit on one timeline through `duration`, `delay` and `after`. See [timelines](/docs/v2/04-timeline).
- Progress sources: what moves a timeline. In ordinary scroll an element plays on time once it is in view; in a locked zone the scroll distance is the time; in drag mode the finger moves it. See [progress sources](/docs/v2/05-progress-sources).
- Attributes carry the design: effects, durations and order are attributes. Scripts read state, listen to events or subscribe to a timeline only when a page needs them.

## Where to start

1. [Setup](/docs/v2/02-setup): build the runtime and load three files in order.
2. [Scroll and drag](/docs/v2/03-input-modes): decide how the page moves forward.
3. [cv-animate](/docs/v2/09-animate): every effect preset and attribute.
4. [Working with AI](/docs/v2/15-working-with-ai): have an AI assistant agree on scenes and material before it writes the page.
