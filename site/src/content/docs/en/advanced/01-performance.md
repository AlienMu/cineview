---
title: Performance
eyebrow: ADVANCED / PERFORMANCE
---

CineView's per-frame cost comes down to two things: how much per-frame change stays off the React render pipeline, and how much first-frame jank the cold-start gate absorbs. This page covers what the monitor readings actually mean, the only surface where per-frame values are observable, and the callbacks that sit on the hot path.

## Runtime monitor

Pass `monitor` on the CineView root to enable runtime monitoring, then read metrics through the ref:

```tsx
const ref = useRef<CineViewRef>(null);

<CineView designWidth={750} monitor ref={ref}>
  {/* ... */}
</CineView>;

const metrics = ref.current!.getPerformanceMetrics();
```

There is nothing else to configure; monitoring is a single boolean. It is observational and changes no animation behavior. Without `monitor`, `getPerformanceMetrics()` is still callable, but with no instance on the page running the monitor there are no frame samples, so `fps` and `avgFrameTime` come back as `0`.

## What the four metric fields really mean

`getPerformanceMetrics()` returns a `PerformanceMetrics`. Every field has its own catch:

| Field          | Type                | Default / absent             | What it actually is                                                                    |
| -------------- | ------------------- | ---------------------------- | -------------------------------------------------------------------------------------- |
| `fps`          | number              | `0` with no samples          | clamped to 60; a 120Hz display also reports 60                                         |
| `avgFrameTime` | number (ms)         | `0` with no samples          | the mean of at most 60 frames, not a percentile                                        |
| `memoryUsage`  | number \| undefined | `undefined`                  | JS heap (MB), median of 8 samples; `undefined` outside Chromium                        |
| `bundleSize`   | number (KB)         | `0` with no resource entries | the sum of every `.js` / `.mjs` / `.css` resource on the page, not this library's size |

Three consequences worth remembering:

**The 60 ceiling on `fps` is a hard clamp.** The formula is `Math.min(Math.max(1000 / avgFrameTime, 0), 60)` (`src/utils/performanceMonitor.ts:101-106`). On a high-refresh display a real 90fps and a real 60fps read identically, so `fps === 60` only proves "not below 60," never "reaching the refresh rate."

**`avgFrameTime` cannot detect jank.** It is the arithmetic mean of the last 60 frame intervals at most (`:44-46`, `:118-123`). One 200ms long task mixed into 59 frames of 16ms lifts the mean to roughly 19ms, which looks perfectly healthy. Jank needs percentiles and long-task records, which means the browser's Performance panel or a `PerformanceObserver`; the framework's reading cannot give you that.

**`bundleSize` is not this library's size.** It walks `performance.getEntriesByType('resource')` and sums the bytes of every code-like asset (`:175-204`), which includes your application code, third-party libraries, and CSS, all of it unrelated to CineView. It is also computed once when the monitor calls `start()` and then cached permanently (`:166-173`), so chunks loaded later never show up. To measure CineView itself, look at build output rather than this field.

## The monitor is a page-level singleton

The monitor is a page-level singleton behind a reference count: the first CineView with `monitor` enabled starts the requestAnimationFrame (rAF) loop on mount, and the last one to unmount stops it (`src/utils/performanceMonitor.ts:217-241`).

That makes the readings page-level rather than per-instance. With two CineViews on a page, both `getPerformanceMetrics()` calls return the same data, reflecting the whole page's frame rate with no way to attribute it to one instance. This is deliberate: frame rate is a page-level property to begin with, and one rAF loop is cheaper than N.

## Cold-start gate

On cold start, the first screen's priority assets pass through the preload pipeline into a gate: the entry timeline is blocked until they are ready, so nothing animates before its images arrive. First-screen `AnimateVideo` media goes through the same pipeline, and only counts as ready once the whole blob is seekable.

The wait is capped: `firstSceneTimeout` defaults to 3000ms. It is a drag-mode-only prop; scroll's cold-start gate always uses the default. On timeout the recoverable `FIRST_SCENE_TIMEOUT` error fires, and the default fallback statically places the first scene in its rest state. Calling `detail.preventDefault()` inside `onError` hands control to you (for example, to render a retry UI). See [Callbacks](/docs/03-callbacks) for the full callback semantics and [Preloading](/docs/02-preload) for preload configuration.

## MotionValue per frame

Anything that changes every frame (progress, elapsed, scroll offset) must live in a `MotionValue`; React state is only for structural changes. A per-frame `setState` fans out into a whole-scene subtree re-render, the number one source of dropped frames in narrative pages.

The framework already does this: `Animate`'s property mapping derives from MotionValues and never re-renders during scrubbing. Apply the same rule in your own consumers:

- Read progress through the render-prop `enterProgress` (see [Animate](/docs/03-animate)) or a read-only MotionValue from `useAnimateTimeline()` (see [useAnimateTimeline](/docs/09-use-animate-timeline)); updates arrive without touching React rendering.
- Inside `onDragProgress` / `onZoneProgress` callbacks, reading values is fine; writing them into state is the problem. To drive the DOM, project through a ref or consume the MotionValue directly.
- Don't add your own `useSpring`/`useTransform` on top of these values: a spring settles on its own schedule and does not follow exit progress.

## In scroll mode, the render path sees stale continuous values

This is not advice, it is structural. Scroll mode splits updates in two: the snapshot React renders from, and the per-frame data that imperative consumers subscribe to.

The comparison deciding when the snapshot changes deliberately excludes the continuous values (`areScrollSceneRenderSnapshotsEqual`, `src/components/CineView/ScrollSceneSlot.tsx:74-124`): `visualViewportOffset`, `zoneState.progressPx`, and `sceneProgress` / `enterProgress` / `exitProgress` take no part in it. Changes to those fields therefore schedule no re-render, and the render path reads whatever they were at the last structural change. The source comment says it outright: `the React snapshot is intentionally stale` (`:190-191`).

The point is to keep every pixel of native scrolling from triggering React work. The cost is that **per-frame numbers are observable through exactly two surfaces**:

- The MotionValues returned by `useAnimateTimeline()` (`progress` / `signedProgress` / `phase`)
- The root's `onZoneProgress` callback

Continuous values are published by a separate source (`src/components/runtime/scrollSceneFrameStore.ts`), written only by the native scroll controller and read by subscription. Read `progressPx` in render to paint a number and you watch it sit still, which is not a bug.

## Two callbacks on the hot path

| Callback                             | Fires                             | Deduplicated                          |
| ------------------------------------ | --------------------------------- | ------------------------------------- |
| `Scene.callbacks.onVisibilityChange` | every scroll frame in scroll mode | no                                    |
| the root's `onZoneProgress`          | when the change exceeds 0.5px     | yes, and endpoints are forced through |

`onVisibilityChange` subscribes to the per-frame data and runs once per scroll frame with no deduplication at all (`src/components/Scene/Scene.tsx:513-543`). The Scene subtree does not re-render because of it (keeping per-frame data out of React is the whole point), but your callback body is on the hot path: a `setState`, a DOM write, or a layout read inside it costs once per frame. If you need throttling, throttle it yourself.

`onZoneProgress` already has a 0.5px threshold, and its baseline is the last reported value rather than the previous frame (`src/components/CineView/useNativeScrollController.ts:96-100`). Using the previous frame as the baseline starves the callback forever during a slow scroll that moves under 0.5px per frame; using the last reported value does not. The terminal 0 and full values are forced through, so you never miss the frame that lands exactly on an endpoint (`:325-337`).

## Video scrubbing and decoded frames

`AnimateVideo` frame-scrubbing maps position to `currentTime`, seeking every frame. With sparse keyframes, each seek decodes a long run from the nearest keyframe, saturating the decode thread and dropping frames. Scrubbed sources must be encoded with dense keyframes (ideally all-keyframe); in development the framework samples seek latency and warns when the median exceeds 50ms.

The memory half is `releaseOnLeave`: decoded frames are released once the viewer scrolls well past, and reattached on return. The full rules, thresholds, and ffmpeg command are in [Media ownership](/docs/06-media-ownership).

## Bundle size

The full `cineview` entry ships both the drag and the scroll engine and dispatches by `mode` at runtime. The dispatcher references both engines statically, so an ES module (ESM) consumer using one mode still carries both:

```tsx
import { CineView } from 'cineview/drag'; // drag engine only, UMD/CJS
import { CineView } from 'cineview/scroll'; // scroll engine only, UMD/CJS
```

Where the per-mode entries are usable and what that means for bundling is in [Installation](/docs/02-installation); the mode decision is in [Choosing a mode](/docs/04-choosing-mode).
