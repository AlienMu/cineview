# Example patterns

Each file exports a component that demonstrates one part of the current API.
Import a component into `src/App.tsx` to try it:

```tsx
import { TimelineSequencing } from './patterns/02-sequencing';

export default function App() {
  return <TimelineSequencing />;
}
```

| File                 | Task                                            | Main API                       |
| -------------------- | ----------------------------------------------- | ------------------------------ |
| `01-hello.tsx`       | Render a Scene                                  | `Cineview`, `Scene`            |
| `02-sequencing.tsx`  | Play elements in order                          | `timeline.after`               |
| `03-scroll-zone.tsx` | Animate across a scroll interval                | `Scene.scroll`, `duration`     |
| `04-positioning.tsx` | Place and size content using design coordinates | `Position.at`, `Container`     |
| `05-video.tsx`       | Control a video with scrolling                  | `AnimateVideo.src`, `duration` |

For the video example, place a seekable video at `public/video.mp4`, or pass a URL
with `<VideoScrubbing src="/my-clip.mp4" />`. Omitting `scrubRange` maps the whole
video to the animation interval. Frequent keyframes help reverse seeking.

Numeric Position and Container properties use `designWidth` for width-based
conversion. Ordinary CSS retains its CSS units. Use responsive CSS for readable
text and layout changes on smaller screens.

Read the [documentation](https://cineview.pages.dev/docs/03-quickstart) for the drag
and scroll examples, or [video tutorial](https://cineview.pages.dev/docs/11-video-timeline)
for a video and text sequence.
