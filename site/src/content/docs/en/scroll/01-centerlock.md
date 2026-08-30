---
title: center-lock scroll takeover
eyebrow: SCROLL / CENTER-LOCK
---

Give a `Scene` a `scroll={{ zoneId, trigger: 'center-lock' }}` and it becomes a locked zone: when scrolling reaches it, the visual box pins to the viewport center, every further pixel of scroll becomes zone animation progress, and only once the budget runs out does the page move on. `center-lock` is the only trigger.

## center-lock is sticky centering

There is no simulated scrolling here. A locked-zone scene renders as three layers: an outer wrapper that joins the document flow and supplies the height, a middle `position: sticky` visual shell, and the content inside it. The shell's pin point is computed, and it is exactly the `scrollTop` at which the visual box's center meets the viewport center.

| Quantity           | Formula                                                  | Meaning                                     |
| ------------------ | -------------------------------------------------------- | ------------------------------------------- |
| `visualSpan`       | declared `vh`/`vw` span, otherwise measured from the DOM | main-axis size of the visual box            |
| `centerLockOffset` | `max(sceneStart + visualSpan / 2 - viewportSpan / 2, 0)` | the `scrollTop` where sticky starts pinning |
| `segmentStart`     | `centerLockOffset`                                       | start of the locked segment                 |
| `segmentEnd`       | `centerLockOffset + totalBudgetPx`                       | end of the locked segment                   |

An over-viewport scene (visual box taller than the viewport) is pushed to that point by the wrapper's `paddingTop`; an under-viewport scene uses the shell's own `top` inset. Both cases resolve to the same `centerLockOffset`. The segment in JS only **describes** that sticky travel, it does not drive it: stop all scripts and the shell still pins.

## Where the scroll distance comes from

The wrapper is not as tall as the visuals:

```text
flowSpan = max(visualSpan, viewportSpan) + timelineDistancePx
```

`timelineDistancePx` is the zone's animation budget (1ms = 1px; see [Zones and scroll budget](/docs/02-zones-budget)). The wrapper stands a full budget taller than it looks, and that extra height is the real scroll distance the audience consumes while the picture appears frozen. With a zero budget the wrapper collapses back to the visual height and the locked travel disappears with it.

```tsx
<CineView designWidth={750} mode="scroll" direction="y">
  <Scene sceneId="hero-seq" scroll={{ zoneId: 'hero-seq', trigger: 'center-lock' }}>
    <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 800 }}>
      <h1>Enters with scroll inside the locked segment</h1>
    </Animate>
  </Scene>
</CineView>
```

That JSX has an 800px zone budget: the audience scrolls 800 real pixels before the title travels from 0 to 1.

## Progress is a pure function

Zone progress has no accumulator and no ownership memory:

```text
progressPx = clamp(nativeOffset - segmentStart, 0, totalBudgetPx)
```

One `clamp` is the whole model, with two direct consequences. Scrolling back into the segment decreases `nativeOffset` from `segmentEnd`, so progress naturally runs `100% → 0%` and the animation sits on the matching frame, with no reverse special case and nothing to configure. Refresh, navigation, and resize cannot leave the state out of sync either: progress is always decided by the current `scrollTop` alone.

Both ends of the segment snap within 0.01px: progress near an endpoint reads exactly 0 or the full budget, so floating-point residue cannot leave the last frame permanently short.

## Anti-skip

A big flick or a held key produces a scroll delta far larger than a segment. Before writing `scrollTop`, the engine runs an intent clamp whose rules mirror per direction:

| Situation                                               | Landing offset                      |
| ------------------------------------------------------- | ----------------------------------- |
| Forward, jumping across the whole segment from outside  | `min(segmentStart + 1, segmentEnd)` |
| Forward, already inside, target past the segment end    | clamped exactly to `segmentEnd`     |
| Backward, jumping across the whole segment from outside | `max(segmentEnd - 1, segmentStart)` |
| Backward, already inside, target past the segment start | clamped exactly to `segmentStart`   |

The first row is the most consequential rule in the clamp: **however big the flick, it is compressed into one pixel inside the segment**, so the audience always sees the locked segment's first frame instead of teleporting past it. Ordinary scrolling outside a segment is untouched.

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

The landing offset is always `centerLockOffset`, which is that zone's **progress 0**, not the zone's midpoint. The `align: 'center'` row is where the public type and the implementation disagree, so do not plan navigation around its literal meaning.

While a smooth scroll is in flight the engine skips the anti-skip clamp: that clamp's corrective `scrollTo` stops a smooth animation per the CSSOM spec, leaving the scroll part-way to its target. Programmatic frames are continuous by construction, so every crossed segment already produces in-segment frames and needs no clamping. Any real user input (wheel, touch, key, scrollbar drag) reclaims control immediately and voids the in-flight target.

## Observing zones

Three scroll-only callbacks cover the zone lifecycle:

| Callback         | detail                             | Fires when                                                 |
| ---------------- | ---------------------------------- | ---------------------------------------------------------- |
| `onZoneEnter`    | `{ zoneId, sceneIndex }`           | the zone goes from inactive to active                      |
| `onZoneProgress` | `{ zoneId, sceneIndex, progress }` | movement exceeds 0.5px against the **last reported** value |
| `onZoneLeave`    | `{ zoneId, sceneIndex }`           | the zone goes from active to inactive                      |

`progress` is normalized 0 to 1 (`progressPx / totalBudgetPx`). The 0.5px threshold compares against the last reported value rather than the previous frame; otherwise slow scrolling resets the baseline every frame and starves the callback forever. The 0 and full endpoints are forced through even when the final frame moved less than 0.5px.

The active test is stricter than "progress is non-zero": `nativeOffset` must sit strictly more than 0.5px inside the segment, and progress must also be more than 0.5px away from both ends. A zero-budget zone is never active, so none of these three ever fire; see [Zones and scroll budget](/docs/02-zones-budget).

The full callback table is in [Callbacks](/docs/03-callbacks).

## Related pages

- [Zones and scroll budget](/docs/02-zones-budget): how the budget is computed and how phase rewrites windows
- [The four input paths](/docs/03-inputs): the inputs upstream of the clamp, and how a zone releases
- [Scene-scoped fixed layer](/docs/04-fixed-layer): pinning elements inside a locked zone
- [Scroll troubleshooting](/docs/06-scroll-pitfalls): the common failures this page's mechanics produce
