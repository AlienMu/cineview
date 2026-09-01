---
title: Ownership and transactions
eyebrow: DRAG / OWNERSHIP
---

Pressing a finger down is not the same as starting a drag. Drag uses a three-stage candidate / ownership / transaction model that freezes one page turn's timeline into a constant. This mechanism explains why taps never disturb animation, why pressing mid-transition takes over in place, and why the first few gestures after mount can be dropped.

## Candidate: pressed but not yet dragging

An ordinary pointer-down establishes only a candidate, and at that point the framework deliberately does nothing:

- No global dragging flag
- No claim on the element timeline
- No `preventDefault`
- No drag callbacks at all

Only the first movement that passes the direction check requests ownership. That boundary is what keeps taps, link clicks, and text selection from visually disturbing the scene.

## Ownership: one synchronous decision

The request is adjudicated synchronously by the root. Only on success does a transaction get created, the dragging flag set, the click suppressed, and `onDragStart` fired. The order is fixed:

1. A session is already active and this is not a re-grab → reject
2. The target scene has `drag.enabled === false` → fire `onDragBlocked` (at most once per direction per press), reject
3. **The target scene has no prepared snapshot** → development warning, reject
4. Create the transaction, clear the candidate hold, fire `onDragStart`

Step 3 is the one most often hit in practice, so it gets its own section.

## The prepared snapshot: a precondition for dragging

**The first few gestures after mount can do nothing, and the framework offers no public "ready to drag" callback.** If the initial screen displays a gesture prompt, tie its visibility to `onLoadProgress` reaching 100 or an explicit delay, rather than assuming mount immediately allows dragging.

The reason is a precondition: a mounted scene publishes an immutable prepared snapshot to the root only after it has resolved all of its presets and its animation registry has settled. That snapshot carries the resolved mapping, a registry snapshot (each element's accumulated delay and the scene's total timeline length) and the visual variants.

Without it, a gesture aimed at the scene is silently refused: no signal at all in production, only a development warning. Publication waits for a macrotask plus every asynchronous preset parse, so finishing mount is not the same as being draggable.

## Transaction: this round's timeline is frozen

When a gesture actually targets a scene, the root creates a transaction from that scene's prepared snapshot, freezing this round's delays, durations, variants, mapping conversion rule, and total timeline length. Follow-finger, post-release continuation, bounce, and re-grab continuation all read that same frozen source.

Two direct consequences:

**An `Animate` mounted mid-transition does not take part in this round.** It renders at its own resting state and warns in development, joining the timeline at the next scene activation. Conditionally rendered elements run into this most often.

**Changing props mid-transition has no effect.** Edits to `delay`, `duration`, `after`, or the entrance variant are ignored with a warning and apply at the next activation. Note the entrance variant is compared **by reference**, so building a fresh inline object literal on every render triggers this warning continuously.

## Re-grab: continue in place with no visual jump

When the user presses again mid-transition, the press often lands on the incoming scene (the outgoing one has largely slid away, so the touch point is usually on the new one). The framework lets a non-current scene accept the gesture in that situation.

The re-grab behavior is **stop the movement where it is and continue following the finger from that position**:

- Not a flush-commit (which consumes the remaining movement in one frame and teleports the whole scene stack)
- Not "hold the gesture, then snap the accumulated offset in one frame at the natural commit point"

The press suspends the running continuation, and that suspension is reversible: if the press never acquires ownership (a tap, a cancel, a rejection), the continuation resumes for its remaining duration and the commit timer is re-armed. Only genuine ownership preempts permanently. Pressing while nothing is in flight suspends nothing, which is the do-nothing candidate behavior described under "Candidate: pressed but not yet dragging."

One edge worth knowing: dragging back to exactly 0 after a re-grab abandons the transition, and the incoming scene's elements rewind to their starting point rather than freezing half-entered.

## Related pages

- [Gestures and thresholds](/docs/02-gestures): the four input checks and the threshold formula
- [Drag callback timing](/docs/05-callbacks): timing facts such as re-grab not firing `onDragStart`
- [Page movement and element time](/docs/03-two-track): who updates each quantity
- [Drag troubleshooting](/docs/06-drag-pitfalls): the failures these mechanisms produce
