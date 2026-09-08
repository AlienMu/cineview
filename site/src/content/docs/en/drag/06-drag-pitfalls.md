---
title: Drag troubleshooting
eyebrow: DRAG / TROUBLESHOOTING
---

These six issues are specific to drag mode. For issues shared by both modes, see [Troubleshooting](/docs/07-common-pitfalls).

## 1. `transitionDuration` does not affect gesture paging speed

`transitionDuration` configures programmatic navigation. Gesture movement uses a separate timing base, and the rebound duration depends on displacement with a 300ms cap.

To change element pacing, adjust `duration`, `timeline.delay`, or the drag mapping through `unit` and `scale`. See [Gestures](/docs/02-gestures).

## 2. `exitAnimation` does not execute during backward dragging

When an element has an `exitAnimation`, forward dragging runs it, but backward dragging reverses the entrance animation instead. The reverse motion interpolates `initial → animate` across `1 - progress`. Without an `exitAnimation`, forward dragging leaves the element at its resting state while the scene moves.

Treat forward and backward movement as separate behaviors. Define `exitAnimation` as the visual inverse of the entrance when both directions need matching motion. Leave it unset when backward dragging acts as an undo gesture.

## 3. The initial screen skips its entrance animation

If scenes are added after the first render, the initial scene can appear at its final state while later scenes animate normally. The first-screen entrance decision is made during the initial mount. An initial scene count of zero disables that entrance animation for the rest of the mount.

Include Scene nodes in the first render. While data or dynamic imports are pending, render a placeholder Scene instead of delaying all Scene declarations.

## 4. A `driver: 'clock'` element never exits

In drag mode, `timeline.driver: 'clock'` starts the element on wall-clock time after its Scene arrives. The element does not join the `after` sequence, does not run `exitAnimation`, and does not contribute its duration to the scene timeline. Development builds report these ignored settings.

Use `driver: 'scene'` when the element needs gesture-driven exit motion or `after` dependencies. Use the clock driver for an independent effect that starts after arrival.

## 5. A distant scene loses timers and local state

Drag mode keeps only the current scene and its immediate neighbors mounted. A scene more than one position away unmounts. Returning to it mounts a new instance, so effects restart, component state resets, and timeline cursors return to zero.

Store state that must survive scene changes outside `CineView`, such as in parent state, Context, or an external store. Keep scene effects limited to presentation work. Scene identity follows array position, so structural reordering changes which instance occupies a slot.

## 6. Wrapped `Scene` elements disappear

`Scene` discovery checks direct children of `CineView`. React arrays are flattened, so `{list.map(...)}` works. Fragments are not flattened, and a custom component that returns `Scene` from its render body hides the nested node. `memo` and `forwardRef` wrappers are unwrapped up to six levels. Mixed direct and Fragment-wrapped children therefore discover only the direct scenes, without an empty-scene warning.

Declare Scene nodes directly under CineView. A reusable factory can return an array of Scene elements; call it in CineView's children rather than wrapping the Scenes in another component.

## Related pages

- [Drag layout contract](/docs/01-layout): the virtualization window and ignored props
- [Starting and resuming a drag](/docs/04-ownership): why early gestures can do nothing
- [Drag callback timing](/docs/05-callbacks): callback timing and names
- [Troubleshooting](/docs/07-common-pitfalls): issues shared across both modes
