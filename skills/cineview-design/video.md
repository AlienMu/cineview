# Video

> Reading this while planning is fine. Code from it goes into a page only after the user has
> confirmed the storyboard (`SKILL.md`).

What a video does on a page depends on what drives its time:
- **Scrubbed**: the reader's scroll or finger moves it forward and back, like an animated picture.
  This happens inside a held scene, or in any drag scene.
- **Played**: it runs at its own speed once something starts it, such as a click, a scene becoming
  current, or simply being on screen as a background loop.
- **A cut**: a short clip carries the change from one scene to the next (`handovers.md`).

| When the clip is meant to | Fits | Why |
|---|---|---|
| show a product or a task step by step, at the reader's pace | scrubbed in a held scene | stopping and reversing are part of reading it |
| open a drag scene under the finger | scrubbed by the finger, then played on | the finger brings the first moments, and the rest plays after release |
| be started by the reader and then watched | scrubbed for its first seconds, then handed to the browser (`range`) | the reader starts it and it carries on |
| set a mood behind the content | a muted background loop | it doesn't compete with the words |
| tell something with sound or at length | click to play | the reader chooses to watch, and browsers need a click before sound |

## Preparing the file

- **Length.** 5-15 seconds. A held scene of 3000 ms maps the whole file onto 3000 px of scroll.
- **Every frame a keyframe**, when it is scrubbed, so any position seeks at once:
  `ffmpeg -i in.mp4 -an -vf "scale=720:-2" -c:v libx264 -pix_fmt yuv420p -g 1 -crf 30 -preset slow -movflags +faststart out.mp4`
  (`-g 1` is the important part; raise `-crf` to 33 for smaller files). A played clip can keep a
  normal encode, which is smaller.
- **Size it to its frame on screen**: a 250 px frame needs about 360 px of width, and a portrait
  phone clip about 720 px. No audio track unless the reader starts it.
- **A poster** that is the first frame of the part you map (frame 0, or the start of `range`), so
  nothing jumps when the video takes over: `ffmpeg -i out.mp4 -frames:v 1 poster.jpg`. If you
  were given a poster, check it; if it is a later frame, make a new one.
- **For blur effects**, a stand-in a few pixels wide:
  `ffmpeg -i poster.jpg -vf scale=24:-1 poster-tiny.jpg`.

## Markup

**Scrubbed in a held scene.** Its `duration` is the length of the scene (1 ms = 1 px of scroll).
`range="2 8"` maps only seconds 2 to 8 of the file.

```html
<cv-scene zone>
  <cv-video src="clip.mp4" poster="clip.jpg" duration="3000" ease="linear"
            aria-label="The editor applying a cut"></cv-video>
</cv-scene>
```

The `<video>` is in the element's shadow root. Style it with
`cv-video::part(video) { width: 100%; height: 100%; object-fit: cover; }`.

**Scrubbed, then played on.** `<cv-video range="0 3">` scrubs the first three seconds. When the
reader reaches the end of that range, the rest of the file plays on its own.

**In a drag scene.** The same element follows the scene's time. The finger scrubs its start, the
rest plays at normal speed after release, and with a `range` the browser carries on after the end.

**A background loop.** A plain `<video>` is enough, because Cineview does not drive its time:

```html
<video src="loop.mp4" poster="loop.jpg" muted loop playsinline autoplay aria-hidden="true"></video>
```

Content on top needs a shade (a gradient or a panel) for contrast. Pausing the video while it is
off screen, with an IntersectionObserver calling `pause()` and `play()`, saves battery. Under
reduced motion the poster alone works well. Files of 2-6 MB and 6-15 s, cut so the loop point is
invisible.

**Click to play, then move on.** A button plays the real clip in place. When it ends, the page goes
to the next scene, or the clip stays on its last frame with a "next" button:

```js
const clip = document.querySelector('.clip'), play = document.querySelector('.play');
play.addEventListener('click', () => { clip.play(); play.hidden = true; });
clip.addEventListener('ended', () => stage.goTo('after'));   // scrolls on, or changes scene in drag
```

When the clip carries information, keep its controls reachable (`controls`, a pause button,
captions).

## Notes

- Map the whole file unless the story needs only part of it (`range`).
- Label every video with `aria-label`. Decorative ones get `aria-hidden="true"`.
- A poster on the element keeps the frame filled while the file loads.
- A mask or a filter over a large area that contains moving layers is painted again on every
  frame. Draw still decoration, such as frames and edges, on its own thin layers.
