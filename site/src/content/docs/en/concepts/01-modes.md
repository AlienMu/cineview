---
title: Modes and animation progress
eyebrow: CONCEPTS / MODES
---

Cineview organizes a page into Scenes. Within each Scene, durations, delays, and `after` define the order of element animations. Dragging, scrolling, or elapsed time then advances those animations.

For example, a title enters over 600ms. A detail follows after a 100ms delay and enters over 400ms. Together they form a 1100ms timeline. The same declarations work in drag and scroll modes; each mode advances that timeline differently.

## Drag: preview the change, then release

Each drag Scene's navigation height is fixed at one viewport and cannot be edited through `Scene.layout.height`. That field only sizes the inner content box. Use scroll for pages of different heights or continuous reading. See [Drag scene layout](/docs/01-layout).

Dragging changes both page position and the target Scene's element time. Move back to revisit an earlier frame. Hold the pointer still to pause animations that follow the gesture.

Distance and release velocity determine whether the Scene changes. On a committed release, the page moves to its destination while elements continue from their release frame. Cancellation restores the page and the target elements. Page arrival and animation completion are separate events, so a long animation can continue after the page arrives.

### Convert drag distance to time

By default, dragging 1% of the viewport length advances element time by 10ms. Half a screen advances 500ms: the title in this example is still entering, and the detail has not started.

With `unit="percent" scale={1}`, half a screen advances 50% of the owning Scene's total duration, or 550ms here. Each Scene calculates its own total. Changing one Scene's animations does not change another Scene's timeline.

`unit` and `scale` map drag distance to element time. `threshold` determines whether release changes the page. See [Gestures and thresholds](/docs/02-gestures) for the effect of release velocity, and try the example in [Quick start](/docs/03-quickstart).

### Start the first Scene

The first Scene waits for its priority resources declared in `assets.preloadImages` before playing its entrance. Other Scenes load resources in the background. The default wait limit is 3000ms. See [Preloading](/docs/02-preload) for timeout behavior and custom loading interfaces.

## Scroll: position determines the frame

Ordinary Scenes move with the page. Declaring `scroll` on a Scene creates a locked zone for its scene-driven animations. The Scene stays centered while scrolling advances those animations, then the page continues moving.

### Convert duration to scroll distance

Inside a locked zone, **1ms equals 1px of real scroll distance**. In this example, the first 600px animate the title. After another 100px, the detail starts its 400px entrance. The zone adds 1100px of scroll distance.

Stop scrolling to hold the current frame. Scroll back to move backward through the same timeline. Releasing the mouse or lifting a finger does not finish the animation automatically. Neither `designWidth` nor viewport height scales this distance.

For concurrent animations, total duration is the latest element end time. An `after` dependency moves the following element's start and can extend the scroll distance. See [Zones and scroll budgets](/docs/02-zones-budget) for exit animations and `phase` ranges.

### Ordinary entrance animations still play over time

Scroll mode also supports ordinary entrance animations. Outside locked zones, Animate defaults to playing over time when its visibility conditions are met. An entrance already in progress continues when scrolling stops, and scroll speed does not change its duration.

Use `timeline={{ driver: 'clock' }}` to select this behavior explicitly. It also lets an element play independently inside a locked zone without adding scroll distance. Compare the ordinary entrances with the middle zone in [Center-lock scrolling](/docs/01-centerlock). Adjust when they start through [Visibility conditions](/docs/03-visibility-conditions).

## After: place one element after another

`timeline={{ after: 'title', delay: 100 }}` references `animateId="title"` in the same Scene. Changing the title's duration moves the detail's start automatically, without recalculating an absolute delay. JSX declaration order does not determine playback order.

For drag and scroll animations, `after` establishes a start position on the timeline. Input advances through that position without an additional timed wait. Visibility animations wait for the predecessor's entrance, then apply their own visibility conditions and delay. See [Animation composition and sequencing](/docs/04-orchestration) for examples and driver restrictions.

## Use the same progress for video and custom drawing

`AnimateVideo` seeks video frames from animation progress. Canvas or SVG components can subscribe to `useAnimateTimeline().progress` inside Animate and draw from that same progress.

An ordinary Animate with `driver: 'clock'` plays independently over time. In drag mode it starts after the Scene officially arrives and does not participate in the Scene duration or `after` sequence. Compare drivers in [Animate timeline](/docs/02-timeline).
