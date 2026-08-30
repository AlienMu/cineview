---
title: Scroll troubleshooting
eyebrow: SCROLL / TROUBLESHOOTING
---

Eight scroll-only failures. Each entry says what you see, then why, then what to change. Failures shared across both modes are in [Troubleshooting](/docs/07-common-pitfalls).

## 1. Scenes vanish entirely, with no error

A blank page or a few missing screens, a clean console, and a passing type-check.

`Scene` must be a direct JSX child of `CineView`. Discovery walks one level of children. Arrays are flattened by React (`{list.map(...)}` is fine), but **Fragments are not flattened**, so Scenes wrapped in `<>...</>` are never found. Custom wrapper components fare a little better: discovery unwraps through the component type, recognizing `memo` / `forwardRef` style wrappers up to six levels deep; but when a wrapper returns `Scene` from its render function, all the framework sees is your component.

An undiscovered Scene receives no runtime injection, so its mode falls back to `'drag'`. It renders `position: absolute` with runtime state `inactive`, which resolves to `pointerEvents: 'none'`: invisible and unclickable, with child `Animate` elements treated as drag elements but no drag runtime running, held at their initial frame.

**And nothing warns.** `EMPTY_SCENES` only fires when zero scenes are found, so the mixed case (one direct Scene plus a Fragment holding two more) produces no signal at all.

The fix: flatten `Scene` elements into direct children of `CineView`. To reuse a group, export a function returning an **array** and spread it, rather than returning a Fragment.

## 2. phase stays at idle inside a locked zone

Elements in the zone follow the scroll correctly, but the render-prop `phase` and `useAnimateTimeline().phase` always read `'idle'`.

This is expected, not a defect. Phase is not updated inside a locked zone, so it cannot tell you whether an element is live. `phase` is written by the visibility check, and scroll-driven elements never run that check, so nothing writes it. The one exception is an infinite-only element, which is set to `'entered'`. Every other element stays at its initial `'idle'` while the visuals scrub normally.

This bites hardest in canvas work. The usual guidance is to subscribe to `timeline.phase` and pause the requestAnimationFrame (rAF) loop on `exited` / `idle`. Inside a locked zone that pauses the loop on the first frame and never resumes, so nothing is ever drawn.

What to do instead: read `signedProgress` (0 not started, positive following scroll, negative exiting) or `frame.source` (`'scroll'` means the element follows scroll) to decide whether the rAF loop runs. Outside a locked zone (or with `timeline.driver: 'clock'`) all six phases work as documented; see [Animate timeline](/docs/02-timeline).

## 3. A declared zone locks nothing

A Scene has `scroll={{ zoneId }}`, scrolling passes straight through, and `onZoneEnter` / `onZoneLeave` never fire. Note that `onZoneProgress` does fire once on the first frame with `progress: 0`; it does not prove the zone works.

The budget is zero. Only an `Animate` with an authored `enterAnimation` or `exitAnimation` registers a zone budget. A zone whose children are all `loopAnimation` totals 0, and only segments longer than 0.5px take part in center-lock. No segment means no lock and no callbacks; the wrapper collapses to the visual height and the scene behaves as a plain section.

The fix: give at least one child an `enterAnimation` plus `duration.enter` to raise the budget. A scene that only wants looping motion does not need to declare a zone in the first place. Budget rules are in [Zones and scroll budget](/docs/02-zones-budget).

## 4. goToZone ignores align

Calling `goToZone(id, { align: 'center' })` does not land on the zone's midpoint.

`align` exists in the public type and is discarded by the implementation. The scroll always stops at `centerLockOffset`, which is that zone's **progress 0** (the point where sticky begins pinning). The public type and the implementation disagree on this one field.

The fix: read `goToZone` as "jump to the start of the zone and play it from the top." To land mid-zone, compute `centerLockOffset + budget / 2` yourself and call native `scrollTo`. That works outside the framework's in-segment semantics and is not recommended.

## 5. zoneTrigger and trigger do nothing

Changing `zoneTrigger` or `Scene.scroll.trigger` produces no behavioral difference.

Both fields are resolved, and the resolved values are never read. `center-lock` is the only implemented behavior and is also the default for both.

The fix: treat them as placeholders. Whether a scene is a locked zone depends only on the presence of the `scroll` prop object; `trigger` makes no difference either way.

## 6. Per-frame numbers are stale in React

Reading `sceneProgress` / `enterProgress` / `progressPx` during render gives a number that is frozen or several frames behind, while binding the same quantity to a motion style is accurate.

This is a deliberate performance trade-off. The quantities that change every frame are left out of the React snapshot's change detection: `visualViewportOffset`, `sceneProgress` / `enterProgress` / `exitProgress`, and a zone's `progressPx` are all excluded. Otherwise every scrolled pixel re-renders the whole Scene subtree. The price of that choice: those fields hold old values on the render path.

The fix: observe per-frame numbers only through MotionValues. Inside children use `useAnimateTimeline()` for `progress` / `signedProgress` / `frame` (they update outside the React render pipeline), and at the root use the `onZoneProgress` callback. Never store continuous progress in `useState`. See [useAnimateTimeline](/docs/09-use-animate-timeline) and [Performance](/docs/01-performance).

## 7. onVisibilityChange fires every frame under scroll

Doing anything in `Scene.callbacks.onVisibilityChange` produces visible frame drops while scrolling.

Under scroll this callback fires **once per scroll frame, with no deduplication**: it fires even when `visible` and `progress` did not change. The subtree does not re-render as a result (by design), but the callback itself runs on every frame, so any `setState`, DOM read/write, or layout measurement inside it multiplies per frame.

The fix: keep the callback to constant-time pure computation, or deduplicate yourself (act only when `visible` flips, or when `progress` moved more than some amount). Anything that drives visuals from continuous progress belongs on a MotionValue rather than in this callback.

## 8. Scene progress freezes while the zone is locked

You expect `onVisibilityChange`'s `progress` to keep advancing while the zone is locked, and instead it sits at one value.

While a zone is active, the scene-level timeline's viewport offset is pinned at `centerLockOffset` (the picture genuinely is not moving; that is what center-lock means). Scene-level `enterProgress` / `exitProgress` / `sceneProgress` are all computed from that offset, so the whole scene timeline freezes during the lock. The two timelines divide the work here: **the scene timeline describes where the scene sits in the document flow, the zone timeline describes progress inside the locked segment.**

The fix: read locked-zone progress from the zone side: `onZoneProgress` at the root, or `useAnimateTimeline().progress` inside zone elements. Leave the scene callback for questions like "has this screen entered the viewport."

## Related pages

- [center-lock scroll takeover](/docs/01-centerlock): segment geometry, pure-function progress, anti-skip
- [Zones and scroll budget](/docs/02-zones-budget): how the budget accumulates from child durations, and how phase rewrites windows
- [The four input paths](/docs/03-inputs): keyboard interception and nested scrollables
- [Troubleshooting](/docs/07-common-pitfalls): failures shared across both modes
