# Build from complete recipes

Applies to `cineview@0.0.1-beta`. Each TSX block is a separate complete `App.tsx`; use one at a time after [installation](./quickstart.md#install). Set the document body margin to `0` in the application's global stylesheet. The [quick-start App](./quickstart.md#run-a-drag-example) covers a drag narrative with a title followed by an explanation.

## Scroll through a narrative

This example needs no media. The introduction plays over time; the middle Scene follows scrolling; the final Scene continues ordinary reading.

```tsx
import { Animate, Cineview, Scene } from 'cineview';

export default function App() {
  return (
    <Cineview mode="scroll">
      <Scene sceneId="intro" layout={{ height: '100vh' }} style={{ padding: 32 }}>
        <Animate enterAnimation="fade-in" duration={{ enter: 800 }} timeline={{ driver: 'clock' }}>
          <h1>Scroll to reveal the next scene</h1>
        </Animate>
      </Scene>
      <Scene
        sceneId="story"
        scroll={{ zoneId: 'story' }}
        layout={{ height: '100vh' }}
        style={{ background: '#e8edf0', padding: 32 }}
      >
        <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 600 }}>
          <h2>One scene, two entrances</h2>
        </Animate>
        <Animate
          enterAnimation="slide-up"
          duration={{ enter: 400 }}
          timeline={{ after: 'title', delay: 100 }}
        >
          <p>The explanation follows the title.</p>
        </Animate>
      </Scene>
      <Scene sceneId="outro" layout={{ height: '100vh' }} style={{ padding: 32 }}>
        <h2>Continue reading</h2>
      </Scene>
    </Cineview>
  );
}
```

The middle zone adds 1100px: title 0–600px, a 100px interval, and explanation 700–1100px. Stop midway to hold the frame, then scroll back to reverse it. The introduction's clock animation does not contribute to the zone duration.

## Advance a video by dragging

Download the [sample MP4](https://cineview.pages.dev/act3-edit.mp4) and save it as `public/act3-edit.mp4`, or provide your own video at that path. This asset is required; the JSX does not generate it. The sample is about ten seconds long. Frequent keyframes improve reverse seeking.

```tsx
import { Animate, AnimateVideo, Cineview, Scene } from 'cineview';

export default function App() {
  return (
    <Cineview mode="drag" unit="percent" scale={1}>
      <Scene sceneId="intro" style={{ padding: 32 }}>
        <h1>Drag up to advance the film</h1>
      </Scene>
      <Scene sceneId="film" assets={{ preloadImages: ['/act3-edit.mp4'] }}>
        <AnimateVideo
          src="/act3-edit.mp4"
          aria-label="Light and motion film"
          duration={{ enter: 1000 }}
          width="100%"
          height="54dvh"
          style={{ objectFit: 'cover' }}
        />
        <div style={{ padding: 24 }}>
          <Animate
            animateId="title"
            enterAnimation="fade-in"
            duration={{ enter: 600 }}
            timeline={{ delay: 100 }}
          >
            <h2>Light in motion</h2>
          </Animate>
          <Animate
            enterAnimation="fade-in"
            duration={{ enter: 400 }}
            timeline={{ after: 'title', delay: 100 }}
          >
            <p>The caption follows the title.</p>
          </Animate>
        </div>
      </Scene>
    </Cineview>
  );
}
```

The Scene lasts 1200ms: video 0–1000ms, title 100–700ms, caption 800–1200ms. Half a viewport of drag advances to 600ms, or 60% of the full video. Committing the change continues from that point; cancelling restores it.

Video positions are measured in seconds; animation duration is measured in milliseconds. Without `scrubRange`, the full clip follows the entrance interval. An explicit range such as `scrubRange={[2, 6]}` selects part of the clip and then allows the remaining video to play automatically. Read [video behavior](../../site/src/content/docs/en/components/04-animate-video.md) before using a partial range.

AnimateVideo manages its own Animate wrapper. Its `timeline` accepts only `delay` and `after`; do not pass Animate's `driver` or `phase`, or assume every native video attribute is supported. `releaseOnLeave` defaults to `false` and applies only to scroll zones. Check [AnimateVideoProps](../../src/components/Animate/AnimateVideo.tsx) for exact properties.

## Verify the result

Run the application and inspect both forward and reverse input. For drag, test a cancelled gesture and a committed change. For scroll, pause in the zone and try keyboard navigation and the scrollbar. Test video after its metadata is ready and check the actual `currentTime`; merely rendering a video element does not establish seeking behavior.

The [interactive video guide](https://cineview.pages.dev/docs/11-video-timeline) also includes a complete scroll video App. For custom visuals driven by the same progress, read [Canvas and SVG](../../site/src/content/docs/en/advanced/09-use-animate-timeline.md).
