---
title: Media ownership
eyebrow: ADVANCED / MEDIA
---

The `<video>` element inside an `AnimateVideo` has two possible drivers: the framework (seeking frame by frame from the timeline position) and the browser itself (native playback). Only one of them owns it at a time, and the handoff is decided by a pure function. This document covers that ownership protocol and its three boundary cases.

## How progress becomes currentTime

The mapping is one linear interpolation, nothing more: `currentTime = range[0] + progress × (range[1] - range[0])` (`src/media/videoPlaybackOwnership.ts:81-90`).

With no `scrubRange`, `range` is `[0, duration]`: progress 0 is the first frame, progress 1 the last. With an explicit `scrubRange`, both endpoints are clamped into `[0, duration]`, so a second value past the real media length is not an error, it is truncated to the real length (`:70-79`). Progress itself is clamped to `[0, 1]` as well.

`duration` is read off the `<video>` element. Before metadata arrives `duration` is not valid, the mapping returns `null`, and that frame issues no seek command.

Computation and execution are separate: the pure function takes one timeline frame and returns the next ownership state plus a list of commands (`pause` / `seek` / `play`), which `VideoFrameRenderer` executes against the real DOM (`src/media/VideoFrameRenderer.tsx:432-490`). Every playback decision is therefore reproducible without touching a browser.

## Reverse scrubRange and end-of-range autoplay

`scrubRange` accepts a reverse interval. `[10, 2]` is legal: because the mapping is only a linear interpolation, progress 0→1 walks `currentTime` from 10s down to 2s, which is playback in reverse.

But end-of-range autoplay does not understand reverse intervals. At progress 1 the decision looks at exactly one thing: `range[1] < duration` (`videoPlaybackOwnership.ts:161-168`). For `[10, 2]`, `range[1]` is 2, less than the media length, so the test passes and the framework issues `play()`. The video then plays forward from t=2s to the end of the clip, the opposite of the intended "rewind to 2s and stop."

This is not a special case but the general consequence of reverse intervals: reverse means `range[1] < range[0] ≤ duration`, so `range[1] < duration` holds almost always, and any reverse `scrubRange` triggers a forward tail playback when it reaches the end. Neither the type signature nor the comments warn about it.

To get "rewind to a point and stop" there are two routes: accept the tail playback and `pause` immediately from `onPlay`, or drop the reverse interval and pre-encode a reversed source, then scrub it forward with the default `[0, duration]` mapping.

## The single-writer protocol

Ownership has six states (`videoPlaybackOwnership.ts:3-9`):

| status            | who drives         | when it is entered                                         |
| ----------------- | ------------------ | ---------------------------------------------------------- |
| `framework-scrub` | framework          | initial state; every time the framework reclaims           |
| `play-pending`    | native (in flight) | `play()` issued, promise not settled                       |
| `native-playback` | native             | `play()` succeeded, or an external play event was observed |
| `native-paused`   | native             | a pause the framework did not issue                        |
| `play-rejected`   | nobody             | the browser refused `play()`                               |
| `ended`           | nobody             | the media reached its end                                  |

The handoff rules:

- **Only an explicit `scrubRange` whose end is before the end of the clip triggers `play()`.** A video without `scrubRange` stays framework-driven forever and rests on its last frame at progress 1.
- **The endpoint uses hysteresis.** The autoplay band is `progress ≥ 1 - 0.001`; the band where the framework reclaims ownership is `progress < 1 - 0.02` (`:58-59`, `:140-148`). The two thresholds differ, so jitter near the endpoint cannot oscillate between play and pause. After one handoff the transfer is latched, and only leaving the hysteresis band clears it.
- **Reclaiming is position-driven.** Frames from the `scroll` and `visibility` sources reclaim unconditionally; a `gesture` frame must have left the endpoint band (`:140-148`). Reclaiming issues `pause` first, then a `seek` to the mapped position.
- **`exiting` / `exited` runs one outgoing pause and latches.** The first exit-phase frame issues a single `pause` if native playback is running, then latches; later exit frames return the state unchanged and issue nothing (`:176-193`). The latch clears when the next scrub-source frame arrives.

Every `play()` request carries a requestId. A play event with the wrong token (a late one, or an externally triggered one) is defensively paused so two sources never both believe they own the element (`:278-314`).

## No arbitration between instances

Ownership is per `AnimateVideo` instance. There is no cross-instance media arbiter in the framework: put two `AnimateVideo` elements in one zone, let both reach their endpoint, and both call `play()`, so both tails play at once. No registry and no "pause the others" logic exists anywhere in the source.

For mutual exclusion, handle coordination at the application level: track who is playing through `onPlay` and pause the previous one manually. The forwarded native events (`onPlay` / `onPause` / `onEnded` / `onTimeUpdate` / `onError`) are the primary mechanism for this.

## The three preconditions of releaseOnLeave

`releaseOnLeave` (default `false`) drops decoded frames once the user has scrolled past. A release needs three conditions to hold together (`src/components/Animate/AnimateVideo.tsx:126-151`):

1. the prop is `true`;
2. the current approach band is `far`;
3. this source has actually been scrubbed at least once. An unplayed video holds no decoded frames to release, so this condition holds only after timeline progress has moved by more than `1e-4`. Changing `src` resets that fact; a replacement source does not inherit "already watched" from the previous one.

The band thresholds are fixed in the framework (`src/components/Scene/sceneScrollRuntime.tsx:24-27`):

| threshold                       | value | behavior                                                                                  |
| ------------------------------- | ----- | ----------------------------------------------------------------------------------------- |
| `SCENE_SCROLL_APPROACH_FAR_VH`  | 1.5   | more than 1.5 viewports past the zone, the band flips to `far` and the source is released |
| `SCENE_SCROLL_APPROACH_NEAR_VH` | 1     | back within 1 viewport of the zone, the band flips to `near` and the source is reattached |

The two thresholds are deliberately unequal, so hovering between them cannot oscillate between release and warm-up.

Outside a locked zone, and everywhere in drag mode, this mechanism does nothing: the approach band exists only inside a locked zone, and with no band there is nothing to release or reattach. Flipping `releaseOnLeave` from `true` back to `false` actively calls `warmUp()` once, so the renderer cannot be left with a detached src.

## Encoding requirements

Encode scrubbed videos all-keyframe. H.264 P/B frames are deltas against earlier frames, so a seek to an arbitrary frame has to decode a full run from the nearest I-frame; with sparse keyframes every seek saturates the decode thread.

```bash
ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264 out.mp4
```

In development the framework checks this automatically: it samples seek latency per src, takes the median once six samples have accumulated, and warns once with that `ffmpeg` command when the median exceeds 50ms (`src/media/VideoFrameRenderer.tsx:51-52,403-426`). One warning per src, and the code is absent from production builds.

The cost is a larger file (every frame self-contained); the payoff is that any frame decodes directly and seek latency flattens out.

## Built-in fixed element attributes

Two attributes on the `<video>` are fixed by the framework and cannot be overridden (`src/media/VideoFrameRenderer.tsx:630-631`):

- `muted`: this is also what makes end-of-range autoplay viable at all. Browser autoplay policies only admit muted media; a `play()` with audio gets refused and lands in the `play-rejected` branch.
- `playsInline`: without it iOS Safari promotes the video into a fullscreen player and frame scrubbing stops working entirely.

`playbackRate` has no effect on scrubbing. Scrubbing writes `currentTime` directly and never goes through the playback rate; `playbackRate` applies only to the native tail playback after the endpoint handoff (`:395-399`).

## A narrower prop surface than Animate

`AnimateVideo` forwards only six things to the inner `Animate`: `animateId`, `enterAnimation`, `exitAnimation`, `duration`, `timeline`, `visibility` (`src/components/Animate/AnimateVideo.tsx:231-239`). Everything else `Animate` offers is absent here:

| Animate has            | AnimateVideo | note                                                          |
| ---------------------- | ------------ | ------------------------------------------------------------- |
| `loopAnimation`        | none         | a loop and frame scrubbing are two drivers, not stackable     |
| `stagger`              | none         | a video has no direct element children to stagger             |
| `enterRef` / `exitRef` | none         | manual triggers apply only to time-driven animations          |
| render-prop children   | none         | the children slot is reserved for the internal frame renderer |
| `timeline.driver`      | none         | pinned to its default `'scene'`                               |
| `timeline.zoneId`      | none         | inherited from the enclosing Scene's locked zone              |
| `timeline.phase`       | none         | no way to restrict the scrub window inside a zone             |

The type of `timeline` is exactly `{ delay?: number; after?: string }` (`:47-50`), those two keys only. Copy a `timeline={{ phase: { start: 0.5 } }}` over from an `Animate` and a TypeScript consumer gets a type error; a JS consumer gets no signal at all, the key is silently dropped, and the element follows scroll from the start of the zone as usual.

The default `enterAnimation` is a neutral variant, `{ initial: { opacity: 1 }, animate: { opacity: 1 } }` (`:13-16`). That keeps frame scrubbing itself the only visible animation instead of layering a fade over it. Pass `enterAnimation` explicitly for an additional entrance effect; it replaces the neutral default.

## Related pages

- The full prop table and frame-scrub semantics are in [AnimateVideo](/docs/04-animate-video).
- How videos reach the shared cache and the cold-start gate is in [Preloading](/docs/02-preload).
- The per-frame observation surface and monitor metrics are in [Performance](/docs/01-performance).
- Zone budget and `1ms = 1px` are in [Zones and budget](/docs/02-zones-budget).
