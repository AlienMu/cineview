---
title: AnimateVideo
eyebrow: COMPONENTS / ANIMATEVIDEO
---

AnimateVideo maps an Animate timeline to a native video's playback position. Reverse progress seeks backward. It adds no separate video-library dependency and always uses muted, inline playback.

## Control a video with scrolling

Declare a locked zone on the Scene and set the video's `duration.enter`. This example maps the full video to 2000px of scrolling. Scrolling back moves the video position backward.

```tsx
import { AnimateVideo, Cineview, Scene } from 'cineview';

export default function VideoPage() {
  return (
    <Cineview mode="scroll" designWidth={750}>
      <Scene
        sceneId="product"
        layout={{ height: '100vh' }}
        scroll={{ zoneId: 'product-video' }}
        assets={{ preloadImages: ['/clip.mp4'] }}
      >
        <AnimateVideo
          src="/clip.mp4"
          width="100%"
          duration={{ enter: 2000 }}
          aria-label="Product demonstration"
        />
      </Scene>
    </Cineview>
  );
}
```

## Video position

The video reads timeline MotionValues without per-frame React state updates.

- Without `scrubRange`, the video position is progress multiplied by the media duration. Progress 0 selects the first frame; 1 selects the last.
- Reverse dragging or scrolling seeks to earlier frames. Seek speed depends on the video encoding and browser.
- `timeline.delay`, `timeline.after`, and visibility settings work as they do for [Animate](/docs/03-animate).

`duration.enter` is the timeline span the scrub occupies, not the video's length. A locked zone uses `1ms = 1px` of scroll distance: `duration={{ enter: 2000 }}` means the video scrubs across 2000px of real scrolling; in drag mode it is 2000ms of element-timeline time.

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
| `preload`                                             | boolean                              | `true`           | Downloads the video early and adds it to the shared cache                                  |
| `releaseOnLeave`                                      | boolean                              | `false`          | Releases decoded frames far from a scroll locked zone                                      |
| `width` / `height`                                    | number \| string                     | none             | Numbers are design px                                                                      |
| `poster`                                              | string                               | none             | Image URL shown before the video loads                                                     |
| `playbackRate`                                        | number                               | `1`              | Native playback speed after the range ends; does not affect seeking                        |
| `style`                                               | CSSProperties                        | none             | Video styles; supported numeric lengths use design-pixel conversion                        |
| `aria-label`                                          | string                               | none             | Description for a muted video without controls                                             |
| `onEnded` `onPlay` `onPause` `onTimeUpdate` `onError` | native video events                  | none             | Event handlers passed to the `<video>`                                                     |

The forwarded `ref` points to the native `<video>` element for reading media state or calling native methods.

## Select a range and continue playback

An explicit range ending before the video's end starts native playback when progress reaches its endpoint. Scrolling back outside the 2% endpoint band pauses playback and restores timeline seeking. A reverse range also starts a forward tail at its endpoint; use a pre-reversed source to end on a fixed frame instead.

For an 8-second video with `scrubRange={[1.2, 4.8]}`, progress 0.5 seeks to 3.0s. At the range end, the remaining 3.2 seconds play natively.

## Prepare video for seeking

Dense keyframes reduce decoding work for random and reverse seeks. Interframes depend on reference frames, so sparse keyframes can increase seek latency.

To encode every frame independently:

```bash
ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264 scrub.mp4
```

All-keyframe encoding increases file size and can reduce seek work. In development, the framework warns once per source when sampled median seek latency exceeds 50ms. The warning identifies slow seeking, not a specific encoding fault.

## releaseOnLeave: release decoded frames

`releaseOnLeave` defaults to false and applies only inside scroll locked zones:

- Beyond 1.5 viewport spans from the zone, it pauses the video and detaches its source to release decoded frames.
- Back within one viewport span, it restores the source and seeks to the current timeline position. A retained blob can be reused without downloading it again.
- The different thresholds avoid repeated release and restore operations near a boundary.
- Release starts only after timeline progress has moved. Changing the video source resets that condition.

## Preload and the initial resource wait

`preload` fills the shared video cache. A cache hit uses a complete downloaded blob, which supports seeking across the file.

To include a first-screen video in the initial resource wait, declare its URL in `Scene.assets.preloadImages`. The video's own `preload` does not add it to that queue. `onReady` only exposes the ref API after mount; it does not wait for the video. See [Preloading](/docs/02-preload).

## Control a video with dragging

Place the video inside a Scene in drag mode. With `unit="percent"` and `scale={1}`, drag distance as a percentage of the viewport maps to a percentage of the element timeline. The video in this example is in the second Scene; dragging toward it reveals its frames.

```tsx
<Cineview mode="drag" designWidth={750} unit="percent" scale={1}>
  <Scene sceneId="intro">
    <h1>Drag up to view the video</h1>
  </Scene>
  <Scene sceneId="video" assets={{ preloadImages: ['/clip.mp4'] }}>
    <AnimateVideo
      src="/clip.mp4"
      width="100%"
      duration={{ enter: 2000 }}
      aria-label="Product demonstration"
    />
  </Scene>
</Cineview>
```

`duration.enter` uses element-timeline milliseconds. If the Scene contains other animations, their durations and dependencies also affect its total duration. `releaseOnLeave` has no effect in drag mode. See [The drag timeline](/docs/02-timeline).

After fully entering the video scene, dragging back to the previous scene moves the video from its position at departure toward the range start. `duration.exit` controls the return and defaults to 600ms; `exitAnimation` is optional. Reversing the gesture restores the frame. Cancelling resumes a video that was playing from its departure position; a paused video stays paused. If native playback has continued beyond a partial range, the return starts from that actual playback position. Moving to a later scene pauses the video at its current frame.
