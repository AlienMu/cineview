---
title: Page movement and element time
eyebrow: DRAG / TIMELINES
---

Dragging can change scenes while advancing preset animations, video frames, and custom drawing. The scene change completes when the page reaches its destination. Unfinished element entrances continue playing.

To see two Scenes on screen while the target title follows your gesture, try the interactive example in [Drag scene layout](/docs/01-layout).

## Control video frames with dragging

`AnimateVideo` follows element progress. Set `unit="percent"` and `scale={1}` to map the drag percentage to the destination Scene's timeline percentage:

```tsx
<Cineview mode="drag" designWidth={750} unit="percent" scale={1}>
  <Scene sceneId="intro">
    <h1>Drag up to explore the product</h1>
  </Scene>
  <Scene sceneId="product">
    <AnimateVideo
      src="/product.mp4"
      duration={{ enter: 2000 }}
      aria-label="Product demonstration"
    />
  </Scene>
</Cineview>
```

With only this video animation in the destination Scene, dragging halfway seeks to the middle of the video. Reversing the gesture moves the video backward. [Gesture thresholds](/docs/02-gestures) determine whether the scene change continues after release.

`duration.enter` sets element-timeline duration. The media file determines video duration. Use `scrubRange`, in seconds, to select a video interval; see [AnimateVideo](/docs/04-animate-video) for playback after that interval ends.

## The latest child entrance determines Scene duration

Scene-driven child animations determine the total timeline duration:

```text
scene element duration = max(accumulated delay + enter duration)
```

`timeline.after` waits for another element's entrance to finish. Combine it with `duration` and `timeline.delay` to play different presets in sequence:

```tsx
<Scene sceneId="details">
  <Animate
    animateId="title"
    enterAnimation="fade-in"
    duration={{ enter: 600 }}
    timeline={{ delay: 100 }}
  >
    <h2>Product details</h2>
  </Animate>
  <Animate
    enterAnimation="slide-up"
    duration={{ enter: 400 }}
    timeline={{ after: 'title', delay: 100 }}
  >
    <p>The description appears after the title.</p>
  </Animate>
</Scene>
```

This Scene has an 1200 ms element timeline. With no scene-driven child animations, the duration is zero and page navigation still works. See [Animation presets](/docs/08-presets) to combine several presets on one element.

## Hold at several positions to inspect the timeline

With `unit="percent" scale={1}`, drag distance maps to the target Scene's timeline:

| Drag distance | Element time | Target Scene frame                                                   |
| ------------- | ------------ | -------------------------------------------------------------------- |
| 25%           | 300ms        | Title has played 200ms since its 100ms start; detail has not started |
| 50%           | 600ms        | Title has played 500ms; detail has not started                       |
| 75%           | 900ms        | Title is complete; detail has played 100ms since its 800ms start     |
| 100%          | 1200ms       | Both elements are complete                                           |

Hold at 50% to keep the frame at 600ms. Drag back to 25% to return to 300ms. A committed release at 50% continues element playback from 600ms, leaving 600ms to play, while the page finishes its own transition. A fast release affects the commit decision; distance still determines element time during the gesture.

## Adjust how drag distance advances animation

`unit` and `scale` map drag distance to element time. The defaults advance in milliseconds; `percent` advances by a percentage of the Scene timeline. See [Gestures and thresholds](/docs/02-gestures) for formulas and Scene overrides.

Each Scene has an independent element timeline. Short animations can finish while longer ones continue.

## During a scene change

The incoming Scene holds each delayed element at its initial frame until its start time. On a committed release, animations continue from their current positions. On cancellation, they return to their initial states.

The outgoing Scene's visuals follow page movement. Reversing the gesture reverses that movement. Completing the page change does not stop elements that are still entering.

## Connect custom drawing to animation

Call `useAnimateTimeline()` in a child of `Animate` to read the element's progress MotionValue. A canvas can draw once, then redraw through `progress.on('change', draw)`. Remove the subscription on unmount. See [useAnimateTimeline](/docs/09-use-animate-timeline) for the complete example.

Add `data-cineview-ignore-drag` to a canvas or slider that handles its own dragging. Presses within that control then leave scene navigation unchanged. See [Gestures and thresholds](/docs/02-gestures) for input rules.

## Read the remaining animation time at commit

`onDragEnd` provides the destination Scene's `elapsedMs` and `timelineDurationMs` at commit. Subtract elapsed time from total duration to get the remaining entrance time at that moment. Subscribe through `useAnimateTimeline()` for later progress.

See [Drag callback timing](/docs/05-callbacks) for callback order, or [Center-lock scrolling](/docs/01-centerlock) for scroll-driven animation.
