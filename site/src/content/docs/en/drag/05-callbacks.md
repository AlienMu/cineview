---
title: Drag callback timing
eyebrow: DRAG / CALLBACKS
---

Drag callbacks differ from standard lifecycle hooks in their timing and invocation frequency. This document details invocation conditions and sequences. For parameter structures, see [Callbacks](/docs/03-callbacks).

## Scene-change callbacks fire at the end of the transition, not the start

```text
onSceneEnter ──┐
                    ├── same batch, the instant page movement reaches the target
onSceneLeave ───┘
```

Page movement reaching its target _is_ the switch, so both callbacks fire back to back in the same synchronous batch. On the gesture path there is no advance notice: no preparation phase precedes the switch.

A further constraint: **when `onSceneLeave` fires, elements in the incoming scene are still animating in**. After release, page movement and element time advance in parallel on two different clocks: the page on the page timescale, elements on their own timeline length. Either can finish first. So this callback is not an "everything is ready" signal. To wait for the element timeline, compute from the `elapsedMs` and `timelineDurationMs` provided by `onDragEnd`.

## onDragProgress fires during a bounce but not after a commit

| Release outcome          | Do `onDragProgress` events continue?                        |
| ------------------------ | ----------------------------------------------------------- |
| Bounce (below threshold) | Yes, a descending tail of progress during the rebound tween |
| Commit (above threshold) | No, silence from release until commit                       |

So a canceled drag leaves a trail of decreasing progress events while a successful drag goes quiet the moment the pointer is released. A progress bar driven by `onDragProgress` freezes at the release value on the commit path.

## A re-grab does not fire onDragStart

Pressing and dragging again while a transition is in flight (taking the movement over in place) does not fire `onDragStart`: the drag session stays active until commit or reset, and `onDragStart` only fires when no session was already active.

From the user's point of view this is a distinct new gesture, and the consumer is never told. Analytics that count gestures through `onDragStart` miss every re-grab.

## pointercancel never commits

`pointercancel` (for example, an incoming call, a browser gesture interruption, or the notification shade) forces a bounce regardless of displacement and velocity, and settles as `onDragCancel`.

The cost: **the public callbacks cannot distinguish a user cancel from a system interrupt**. Both arrive as `onDragCancel`.

## Programmatic navigation fires onDragEnd

`ref.goToScene(index)` emits an `onDragEnd` before the actual switch, with `progress: 1`, `elapsedMs: 0`, and `timelineDurationMs: 0`.

This is specified behavior (every drag commit goes through this callback, gestures and ref alike), but the consequence matters: **evaluating gesture counts via `onDragEnd` also captures programmatic invocations**. To distinguish them, verify whether `elapsedMs` is 0 or maintain an application-level flag.

Separately, `goToScene(index, false)` (`animated: false`) **skips the entire entrance timeline**: no continuation directive is published, the destination lands at its resting state, and per-element delay sequencing never plays. For a full entrance, use the default `animated: true`.

## Exactly one terminal callback per session

This invariant is safe to rely on:

```text
onDragStart → onDragProgress* → exactly one onDragEnd or onDragCancel
```

Once `onDragStart` fires, that pointer session ends with exactly one commit or one cancel. Never both, never neither. A boundary rebound (forward on the first screen, backward on the last) reports progress 0 and, if uncommitted, still settles through the same `onDragCancel` fallback.

`onDragBlocked` is not terminal: it fires when an admission condition in application logic rejects the drag, at most once per direction per press, and that press still settles as a cancel. Rejections caused by insufficient internal readiness produce a development-only diagnostic and no public callback.

## onReady is unrelated to assets

`onReady` is a mount-time API handoff and waits for no assets. Using it to dismiss a loading overlay dismisses it too early. To wait for assets, watch `onLoadProgress` reach 100 (note it is an integer 0 to 100, not 0 to 1).

## Related pages

- [Callbacks](/docs/03-callbacks): parameter shapes and error codes for every callback
- [Ownership and transactions](/docs/04-ownership): the full candidate / ownership / re-grab semantics
- [Page movement and element time](/docs/03-two-track): why commit and element completion are separate events
- [Performance](/docs/01-performance): discipline for consuming per-frame callbacks
