---
title: Gestures and thresholds
eyebrow: DRAG / GESTURES
---

Drag input is pointer-only: no wheel, no keyboard. A gesture passes four checks before it counts as a drag, and on release the commit decision comes from velocity and displacement together. This page lists the real numbers for every condition.

## Pointer only

The framework listens for neither wheel nor keydown. Mouse-wheel paging does not work on desktop, and neither does keyboard paging. The only programmatic path is `ref.goToScene(index, animated?)`.

`touch-action` on the scene is fixed per direction, releasing the cross axis and claiming the drag axis:

| `direction`     | `touch-action`     |
| --------------- | ------------------ |
| `'y'` (default) | `pan-x pinch-zoom` |
| `'x'`           | `pan-y pinch-zoom` |

The cost is that **native scrolling along the drag axis is unavailable in drag mode**. A sub-region that needs to scroll on the same axis has to opt out of the gesture using the mechanism in "Interactive elements are exempt automatically."

## The four pointerdown checks

All four must pass before a candidate is established:

1. This scene may start a gesture (the current scene, or any scene while a transition is in flight)
2. `event.isPrimary !== false`: later fingers in a multi-touch never enter
3. `event.button === 0`: right-click and middle-click never drag
4. The press did not land inside an interactive element (see "Interactive elements are exempt automatically")

### Interactive elements are exempt automatically

If the press lands on any of these selectors, the gesture never starts:

```text
a, button, input, textarea, select, option, summary,
[contenteditable="true"], [data-cineview-ignore-drag]
```

`data-cineview-ignore-drag` provides a declarative opt-out: applying it to custom sliders, draggable canvases, or nested scroll regions prevents that subtree from triggering scene navigation.

There is a second way to opt out: a custom `onPointerDown` is composed with the framework handler rather than replaced, so calling `event.preventDefault()` inside it causes the framework to skip gesture processing entirely.

## The direction check: tap versus drag

While ownership is not yet held, every move must satisfy:

```text
|mainAxisDelta| >= 1 && |mainAxisDelta| > |crossAxisDelta|
```

Sub-pixel movement and cross-axis-dominant swipes both count as taps, not drags. So a purely horizontal swipe across a vertical drag page never claims the gesture. A direction rejected within one press stays locked until the finger crosses back over the origin, at which point the opposite direction is preflighted.

## Thresholds: faster flicks need less distance

On release the displacement ratio is compared against a threshold that falls linearly with velocity:

| Field         | Default | Meaning                                            |
| ------------- | ------- | -------------------------------------------------- |
| `minVelocity` | `0`     | Lower velocity bound (px/s)                        |
| `maxVelocity` | `1000`  | Upper velocity bound (px/s)                        |
| `minRatio`    | `0.15`  | Displacement threshold at the upper velocity bound |
| `maxRatio`    | `0.3`   | Displacement threshold at the lower velocity bound |

```text
threshold(v) = maxRatio − (clamp(v) − minVelocity) / (maxVelocity − minVelocity) × (maxRatio − minRatio)
```

A slow drag needs 30% of the screen; a flick above 1000 px/s needs only 15%. Two edge behaviors matter: a non-finite velocity returns `maxRatio` outright, and **setting `minVelocity` equal to `maxVelocity` pins the threshold at `maxRatio`** (the span is zero, so the same fallback applies).

Three engine constants are not part of `threshold`:

- Direction-reversal veto at 600 px/s: if the displacement qualifies but the finger is flicking back quickly, the commit is vetoed.
- Boundary bounce is a fixed 150 ms: that value applies at the first screen going back or the last screen going forward, whatever the drag distance. The ordinary bounce instead scales with displacement (ratio × 800, capped at 300 ms).
- **A standalone Scene outside CineView uses a fixed threshold of 0.5**, and `threshold` config is ignored entirely in that case.

Progress is divided by `window.innerHeight` / `window.innerWidth`, not by the container. A CineView embedded in an iframe, a split pane, or any non-full-height parent receives an inaccurate progress mapping: reaching progress 1 requires a full window's worth of movement.

## How drag distance becomes element time

`unit` and `scale` decide how gesture displacement advances the element timeline:

| `unit`             | Default `scale` | Conversion                                                       |
| ------------------ | --------------- | ---------------------------------------------------------------- |
| `'time'` (default) | `10`            | Each 1% dragged advances `scale` milliseconds                    |
| `'percent'`        | `1`             | Each 1% dragged advances `scale` percent of the element timeline |

With the default `time + 10` configuration, a full-screen drag interaction advances exactly 1000 ms of element timeline, regardless of that scene's total timeline duration. A 6.5-second entrance is only about 15% scrubbed at full drag; the remainder completes at real-time speed after release. To achieve proportional scrubbing across the entire timeline, set `unit: 'percent'`.

`Scene.drag` can override this, but as a whole group: providing either `unit` or `scale` stops the group inheriting from the root, and the omitted field falls back to the framework default rather than the root's value. So with a root of `percent + 0.5`, a scene that writes only `scale: 2` resolves to `time + 2`.

Fallbacks for rejected configuration values are asymmetric: a rejected `unit` also resets scale to the `time` default (even if percent was specified), while a rejected `scale` retains the unit and resets only the scale. Both report `INVALID_DRAG_CONFIG`.

## drag.enabled applies to the target scene

`Scene.drag.enabled` defaults to `true`. It is read from the target scene at ownership time, not from the scene under the finger.

Setting `enabled: false` on Scene 3 does not prevent navigating away from Scene 3; rather, it renders Scene 3 unreachable from adjacent scenes (Scene 2 and Scene 4). When blocked, `onDragBlocked` is reported at most once per direction per press. Programmatic navigation is unaffected.

## Related pages

- [Drag layout contract](/docs/01-layout): size defaults and engine-level fixed styles
- [Ownership and transactions](/docs/04-ownership): candidates, ownership, re-grab
- [Drag callback timing](/docs/05-callbacks): which callbacks fire, and when
- [CineView](/docs/01-cineview): the full drag-mode props table
