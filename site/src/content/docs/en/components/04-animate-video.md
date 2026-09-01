---
title: AnimateVideo
eyebrow: COMPONENTS / ANIMATEVIDEO
---

AnimateVideo drives a native `<video>` from the timeline position: the drag or scroll position maps directly onto `currentTime`, and reverse input plays backward. It is a thin wrapper over `Animate`, reusing the render-prop to feed the internal `enterProgress` to the frame renderer. Zero dependencies, no controls, always muted + `playsInline`.

```tsx
<AnimateVideo
  src="/clip.mp4"
  duration={{ enter: 2000 }} // scrub span (real scroll px in locked zones)
  timeline={{ delay: 100, after: 'intro' }}
  visibility={{ replay: true }}
/>
```

## Frame-scrub semantics

The outer `Animate` manages the progress; the video consumes it as a MotionValue, with no per-frame React state. Position is the input, frames are the output:

- Without `scrubRange`, `currentTime = progress × duration`: progress 0 is the first frame, progress 1 the last.
- Reverse input plays backward. Dragging or scrolling back seeks back frame by frame; there is no separate "reverse mode" to author.
- The wrapper is an ordinary `Animate`, so `timeline.delay` / `after` / visibility conditions apply to the scrub window exactly as for any other element.

`duration.enter` is the timeline span the scrub occupies, not the video's length. A locked zone settles each animation at `1ms = 1px` of scroll distance: `duration={{ enter: 2000 }}` means the video scrubs across 2000px of real scrolling; in drag mode it is 2000ms of element-timeline time.

`AnimateVideo.timeline` is a deliberately narrowed type: only `delay` and `after`. The wrapper's `driver` stays at its default (`'scene'`), so it binds to its zone's/scene's timeline like any other `Animate`.

## Props

| prop                                                  | type                                | default        | notes                                                                                                                               |
| ----------------------------------------------------- | ----------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src`                                                 | string                              | none           | Video URL. Scrub footage must be keyframe-dense, see "Footage must be keyframe-dense"                                               |
| `animateId`                                           | string                              | none           | Same as [Animate](/docs/03-animate); required when referenced by `after`                                                            |
| `duration.enter` / `exit`                             | number (ms)                         | none           | Scrub span; `1ms = 1px` inside a locked zone                                                                                        |
| `scrubRange`                                          | `readonly [from, to]` (seconds)     | none           | Maps the timeline onto an explicit interval of video time; reverse intervals (`from > to`) are valid. Ends clamp to `[0, duration]` |
| `enterAnimation` / `exitAnimation`                    | AnimationType                       | neutral preset | Defaults to `opacity: 1 → 1`, keeping frame scrubbing the only visible animation                                                    |
| `timeline.delay` / `after`                            | none                                | -              | Only these two fields; semantics as in Animate                                                                                      |
| `visibility`                                          | `{replay, enterMargin, exitMargin}` | none           | Same as Animate                                                                                                                     |
| `preload`                                             | boolean                             | `true`         | Eagerly fills the shared video preload cache                                                                                        |
| `releaseOnLeave`                                      | boolean                             | `false`        | Decoded-frame residency management, locked zones only                                                                               |
| `width` / `height`                                    | number \| string                    | none           | Numbers are design px                                                                                                               |
| `poster`                                              | string                              | none           |                                                                                                                                     |
| `playbackRate`                                        | number                              | none           |                                                                                                                                     |
| `style`                                               | CSSProperties                       | none           |                                                                                                                                     |
| `aria-label`                                          | string                              | none           | A control-less silent video must describe itself                                                                                    |
| `onEnded` `onPlay` `onPause` `onTimeUpdate` `onError` | native video events                 | none           | Passed through to the underlying `<video>`, gated by playback ownership                                                             |

## scrubRange and the endpoint handoff

When the interval ends before the footage does, reaching the interval end does this: the framework seeks to `to`, then hands ownership to native playback (`play()`), and the tail plays out at its own pace instead of following user scroll speed. Scrolling back out of the end band (2% debounce band) reclaims scrub ownership: pause, seek, resume scrubbing.

Example: 8-second footage, `scrubRange={[1.2, 4.8]}`, `duration={{ enter: 3600 }}`. Progress 0.5 seeks to `1.2 + 0.5 × 3.6 = 3.0s`; progress 1 seeks to 4.8s and hands off, and the remaining 3.2 seconds play natively.

## Footage must be keyframe-dense

H.264 P/B frames are deltas against the previous frame, so seeking to any frame decodes the whole run from the nearest keyframe. With sparse keyframes (a common default of roughly one every 250 frames), every scrub step maxes out the decode thread and drops frames; reverse is the worst.

Encode every frame as an I-frame:

```bash
ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264 scrub.mp4
```

The cost is a bigger file (every frame self-contained); the gain is direct decode of any frame and flat seek latency. The runtime measures per-step seek latency while scrubbing and warns once when a single source's median exceeds 50ms, surfacing mis-encoded videos during development.

## releaseOnLeave: decoded-frame residency

A scrubbed `<video>` keeps its decoded frames and GPU textures after being scrolled past, which can cause frame drops in subsequent scenes. `releaseOnLeave` (default `false`) manages that residency, effective only inside locked zones and silently ignored in drag mode and outside zones:

- **Beyond 1.5 viewports from the zone** (band `far`): release: `pause` + detach `src` + `load()`, decoded frames dropped, the in-memory blob lease kept.
- **Back within 1 viewport height of the zone** (band `near`): re-attach the source (zero network, the blob is still in memory), and once metadata is ready, chase the seek up to the current timeline position.
- The release threshold deliberately sits outside the re-attach threshold (hysteresis), so hovering between the two never oscillates.
- Release only happens after the timeline has genuinely been scrubbed or played at least once: an unplayed video holds no decoded frames requiring release.

## Preload and cold-start readiness

`preload` (default `true`) eagerly fills the shared video preload cache. On a cache hit the renderer mounts a whole-segment blob objectURL instead of the raw `src`: a complete in-memory blob guarantees seekability, progressive network buffers do not, and frame scrubbing needs the former.

First-screen media preloaded this way joins the cold-start readiness check, ensuring `onReady` waits for it before presenting the initial scene. A video already loaded through the page-level preload pipeline can opt out per instance with `preload={false}` to avoid duplicate work. See [Preload](/docs/02-preload).

## Under drag mode

Everything carries over: the scene's element timeline drives the progress, the gesture position maps to `currentTime`, and dragging back plays backward. Two props are scroll-only: `releaseOnLeave` is ignored (no approach band outside zones), and `duration.enter` reads as element-timeline milliseconds rather than px.
