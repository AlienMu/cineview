---
title: waitFor chains & stagger
eyebrow: SEQUENCING
---

Two complementary sequencing tools: `waitFor` orders elements against each other (B does not start until A has entered); `stagger` reveals a group of children one by one. Both compile to delays before any frame is drawn.

## How waitFor accumulates

The registry (`src/animations/registry.ts`) resolves each registered element into a `calculatedDelay`:

```text
calculatedDelay(B) = B.delay + calculatedDelay(A) + A.enterDuration
```

where `A` is `B.waitFor`. A chain compiles into disjoint windows on the timeline — no element watches another at runtime:

```tsx
<Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 600 }}>
  <h1>Title</h1>
</Animate>

<Animate
  animateId="subline"
  enterAnimation="slide-up"
  duration={{ enter: 600 }}
  timeline={{ waitFor: 'title', delay: 0 }}
>
  <p>Subline waits for the title to finish</p>
</Animate>

<Animate
  animateId="video"
  enterAnimation="fade-in"
  duration={{ enter: 6000 }}
  timeline={{ waitFor: 'subline', delay: 0 }}
>
  <div className="video-stage" />
</Animate>
```

| Element | delay | leader duration | calculatedDelay | own window |
| --- | --- | --- | --- | --- |
| title | 0 | — | 0 | 0 – 600 |
| subline | 0 | 600 | 600 | 600 – 1200 |
| video | 0 | 600 | 1200 | 1200 – 7200 |

The scene's timeline duration is the max of `calculatedDelay + duration` over all elements. Under scroll takeover every millisecond is a real scroll pixel (`1ms = 1px`), so the table above literally reads in px. In drag mode the same `calculatedDelay` gates the scene's element track: the element's enter plays within `[calculatedDelay, calculatedDelay + enterDuration]` of scene elapsed.

Give exits the mirrored choreography — a chain that enters title → subline → video should exit video → subline → title, or the reverse pass collapses into a simultaneous rollback.

## Where the chain runs

The accumulation arithmetic is shared; each mode consumes it through its own clock:

- **Scroll takeover**: the chain's millisecond numbers become px windows inside the zone — the follower's `startMs` is its `startPx` (`1ms = 1px`), so scrolling the zone literally walks the cascade.
- **Drag**: the same `calculatedDelay` gates the scene's element track — each follower's enter occupies `[calculatedDelay, calculatedDelay + enterDuration]` of scene elapsed, and the finger scrubs through it.
- **Visibility** (scroll mode outside zones): the chain plays in real time — `delay` is simply elapsed waiting time before the enter starts.

One edge is special: a **visibility follower waiting on a scroll-zone leader** compiles without delay accumulation and instead waits at runtime for the leader's actual completion event — a scroll leader has a real completion to publish. The reverse directions are rejected outright:

| Follower ↓ waits on → leader | drag | scroll | visibility |
| --- | --- | --- | --- |
| drag | allowed | rejected | rejected |
| scroll | rejected | allowed | rejected |
| visibility | rejected | allowed (runtime-completion-only) | allowed |

Also outside the registry: the drag arrival lane (`sceneControlled: false`) skips registry participation entirely — an arrival element is not a valid `waitFor` target, and its own `waitFor` is ignored.

## Validation and reporting

The registry compiles the whole graph and reports issues instead of guessing:

| Issue | Public code | Behavior |
| --- | --- | --- |
| `waitFor` target not registered | `INVALID_ANIMATION` | Reported; the follower falls back to its own `delay` only. |
| Cycle in the chain | `CIRCULAR_DEPENDENCY` | Reported; every cycle member falls back to its own `delay` — no accumulation through the cycle. |
| Duplicate `animateId` | `INVALID_COMPONENT_HIERARCHY` | Reported; the registry refuses ambiguous references. |
| Cross-driver edge | `INVALID_ANIMATION` | Rejected (see below). |

One cross-driver edge is deliberately allowed: a **visibility follower may wait on a scroll-zone leader**. In that direction the follower's delay does *not* accumulate the leader's window — it waits at runtime for the leader's actual completion (runtime-completion-only). The reverse — a scroll-driven follower waiting on a visibility leader — is rejected: a scroll element's window must be a pure function of scroll position, and a visibility leader has no scroll-addressable end.

## Stagger: grouping inside one Animate

`stagger` reveals the direct children of a single child element one by one, driven by the `enterAnimation` variant:

```tsx
<Animate
  animateId="lines"
  enterAnimation="slide-up"
  duration={{ enter: 800 }}
  stagger={{ each: 120, from: 'first' }}
>
  <ul>
    <li>First to reveal</li>
    <li>Second</li>
    <li>Third</li>
  </ul>
</Animate>
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `stagger.each` | `number` | `40` | Interval between each child (ms). |
| `stagger.from` | `'first' \| 'last' \| 'center'` | `'first'` | Reveal origin: first-to-last, last-to-first, or middle outward. |

Rules that matter in practice:

- `children` must be a single React element (type-enforced when `stagger` is set); each **direct** child of it is one stagger item.
- The reveal runs through Framer's native variant propagation, so items may animate **any** Framer-animatable property (`clipPath`, `width`, …) — the enter/exit ten-property whitelist does not apply here.
- It is time-driven and never scrubs: the group plays when its lane says "enter" and resets on re-enter per `visibility.replayOnReenter`. For per-element scrub, use the render-prop `enterProgress` instead.
- The completion clock is `max(authored duration, tail + item duration)` where `tail = lastOrder × each`. That effective duration is what the element registers — so a `waitFor` follower of a staggered group waits for the whole reveal, not the authored `duration.enter` alone.

## Stagger timing by the numbers

Five items, `each: 120`, variant item duration 600 ms (the variant's own `transition.duration` when declared, otherwise the authored `duration.enter`):

| `from` | last order | tail (`lastOrder × each`) | effective duration |
| --- | --- | --- | --- |
| `'first'` | 4 | 480 ms | `max(600, 480 + 600)` = **1080 ms** |
| `'last'` | 4 | 480 ms | **1080 ms** (reverse order, same total) |
| `'center'` | 2 | 240 ms | `max(600, 240 + 600)` = **840 ms** |

Two consequences:

- `from: 'center'` finishes measurably sooner — the reveal fans outward from the middle, so the farthest item is only half a list away.
- The **effective** duration is what the element registers with the timeline — a `waitFor` follower of this group waits the full 1080 ms, not the authored 600. Budget your chain arithmetic against the stagger, not the variant.

The exit pass staggers with the same `each`/`from`, animating each item toward the `exitAnimation` exit record — or back toward the `initial` record when no `exitAnimation` is authored. Enter and exit use the same rhythm, so the group unwinds the way it assembled.

Internally this is `StaggerContainer` (`src/components/Animate/StaggerContainer.tsx`), with one thin subscriber per mode (scroll reads the signed visual signal, drag reads the visual state, the drag arrival lane reads its phase). It is not a public export — `Animate`'s `stagger` prop is the public surface.

## Authoring checklist

Before calling a cascade done:

1. Every `waitFor` target exists in the same registry scope (same scene for drag, same zone for scroll takeover) — otherwise it reports `INVALID_ANIMATION` and the follower starts on its bare `delay`.
2. No `animateId` is duplicated anywhere in the tree — duplicates report `INVALID_COMPONENT_HIERARCHY`.
3. The chain has no cycle — every member of a cycle reports `CIRCULAR_DEPENDENCY` and falls back to its own delay.
4. No chain leader carries `timeline.phase` (see the constraint below).
5. Exits mirror the enter chain in reverse, or the reverse pass rolls back as one blob.
6. If a leader is a stagger group, chain arithmetic uses its effective duration, not the authored one.

## Current constraint: chain leaders must not carry a phase window

Inside a scroll takeover zone, do **not** combine `timeline.phase` on a chain leader with `waitFor` followers.

`sceneScrollBudget` keeps two clocks. The ms clock (`resolveTiming`) resolves the waitFor chain: the follower's start derives from the leader's `totalEndMs`. The px clock applies authored phase corrections — a phase-windowed element's effective end becomes `phaseEndPx`. The phase correction is applied **only to the px clock**; the ms-level chain never consumes the leader's `phaseEnd`. The follower's start px, derived from the uncorrected ms clock, therefore lands early.

This was measured, not theorized (task-flow `2026-08-23-stage3-demo-hub-docs.md`, T1.8): with a phase-windowed title leading a chain, the subline started while the title was at 14% progress. The demo was fixed by removing the phase window and authoring a pure three-level waitFor chain.

Until the framework closes the gap (either the budget consumes the leader's `phaseEnd` for the chain, or the constraint moves into the types — currently recorded as a pending decision), author by these rules:

- Author chains as pure `waitFor` + `delay` cascades; let the chain arithmetic place the windows.
- Keep phase-windowed elements out of chains — an element with `timeline.phase` may exist in the same zone, but nothing should `waitFor` it.
