---
title: Video seeking and playback
eyebrow: ADVANCED / MEDIA
---

AnimateVideo follows timeline progress until an explicit video range ends before the clip's end. It can then continue with native playback. Scrolling back can restore timeline control.

## Map progress to video time

```text
video time = from + progress × (to - from)
```

Without `scrubRange`, the range is zero to the video's duration. Explicit endpoints are clamped to that duration, and progress is clamped to 0–1. The renderer waits for usable metadata before seeking.

`duration.enter` controls the Animate timeline span. The video's own duration determines the available media time.

## Reverse ranges and endpoint playback

`scrubRange={[10, 2]}` maps increasing progress from ten seconds back to two seconds, provided the clip is long enough.

At the endpoint, the forward-playback rule still applies: an explicit range ending before the clip's end can start native playback from that endpoint to the end. The reverse range therefore does not mean “rewind to two seconds and stop.”

To stop on a final reversed frame, use a pre-reversed source with the default full-video range. An application's `onPlay` handler can also pause native playback when that behavior is needed.

## Switching between seeking and playback

Without an explicit `scrubRange`, the video stays at its mapped position and rests on the last frame at progress 1.

With an explicit range ending before the clip's end, native playback can start at `progress ≥ 0.999`. It keeps control within the endpoint band. Progress below `0.98` lets scroll or gesture input pause playback and resume seeking.

While native playback is in control, `playbackRate` affects its speed. It does not affect direct timeline seeking. Further timeline movement can pause externally started playback to restore the mapped position.

## Multiple videos

Each AnimateVideo controls its own video. Two videos reaching their playback endpoints can play at the same time.

For exclusive playback, keep video refs in the application and pause the previous video when another reports `onPlay`. The forwarded events are `onEnded`, `onPlay`, `onPause`, `onTimeUpdate`, and `onError`.

## Release decoded frames

`releaseOnLeave` defaults to false and works only in scroll locked zones. It releases decoded frames after the video's timeline has moved and the zone is sufficiently far away.

| Distance from the zone        | Action                                          |
| ----------------------------- | ----------------------------------------------- |
| More than 1.5 viewport spans  | Pause and detach the video source               |
| Back within one viewport span | Restore the source and seek to current progress |

The two thresholds avoid repeated release and restore operations near the boundary. A cached blob can remain available while decoded frames are released.

Changing `src` resets the “timeline has moved” condition. Turning `releaseOnLeave` off restores a detached source.

## Encoding for seeking

Dense keyframes reduce the decoding work required for random and reverse seeks. To encode each frame independently:

```bash
ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264 out.mp4
```

The file becomes larger. Seek latency still depends on the browser, device, and other work on the page.

Development builds collect seek-latency samples. Once six samples are available, a median over 50ms produces one warning per source. This measures slow seeking; it does not inspect the encoding itself.

## Native video attributes

AnimateVideo always sets `muted` and `playsInline`. Muting supports autoplay use, while inline playback keeps the video within the page. A browser can still reject a playback request.

`playbackRate` changes native playback speed after a range endpoint. Timeline-driven seeking writes the media position directly.

## Supported Animate options

AnimateVideo accepts `animateId`, `enterAnimation`, `exitAnimation`, `duration`, `visibility`, and the `timeline.delay` / `timeline.after` options.

It does not expose `loopAnimation`, `stagger`, manual refs, render-prop children, or the other Animate timeline fields. Use the public type as the supported contract; extra JavaScript properties are not documented options.

The default entrance keeps opacity at 1. Pass an entrance animation when the video also needs a visible entrance effect. Delay and dependencies can place the video within a longer Scene sequence.

## Related pages

- [AnimateVideo](/docs/04-animate-video): all video props
- [Preloading](/docs/02-preload): cache and initial resource wait
- [Performance](/docs/01-performance): frame and seek measurements
- [Zones and scroll budgets](/docs/02-zones-budget): timeline distance
