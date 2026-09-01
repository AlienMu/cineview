---
title: The Animate timeline
eyebrow: CONCEPTS / TIMELINE
---

Every `Animate` element runs on a dedicated timeline: `phase` indicates its current lifecycle state, `timeline.*` configures its driver and scheduling, and `enterRef` / `exitRef` provide manual control.

## phase: the six states

| phase      | meaning                                 |
| ---------- | --------------------------------------- |
| `idle`     | at rest, not scheduled yet              |
| `waiting`  | scheduled, waiting on `delay` / `after` |
| `entering` | enter in progress                       |
| `entered`  | enter complete                          |
| `exiting`  | exit in progress                        |
| `exited`   | exit complete (at rest until a replay)  |

Two ways to read it: render-prop children receive `{ enterProgress, phase }`; inside a child component, `useAnimateTimeline()` returns read-only MotionValues, so reading progress does not trigger React re-renders (see [useAnimateTimeline](/docs/09-use-animate-timeline)). Enter progress runs 0→1, and exit rewinds along the same path.

**`phase` does not advance inside a locked zone.** For an element inside a locked zone it stays at `idle`, while `progress` scrubs with scrolling as usual. So any "keep drawing while phase says so" logic stops immediately inside a zone; use `signedProgress` or `frame.source` there instead. Drag mode is unaffected and runs the full set of phases. See [useAnimateTimeline](/docs/09-use-animate-timeline).

## driver: timeline drivers

`timeline.driver` configures the source that drives progress, accepting either `'scene'` (default) or `'clock'`. The driving rules across modes and configurations are as follows:

| driver    | context                                       | driven by                                                                      |
| --------- | --------------------------------------------- | ------------------------------------------------------------------------------ |
| `'scene'` | inside a scroll locked zone (inherits zoneId) | driven by the zone's real scroll budget; `timeline.phase` can narrow the range |
| `'scene'` | scroll, outside a zone                        | falls back to the visibility conditions                                        |
| `'scene'` | drag                                          | driven by the scene's shared element timeline (follows the gesture)            |
| `'clock'` | scroll                                        | forced to the visibility conditions on its own (even inside a zone)            |
| `'clock'` | drag                                          | plays independently in real time once the scene arrives                        |

The last row needs care: with `driver: 'clock'` + drag the element **does not join the registry / `after` / T_self, and ignores `exitAnimation`**: the exit animation does not play.

## delay, after, and phase ranges

- `timeline.delay` (ms): time to wait before entering, added on top of the `after` chain.
- `timeline.after`: a wait chain pointing at another `animateId`. A nonexistent id reports `INVALID_ANIMATION`; a cycle reports `CIRCULAR_DEPENDENCY`.
- `timeline.zoneId`: explicitly assigns the element to a locked zone.
- `timeline.phase: { start, end }`: restricts the scrub window to a segment of zone progress; only meaningful in the "`'scene'` + scroll locked zone" row.

Full timeline rules (chain resolution, stagger, mirrored exits) live in [Timeline](/docs/04-orchestration). One rule up front: **if the entrance cascades with `after`, the exit needs a mirrored reverse timeline**, or every element exits in the same frame.

## enterRef / exitRef: manual triggers

Both refs are manual triggers on the element's timeline. The type is `MutableRefObject<(() => void) | null>`, so call `ref.current?.()` to trigger.

**`enterRef`** rules:

- Calling it enters immediately and interrupts a pending `after` / `delay`.
- With both the ref and `after` / `delay` set: `after` / `delay` act as the fallback: if nobody fires the manual trigger, the timeline plays automatically as usual.
- With the ref set but no `after` / `delay`: **it never auto-fires**; manual calls only.

**`exitRef`** is stricter:

- Setting it disables _all_ automatic exits: leaving a scroll zone or switching away in drag mode does not exit the element; exit must be triggered manually via the ref.
- **No delay fallback exists.** If `exitRef` is assigned without being invoked, the element remains mounted indefinitely. Omitting `exitRef` preserves the automatic exit fallback.

The full props table: [Animate reference](/docs/03-animate).
