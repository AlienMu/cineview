---
title: AnimateVideo
eyebrow: API REFERENCE
---

`<AnimateVideo>` drives a native `<video>` from the timeline position: the drag or scroll position maps directly onto `currentTime`, and reverse input plays backward. It is a thin wrapper over `Animate`, with zero dependencies. This page is the complete field reference; frame-scrub semantics, the endpoint handoff, and the encoding constraint live in the [AnimateVideo guide](/docs/animate-video).

## Props

Every field below is checked against `AnimateVideoProps` in `src/components/Animate/AnimateVideo.tsx`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `src` | `string` | `required` | Video resource URL. Scrub videos should use dense keyframes — all-keyframe for predictable reverse seeks (see the guide for the constraint). |
| `aria-label` | `string` | — | Accessible name for the video element. |
| `width` | `number \| string` | — | Numeric values pass through the px2vw conversion; strings pass through. |
| `height` | `number \| string` | — | Same conversion as `width`. |
| `style` | `CSSProperties` | — | Style with length values converted by the px2vw context. |
| `preload` | `boolean` | `true` | Whether this component eagerly fills the shared video preload cache (whole-segment blob objectURL, guaranteed seekable). First-screen media joins the `priorityComplete` cold-start gate. |
| `poster` | `string` | — | Poster frame before media is ready. |
| `playbackRate` | `number` | `1` | Playback rate applied on the native element (affects the endpoint-handoff tail, not scrubbing). |
| `scrubRange` | `readonly [fromSeconds: number, toSeconds: number]` | — | Video-time interval driven by progress; both ends clamped to `[0, duration]`; reverse intervals valid; authored ranges ending early enable the endpoint handoff. |
| `animateId` | `string` | `auto` | Identifier for `waitFor` references. |
| `duration.enter` | `number` | `600` | Scrub span. Under scroll takeover this is real scroll px (`1ms = 1px`). |
| `duration.exit` | `number` | `600` | Exit duration of the wrapper layer. |
| `enterAnimation` | `AnimationType` | neutral | Wrapper-layer animation. Default is a neutral `opacity: 1 → 1` variant so frame scrubbing stays the visible animation; shares the `duration.enter` axis with the scrub. |
| `exitAnimation` | `AnimationType` | — | Wrapper-layer exit animation. |
| `timeline.delay` | `number` | `0` | Enter delay of the scrub window (real scroll px under takeover). |
| `timeline.waitFor` | `string` | — | Wait for another `animateId` to finish entering before the scrub window starts. |
| `visibility.replayOnReenter` | `boolean` | `true` | Re-entering the viewport replays from the initial frame. |
| `visibility.enterMargin` | `number` | `inherit` | Viewport edge margin gating enter (design px); inherits `modes.scroll.enterMargin`. |
| `visibility.exitMargin` | `number` | `inherit` | Same for exit; inherits `modes.scroll.exitMargin`. |
| `releaseOnLeave` | `boolean` | `false` | Band-driven decoded-frame residency (far releases / near rewarms — band semantics in the guide). Scroll takeover zones only. |
| `onPlay` / `onPause` / `onEnded` | event handler | — | Native media callbacks, gated by playback ownership (see below). |
| `onTimeUpdate` | event handler | — | Native callback, passed through unfiltered. |
| `onError` | event handler | — | Native error callback, passed through. |
| `ref` | `HTMLVideoElement` | — | Forwarded to the underlying `<video>` element. |

## Native media callbacks

Native media events can be consumed directly:

```tsx
<AnimateVideo
  src="/clip.mp4"
  duration={{ enter: 3000 }}
  onEnded={() => setFinished(true)}
  onPlay={() => setPlaying(true)}
  onPause={() => setPlaying(false)}
/>
```

`onPlay` / `onPause` / `onEnded` pass through a playback-ownership gate: only events committed to the current source generation and activation are delivered. Events still in flight from a released or replaced video node are dropped instead of surfacing as ghost callbacks — safe to use these for UI state without deduplication of your own. `onTimeUpdate` and `onError` are passed through unfiltered.

This is the native-event pass-through surface, not the framework callback surface — framework-level error reporting goes through CineView's `onError` (see the [CineView API](/docs/cineview-api)).

## Types

### timeline (deliberately narrowed)

`AnimateVideo.timeline` is not the full `AnimateProps['timeline']` — it carries only two fields: `delay` and `waitFor`. The wrapper's `sceneControlled` stays at its default (`true`), so it binds to its zone's / scene's track like any other `Animate` — there is no way to move a video onto the arrival lane with `sceneControlled: false`.

### scrubRange

A `readonly [fromSeconds: number, toSeconds: number]` tuple:

- both ends are clamped to `[0, duration]`;
- a reverse interval (`from > to`) is valid — progress walks the footage backward;
- without `scrubRange`, `currentTime = progress × duration` and there is no endpoint handoff (progress 1 just holds the last frame);
- the endpoint-handoff semantics (seeking to `to`, handing ownership to native `play()`, the 2% hysteresis band reclaiming it) are documented in the [component guide](/docs/animate-video).

### Shared types

- `AnimationType` (the type of `enterAnimation` / `exitAnimation`) → [type dictionary](/docs/types)
- The preload pipeline and the `priorityComplete` cold-start gate (what `preload` feeds into) → [preload deep-dive](/docs/preload)

## Constraint notes

- **All-keyframe encoding is a hard constraint.** H.264 P/B frames are deltas against the previous frame, so seeking to any frame decodes the whole run from the nearest keyframe; with the usual sparse keyframes every scrub step maxes out the decode thread (reverse is the longest and worst). `ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264 out.mp4` encodes every frame as an I-frame — bigger file, flat seek latency. The dev build measures per-step seek latency while scrubbing and warns once when a single source's median exceeds 50ms.
- **Two silent differences under drag mode**: `releaseOnLeave` is ignored (there is no approach band outside takeover zones); `duration.enter` reads as element-track milliseconds, not scroll px. Everything else carries over.
- **The correct use of `preload={false}`**: opting the instance out when the video has already been loaded by the page through the CineView preload pipeline, avoiding duplicate work — it is not a bandwidth saver (first-use videos should be preloaded; only the whole-segment blob guarantees seekability).

