---
title: Animate
eyebrow: TIMELINE CONSUMER
---

Animate consumes the current mode's timeline semantics, composing delay, waitFor, phase, visibility, and stagger.

## When to use

- Any element needing enter / exit / persistent-loop semantics. Do not hand-write opacity/transform lifecycles, and do not use CSS `animation: … infinite`.
- You need cascade orchestration (`waitFor` + `delay`) or staggered child reveals (`stagger`).
- You need to expose animation progress to a custom renderer: use the render-prop form (receiving `enterProgress`) or `useAnimateTimeline()`, never a home-built driver.

## The current timeline API

`timeline.sceneControlled` defaults to true. Inside a scroll takeover zone it binds to the zone; elsewhere it gracefully falls back to visibility. Set false to force visibility.

Typical usage: declare the element's enter/exit animation names (`enterAnimation`/`exitAnimation`) with their durations (`duration.enter`/`duration.exit`), attach it to a cascade via `timeline.delay`/`waitFor`, and opt into replay on re-entry via `visibility.replayOnReenter`. The value lists live in the API reference.

The lane adjudication (`timeline.sceneControlled`) decides what drives this element's progress:

- **Scroll takeover lane**: inside a takeover zone with `sceneControlled` untouched. Driven by scroll px, `duration.enter` is real scroll distance (`1ms = 1px`), and scrolling backward plays it in reverse.
- **Visibility time lane**: scroll mode outside a zone, or explicit `sceneControlled: false`. Driven by real time, with the viewport-margin gate triggering enter/exit.
- **Drag element track / arrival lane**: in drag mode, scene-controlled elements scrub with the scene's element track; `sceneControlled: false` switches to the independent arrival lane, which plays in real time with no exit pass.

Manual control (`enterRef`/`exitRef`) only means something on time lanes. On a scrub lane the visual position is a pure function of its single owner, and manual writes are reported and ignored. The full lane × ref support matrix lives in the API reference.

## Common misuse

- **Using CSS `animation: … infinite` for persistent loops**: it escapes phase gating, never stops off-screen, and produces the "everything else has exited but this is still moving" broken window. `infiniteAnimation` is the one sanctioned channel.
- **Choreographing enter without exit**: whatever cascade `waitFor`/`delay` builds for entry needs the mirrored exit choreography, or all exits fire at once (a "packaged rollback") and the timing goes asymmetric.
- **Passing `enterRef` on a scrub lane**: it structurally cannot work. Use `sceneControlled: false` (drag) or move the element outside the takeover zone (scroll).
- **Providing neither `enterAnimation` nor `infiniteAnimation`**: reports `INVALID_ANIMATION`; provide at least one.

---

For the complete field reference and the lane support matrix see the [Animate API](/docs/animate-api).
