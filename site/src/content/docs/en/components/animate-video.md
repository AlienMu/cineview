---
title: AnimateVideo
eyebrow: FRAME SCRUB
---

AnimateVideo drives a native `<video>` from the timeline position: the drag or scroll position maps directly onto `currentTime`, and reverse input plays backward. It is a thin wrapper over `Animate`, reusing the render-prop to feed the internal `enterProgress` to the frame renderer. Zero dependencies, no controls, always muted + `playsInline`.

## When to use

- The narrative needs a video that scrubs frame by frame with the scroll / drag: position is the input, frames are the output, not on-demand playback.
- You need reverse playback (scrolling or dragging back seeks back frame by frame) and refuse to pay the cost of writing a separate "reverse mode".
- The footage's ending should play out at its own real pace (the endpoint handoff) instead of following the viewer's scroll speed.

## Frame-scrub semantics

The outer `Animate` owns the progress (single-writer discipline); the video consumes it as a pure MotionValue with no per-frame React state. Position is the input, frames are the output:

- Without `scrubRange`, `currentTime = progress × duration`: progress 0 is the first frame, progress 1 the last.
- Reverse input plays backward. Dragging back or scrolling back seeks back frame by frame; there is no separate "reverse mode" to author.
- The wrapper is an ordinary `Animate`, so `timeline.delay` / `waitFor` / visibility gating apply to the scrub window exactly as they do to any other element.

The minimal usage needs only `src` and `duration.enter`; add the rest as needed.

## scrubRange and the endpoint handoff

`scrubRange` maps the timeline onto an explicit interval of video time rather than the whole footage. Both ends are clamped to `[0, duration]`, and a reverse interval (`from > to`) is also valid: progress walks the footage backward. Without `scrubRange` there is no tail to hand off; progress 1 just holds the last frame.

When the interval ends before the footage does, reaching the interval end does one deliberately designed thing: the framework first seeks to `to`, then hands single-writer ownership to native playback (`play()`), and the tail plays out as a real video. Scrolling back out of the end band (2% hysteresis) makes the framework reclaim scrub ownership: pause, seek, resume scrubbing. The exit frame latches outgoing: native playback is paused and the element freezes.

Why a handoff at all: a scrubbed video is a position-driven medium, but an ending is time-driven. The last seconds of the footage should move at their own pace, not at the viewer's scroll speed.

Walk the numbers: 8-second footage, `scrubRange={[1.2, 4.8]}`, `duration={{ enter: 3600 }}`. Progress 0.5 seeks to `1.2 + 0.5 × 3.6 = 3.0s`. Progress 1 seeks to 4.8s and hands off, and the remaining 3.2 seconds play natively. Scrolling back to 0.9 (below the 2% hysteresis band) pauses the tail, reclaims scrub, and seeks back to `1.2 + 0.9 × 3.6 = 4.44s`.

## duration.enter is the scrub span

`duration.enter` is not "the video's length"; it is how much timeline the scrub occupies. Under scroll takeover `1ms = 1px` holds literally: `duration={{ enter: 2000 }}` means the video scrubs across 2000px of real scroll (two viewports on a typical mobile page). In drag mode it is 2000ms of element-track time.

The wrapper animation shares the same axis: `enterAnimation` (a neutral `opacity: 1 → 1` variant by default, keeping frame scrubbing the only visible animation) and the frame scrub share one `duration.enter`, so they never crowd each other.

`AnimateVideo.timeline` is a deliberately narrowed type: only `delay` and `waitFor`. The wrapper's `sceneControlled` stays at its default (`true`), so it binds to its zone's/scene's track like any other `Animate`.

The site's own video scene is exactly this shape: the Scene declares a `center-lock` takeover zone, the AnimateVideo sits after the title via `waitFor`, `duration.enter` is 4000, `releaseOnLeave` is on, and the video fills the screen with `objectFit: 'cover'`.

## Under drag mode

All of the above carries over: the wrapper is a scene-controlled `Animate`, the scene's element track drives the progress, the finger's position across the scene's settle span is the `currentTime`, and dragging back plays backward. Two props are scroll-only and silently inert under drag: `releaseOnLeave` is ignored (there is no approach band outside scroll takeover zones), and `duration.enter` reads as element-track milliseconds rather than scroll px.

## Scrubbed videos must be all-keyframe encoded

This is a hard constraint, not advice. H.264 P/B frames are deltas against the previous frame, so seeking to any frame decodes the whole run from the nearest keyframe. With the usual sparse keyframes (roughly one every 250 frames), every scrub step maxes out the decode thread and drops frames; reverse is the longest and the worst.

Encode every frame as an I-frame: pass `-g 1` and `-keyint_min 1` to ffmpeg; the full command lives in the [AnimateVideo API](/docs/animate-video-api). The cost is a bigger file, since every frame is self-contained, but any frame decodes directly and seek latency flattens. The dev build measures per-step seek latency while scrubbing and warns once when a single source's median exceeds 50ms, surfacing mis-encoded videos in development instead of production.

## releaseOnLeave: decoded-frame residency

A scrubbed `<video>` keeps its decoded frames and GPU textures after being scrolled past. Measured evidence shows they drop frames in the scenes the viewer reaches **next**. `releaseOnLeave` (default `false`) manages that residency, effective only inside scroll takeover zones and ignored in drag mode and outside zones.

Beyond 1.5 viewports away from the zone, release: `pause`, detach `src`, and `load()` drops the decoded frames, while the in-memory blob lease stays. Back within 1 viewport of the zone, rewarm: re-attach the source (zero network, the blob is still in memory), and once metadata is ready, chase the pending seek to the current timeline position. The release threshold deliberately sits outside the rewarm threshold (Schmitt ordering), so hovering between the two never flaps. Release is also possible only after the timeline has genuinely been scrubbed or played at least once; an unwatched video holds no residency worth releasing.

## Preload and cold start

`preload` (default `true`) eagerly fills the shared video preload cache. On a cache hit the renderer mounts a whole-segment blob objectURL instead of the raw `src`: a complete in-memory blob guarantees seekability, progressive network buffers do not, and frame scrubbing needs the former.

First-screen media preloaded this way joins the `priorityComplete` cold-start gate, so `onReady` waits for it instead of revealing a half-buffered video. A video already loaded by the page through the CineView preload pipeline can opt out per instance with `preload={false}` to avoid duplicate work; the site's video scene is written exactly that way, relying on page-level preloading.

## Native media callbacks

`onPlay` / `onPause` / `onEnded` / `onTimeUpdate` / `onError` pass through to the underlying `<video>`. The first three are gated by playback ownership: events still in flight from released or replaced nodes are dropped, so using them directly for UI state is safe. The field table and gating semantics live in the [AnimateVideo API](/docs/animate-video-api).

---

For the complete field reference see the [AnimateVideo API](/docs/animate-video-api).
