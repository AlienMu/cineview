---
title: Introduction
eyebrow: GETTING STARTED / INTRODUCTION
---

Use Cineview's React components to build pages that respond to dragging or scrolling. A scene can contain ordinary content, video, and custom drawings. Select the interaction, then set the animations for each scene.

## Two ways to move through a page

Drag mode suits full-screen presentations. Drag toward the next screen to preview it, or drag back to revisit the previous one. On release, the page completes the change or returns to its starting position.

Scroll mode keeps the page's normal reading order. Add a locked zone where an animation should follow scrolling: the scene stays in view while scroll distance determines progress. Scrolling back reverses the animation.

Both modes use `Scene` to organize content. See [Choosing a mode](/docs/04-choosing-mode) to decide which interaction fits the page.

## Control video by dragging or scrolling

With `AnimateVideo`, moving forward shows later video frames and moving back shows earlier ones. Stopping inside the selected range holds the current frame. If source video remains after the range endpoint, reaching that endpoint starts playback of the remaining video. After a drag commits a scene change, unfinished animation continues from the release point.

[Quickstart](/docs/03-quickstart) includes complete drag and scroll video examples. [AnimateVideo](/docs/04-animate-video) covers video ranges, playback after the range, and encoding for seeking.

## Combine presets and draw custom content

A heading can fade and scale at the same time, while a caption starts after it appears. During a drag, these elements read the same elapsed time and begin only at their own start points. [Quickstart](/docs/03-quickstart) follows a title delayed by 100ms and a caption starting at 800ms; [Animation composition and sequencing](/docs/04-orchestration) covers the configuration.

Canvas, SVG, or WebGL drawings can respond to the same drag or scroll progress. A custom component reads progress with `useAnimateTimeline()` and updates its drawing without rendering React on every frame. See the [custom drawing example](/docs/09-use-animate-timeline).

A scene can also contain a slider or canvas with its own drag interaction. Add `data-cineview-ignore-drag` to that control so dragging it does not change scenes. See [Gestures and thresholds](/docs/02-gestures).

## Prepare assets before they appear

The first scene can wait for its images or video before entering. List their URLs in `Scene.assets.preloadImages` to include them in first-screen loading; assets declared by other scenes download automatically too. Use `ref.preload()` when an action must wait for resources. See [Preloading](/docs/02-preload).

## Position content from a design

`Position` places elements, while `Container` sets dimensions and spacing. Set `designWidth` to the design's width; numeric dimensions scale with viewport width. See [Responsive scaling](/docs/05-responsive).

## Next steps

- [Installation](/docs/02-installation): dependencies and entry points.
- [Quickstart](/docs/03-quickstart): run drag and scroll video examples.
