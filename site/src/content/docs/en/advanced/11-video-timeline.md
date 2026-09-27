---
title: Control video with drag and scroll
eyebrow: ADVANCED / VIDEO
---

Drag up into the second scene to advance its video and text along one timeline. Pause between scenes, then move back and forth to seek through the video. Commit the scene change and unfinished animations continue from the release point. Once fully inside the scene, drag down to return: the video moves backward too. Reverse the gesture or cancel the return to restore its position.

<!-- preview:video -->

## Prepare a video

Follow [Installation](/docs/02-installation), then download the [example video](/act3-edit.mp4) and save it as `public/act3-edit.mp4` in the app. This clip is about ten seconds long; you can also use your own video. Frequent keyframes usually make reverse seeking smoother. See [AnimateVideo](/docs/04-animate-video) for encoding guidance.

## Create two scenes

This code uses the same animation durations and sequence as the example. The “Start again” button and page styling are presentation details for the preview.

```tsx
import { Animate, AnimateVideo, Cineview, Scene } from 'cineview';

export default function App() {
  return (
    <Cineview mode="drag" unit="percent">
      <Scene sceneId="intro">
        <div style={{ height: '100dvh', display: 'grid', placeItems: 'center' }}>
          <h1>Drag up to see the next scene</h1>
        </div>
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
            animateId="detail-title"
            enterAnimation="fade-in"
            duration={{ enter: 600 }}
            timeline={{ delay: 100 }}
          >
            <h2>Light in motion</h2>
          </Animate>
          <Animate
            enterAnimation="fade-in"
            duration={{ enter: 400 }}
            timeline={{ after: 'detail-title', delay: 100 }}
          >
            <p>The title appears first. The caption follows.</p>
          </Animate>
        </div>
      </Scene>
    </Cineview>
  );
}
```

The target scene's element timeline lasts 1200ms. The title starts at 100ms and finishes 600ms later, at 700ms. The caption follows the title and waits another 100ms, so it begins at 800ms. The video starts at 0ms and runs for 1000ms. All three elements read the same elapsed time and change only during their own intervals.

`unit="percent"` uses the default `scale={1}` to map drag percentage to this 1200ms timeline. Halfway through the drag, element time reaches 600ms: the video is at 60% of its full length, the title is nearly complete, and the caption has not started. Commit at this point and animation continues from 600ms; the caption fades in when time reaches 800ms. Cancel the change and the target scene returns to its initial frame.

Once fully inside the second scene, drag down to move the video from its current frame toward the start. Move upward again to restore its position before departure. Hold a short drag before releasing to cancel the return. A video that was playing resumes; a paused video stays paused. The return uses `duration.exit`, which defaults to 600ms, without requiring `exitAnimation`. Moving to a later scene still pauses the video at its current frame.

Omitting `scrubRange` maps the full video to the 1000ms entrance interval. Video seconds select the media range; animation milliseconds control how the gesture advances it. To control only part of the clip, set `scrubRange={[2, 6]}`. After reaching six seconds, the remaining video plays automatically.

`assets.preloadImages` adds the video to its Scene's resource queue. This second-scene video prepares in the background and does not extend the first scene's wait. See [Preloading](/docs/02-preload).

## Control the video with scrolling

This is a separate scroll-mode `App`. Declaring `scroll` on the video scene makes its frames follow scroll position:

```tsx
import { AnimateVideo, Cineview, Scene } from 'cineview';

export default function App() {
  return (
    <Cineview mode="scroll">
      <Scene sceneId="intro" layout={{ height: '100vh' }}>
        <h1>Scroll down to watch the video</h1>
      </Scene>
      <Scene
        sceneId="film"
        layout={{ height: '100vh' }}
        scroll={{ zoneId: 'film' }}
        assets={{ preloadImages: ['/act3-edit.mp4'] }}
      >
        <AnimateVideo
          src="/act3-edit.mp4"
          aria-label="Light and motion film"
          duration={{ enter: 2400 }}
          width="100%"
        />
      </Scene>
    </Cineview>
  );
}
```

The video advances from its first frame to its last across the zone's 2400px scroll distance. Inside the range, stopping holds the current frame; scrolling upward moves backward. `duration.enter` determines the scroll distance, while the video length determines the media range.

## Extend the example

- Use [useAnimateTimeline](/docs/09-use-animate-timeline) to drive Canvas or SVG with the same progress.
- To layer more presets or start a caption after the video, see [Animation composition and sequencing](/docs/04-orchestration).
- To display loading progress, see [Preloading](/docs/02-preload).
- To add a slider or canvas with its own drag interaction, see [Gestures and thresholds](/docs/02-gestures).
