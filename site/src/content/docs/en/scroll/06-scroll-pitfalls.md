---
title: Scroll troubleshooting
eyebrow: SCROLL / TROUBLESHOOTING
---

These eight issues are specific to scroll mode. For issues shared by both modes, see [Troubleshooting](/docs/07-common-pitfalls).

## 1. Scenes disappear without an error

The page is blank or missing scenes, the console is clean, and type-checking passes when `Scene` is not a direct child of `CineView`. Arrays are flattened by React, but Fragments are not. A custom wrapper that returns `Scene` from its render body also hides the nested node. `memo` and `forwardRef` wrappers are unwrapped up to six levels.

An undiscovered Scene receives no runtime injection. It falls back to drag mode, renders as an inactive absolute-positioned element with `pointerEvents: 'none'`, and holds child `Animate` elements at their initial frame. The `EMPTY_SCENES` warning appears only when no valid Scene is found, so a mixture of direct and Fragment-wrapped children can fail silently.

Declare Scene nodes directly under CineView. For reusable groups, return an array of Scene elements from a function and call it in CineView's children.

## 2. `phase` stays at `idle` inside a locked zone

Scene-driven entrance and exit animations in a locked zone keep `phase: 'idle'` while progress follows scrolling. Clock-driven elements use visibility phases, and loop-only elements rest at `entered`.

Read timeline progress for position-driven visuals. For a canvas that only depends on progress, draw once and subscribe to progress changes. Phase and driver source alone do not indicate viewport visibility. See [useAnimateTimeline](/docs/09-use-animate-timeline).

## 3. A declared zone never locks

A `Scene` has `scroll={{ zoneId }}`, but scrolling passes through without `onZoneEnter` or `onZoneLeave`. A first-frame `onZoneProgress` event with `progress: 0` does not prove that the zone has a non-zero segment.

Without a scene-driven entrance or exit, the zone budget is zero. It adds no animation travel, although its wrapper still occupies the larger of the visual span and one viewport. Segments of at most 0.5px do not participate in anti-skip limiting.

Add at least one child with `enterAnimation` and `duration.enter` to create a segment. A zone is unnecessary for loop-only effects. See [Zones and scroll budget](/docs/02-zones-budget).

## 4. `goToZone` ignores `align`

`goToZone(id, { align: 'center' })` always targets the zone start. The only supported alignment is center.

Use `goToZone` to navigate to that start position. It does not expose a progress-offset option.

## 5. `zoneTrigger` and `trigger` have no effect

Center-lock is the only supported trigger. Neither the root nor Scene trigger field selects a different locking behavior.

Declare `Scene.scroll` to request a locked zone, then provide scene-driven animation duration to give it scroll travel.

## 6. Render reads an older per-frame value

A one-time `.get()` during render does not subscribe React to progress changes. Values read that way can remain unchanged in the rendered content.

Bind MotionValues to motion styles, subscribe to the values returned by `useAnimateTimeline()`, or use render-prop children when JSX needs updated numbers. Render-prop updates do render through React. At the root, use `onZoneProgress`.

## 7. `onVisibilityChange` runs on every scroll frame

In scroll mode, `Scene.callbacks.onVisibilityChange` runs on every scroll frame without deduplication, even when `visible` and `progress` have not changed. The Scene content does not rerender for this callback, but work inside the callback still runs every frame.

Keep the callback constant-time, or filter it outside the callback so work runs only when `visible` changes or progress crosses a chosen threshold. Drive continuous visuals with MotionValues.

## 8. Scene progress stops while a zone is locked

A Scene's visibility progress can stay constant while its locked-zone animation advances. They describe different ranges.

Read locked-zone progress from `onZoneProgress` or an individual element's progress through `useAnimateTimeline()`. Scene visibility callbacks describe the Scene's position in the document.

## Related pages

- [Center-lock scrolling](/docs/01-centerlock): segment geometry and skipped-frame protection
- [Zones and scroll budget](/docs/02-zones-budget): how durations form a locked segment
- [The four input paths](/docs/03-inputs): keyboard interception and nested scrollables
- [Troubleshooting](/docs/07-common-pitfalls): issues shared across both modes
