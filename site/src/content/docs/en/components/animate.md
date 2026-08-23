---
title: Animate
eyebrow: TIMELINE CONSUMER
---

Animate consumes the current mode's timeline semantics, composing delay, waitFor, phase, visibility, and stagger.

## When to use

- Any element needing enter / exit / persistent-loop semantics — do not hand-write opacity/transform lifecycles, and do not use CSS `animation: … infinite`.
- When you need cascade orchestration (`waitFor` + `delay`) or staggered child reveals (`stagger`).
- When you need to expose animation progress to a custom renderer — use the render-prop form (receiving `enterProgress`) or `useAnimateTimeline()`, never a home-built driver.

## The current timeline API

sceneControlled defaults to true. Inside a scroll takeover zone it binds to the zone; elsewhere it gracefully falls back to visibility. Set false to force visibility.

```tsx
<Animate
  animateId="subtitle"
  enterAnimation="slide-up"
  exitAnimation="fade-out"
  duration={{ enter: 800, exit: 400 }}
  timeline={{ delay: 160, waitFor: 'title' }}
  visibility={{ replayOnReenter: true }}
>
  <p>Chapter copy</p>
</Animate>
```

The lane adjudication (`timeline.sceneControlled`) decides what drives this element's progress:

- **Scroll takeover lane** — inside a takeover zone with `sceneControlled` untouched: driven by scroll px, `duration.enter` is real scroll distance (`1ms = 1px`), and scrolling backward plays it in reverse.
- **Visibility time lane** — scroll mode outside a zone, or explicit `sceneControlled: false`: driven by real time, with the viewport-margin gate triggering enter/exit.
- **Drag element track / arrival lane** — in drag mode, scene-controlled elements scrub with the scene's element track; `sceneControlled: false` switches to the independent arrival lane (real-time playback, no exit pass).

Manual control (`enterRef`/`exitRef`) only means something on time lanes — on a scrub lane the visual position is a pure function of its single owner, and manual writes are reported and ignored. The full lane × ref support matrix lives in the API reference.

## Common misuse

- **Using CSS `animation: … infinite` for persistent loops** — it escapes phase gating, never stops off-screen, and produces the "everything else has exited but this is still moving" broken window. `infiniteAnimation` is the one sanctioned channel.
- **Choreographing enter without exit** — whatever cascade `waitFor`/`delay` builds for entry needs the mirrored exit choreography, or all exits fire at once (a "packaged rollback") and the timing goes asymmetric.
- **Passing `enterRef` on a scrub lane** — it structurally cannot work; use `sceneControlled: false` (drag) or move the element outside the takeover zone (scroll).
- **Providing neither `enterAnimation` nor `infiniteAnimation`** — reports `INVALID_ANIMATION`; provide at least one.

---

For the complete field reference and the lane support matrix see the [Animate API](/docs/animate-api).
