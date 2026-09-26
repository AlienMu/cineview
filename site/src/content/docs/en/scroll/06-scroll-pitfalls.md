---
title: Scroll troubleshooting
eyebrow: SCROLL / TROUBLESHOOTING
---

Start with the visible result, then check the configuration that controls it. For issues shared by both modes, see [Troubleshooting](/docs/07-common-pitfalls).

## Scenes are missing

A page is blank or shows only some Scenes, sometimes without a console error.

Declare each `Scene` directly under `Cineview`. An array of Scenes works, but a Fragment or a component that returns a Scene hides it from discovery. If no Scene is found, Cineview reports `EMPTY_SCENES`.

## `phase` stays at `idle` in a locked zone

An animation follows scrolling while `phase` remains `idle`. This is expected for scene-driven animations in a locked zone.

Read `progress` from `useAnimateTimeline()` for visuals that follow scroll position. For Canvas, draw once and subscribe with `progress.on('change', draw)`. `phase` does not indicate whether an element is on screen. See [Custom drawing](/docs/09-use-animate-timeline).

## A declared zone does not lock

Scrolling passes through a Scene with `scroll={{ zoneId }}` without stopping. `onZoneEnter` and `onZoneLeave` do not fire. A first `onZoneProgress` value of 0 can occur even when the zone has no scroll distance.

Add a scene-driven `enterAnimation` to a child `Animate`, then add `exitAnimation` if it needs an exit. Its duration gives the zone scroll distance; an entrance defaults to 600ms when no duration is supplied. With no animation contributing to the duration budget, the zone has no distance to hold. See [Zones and scroll budgets](/docs/02-zones-budget).

## `goToZone` does not reach the expected progress

Calling `goToZone(id)` reaches the start of the locked zone.

The method aligns the scene at its lock position with zone progress at zero. Continue scrolling to advance the animation. Pass `{ animated: false }` to disable smooth scrolling to the start.

## Removed trigger options produce type errors

Existing `zoneTrigger`, `Scene.scroll.trigger`, or `goToZone` `align` fields produce unknown-property errors after upgrading.

Remove these three fields. A locked zone has one trigger behavior: declare it with `scroll={{ zoneId: 'film' }}` and navigate with `goToZone('film', { animated: false })`. Scene positioning and zone duration keep their existing meaning.

Remove `Animate.timeline.zoneId` as well. Move the Animate into the Scene whose zone it should follow; `Scene.scroll.zoneId` remains the zone identifier for navigation.

## A rendered value stops updating

Calling `.get()` during React render reads the value at that moment. The rendered number does not subscribe to later progress changes.

Bind a MotionValue to a motion style, subscribe to `useAnimateTimeline()` values, or use render-prop children for light JSX that must rerender. Use `onZoneProgress` to observe a whole zone.

## Visibility callbacks run often

`Scene.callbacks.onVisibilityChange` can run on every scroll frame, even when the reported values repeat.

Keep the callback's work small. Filter repeated values or report only chosen progress changes. Drive continuous visuals with MotionValues.

## Scene progress pauses during a lock

Scene visibility progress can stay constant while the locked-zone animation advances. They measure different ranges.

Use `onZoneProgress` for the whole zone, or `useAnimateTimeline()` for one element. Use Scene visibility progress to describe the Scene's position in the document.

## Video lags behind scrolling

Video seeking can lag, especially when scrolling backward through a file with sparse keyframes. Development builds warn when sampled seek latency stays high.

Use a video encoded for frame seeking; see [AnimateVideo](/docs/04-animate-video). On pages with several video zones, `releaseOnLeave` can free decoded frames after a video leaves the active area.

## Related pages

- [Center-lock scrolling](/docs/01-centerlock): where locking starts
- [Zones and scroll budgets](/docs/02-zones-budget): how animation duration becomes scroll distance
- [The four input paths](/docs/03-inputs): wheel, touch, keyboard, and scrollbar behavior
- [Troubleshooting](/docs/07-common-pitfalls): issues shared across both modes
