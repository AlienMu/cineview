---
title: The Animate timeline
eyebrow: CONCEPTS / TIMELINE
---

`Animate` uses `timeline` to select its progress source and timing. Read `phase` for its animation stage, or use the supported manual refs to trigger an entrance or exit.

## phase: the six states

| phase      | meaning                                 |
| ---------- | --------------------------------------- |
| `idle`     | at rest, not scheduled yet              |
| `waiting`  | scheduled, waiting on `delay` / `after` |
| `entering` | enter in progress                       |
| `entered`  | enter complete                          |
| `exiting`  | exit in progress                        |
| `exited`   | exit complete (at rest until a replay)  |

Render-prop children receive `{ enterProgress, phase }` as React values. A descendant component can call `useAnimateTimeline()` for MotionValues that update without React rendering. See [useAnimateTimeline](/docs/09-use-animate-timeline).

For a scene-driven entrance or exit inside a scroll locked zone, `phase` stays at `idle` while progress follows scrolling. Clock-driven elements use visibility phases; loop-only elements rest at `entered`. In drag mode, phases identify entering and exiting.

## driver: timeline drivers

`timeline.driver` accepts `'scene'` (default) or `'clock'`. Its behavior depends on the mode:

| driver    | context                                       | driven by                                                                      |
| --------- | --------------------------------------------- | ------------------------------------------------------------------------------ |
| `'scene'` | inside a scroll locked zone (inherits zoneId) | driven by the zone's real scroll budget; `timeline.phase` can narrow the range |
| `'scene'` | scroll, outside a zone                        | falls back to the visibility conditions                                        |
| `'scene'` | drag                                          | driven by the scene's shared element timeline (follows the gesture)            |
| `'clock'` | scroll                                        | forced to the visibility conditions on its own (even inside a zone)            |
| `'clock'` | drag                                          | plays independently in real time once the scene arrives                        |

In drag mode, `driver: 'clock'` plays after the Scene arrives. It does not participate in `after` dependencies or the Scene's total element duration, and does not play `exitAnimation`.

## delay, after, and phase ranges

- `timeline.delay` (ms): time to wait before entering, added on top of the `after` chain.
- `timeline.after`: a wait chain pointing at another `animateId`. A nonexistent id reports `INVALID_ANIMATION`; a cycle reports `CIRCULAR_DEPENDENCY`.
- `timeline.zoneId`: explicitly assigns the element to a locked zone.
- `timeline.phase: { start, end }`: restricts the scrub window to a segment of zone progress; only meaningful in the "`'scene'` + scroll locked zone" row.

`after` controls entrance order. Add ordered exits only when the design needs them; an entrance cascade does not create an exit sequence. See [Timeline](/docs/04-orchestration).

## enterRef / exitRef: manual triggers

The refs contain trigger functions; call `ref.current?.()` to use one.

Visibility-driven scroll animations support both refs, including `driver: 'clock'` elements inside a locked zone. Drag with `driver: 'clock'` supports `enterRef` only. Scene-driven drag and locked-zone animations ignore both refs and report `INVALID_ANIMATION`.

For supported `enterRef` usage:

- Calling it starts entering immediately and interrupts a pending wait.
- An authored `after` dependency or positive `timeline.delay` remains an automatic fallback where that option is supported.
- Without a fallback, entrance requires a manual call.

For supported `exitRef` usage, passing the ref disables automatic exit. Calling it starts the exit and interrupts a pending entrance. There is no delay fallback. Scene mounting and visibility still apply; the ref does not keep content on screen after its Scene leaves.

The full props table: [Animate reference](/docs/03-animate).
