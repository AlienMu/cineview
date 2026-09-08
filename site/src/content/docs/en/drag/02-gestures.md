---
title: Gestures and thresholds
eyebrow: DRAG / GESTURES
---

Drag supports pointer gestures and keyboard navigation. Velocity and displacement determine whether a pointer gesture commits a scene change.

## Pointer and keyboard input

Focus the CineView container to use ArrowUp/ArrowDown in vertical mode, ArrowLeft/ArrowRight in horizontal mode, PageUp/PageDown, Home, and End. Controls inside the Scene keep their own keys. Mouse-wheel paging is not provided. Use `ref.goToScene(index, animated?)` for programmatic navigation.

`touch-action` on the scene is fixed per direction, releasing the cross axis and claiming the drag axis:

| `direction`     | `touch-action`     |
| --------------- | ------------------ |
| `'y'` (default) | `pan-x pinch-zoom` |
| `'x'`           | `pan-y pinch-zoom` |

Scene touch handling reserves the drag axis and permits gestures on the other axis. An inner control can opt out of CineView's gesture handling, but that does not change an ancestor's CSS `touch-action` restrictions.

## The four pointerdown checks

The initial press must satisfy all four conditions:

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

Add `data-cineview-ignore-drag` to an interactive region to prevent it from starting scene navigation. This is useful for sliders, draggable canvases, and custom controls.

A Scene's custom `onPointerDown` runs with the framework handler. Calling `event.preventDefault()` in it suppresses the framework gesture.

## The direction check: tap versus drag

Before a drag starts, movement must satisfy:

```text
|mainAxisDelta| >= 1 && |mainAxisDelta| > |crossAxisDelta|
```

Movement below one pixel or dominated by the other axis does not start a drag. A rejected direction remains rejected for that press until the pointer crosses its starting position and attempts the opposite direction.

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

Gesture progress uses the executing window's `innerHeight` or `innerWidth`. A container that is smaller than that window can therefore require more movement than its own size suggests.

## How drag distance becomes element time

`unit` and `scale` decide how gesture displacement advances the element timeline:

| `unit`             | Default `scale` | Conversion                                                       |
| ------------------ | --------------- | ---------------------------------------------------------------- |
| `'time'` (default) | `10`            | Each 1% dragged advances `scale` milliseconds                    |
| `'percent'`        | `1`             | Each 1% dragged advances `scale` percent of the element timeline |

With the default `time + 10` configuration, a full-screen drag interaction advances exactly 1000 ms of element timeline, regardless of that scene's total timeline duration. A 6.5-second entrance is only about 15% scrubbed at full drag; the remainder completes at real-time speed after release. To achieve proportional scrubbing across the entire timeline, set `unit: 'percent'`.

`Scene.drag` can override this, but as a whole group: providing either `unit` or `scale` stops the group inheriting from the root, and the omitted field falls back to the framework default rather than the root's value. So with a root of `percent + 0.5`, a scene that writes only `scale: 2` resolves to `time + 2`.

An unsupported `unit` resets the mapping to `time` with its default scale. An unsupported `scale` keeps the unit and resets only the scale. Both report `INVALID_DRAG_CONFIG`.

## drag.enabled applies to the target scene

`Scene.drag.enabled` defaults to `true` and applies to the target Scene.

Setting `enabled: false` on Scene 3 prevents adjacent scenes from dragging into it. Navigation away from Scene 3 and programmatic navigation remain available. `onDragBlocked` fires at most once per attempted direction in a press.

## Related pages

- [Drag layout contract](/docs/01-layout): size defaults and engine-level fixed styles
- [Starting and resuming a drag](/docs/04-ownership): starting and resuming a gesture
- [Drag callback timing](/docs/05-callbacks): which callbacks fire, and when
- [CineView](/docs/01-cineview): the full drag-mode props table
