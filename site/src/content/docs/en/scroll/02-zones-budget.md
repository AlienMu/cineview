---
title: Zones and scroll budget
eyebrow: SCROLL / BUDGET
---

A zone's locked travel adds up from the animation durations of its children, and no prop sets it directly. This page covers how that arithmetic works, along with the authoring choices that zero it out or rewrite it entirely.

## 1ms = 1px

A locked zone's time-to-distance rate is hard-wired to 1, so the px fields and the ms fields are numerically the same number. `duration={{ enter: 2000 }}` means the audience scrolls 2000 real pixels to finish that element's entry.

The zone total takes the largest timeline end across all registered elements, times the rate:

| Quantity        | Rule                                                                        |
| --------------- | --------------------------------------------------------------------------- |
| `enterDuration` | forced to a minimum of 1ms/1px. `duration: { enter: 0 }` still occupies 1px |
| `exitDuration`  | counted as 0 without an `exitAnimation`, occupying no budget                |
| element end     | `delay` (including accumulated `after` chain) + enter + exit                |
| `totalBudgetPx` | the maximum element end, at least 1px when `> 0`                            |

Both `duration.enter` and `duration.exit` default to 600.

## Zero budget means zero locking

Only segments longer than 0.5px enter the center-lock clamp, and the segment length _is_ `totalBudgetPx`. A zero-budget zone therefore takes no part in locking at all: the wrapper collapses to the visual height, scrolling passes straight through, and `onZoneEnter` / `onZoneLeave` **never fire**. `onZoneProgress` fires exactly once on the first frame with `progress: 0`, then stays silent.

The usual cause is not writing a zero duration, it is that no element registered a budget: only an `Animate` with an authored `enterAnimation` or `exitAnimation` registers. A locked-zone scene whose children are all `loopAnimation` therefore degrades silently into a plain section, and the author believes a zone was declared when nothing locks.

```tsx
{
  /* declares a zone, but the budget is 0, so it behaves as a plain section */
}
<Scene sceneId="loop" scroll={{ zoneId: 'loop' }}>
  <Animate animateId="pulse" loopAnimation="pulse">
    <div className="dot" />
  </Animate>
</Scene>;
```

To actually lock, give at least one element an `enterAnimation` plus `duration.enter`.

## phase rewrites the window

`timeline.phase: { start, end }` pins an element's scrub range to a slice of the zone's progress. It has two consequences authors routinely misread.

**Once declared, the fractions are zone-relative, not element-relative.** Without `phase` the window is the element's own `[enterStartPx, enterEndPx]`; with `phase` the window becomes `[0, totalBudgetPx]`, so `phase: { start: 0.5 }` means "halfway through the whole zone budget," not "halfway through the element's own entry."

**An element that declares `phase` has its authored exit moved to the end of the zone.** The assembly computes `exitEndPx = totalBudgetPx` and `exitStartPx = max(phaseEndPx, totalBudgetPx - exitDurationPx)`. The exit therefore always closes out the whole zone, and `duration.exit` only means "the tail window is at least 1px wide"; it no longer expresses the exit span. To exit mid-zone, do not give that element a `phase`.

The window end has one more floor: `phaseEndPx` is at least `phaseStartPx + 1`, so zero-width windows do not exist.

## Where a after chain anchors

Inside a zone, `after` is folded into an accumulated delay at compile time (the scroll-driven rules; see [Timeline](/docs/04-orchestration)). The anchor is the leader's enter-window close, not its exit:

```text
follower.start = leader.phaseEndPx + follower.delay
```

Anchoring on enter rather than exit keeps the total computable. A leader with `phase` has its exit pinned to the zone end, and the zone end is itself decided by every element's end. Anchoring there means "zone total" has to solve for itself, which has no answer. Anchored at the enter close, the chain stays bounded: the follower starts before the leader's zone-end exit, the two overlap visually, and the budget stays finite.

The window end feeds the zone total, and the total decides the window end, so a zone with `phase` is solved by iterating until the value settles. With `phase.end < 1` the iteration settles; `phase.end: 1` leaves it with no stable answer, and followers pile up past the zone end, stopped only by the iteration cap. For a long window write something with headroom, such as `phase.end: 0.95`, rather than a flat 1.

## Zone identity

| Source          | Priority | Notes                                                                                    |
| --------------- | -------- | ---------------------------------------------------------------------------------------- |
| `scroll.zoneId` | highest  | explicit declaration                                                                     |
| `sceneId`       | next     | used directly as the zone id when `zoneId` is absent                                     |
| auto id         | fallback | shaped `scene-zone-<instance id>`, per-instance, stable across renders but unpredictable |

With neither declared you land on the auto id: the zone works, but you cannot target it with `goToZone` and cannot reference it from `timeline.zoneId`. Programmatic navigation and cross-Scene membership both require an authored identity.

A duplicate zoneId demotes the later declaration. The root preflights children in document order, and the first Scene declaring an id owns it. Any later Scene with the same id is `cloneElement`-stripped of its `scroll` prop and rendered as a plain flow scene.

That rejection reports `INVALID_COMPONENT_HIERARCHY` through `onError` (`reason: 'duplicate-scroll-zone'`, with the owner's and the rejected scene's indices in context), plus a dev console message. Visually it reads as one zone no longer locking; the `onError` payload names it.

## Two sets of sizing rules

`sceneSizing` takes `'content'` (default) or `'screen'`, and it applies only to scenes without a locked zone: `'screen'` gives them a one-viewport minimum span, `'content'` lets the content size them. Locked-zone scenes behave identically under both values.

Locked-zone span resolution has one more strict rule: **absolute px sizes are discarded**. With a single conversion base there is no separate height base, so `layout.height: 800` and `layout.height: '800px'` are both left unconverted and fall back to the measured DOM span. Only `vh` / `vw` survive (floored at 1px). To control a locked zone's visual box precisely, use viewport-relative units.

One more: **a locked-zone scene is clipped by the viewport, not scrollable**. The visual shell carries `maxHeight: 100vh` plus `overflow: hidden`, and the content layer applies a compensating `translateY` to recenter. Content taller than one screen is cut off at both ends around the vertical center, and no inner scrollbar appears. Long content in a locked zone has to be split into segments, or moved to a plain flow scene.

## Related pages

- [center-lock scroll takeover](/docs/01-centerlock): segment geometry and the anti-skip clamp
- [Timeline](/docs/04-orchestration): the full rules for both `after` forms
- [Animate timeline](/docs/02-timeline): what each `timeline.*` field means
- [Scroll troubleshooting](/docs/06-scroll-pitfalls): the common failures for zero budget and phase
