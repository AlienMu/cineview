---
title: Scroll troubleshooting
eyebrow: SCROLL / TROUBLESHOOTING
---

These eight issues are specific to scroll mode. For issues shared by both modes, see [Troubleshooting](/docs/07-common-pitfalls).

## 1. Scenes disappear without an error

The page is blank or missing scenes, the console is clean, and type-checking passes when `Scene` is not a direct child of `CineView`. Arrays are flattened by React, but Fragments are not. A custom wrapper that returns `Scene` from its render body also hides the nested node. `memo` and `forwardRef` wrappers are unwrapped up to six levels.

An undiscovered Scene receives no runtime injection. It falls back to drag mode, renders as an inactive absolute-positioned element with `pointerEvents: 'none'`, and holds child `Animate` elements at their initial frame. The `EMPTY_SCENES` warning appears only when no valid Scene is found, so a mixture of direct and Fragment-wrapped children can fail silently.

Declare every `Scene` as a direct child of `CineView`. For reusable groups, export a function that returns a `Scene[]` and spread the result instead of returning a Fragment.

## 2. `phase` stays at `idle` inside a locked zone

Elements in a locked zone follow scroll correctly, but the render prop and `useAnimateTimeline().phase` remain `'idle'`. This is expected. The phase value comes from viewport visibility checks, while locked-zone elements read continuous scroll progress. Only an element using `loopAnimation` without another animation enters `'entered'`; other locked-zone elements remain at `'idle'` while their visual state follows scroll.

Use `signedProgress` for continuous locked-zone activity. In a canvas renderer, do not stop a `requestAnimationFrame` loop solely because phase is `'idle'`; read the zone progress and pause only when the element is actually outside its active range. Outside locked zones, or with `timeline.driver: 'clock'`, the phase values follow the normal lifecycle. See [The Animate timeline](/docs/02-timeline).

## 3. A declared zone never locks

A `Scene` has `scroll={{ zoneId }}`, but scrolling passes through without `onZoneEnter` or `onZoneLeave`. A first-frame `onZoneProgress` event with `progress: 0` does not prove that the zone has a non-zero segment.

The zone budget is zero when no child has an authored `enterAnimation` or `exitAnimation` with duration. A zone containing only `loopAnimation` elements has no lock segment. Segments shorter than 0.5 px are also excluded, so the wrapper falls back to its visual height and behaves like a regular section.

Add at least one child with `enterAnimation` and `duration.enter` to create a segment. A zone is unnecessary for loop-only effects. See [Zones and scroll budget](/docs/02-zones-budget).

## 4. `goToZone` ignores `align`

`goToZone(id, { align: 'center' })` always stops at `centerLockOffset`, the start of the zone at progress 0. The public type accepts `align`, but the implementation does not use it.

Treat `goToZone` as a jump to the zone start. To stop at another point, add the desired offset to `centerLockOffset` and call the native `scrollTo` method.

## 5. `zoneTrigger` and `trigger` have no effect

Changing the root `zoneTrigger` or `Scene.scroll.trigger` does not change behavior. Both fields are parsed, but their values are not read. Center-lock is the only implemented behavior and is also the default.

Use the presence of a valid `scroll` configuration to decide whether a scene is a locked zone. Do not use either trigger field as a mode switch.

## 6. Render reads an older per-frame value

Reading `sceneProgress`, `enterProgress`, or `progressPx` during render can return an older value, while the same value bound to a motion style stays current. Continuous values are excluded from React snapshot updates so each scroll pixel does not rerender the Scene subtree.

Read continuous values through MotionValue subscriptions and `useAnimateTimeline().progress`, `signedProgress`, or `frame`. At the root, use `onZoneProgress`. Avoid writing per-frame values to React state. See [useAnimateTimeline](/docs/09-use-animate-timeline) and [Performance](/docs/01-performance).

## 7. `onVisibilityChange` runs on every scroll frame

In scroll mode, `Scene.callbacks.onVisibilityChange` runs on every scroll frame without deduplication, even when `visible` and `progress` have not changed. The Scene subtree does not rerender for this callback, but work inside the callback still runs every frame.

Keep the callback constant-time, or filter it outside the callback so work runs only when `visible` changes or progress crosses a chosen threshold. Drive continuous visuals with MotionValues.

## 8. Scene progress stops while a zone is locked

During a locked segment, the scene timeline uses the fixed `centerLockOffset`. `enterProgress`, `exitProgress`, and `sceneProgress` therefore stay constant while the zone timeline continues to advance.

Read locked-zone progress from root `onZoneProgress` or from `useAnimateTimeline().progress` inside the zone. Use scene callbacks for document-flow visibility, not for progress inside the locked segment.

## Related pages

- [Center-lock scrolling](/docs/01-centerlock): segment geometry and skipped-frame protection
- [Zones and scroll budget](/docs/02-zones-budget): how durations form a locked segment
- [The four input paths](/docs/03-inputs): keyboard interception and nested scrollables
- [Troubleshooting](/docs/07-common-pitfalls): issues shared across both modes
