---
title: Page movement and element time
eyebrow: DRAG / DUAL-TRACK
---

In drag mode two quantities run on their own clocks: page movement `renderProgress`, and each scene's element time `elementElapsedMotion`. The first turns pages, the second animates elements in. Once the division is clear, "why is this element still moving" and "why did the change do nothing" both have one definite answer.

## The two quantities and who updates them

| Quantity                            | Updated by                                | Used for                                 |
| ----------------------------------- | ----------------------------------------- | ---------------------------------------- |
| Page movement `renderProgress`      | the framework's drag-and-release handling | page translate, the commit decision      |
| Element time `elementElapsedMotion` | each Scene itself                         | every scene-driven Animate in that Scene |
| `dragRelease`                       | the scene manager, at release             | a read-only directive every scene reads  |

- Page movement is the only trigger of a switch: reaching its target is what commits the page turn.
- Element time is a MotionValue owned by each Scene instance (the elapsed milliseconds of its own enter timeline), with zero sharing across scenes. There is no global element scalar and no cross-scene write path.
- At release, `dragRelease` carries one read-only directive: settle to the end or bounce back to zero. Every scene reads it and continues on its own; nobody writes it back.

## A scene's timeline length adds up from its children

In drag mode no prop sets how long a scene's timeline is. It is the result of the children's timeline arrangement:

```text
scene timeline length = max(over scene-driven Animates of (accumulated delay + enter duration))
```

`after` chains are folded into each element's accumulated delay at registration time, so a longer chain means a longer total. In drag this computation has no floor (the page transition duration never raises it), which means **a scene containing no `Animate` at all has a length of 0 and completes instantly on release**.

The way to tune how a transition feels is to lay out the elements' timeline, not to set a duration parameter.

## Drag distance and the timeline are two different scales

While following the finger, the framework converts gesture displacement into element-time milliseconds, using the conversion rule that `unit` and `scale` define. The consequence of the default `time + 10` deserves its own note:

**Dragging a full screen advances only 1000 ms of element time, regardless of the scene's total timeline length.**

So a 6.5-second entrance is only about 15% along at full drag, and the remainder completes at real-time rate after release. This is a deliberate trade: it decouples drag speed from the animation clock so short elements can settle while the finger is still moving, at the cost of a long timeline not completing in a single drag. For "half a drag equals half the timeline," set `unit: 'percent'`. See [Gestures and thresholds](/docs/02-gestures).

Because every element normalizes against its own accumulated delay and duration on that one clock, short elements finish before the drag does. That buys correct `after` serialization and is a design trade rather than a defect.

Neither `renderProgress` nor `elementElapsedMotion` has a public write API. The timeline enters the framework purely through declarations (`duration` / `delay` / `after`). Writing these quantities from outside does not error; the framework's own calculation overwrites the value on the next frame, so the animation "looks broken" while the write never took effect.

## During a switch: outgoing and enter segments

Adjacent scenes stay mounted while a gesture is in flight, and the division of labor holds:

- Enter (incoming scene): while following the finger, `elapsed = r × T` (r is the drag timeline ratio in 0..1, T is that scene's total enter-timeline length); on a switching release it continues from its current position to T at natural rate, on a non-switching release it bounces back to 0. Elements with `delay` / `after` hold their initial frame until `elementElapsedMs` crosses their threshold.
- Outgoing scene: its element time is neither taken over nor reset by the incoming scene. Exit visuals follow `renderProgress` in reverse: drag back and the exit rewinds in real time instead of playing one-way by clock.
- Commit only switches the current page; it **does not interrupt element time that is still completing**. After the page has turned, the incoming scene's element animations keep completing from the release state, across the commit boundary.

## What the drag callbacks carry

| callback         | detail                                                                                  | when it fires                                                                            |
| ---------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `onDragStart`    | `{ sceneIndex, progress, direction }`                                                   | the first valid gesture with a determined direction; a light tap does not count          |
| `onDragProgress` | `{ sceneIndex, progress, direction? }`                                                  | while dragging                                                                           |
| `onDragBlocked`  | `{ fromIndex, targetSceneIndex, direction }`                                            | a gesture rejected by an admission check                                                 |
| `onDragEnd`      | `{ sceneIndex, progress, direction?, targetSceneIndex, elapsedMs, timelineDurationMs }` | switch committed: target scene, element-timeline elapsed ms, total enter-timeline length |
| `onDragCancel`   | `{ sceneIndex, progress, direction? }`                                                  | not committed (bounced back)                                                             |

Two conclusions you can rely on: once `onDragStart` fires, that gesture session ends with exactly one `onDragEnd` or `onDragCancel`; and `elapsedMs` in `onDragEnd` is the target scene's element-time elapsed at commit time; compare it with `timelineDurationMs` to know how much entrance remains.

Scroll mode does not split these two quantities, but it keeps the same discipline: one scroll source at a time, a `Scene.scroll` locked zone or the native document flow, never both. See [Dual-mode engines](/docs/01-modes) and [Center-lock takeover](/docs/01-centerlock).
