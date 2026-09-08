---
title: AnimateVideo
eyebrow: COMPONENTS / ANIMATEVIDEO
---

AnimateVideo maps an Animate timeline to a native video's playback position. Reverse progress seeks backward. It adds no separate video-library dependency and always uses muted, inline playback.

```tsx
<AnimateVideo
  src="/clip.mp4"
  duration={{ enter: 2000 }} // scrub span (real scroll px in locked zones)
  visibility={{ replay: true }}
  aria-label="Product demonstration"
/>
```

## Video position

The video reads timeline MotionValues without per-frame React state updates.

- Without `scrubRange`, `currentTime = progress × duration`: progress 0 is the first frame, progress 1 the last.
- Reverse input plays backward. Dragging or scrolling back seeks back frame by frame; there is no separate "reverse mode" to author.
- The wrapper is an ordinary `Animate`, so `timeline.delay` / `after` / visibility conditions apply to the scrub window exactly as for any other element.

`duration.enter` is the timeline span the scrub occupies, not the video's length. A locked zone settles each animation at `1ms = 1px` of scroll distance: `duration={{ enter: 2000 }}` means the video scrubs across 2000px of real scrolling; in drag mode it is 2000ms of element-timeline time.

The public `timeline` options are `delay` and `after`. The driver defaults to `'scene'`, so the video follows its Scene or locked zone. Outside a locked zone in scroll mode, it uses visibility-triggered timing.

## Props

| prop                                                  | type                                 | default          | notes                                                                                      |
| ----------------------------------------------------- | ------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------ |
| `src`                                                 | string                               | none             | Video URL. Encoding guidance: [Prepare video for seeking](#Prepare-video-for-seeking).     |
| `animateId`                                           | string                               | none             | Same as [Animate](/docs/03-animate); required when referenced by `after`                   |
| `duration.enter` / `exit`                             | number, ms                           | 600              | Timeline span; scene-driven locked-zone values correspond to scroll pixels                 |
| `scrubRange`                                          | `readonly [from, to]`, seconds       | Full video       | Video-time range; reverse ranges are supported and endpoints are clamped to media duration |
| `enterAnimation`                                      | AnimationType                        | `opacity: 1 → 1` | Optional entrance effect over the video                                                    |
| `exitAnimation`                                       | AnimationType                        | none             | Optional exit effect                                                                       |
| `timeline`                                            | `{ delay?: number; after?: string }` | none             | Supported timing options                                                                   |
| `visibility`                                          | `{replay, enterMargin, exitMargin}`  | none             | Same as Animate                                                                            |
| `preload`                                             | boolean                              | `true`           | Eagerly fills the shared video preload cache                                               |
| `releaseOnLeave`                                      | boolean                              | `false`          | Decoded-frame residency management, locked zones only                                      |
| `width` / `height`                                    | number \| string                     | none             | Numbers are design px                                                                      |
| `poster`                                              | string                               | none             |                                                                                            |
| `playbackRate`                                        | number                               | none             |                                                                                            |
| `style`                                               | CSSProperties                        | none             |                                                                                            |
| `aria-label`                                          | string                               | none             | A control-less silent video must describe itself                                           |
| `onEnded` `onPlay` `onPause` `onTimeUpdate` `onError` | native video events                  | none             | Passed through to the underlying `<video>`, following the playback rules                   |

## scrubRange and the endpoint handoff

An explicit range ending before the video's end starts native playback when progress reaches its endpoint. Scrolling back outside the 2% endpoint band pauses playback and restores timeline seeking. A reverse range also starts a forward tail at its endpoint; use a pre-reversed source to end on a fixed frame instead.

For an 8-second video with `scrubRange={[1.2, 4.8]}`, progress 0.5 seeks to 3.0s. At the range end, the remaining 3.2 seconds play natively.

## Prepare video for seeking

Dense keyframes reduce decoding work for random and reverse seeks. Interframes depend on reference frames, so sparse keyframes can increase seek latency.

To encode every frame independently:

```bash
ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264 scrub.mp4
```

All-keyframe encoding increases file size and can reduce seek work. In development, the framework warns once per source when sampled median seek latency exceeds 50ms. The warning identifies slow seeking, not a specific encoding fault.

## releaseOnLeave: decoded-frame residency

`releaseOnLeave` defaults to false and applies only inside scroll locked zones:

- Beyond 1.5 viewport spans from the zone, it pauses the video and detaches its source to release decoded frames.
- Back within one viewport span, it restores the source and seeks to the current timeline position. A retained blob can be reused without downloading it again.
- The different thresholds avoid repeated release and restore operations near a boundary.
- Release starts only after timeline progress has moved. Changing the video source resets that condition.

## Preload and cold-start readiness

`preload` fills the shared video cache. A cache hit uses a complete downloaded blob, which supports seeking across the file.

To include a first-screen video in the initial resource wait, declare its URL in `Scene.assets.preloadImages`. The video's own `preload` does not add it to that queue. `onReady` only exposes the ref API after mount; it does not wait for the video. See [Preloading](/docs/02-preload).

## Under drag mode

In drag mode, scene element progress determines the video's position. `duration.enter` is measured in element-timeline milliseconds, and `releaseOnLeave` has no effect. Other supported video options retain their behavior.
