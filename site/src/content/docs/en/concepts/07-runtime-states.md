---
title: Scene visibility and input
eyebrow: CONCEPTS / STATES
---

A Scene's visibility and transition stage determine whether its content accepts input and whether Animate loops run.

## Scene activity and input

| Scene condition            | Pointer input |
| -------------------------- | ------------- |
| Not yet active             | Off           |
| Entering                   | On            |
| Visible and settled        | On            |
| Playing its exit animation | On            |
| Covered by another Scene   | Off           |
| Past its scroll range      | Off           |

Inactive content also follows the framework's accessibility behavior. Pointer input resumes when the Scene becomes interactive again.

## When continuous animation stops

`loopAnimation` runs only during the element's eligible animation stage while it is visible. It pauses when the Scene becomes inactive, covered, or past its range, and during exit.

CSS animations do not automatically follow those conditions. Use `loopAnimation` for effects that need to stop with the Scene. See [Animate](/docs/03-animate).

## Scroll scene transitions

| Scroll stage                   | Scene behavior                                         |
| ------------------------------ | ------------------------------------------------------ |
| Entrance                       | The Scene enters                                       |
| Exit with an exit animation    | The Scene plays its exit                               |
| Exit without an exit animation | The Scene becomes covered                              |
| Main visible section           | The current Scene accepts input; covered Scenes do not |
| After the section              | The Scene is no longer interactive                     |

A Scene without an exit animation becomes covered directly. A Scene stacked above it can also cover it before its own range ends.

## Observe visibility

Use `Scene.callbacks.onVisibilityChange` for `visible` and `progress`. The root's `onSceneVisibilityChange` observes the same kind of information.

These callbacks describe Scene visibility, not completion of every child animation. Use [useAnimateTimeline](/docs/09-use-animate-timeline) to read an individual Animate's progress and phase. In a locked zone, use `onZoneProgress` for the zone's scroll progress.

## Related pages

- [Animate timeline](/docs/02-timeline): element phases and drivers
- [Visibility conditions](/docs/03-visibility-conditions): conditions for timed entrance and exit
- [DOM and layout](/docs/06-dom-contract): pointer events and stacking
- [Troubleshooting](/docs/07-common-pitfalls): loops that keep running
