---
title: center-lock scrolling
eyebrow: SCROLL / CENTER-LOCK
---

Configuring a Scene with `scroll={{ zoneId, trigger: 'center-lock' }}` declares a locked zone. When scrolling reaches the target position, the visual container locks to the viewport center, subsequent scroll displacement advances zone animation progress, and the page resumes standard document flow scrolling once the budget is exhausted. `center-lock` is the sole supported trigger.

## Positioning mechanism

Locked-zone scenes render in three layers: an outer wrapper that occupies document flow and provides scroll height, a middle `position: sticky` visual shell, and the inner content container. The visual shell locks into place when `scrollTop` aligns the visual box center with the viewport center.

| Quantity           | Formula                                                  | Meaning                                     |
| ------------------ | -------------------------------------------------------- | ------------------------------------------- |
| `visualSpan`       | declared `vh`/`vw` span, otherwise measured from the DOM | main-axis size of the visual box            |
| `centerLockOffset` | `max(sceneStart + visualSpan / 2 - viewportSpan / 2, 0)` | the `scrollTop` where sticky starts pinning |
| `segmentStart`     | `centerLockOffset`                                       | start of the locked segment                 |
| `segmentEnd`       | `centerLockOffset + totalBudgetPx`                       | end of the locked segment                   |

Tall scenes (where visual height exceeds viewport height) align through the wrapper's `paddingTop`, while compact scenes align through the visual shell's `top` inset. Both configurations resolve to the same `centerLockOffset`.

## Where the scroll distance comes from

The wrapper is not as tall as the visuals:

```text
flowSpan = max(visualSpan, viewportSpan) + timelineDistancePx
```

`timelineDistancePx` is the zone's animation budget (1ms = 1px; see [Zones and scroll budget](/docs/02-zones-budget)). The wrapper stands a full budget taller than its visual height, and that additional height is the physical scroll distance consumed while the scene remains pinned in place. With a zero budget the wrapper collapses back to the visual height and the locked travel disappears.

```tsx
<CineView designWidth={750} mode="scroll" direction="y">
  <Scene sceneId="hero-seq" scroll={{ zoneId: 'hero-seq', trigger: 'center-lock' }}>
    <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 800 }}>
      <h1>Enters with scroll inside the locked segment</h1>
    </Animate>
  </Scene>
</CineView>
```

That JSX has an 800px zone budget: scrolling 800 physical pixels advances the title entrance from 0 to 1.

## Progress is a pure function

Zone progress has no accumulator and no ownership memory:

```text
progressPx = clamp(nativeOffset - segmentStart, 0, totalBudgetPx)
```

Scrolling backward into the segment decreases `nativeOffset` from `segmentEnd`, running progress from `100%` to `0%` and synchronizing the animation frame linearly. Across page reloads, container resizes, or layout shifts, progress is derived strictly from the current `scrollTop`.

Both ends of the segment snap within 0.01px: progress near an endpoint reads exactly 0 or the full budget, so floating-point residue cannot leave the last frame permanently short.

## Anti-skip boundary clamping

Rapid flick gestures or sustained key presses can generate scroll deltas that exceed segment boundaries. Before committing `scrollTop`, the engine applies boundary clamping symmetrically across directions:

| Situation                                               | Landing offset                      |
| ------------------------------------------------------- | ----------------------------------- |
| Forward, jumping across the whole segment from outside  | `min(segmentStart + 1, segmentEnd)` |
| Forward, already inside, target past the segment end    | clamped exactly to `segmentEnd`     |
| Backward, jumping across the whole segment from outside | `max(segmentEnd - 1, segmentStart)` |
| Backward, already inside, target past the segment start | clamped exactly to `segmentStart`   |

When a single gesture attempts to leap past an entire locked segment forward, the target offset is constrained to `segmentStart + 1`, guaranteeing that the initial locked frame renders rather than jumping past the sequence. Normal scrolling outside locked segments remains unaffected.

Only segments longer than 0.5px take part in the clamp. Programmatic scrolls (`goToScene` / `goToZone`) deliberately skip it; the "Programmatic navigation" section covers that path.

## Programmatic navigation

`goToZone` is the scroll-only ref method:

```tsx
const ref = useRef<CineViewScrollRef>(null);

<CineView mode="scroll" ref={ref}>
  {/* ... */}
</CineView>;

ref.current!.goToZone('hero-seq', { animated: true });
```

| Option     | Type       | Default | Notes                                                       |
| ---------- | ---------- | ------- | ----------------------------------------------------------- |
| `animated` | `boolean`  | `true`  | `true` uses `behavior: 'smooth'`, `false` lands instantly   |
| `align`    | `'center'` | none    | present in the public type, discarded by the implementation |

The destination offset always lands on `centerLockOffset`, corresponding to the zone's start position (progress 0).

While a smooth scroll is in flight the engine skips the anti-skip clamp: that clamp's corrective `scrollTo` stops a smooth animation per the CSSOM spec, leaving the scroll part-way to its target. Programmatic frames are continuous by construction, so every crossed segment already produces in-segment frames and needs no clamping. Any real user input (wheel, touch, key, scrollbar drag) reclaims control immediately and voids the in-flight target.

## Observing zone states

Three scroll-only callbacks cover the zone lifecycle:

| Callback         | detail                             | Fires when                                                 |
| ---------------- | ---------------------------------- | ---------------------------------------------------------- |
| `onZoneEnter`    | `{ zoneId, sceneIndex }`           | the zone goes from inactive to active                      |
| `onZoneProgress` | `{ zoneId, sceneIndex, progress }` | movement exceeds 0.5px against the **last reported** value |
| `onZoneLeave`    | `{ zoneId, sceneIndex }`           | the zone goes from active to inactive                      |

`progress` is normalized 0 to 1 (`progressPx / totalBudgetPx`). The 0.5px threshold compares against the last reported value rather than the previous frame; otherwise slow scrolling resets the baseline every frame and starves the callback forever. The 0 and full endpoints are forced through even when the final frame moved less than 0.5px.

A zone is considered active when `nativeOffset` rests at least 0.5px inside the segment bounds and progress is at least 0.5px away from both extremities. Zero-budget zones never enter the active state; see [Zones and scroll budget](/docs/02-zones-budget).

The full callback table is in [Callbacks](/docs/03-callbacks).

## Related pages

- [Zones and scroll budget](/docs/02-zones-budget): how the budget is computed and how phase changes the active range
- [The four input paths](/docs/03-inputs): the inputs upstream of the clamp, and how a zone releases
- [Scene-scoped fixed layer](/docs/04-fixed-layer): pinning elements inside a locked zone
- [Scroll troubleshooting](/docs/06-scroll-pitfalls): common scroll-mode failure modes
