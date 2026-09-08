---
title: Page movement and element time
eyebrow: DRAG / TIMELINES
---

In drag mode, page movement and element animations can finish at different times. The scene switch commits when page movement completes; elements can continue entering afterward.

## Page movement and element progress

| Value            | What it describes                                        |
| ---------------- | -------------------------------------------------------- |
| Page movement    | How far the scene has moved toward its next position     |
| Element progress | How far an individual entrance or exit has played        |
| Release outcome  | Whether movement continues to the destination or returns |

Each Scene's element timing is independent. Moving into another Scene does not replace the outgoing Scene's element timeline.

## Calculate the Scene's element duration

The total comes from the latest end time among scene-driven child animations:

```text
scene element duration = max(accumulated delay + enter duration)
```

`after` adds the leader's entrance to the follower's starting delay. With no scene-driven Animate children, the element duration is zero: there is no element animation to continue after release. Page movement still completes independently.

Configure the sequence through each Animate's `duration`, `timeline.delay`, and `timeline.after`.

## Map drag distance to time

With the default `unit: 'time'` and `scale: 10`, every 1% of drag advances 10ms of element time. A full-screen drag advances 1000ms.

For a 6.5-second timeline, that reaches about 15% before release; the remaining animation continues at real-time speed. Use `unit: 'percent'` when drag percentage needs to map to the same timeline percentage.

Elements with shorter durations can finish while a longer element is still entering. See [Gestures and thresholds](/docs/02-gestures).

## During a scene change

The incoming Scene holds each delayed element at its initial frame until its start time. On a committed release, its animations continue from their current positions; on a canceled release, they return toward their initial states.

The outgoing Scene's visuals follow page movement. Reversing the gesture reverses that movement. Committing the page change does not stop the incoming elements that are still playing.

## Read the drag callbacks

| Callback         | Meaning                                                  |
| ---------------- | -------------------------------------------------------- |
| `onDragStart`    | A direction-qualified gesture starts                     |
| `onDragProgress` | Progress while dragging or returning after cancellation  |
| `onDragBlocked`  | Application configuration prevents entry into the target |
| `onDragEnd`      | A scene change commits, with target and element timing   |
| `onDragCancel`   | An accepted gesture returns without committing           |

`onDragEnd` includes `elapsedMs` and `timelineDurationMs`. They describe the target Scene's element timeline at commit and indicate how much entrance remains at that moment. They do not update afterward.

Timing details are in [Drag callbacks](/docs/05-callbacks). For scroll-driven timing, see [Center-lock](/docs/01-centerlock).
