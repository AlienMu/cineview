---
title: Troubleshooting
eyebrow: ADVANCED / TROUBLESHOOTING
---

These six issues occur across both modes. Each item states what the runtime does and the change that addresses it.

## 1. A looping animation continues after exit

An element that uses CSS `animation: ... infinite` keeps repainting after its Scene exits. CSS animation does not follow the element lifecycle.

Put persistent motion in `Animate`'s `loopAnimation` prop. The loop stops when the element leaves its active phase or the viewport. `loopAnimation` can coexist with `enterAnimation`; for a loop-only element, omit `enterAnimation` because its type is `enterAnimation?: never`. See [Animate](/docs/03-animate).

## 2. An element never exits after `exitRef` is set

Passing `exitRef` takes over the automatic exit on a time-driven lane (a visibility-driven element outside any takeover zone, or `timeline.driver: 'clock'`). The ref must be called by application code, and it has no `delay` or `after` fallback. It applies to visibility-driven scroll animations. `enterRef` also applies to independent drag elements with `driver: 'clock'`. Neither ref applies to position-driven animations, such as locked-zone scroll elements or scene-driven drag elements; those uses report `INVALID_ANIMATION`.

Remove `exitRef` to restore automatic exits, or call it at the required application event. For `enterRef`, `after` and `delay` remain fallback triggers when supplied; a ref with neither fallback never starts automatically. See [The Animate timeline](/docs/02-timeline) and [Animate](/docs/03-animate).

## 3. A `driver: 'clock'` element has no exit animation

In drag mode, `timeline.driver: 'clock'` starts after the Scene arrives and runs independently of the scene timeline. It does not join `after` ordering and ignores `exitAnimation`.

Use the default `driver: 'scene'` when an element needs ordered entry or exit motion. Use the clock driver for decorative motion that does not belong to the narrative sequence. See [The Animate timeline](/docs/02-timeline).

## 4. `duration: 2000` in a scroll zone means 2000 px of scrolling

Inside a locked scroll zone, duration maps directly to real scroll distance: 1 ms equals 1 px. `duration.enter: 2000` therefore spans 2000 px of scrolling instead of two seconds of wall-clock time.

Set zone durations in the amount of scrolling the section needs. Scrolling backward maps progress from 100% to 0% naturally. Large input deltas are clamped to an in-segment frame so a zone is not skipped. See [Center-lock scrolling](/docs/01-centerlock) and [Zones and scroll budget](/docs/02-zones-budget).

## 5. An `after` reference reports an error or `stagger` ignores scroll

An `after` target that does not exist reports `INVALID_ANIMATION`; a cycle such as A → B → A reports `CIRCULAR_DEPENDENCY`. The registry checks both cases when the component mounts, reports them through `onError` and a development warning, ignores only that one dependency, and keeps the remaining animation running. `stagger` uses Framer Motion's `staggerChildren`, which follows elapsed time instead of scroll position.

Declare the `after` target before its follower and match the id exactly. Split a cycle into separate sequences. For per-element reveals tied to scroll, use the render prop's `enterProgress` and assign progress ranges to the children. See [Timeline](/docs/04-orchestration) and [Animate](/docs/03-animate).

## 6. Every element exits in the same frame

An `after` chain controls entrance order only. When a scene changes, each element receives the exit signal at the same time unless its exit timing is defined separately.

Write the reverse order with `exitAnimation` and `duration.exit`, or stagger the exit work explicitly. An asymmetric entrance and exit is valid, but an entrance chain alone cannot create ordered exits. See [Timeline](/docs/04-orchestration).
