---
title: Troubleshooting
eyebrow: ADVANCED / TROUBLESHOOTING
---

Six failure modes you actually run into. Each entry says what you see first, then what to do, with the reason in between. When something breaks, find your symptom here, then read the linked reference page.

## 1. A looping animation keeps running after exit

What you see: the scene has exited, but a looping effect is still rendering, even repainting every frame while offscreen.

You used CSS `animation: ... infinite`. CSS infinite animations ignore the animation phase. The element exited, the loop didn't.

What to do: persistent/looping motion belongs in the `loopAnimation` prop of `Animate`, controlled by `shouldRunInfinite`: it stops the moment the element leaves its own phase or scrolls out of the viewport. `loopAnimation` can coexist with `enterAnimation`; for a loop-only element omit the `enterAnimation` prop entirely (its type is `enterAnimation?: never`, which means "this key must not appear," not "pass the string never"; `'never'` is not a preset name, so writing it fails type-checking and then fails to parse at runtime). See [Animate](/docs/03-animate).

## 2. After wiring `exitRef`, the element never exits on its own

What you see: you passed `exitRef` to an Animate, and from then on neither leaving the scroll zone nor switching drag scenes exits the element. It looks stuck.

Passing `exitRef` takes the exit over explicitly: every automatic exit (leaving the zone, switching scenes) is disabled, and you call it yourself. That's the designed semantics, not a broken state; and unlike `enterRef`, `exitRef` has **no delay/after fallback**. Note where each one applies: `exitRef` works only on visibility-driven animations in scroll, while `enterRef` also works on independently playing elements in drag (`driver: 'clock'`). On animations that follow scroll position (a locked zone in scroll, scene-driven elements in drag), neither ref does anything: both are ignored and reported as `INVALID_ANIMATION`.

What to do: either drop `exitRef` to restore automatic exits, or call it at the right business moment (user confirmed, data ready). `enterRef` is the opposite: if the ref is set and after/delay also exist, after/delay act as fallback; only "ref with no after/delay at all" never auto-triggers. Full behavior matrix in [Timeline concepts](/docs/02-timeline) and [Animate](/docs/03-animate).

## 3. An element with `driver: 'clock'` has no exit animation

What you see: in drag mode the element just pops out of existence; the `exitAnimation` you configured never plays.

With `timeline.driver: 'clock'` in drag mode, the element plays independently on wall-clock time after its Scene arrives: it **does not join the after timeline, and it ignores `exitAnimation`**. The easiest cell of the five-row inference table to step on.

What to do: if you want an exit timeline, keep the default `driver: 'scene'` (the element timeline rides the scene transition and exit replays in order). Independent playback suits decorative motion that isn't cut into the narrative. See [Timeline concepts](/docs/02-timeline).

## 4. In a scroll zone, `duration: 2000` means 2000px of scrolling

What you see: you expected `duration: { enter: 2000 }` to be a two-second animation; instead it takes 2000px of scrolling to complete.

In a scroll locked zone, animation time is real scroll distance: **1ms = 1px**. The millisecond value of `duration.enter` translates directly into scroll pixels. Not a bug; it is animation time expressed as how much the user scrolls.

What to do: budget zone timelines directly in pixels: 2000ms is a 2000px scrolling span. Scrolling back into the segment drives progress 100%→0% naturally, no reverse special-casing needed. Large inputs (long flicks) get clamped to in-segment frames to prevent skipping. Mechanics in [center-lock & zones](/docs/01-centerlock).

## 5. `after` errors / stagger doesn't follow the scroll

What you see, one of three things:

- `after: 'title'` reports `INVALID_ANIMATION` on mount with a dev console warning; the broken edge is ignored and the animation still runs.
- After chaining several `after` edges you get `CIRCULAR_DEPENDENCY`.
- An Animate with `stagger` inside a zone doesn't reveal children with scroll progress; they run on their own clock.

`after` may only point at an **existing animateId**: a missing target reports `INVALID_ANIMATION`, a cycle A→B→A reports `CIRCULAR_DEPENDENCY`. Both are statically validated by the registry at mount, but **not rejected**: they surface through `onError` plus a dev warning, the incorrect edge is ignored, and everything else runs (fail-open, so development isn't interrupted). `stagger` uses Framer's native `staggerChildren`, which **runs on time, not on scroll position**.

What to do: declare the `after` target first and match id strings exactly; if the chain has a cycle, split it. For scroll-driven per-element reveal, use the render prop's `enterProgress` and bucket the children yourself. Rules in [Timeline](/docs/04-orchestration) and [Animate](/docs/03-animate).

## 6. Every element exits in the same frame

What you see: the entrance was a polished `after` cascade (title → subtitle → button, in sequence); on exit every element fires its `exitAnimation` in the same frame, so the whole set disappears at once.

An entrance cascade is not an exit timeline. `timeline.after` only describes the entry graph; with no reverse dependency graph for exit, the scene-switch signal reaches every element **simultaneously** and each starts its own exit at once.

What to do: if the entrance used a after cascade, write the reverse order explicitly with `exitAnimation` + `duration.exit` (stagger exits against each other, or build a separate exit-side chain). Asymmetric enter/exit is allowed by design; writing only half produces this symptom. See [Timeline](/docs/04-orchestration).
