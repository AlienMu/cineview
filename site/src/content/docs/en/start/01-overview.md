---
title: Overview
eyebrow: GETTING STARTED / OVERVIEW
---

Cineview writes landing pages in plain HTML with a set of custom elements (`cv-*`). A page is a series of scenes, each with its own timeline, and the reader's scroll or finger moves through it. It needs no front-end framework, and it also works inside pages built with React or another framework.

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

- Timelines: the elements of a scene sit on one timeline through `duration`, `delay` and `after`. See [timelines](/docs/05-timeline).
- Progress sources: what moves a timeline. In ordinary scroll an element plays on time once it is in view; in a locked zone the scroll distance is the time; in drag mode the finger moves it. See [progress sources](/docs/06-progress-sources).
- Attributes carry the design: effects, durations and order are attributes. Scripts read state, listen to events or subscribe to a timeline only when a page needs them.

## Where to start

1. [Setup](/docs/02-setup): install from npm or load from a content delivery network (CDN), three files in `<head>`.
2. [Scroll and drag](/docs/03-input-modes): decide how the page moves forward.
3. [Working with AI](/docs/04-working-with-ai): have an AI assistant agree on scenes and material before it writes the page.
4. [cv-animate](/docs/11-animate): every effect preset and attribute.
