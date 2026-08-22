---
title: AnimateVideo
eyebrow: FRAME SCRUB
---

AnimateVideo drives a native `<video>` by timeline position: drag or scroll position maps directly to `currentTime`, and scrubbing backwards plays the video backwards. It is a thin wrapper over `Animate` reusing its render-prop to feed the internal `enterProgress` to the frame renderer — zero libraries, no controls, always muted and `playsInline`.

## Frame scrubbing semantics

The wrapping `Animate` owns the progress (single-writer discipline); the video consumes it as a plain MotionValue with no per-frame React state. Position is the input, frame index is the output:

- Without `scrubRange`, `currentTime = progress × duration` — progress 0 is the first frame, progress 1 the last.
- Reverse input plays in reverse. Dragging back or scrolling back seeks back frame by frame; there is no separate "reverse mode" to author.
- The wrapper layer is a normal `Animate`, so `timeline.delay` / `waitFor` / visibility gating all apply to the scrub window like any other element.

```tsx
<AnimateVideo
  src="/clip.mp4"
  duration={{ enter: 2000 }}
  timeline={{ delay: 100, waitFor: 'intro' }}
  visibility={{ replayOnReenter: true }}
/>
```

## scrubRange and the endpoint handoff

`scrubRange` maps the timeline to an explicit interval of video time instead of the whole clip:

```tsx
<AnimateVideo
  src="/clip.mp4"
  scrubRange={[1.2, 4.8]}
  duration={{ enter: 3600 }}
/>
```

- Both endpoints are clamped to `[0, duration]`; a **reverse interval** (`from > to`) is valid — progress then walks the clip backwards.
- When the range ends before the clip ends, reaching the end of the scrub span does something deliberate: the framework seeks to `to`, then hands single-writer ownership to native playback with a `play()` — the tail of the clip plays out as real video. Scroll back below the endpoint (2% hysteresis) and the framework reclaims scrub ownership: pause, seek, resume scrubbing.
- Without `scrubRange` there is no tail to hand off — progress 1 simply holds the last frame.
- Exit frames latch outgoing: native playback is paused and the element freezes.

The handoff exists because a scrubbed video is a *position-driven* medium, but an ending is *time-driven* — the last seconds of a clip want to run at their own tempo, not at the viewer's scroll speed.

Walk the numbers once: an 8-second clip, `scrubRange={[1.2, 4.8]}`, `duration={{ enter: 3600 }}`. Progress 0.5 seeks to `1.2 + 0.5 × 3.6 = 3.0s`. Progress 1 seeks to 4.8s and hands off — the remaining 3.2 seconds play natively. Scroll back to 0.9 (below the 2% hysteresis band) and the framework pauses the tail, reclaims scrub, and seeks back to `1.2 + 0.9 × 3.6 = 4.44s`.

## duration.enter is the scrub span

`duration.enter` is not a "video duration" — it is how much timeline the scrub occupies. Under scroll takeover the `1ms = 1px` rule applies literally: `duration={{ enter: 2000 }}` means the video scrubs across 2000 px of real scroll (2 viewports of a typical mobile page). In drag mode it is 2000 ms of element-track time.

The wrapper layer animates on the same axis: `enterAnimation` (default a neutral `opacity: 1 → 1` variant, so frame scrubbing remains the visible animation) and the frame scrub share the one `duration.enter` — they cannot crowd each other.

`AnimateVideo.timeline` is deliberately narrow: only `delay` and `waitFor`. The wrapper's `sceneControlled` stays at its default (`true`), so the element binds to its zone/scene lane like any `Animate`.

A complete takeover-zone example, the shape the site's own video scene uses:

```tsx
<Scene sceneId="act-video" scroll={{ zoneId: 'act-video-seq', trigger: 'center-lock' }}>
  {/* The wrapper's enterAnimation only styles the wrapper layer; frame scrubbing
      is driven by the internal enterProgress — both share the duration.enter axis. */}
  <AnimateVideo
    src="/video.mp4"
    animateId="act-video"
    duration={{ enter: 4000 }}
    timeline={{ waitFor: 'act-title', delay: 0 }}
    releaseOnLeave
    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
  />
</Scene>
```

## In drag mode

Everything above transfers: the wrapper is a scene-controlled `Animate`, so the scene's element track drives progress — the finger's position across the scene's settle span scrubs `currentTime`, and dragging back plays back. Two properties are scroll-specific and quietly do nothing in drag:

- `releaseOnLeave` is ignored (there are no approach bands outside scroll takeover zones).
- `duration.enter` reads as element-track milliseconds, not scroll px.

## Encode scrub videos all-keyframe

This is a hard constraint, not advice. H.264 P/B frames are deltas against the previous frame; seeking to an arbitrary frame requires decoding the whole run from the nearest keyframe. With the usual sparse keyframes (about one per 250 frames), every scrub step saturates the decode thread and drops frames — worst in reverse, where runs are longest.

Encode every frame as an I-frame:

```bash
ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264 out.mp4
```

The trade is file size — every frame is self-contained — but any frame becomes directly decodable and seeks go flat. The dev build measures per-seek latency as you scrub and warns once per source when the median exceeds 50 ms, so a mis-encoded video identifies itself during development instead of in production.

## releaseOnLeave: decoded-frame residency

A `<video>` that has been scrubbed through keeps decoded frames and GPU textures resident after you scroll past — probe evidence shows they measurably drop frames in the *next* scenes the viewer reaches. `releaseOnLeave` (default `false`) manages that residency, scroll takeover zones only (ignored in drag mode and outside zones):

- **far** — more than 1.5 viewports past the zone: release. `pause` + drop `src` + `load()` discards the decoded frames; the in-memory blob lease is kept.
- **near** — back within 1 viewport of the zone: warm up. The source is re-attached (zero network — the blob is still in memory) and pending seeks catch up to the current timeline position once metadata is back.
- The release threshold sits deliberately outside the preload threshold (Schmitt ordering), so hovering between them cannot flap.
- Release only happens after the timeline has actually been scrubbed or played once — an un-watched video has nothing resident to free.

## Preload and cold start

`preload` (default `true`) eagerly fills the shared video preload cache. When the cache holds the source, the renderer attaches a whole-segment blob objectURL instead of the raw `src` — a full in-memory blob is guaranteed seekable, which is exactly what frame scrubbing needs (progressive network buffering is not).

Two consequences:

- First-screen media preloaded this way joins the `priorityComplete` cold-start gate — `onReady` waits for it rather than revealing a half-buffered video.
- A video the page already preloads through the CineView preload pipeline can opt out per-instance with `preload={false}` to avoid double work — the site's video scene does exactly this while relying on the page-level preload.

## Native media callbacks

The native media events are yours to consume:

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

## Props

Every field below is checked against `AnimateVideoProps` in `src/components/Animate/AnimateVideo.tsx`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `src` | `string` | `required` | Video resource URL. Scrub videos should use dense keyframes — all-keyframe for predictable reverse seeks (see above). |
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
| `releaseOnLeave` | `boolean` | `false` | Band-driven decoded-frame residency (see above). Scroll takeover zones only. |
| `onPlay` / `onPause` / `onEnded` | event handler | — | Native media callbacks. Gated by playback ownership: they fire only for events committed to the current source generation and activation, never for stale events from a released/replaced node. |
| `onTimeUpdate` | event handler | — | Native callback, passed through unfiltered. |
| `onError` | event handler | — | Native error callback, passed through. |
| `ref` | `HTMLVideoElement` | — | Forwarded to the underlying `<video>` element. |
