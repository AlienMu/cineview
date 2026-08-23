---
title: Animate
eyebrow: API REFERENCE
---

`<Animate>` consumes the current mode's timeline semantics, composing delay, waitFor, phase, visibility, and stagger. This page is the complete field reference; timeline semantics and tutorials live in the [Animate guide](/docs/animate).

## Props

Every field and default below is checked against `AnimateProps` in `src/types/index.ts` (a discriminated union: an `enterAnimation`-required branch, or an `infiniteAnimation`-only branch) and the Animate implementation. Provide at least one of `enterAnimation` / `infiniteAnimation` — neither reports `INVALID_ANIMATION`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `animateId` | `string` | `auto` | Unique element identifier (auto-generated `animate-{n}` when omitted); the reference target of `waitFor`. |
| `enterAnimation` | `AnimationType` | — | Enter animation (preset name / custom variant / composed). Provide at least one of this and `infiniteAnimation`; the infinite-only branch forbids passing enter. |
| `infiniteAnimation` | `AnimationType` | — | The one sanctioned channel for persistent looping motion (site code must not use CSS `animation: … infinite`). Runs only while the element is in its own phase and inside the viewport; stops automatically off-screen or on exit. Provide at least one of this and `enterAnimation`. |
| `exitAnimation` | `AnimationType` | — | Exit animation; must coexist with `enterAnimation` or `infiniteAnimation`. Ignored on the drag `sceneControlled: false` lane (see the lane matrix). |
| `duration.enter` | `number` | `600` | Enter duration (ms). Under scroll takeover this is real scroll px (`1ms = 1px`). |
| `duration.exit` | `number` | `600` | Exit duration (ms). |
| `timeline.sceneControlled` | `boolean` | `true` | Whether the scene may take over this element's timeline. When `true`: inside a scroll takeover zone it is driven by that zone's scroll budget; in scroll mode but outside a zone it gracefully falls back to the visibility gate; in drag mode it is driven by the Scene's shared element track. When `false`: scroll forces the visibility gate; drag switches to an independent arrival lane (plays in real time, skips the registry/waitFor/T_self, and ignores `exitAnimation`). |
| `timeline.delay` | `number` | `0` | Enter delay (ms; real scroll px under scroll takeover). |
| `timeline.waitFor` | `string` | — | Wait for another `animateId` to finish entering before this element's enter starts, forming a cascade. An unknown target reports `INVALID_ANIMATION`; a cycle reports `CIRCULAR_DEPENDENCY`. Ignored in drag mode when `sceneControlled` is `false`. |
| `timeline.zoneId` | `string` | — | Explicitly overrides the inherited zone binding (in scroll mode this decides takeover vs. the visibility lane). |
| `timeline.phase.start` | `number` | — | Start of this element's enter sub-window inside a scroll takeover zone (`0..1`, a fraction of the whole zone budget). Defaults to the window derived from `delay`/`waitFor`. |
| `timeline.phase.end` | `number` | — | End of the same sub-window. |
| `visibility.replayOnReenter` | `boolean` | `true` | Whether re-entering the viewport replays the enter animation. |
| `visibility.enterMargin` | `number` | `inherit` | Viewport edge margin gating enter (design px); inherits `modes.scroll.enterMargin` (default `50`). |
| `visibility.exitMargin` | `number` | `inherit` | Viewport edge margin gating exit (design px); inherits `modes.scroll.exitMargin` (default `50`). |
| `stagger` | `AnimateStaggerConfig` | — | Staggered reveal of children. Requires `children` to be a single React element: each direct child is revealed one by one with the `enterAnimation` variant via framer's native `staggerChildren` (bypassing the enter/exit 10-property whitelist, so any framer-animatable property works). Time-driven, never scrubs with scroll/drag; for per-element scrub use the render-prop instead. |
| `stagger.each` | `number` | `40` | Interval between each child (ms). |
| `stagger.from` | `'first' \| 'last' \| 'center'` | `'first'` | Stagger origin. |
| `enterRef` | `React.MutableRefObject<(() => void) \| null>` | — | Manual enter trigger — see the lane support matrix below. Coexisting with `waitFor`/`delay`, the framework still fires the fallback once the wait elapses; with neither authored, the element never enters automatically and must be triggered manually. |
| `exitRef` | `React.MutableRefObject<(() => void) \| null>` | — | Manual exit trigger. Passing it disables the automatic exit (leaving the scroll zone / switching scenes in drag no longer exits); no `delay` fallback exists (there is no "auto-exit after timeout" semantics). |
| `children` | `ReactNode \| ((state: AnimateRenderState) => ReactNode)` | `required` | Content; the render-prop form receives `{ enterProgress, phase }`, with progress natively following the active timeline source. |

## Manual control and lane support

`enterRef`/`exitRef` only mean something on a time-driven lane. On a scrub lane the visual position is a pure function of its single owner (the zone's progressPx, or the finger during a drag) — anything a manual call wrote would be recomputed away on the next frame, so the framework reports `INVALID_ANIMATION` and ignores the ref instead of silently pretending it works.

| Lane | enterRef | exitRef | Behaviour |
| --- | --- | --- | --- |
| Visibility time lane (scroll mode, not taken over) | Supported | Supported | Manual triggers play enter/exit immediately. Coexisting with `waitFor`/`delay`, the wait still fires as a fallback; with neither authored, the element never enters automatically. Passing exitRef disables the automatic exit. |
| Arrival time lane (drag mode + `sceneControlled: false`) | Supported | Ignored | This lane has no exit pass (it also ignores `exitAnimation` and `waitFor`); a passed exitRef is reported as ignored. |
| Scrub lanes (scroll takeover zone; drag scene-controlled element track) | Ignored | Ignored | Reports `INVALID_ANIMATION`. For manual control use `timeline.sceneControlled: false` (drag) or move the element outside the takeover zone (scroll). |

## Types

### AnimateRenderState

The state object the render-prop form of `children` receives:

| Field | Type | Description |
| --- | --- | --- |
| `enterProgress` | `number` | `0..1` — 0 is the initial frame, 1 fully entered. Natively follows the active timeline source: time-driven under the visibility gate, scrubbed by scroll / drag otherwise. |
| `phase` | `AnimatePhase` | The six-state phase (see below). |

### AnimatePhase

The `'idle' | 'waiting' | 'entering' | 'entered' | 'exiting' | 'exited'` six-state vocabulary; per-state semantics and the atomic snapshot are documented in the [useAnimateTimeline API](/docs/use-animate-timeline-api).

### AnimateStaggerConfig

The two fields of `stagger`: `each` (default `40`, interval between each direct child in ms) and `from` (default `'first'`, one of `'first' | 'last' | 'center'`).

### Shared types

- `AnimationType` = preset name (43 of them) / custom variant / composed animation → [type dictionary](/docs/types); the preset catalogue → [animation presets](/docs/presets), composition → [custom & composed](/docs/custom)
- The semantics guide for `waitFor` cascades and stagger → [waitFor & stagger](/docs/waitfor-stagger)

## Constraint notes

- **The four sources of `INVALID_ANIMATION`**: `waitFor` pointing at a nonexistent `animateId`; neither `enterAnimation` nor `infiniteAnimation` provided; an unknown preset name; or an `enterRef`/`exitRef` passed on a scrub lane (reported and ignored).
- **The adjudication path of `sceneControlled`**: default `true`. In scroll mode — inside a takeover zone, driven by the zone's scroll budget; outside, graceful visibility fallback; explicit `false` is the only way to force visibility. In drag mode `false` switches to the arrival lane — real-time playback, no registry/waitFor participation, `exitAnimation` ignored; that is the standard move on the drag side when manual control (`enterRef`) is needed.
- **`stagger` or the render-prop — pick one.** `stagger` is a time-driven child reveal (it never scrubs) and requires `children` to be a single React element; for per-element scrub use the render-prop form (`children` as a function, receiving `enterProgress`).
- **The infinite-only branch**: with only `infiniteAnimation` authored, passing `enterAnimation` is forbidden — a persistent looping element has no enter semantics; `exitAnimation` may coexist (the exit stays phase-gated).

