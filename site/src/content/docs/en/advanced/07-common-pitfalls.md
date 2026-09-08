---
title: Troubleshooting
eyebrow: ADVANCED / TROUBLESHOOTING
---

Check the animation's mode and driver first. These settings determine its timing, manual controls, and exit behavior.

## 1. A looping animation continues after exit

An effect written as CSS `animation: ... infinite` does not automatically stop with its Scene. It can keep running after the element leaves.

Put persistent motion in `Animate`'s `loopAnimation` prop. The loop stops when the element leaves its active phase or the viewport. `loopAnimation` can coexist with `enterAnimation`; for a loop-only element, omit `enterAnimation` because its type is `enterAnimation?: never`. See [Animate](/docs/03-animate).

## 2. An element never exits after `exitRef` is set

Visibility-driven scroll animations support `exitRef`. Passing it disables automatic exit, so application code must call the trigger. Drag with `driver: 'clock'` supports `enterRef` only; scene-driven drag and locked-zone animations reject both refs.

Remove `exitRef` to restore supported automatic exits, or call `exitRef.current?.()` at the intended event. See [Manual controls](/docs/03-animate).

## 3. A `driver: 'clock'` element has no exit animation

In drag mode, `timeline.driver: 'clock'` starts after the Scene arrives and runs independently of the scene timeline. It does not join `after` ordering and ignores `exitAnimation`.

Use the default `driver: 'scene'` when an element needs ordered entry or exit motion. Use the clock driver for decorative motion that does not belong to the narrative sequence. See [The Animate timeline](/docs/02-timeline).

## 4. A locked-zone animation needs more scrolling than expected

Without a phase override, `duration.enter: 2000` occupies 2000 pixels of real scroll distance inside a locked zone. It does not mean two seconds of elapsed time.

Set the duration for the intended scroll distance. Reverse scrolling reverses progress, and oversized user input is constrained at the segment boundaries. See [Zones and scroll budgets](/docs/02-zones-budget).

## 5. An `after` reference reports an error or `stagger` ignores scroll

A missing `after` target reports `INVALID_ANIMATION`; a cycle reports `CIRCULAR_DEPENDENCY`. The unsupported dependency is ignored, and the remaining animation keeps its own timing. Stagger plays by elapsed time rather than scroll position.

Match an existing `animateId` in the same Scene and remove cycles. JSX declaration order does not matter. For progress-driven child reveals, use separate Animate elements or derive child styles from timeline MotionValues.

## 6. Every element exits in the same frame

`after` controls entrance order and does not define an exit sequence. Different exit durations change completion times, not start order.

For ordered exits on visibility-driven scroll elements, call their manual exit refs in the desired order. For position-driven effects, define the sequence through timeline ranges or keyframes. An entrance sequence can also be used without an exit. See [Timeline](/docs/04-orchestration).
