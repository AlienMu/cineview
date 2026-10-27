---
title: cv-video
eyebrow: ELEMENTS / VIDEO
---

`cv-video` is a video that plays along a timeline. It is also a `cv-animate`: `fx`, durations, `after`, exits and progress sources work the same way. Without `fx` it is an entrance with no effect, and the entrance's progress sets the video's time.

```html
<cv-scene zone>
  <cv-video src="ride.mp4" poster="ride-first-frame.jpg" duration="2400" ease="linear"
            aria-label="A night ride through the city"></cv-video>
</cv-scene>
```

<!-- example:video -->

## Attributes

| Attribute | Default | Notes |
| --- | --- | --- |
| `src` | Not set | The video file |
| `range` | The whole file | The part of the file the timeline covers, in seconds, such as `range="0 3.2"`; it can run backwards |
| `preload` | On | Fetches the whole file into the cache so any frame seeks at once; `preload="none"` turns it off |
| `poster` | Not set | The poster image |
| `playback-rate` | `1` | The speed of natural playback after the timeline ends |
| `aria-label` | Not set | A description of the video |

When `range` ends before the file does, the rest plays at normal speed once the timeline is done: the video follows the scroll first and then plays on by itself.

## Prepare the file

- A video that follows scroll or drag needs every frame as a keyframe; otherwise reversing and jumping stutter. Encode it with ffmpeg:

```bash
ffmpeg -i source.mp4 -an -c:v libx264 -preset slow -crf 24 -g 1 -keyint_min 1 \
  -pix_fmt yuv420p -movflags +faststart scrub.mp4
```

- Make the poster from the first frame, so the poster and the first played frame match:

```bash
ffmpeg -i scrub.mp4 -frames:v 1 -q:v 3 first-frame.jpg
```

- Drop the audio track (`-an`). A video that follows the scroll plays silently.
- All-keyframe files are larger; reduce the size or raise `-crf`.

## Styles and events

The video node is in the shadow root; style it with `::part(video)`:

```css
cv-video::part(video) { width: 100%; height: 100%; object-fit: cover; }
```

- `play`, `pause`, `ended` and `error` are dispatched again on the `cv-video`.
- A load failure also dispatches an `asset-failed` `cv-error`.
- `el.video` is the current `<video>` node. It is replaced when the cached copy arrives, so read it each time it is needed.

## Beyond scroll-following playback

`cv-video` only plays along a timeline. For a video that starts on click, loops as a background, or moves to the next scene when it ends, use a plain `<video>` element with `stage.goTo()`:

```js
const clip = document.querySelector('#intro-film');
clip.addEventListener('ended', () => stage.goTo('after-film'));
```
