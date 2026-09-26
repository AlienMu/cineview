---
title: Starting and resuming a drag
eyebrow: DRAG / SESSIONS
---

A drag starts when movement establishes its direction. Pressing during a transition pauses its movement so dragging can continue from that position.

## Press before movement

A stationary press does not start a drag or emit `onDragStart`. Links, buttons, and other exempt controls keep their normal interaction.

The first movement that meets the direction check attempts to start the gesture.

## Conditions for starting

Starting a gesture requires three conditions: no competing drag, a target Scene that allows dragging, and ready target animations.

If `Scene.drag.enabled` is false on the target, `onDragBlocked` fires at most once per direction per press. If its animations are still being prepared, development builds warn and the attempt does not start.

## Initial readiness

A target Scene becomes available for dragging when its animations are ready. Preset animations can still be loading just after mount.

`onReady` exposes the ref API, while `onLoadProgress` reports preload-queue progress. Drag readiness has no separate callback, and a fixed delay cannot guarantee that a target is ready. Keep the initial Scene content visible while its neighbor prepares. See [Preloading](/docs/02-preload) for resource configuration.

## Configuration during a transition

A drag uses the animation configuration captured when it starts. Changes to delays, durations, dependencies, or variants take effect on the next activation.

An Animate added during that transition does not join the current sequence. It appears at its resting state and joins the next activation. Development builds warn about these changes.

Keep configuration object references stable while their values are unchanged. This also applies to objects passed by a parent.

## Continue a transition with another drag

Pressing during a transition pauses movement at its current position. Dragging continues from there.

A press that ends as a tap, cancellation, or rejected attempt resumes the remaining movement. A successful drag controls the movement from that position. Dragging back to zero cancels the transition and returns incoming elements toward their initial frames.

## Related pages

- [Gestures](/docs/02-gestures): input conditions and thresholds
- [Drag callbacks](/docs/05-callbacks): session notifications
- [Page movement and element time](/docs/03-two-track): independent completion times
- [Drag troubleshooting](/docs/06-drag-pitfalls): delayed or missing interaction
