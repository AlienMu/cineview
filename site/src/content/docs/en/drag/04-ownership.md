---
title: Starting and resuming a drag
eyebrow: DRAG / OWNERSHIP
---

A press starts a possible drag. The framework waits for a direction-qualified movement before starting a drag session. Pressing during a transition pauses its movement so dragging can continue from that position.

## Press before movement

A stationary press does not start a drag or emit `onDragStart`. Links, buttons, and other exempt controls keep their normal interaction.

The first movement that meets the direction check attempts to start the gesture.

## Conditions for starting

A gesture can start when no other session prevents it, the target Scene allows dragging, and the target's animations are ready.

If `Scene.drag.enabled` is false on the target, `onDragBlocked` fires at most once per direction per press. If its animations are still being prepared, development builds warn and the attempt does not start.

## Initial readiness

Mounting does not mean every target Scene is immediately ready to drag. Preset loading and animation registration can still be pending.

There is no public callback for this specific readiness condition. `onReady` exposes the ref API, while `onLoadProgress` describes queued resources. Neither a resource percentage nor an arbitrary delay guarantees drag readiness. Keep the initial Scene content available while its adjacent Scene is being prepared.

## Configuration during a transition

A drag uses the animation configuration captured when it starts. Changes to delays, durations, dependencies, or variants take effect on the next activation.

An Animate added during that transition does not join the current sequence. It appears at its resting state and joins the next activation. Development builds warn about these changes.

Keep variant objects stable when their meaning is unchanged, including objects passed from a parent render.

## Continue a transition with another drag

Pressing during a transition pauses movement at its current position. Dragging continues from there.

A press that ends as a tap, cancellation, or rejected attempt resumes the remaining movement. A successful drag controls the movement from that position. Dragging back to zero cancels the transition and returns incoming elements toward their initial frames.

## Related pages

- [Gestures](/docs/02-gestures): input conditions and thresholds
- [Drag callbacks](/docs/05-callbacks): session notifications
- [Page movement and element time](/docs/03-two-track): independent completion times
- [Drag troubleshooting](/docs/06-drag-pitfalls): delayed or missing interaction
