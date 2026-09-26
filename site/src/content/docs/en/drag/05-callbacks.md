---
title: Drag callback timing
eyebrow: DRAG / CALLBACKS
---

Drag callbacks report gesture start, progress, outcome, and the moment a scene change completes. The timing differs between pointer gestures and ref navigation; parameter definitions are in [Callbacks](/docs/03-callbacks).

## Scene-change callbacks on gesture commit

On the gesture path, `onSceneEnter` and `onSceneLeave` run in the same synchronous batch when page movement commits the switch. They do not provide advance notice of a gesture-driven change.

The incoming Scene's elements may still be entering. Page movement and element animation can finish in either order. `onDragEnd` reports the target's `elapsedMs` and `timelineDurationMs` at commit; it is not a continuously updated completion signal.

## onDragProgress fires during a bounce but not after a commit

| Release outcome          | Do `onDragProgress` events continue?                        |
| ------------------------ | ----------------------------------------------------------- |
| Bounce (below threshold) | Yes, progress decreases until the bounce ends |
| Commit (above threshold) | No, reporting stops at release                       |

A progress bar driven by `onDragProgress` remains at the release value when the change commits. For complete element-animation progress, subscribe through [useAnimateTimeline](/docs/09-use-animate-timeline).

## Dragging again during a transition does not fire onDragStart

`onDragStart` counts drag sessions. Resuming movement within an existing session does not create another start event.

## pointercancel never commits

`pointercancel` (for example, an incoming call, a browser gesture interruption, or the notification shade) cancels the change, bounces back, and reports `onDragCancel`. Displacement and velocity do not change this outcome.

Both a user cancellation and a browser interruption report `onDragCancel`; the payload has no separate interruption reason.

## Programmatic navigation fires onDragEnd

`ref.goToScene(index)` emits an `onDragEnd` before the actual switch, with `progress: 1`, `elapsedMs: 0`, and `timelineDurationMs: 0`.

Record ref calls in application code if analytics need to distinguish programmatic navigation from gestures. A zero `elapsedMs` is not a reliable origin test because a gesture can target a Scene with no element duration.

`goToScene(index, false)` displays the destination at its entered state without playing its entrance sequence. Use the default `animated: true` to play the entrance.

## Exactly one terminal callback per session

An accepted drag session reports one terminal outcome: `onDragEnd` for a committed switch or `onDragCancel` for a return.

```text
onDragStart → onDragProgress* → onDragEnd or onDragCancel
```

Dragging backward at the first Scene or forward at the last bounces back to the original position with a reported progress of zero.

An initially blocked press has not started a drag session. It can report `onDragBlocked` without a later cancel event. Insufficient animation readiness produces a development diagnostic and no public drag callback.

## onReady exposes the API

`onReady` provides the ref API after mount and does not wait for assets. Use `onLoadProgress` for queued request completion (integer 0–100), and handle resource failures separately. That percentage includes failed requests and is not a drag-readiness signal.

## Related pages

- [Callbacks](/docs/03-callbacks): parameter shapes and error codes for every callback
- [Starting and resuming a drag](/docs/04-ownership): starting and resuming a gesture
- [Page movement and element time](/docs/03-two-track): why commit and element completion are separate events
- [Performance](/docs/01-performance): reducing work in per-frame callbacks
