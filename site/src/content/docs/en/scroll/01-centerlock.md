---
title: center-lock scrolling
eyebrow: SCROLL / CENTER-LOCK
---

A Scene with `scroll` declares a locked zone. With a non-zero animation budget, it stays centered while scrolling advances its animations. Once that range ends, the Scene continues moving with the content. The supported trigger is `center-lock`.

## Positioning mechanism

A locked zone has a wrapper that reserves scroll space, a sticky visual container, and its content. The vertical formulas use `scrollTop`; horizontal scrolling uses the corresponding width and `scrollLeft` values.

| Quantity           | Formula                                                  | Meaning                                     |
| ------------------ | -------------------------------------------------------- | ------------------------------------------- |
| `visualSpan`       | declared `vh`/`vw` span, otherwise measured from the DOM | main-axis size of the visual box            |
| `centerLockOffset` | `max(sceneStart + visualSpan / 2 - viewportSpan / 2, 0)` | the `scrollTop` where sticky starts pinning |
| `segmentStart`     | `centerLockOffset`                                       | start of the locked segment                 |
| `segmentEnd`       | `centerLockOffset + totalBudgetPx`                       | end of the locked segment                   |

Tall scenes (where visual height exceeds viewport height) align through the wrapper's `paddingTop`, while compact scenes align through the visual container's `top` inset. Both configurations resolve to the same `centerLockOffset`.

## Where the scroll distance comes from

The wrapper reserves space for the visible content and the animation travel:

```text
flowSpan = max(visualSpan, viewportSpan) + timelineDistancePx
```

`timelineDistancePx` is the animation budget at `1ms = 1px`. With a zero budget, there is no animation travel, but the wrapper still occupies the larger of the visual span and the viewport span. See [Zones and scroll budgets](/docs/02-zones-budget).

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

## Progress from scroll position

`nativeOffset` is `scrollTop` for vertical scrolling and `scrollLeft` for horizontal scrolling:

```text
progressPx = clamp(nativeOffset - segmentStart, 0, totalBudgetPx)
```

Reverse scrolling decreases progress through the same interval. Resize or layout changes recalculate the segment geometry, and progress follows the resulting position.

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

ref.current?.goToZone('hero-seq', { animated: true });
```

| Option     | Type       | Default | Notes                                                                 |
| ---------- | ---------- | ------- | --------------------------------------------------------------------- |
| `animated` | `boolean`  | `true`  | Requests smooth scrolling when true, immediate positioning when false |
| `align`    | `'center'` | none    | The only accepted value; the destination is always the zone start     |

The destination offset always lands on `centerLockOffset`, corresponding to the zone's start position (progress 0).

Programmatic navigation skips the anti-skip limit so it can reach the requested destination. A new accepted wheel, touch, key, or scrollbar input interrupts the smooth scroll and resumes user control.

## Observing zone states

Three scroll-only callbacks cover the zone lifecycle:

| Callback         | detail                             | Fires when                                                 |
| ---------------- | ---------------------------------- | ---------------------------------------------------------- |
| `onZoneEnter`    | `{ zoneId, sceneIndex }`           | the zone goes from inactive to active                      |
| `onZoneProgress` | `{ zoneId, sceneIndex, progress }` | movement exceeds 0.5px against the **last reported** value |
| `onZoneLeave`    | `{ zoneId, sceneIndex }`           | the zone goes from active to inactive                      |

`progress` is `progressPx / totalBudgetPx`, from 0 to 1. Movement is measured against the last reported value. The zero and full endpoints are reported even when the final change is less than 0.5px.

A zone is active only when the scroll offset and its progress are more than 0.5px from both ends. Zero-budget zones never become active: they report an initial zero progress, without enter or leave events.

The full callback table is in [Callbacks](/docs/03-callbacks).

## Related pages

- [Zones and scroll budget](/docs/02-zones-budget): how the budget is computed and how phase changes the active range
- [The four input paths](/docs/03-inputs): the inputs upstream of the clamp, and how a zone releases
- [Scene-scoped fixed layer](/docs/04-fixed-layer): pinning elements inside a locked zone
- [Scroll troubleshooting](/docs/06-scroll-pitfalls): common scroll-mode failure modes
