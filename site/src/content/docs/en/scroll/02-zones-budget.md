---
title: Zones and scroll budgets
eyebrow: SCROLL / BUDGET
---

The latest child-animation end determines a locked zone's scroll budget. Durations, delays, and dependencies affect that endpoint.

## 1ms = 1px

The conversion rate between animation duration and physical scroll distance is fixed at 1 (1ms = 1px). For example, `duration={{ enter: 2000 }}` requires 2000 physical pixels of scroll displacement to complete an entrance animation.

The total zone budget matches the maximum timeline end offset across all registered elements:

| Quantity        | Rule                                                            |
| --------------- | --------------------------------------------------------------- |
| `enterDuration` | minimum of 1ms/1px. `duration: { enter: 0 }` still occupies 1px |
| `exitDuration`  | defaults to 0 without an `exitAnimation`, occupying no budget   |
| element end     | `delay` (including accumulated `after` chain) + enter + exit    |
| `totalBudgetPx` | the maximum element end, at least 1px when `> 0`                |

Both `duration.enter` and `duration.exit` default to 600ms.

## Zero-budget fallback

A zero budget adds no animation travel. The Scene still occupies the larger of its visual span and one viewport. `onZoneEnter` and `onZoneLeave` do not fire; `onZoneProgress` reports its initial zero value. Only segments longer than 0.5px participate in anti-skip limiting.

Scene-driven elements register budget when they have an entrance or exit animation. A Scene with only loop animations has no animation budget.

```tsx
{
  /* A loop-only zone has no animation travel. */
}
<Scene sceneId="loop" scroll={{ zoneId: 'loop' }}>
  <Animate animateId="pulse" loopAnimation="pulse">
    <div className="dot" />
  </Animate>
</Scene>;
```

To enable scroll locking, configure at least one child element with `enterAnimation` and `duration.enter`.

## timeline.phase mapping rules

`timeline.phase: { start, end }` maps an element's animation progress to a normalized fraction of the total zone budget.

When `phase` is specified, start and end fractions apply relative to the entire zone budget (`[0, totalBudgetPx]`), rather than the element's standalone duration. For example, `phase: { start: 0.5 }` begins the entrance animation when the zone reaches 50% of its cumulative budget.

Elements declaring `phase` align their exit animations to the trailing edge of the zone (`exitEndPx = totalBudgetPx`, `exitStartPx = max(phaseEndPx, totalBudgetPx - exitDurationPx)`). To position an exit animation within the middle of a zone, omit `phase` and use standard `delay` and `duration` sequencing instead.

The computed window end is bounded such that `phaseEndPx` is always at least `phaseStartPx + 1`.

## Connection references for after chains

Within scroll-driven zones, `after` dependencies collapse into cumulative delays at compile time. Sequences connect to the leader element's entrance completion point:

```text
follower.start = leader.phaseEndPx + follower.delay
```

An `after` follower begins at its leader's entrance endpoint. If a leader uses `phase`, leave room for followers by using an end fraction below 1, such as 0.95.

## Zone identity

| Source          | Priority | Notes                                                          |
| --------------- | -------- | -------------------------------------------------------------- |
| `scroll.zoneId` | highest  | explicit declaration                                           |
| `sceneId`       | next     | used directly as the zone id when `zoneId` is absent           |
| auto id         | fallback | Generated for the Scene; declare an explicit id for navigation |

Set `scroll.zoneId` or `sceneId` when using `goToZone` or explicitly binding an Animate to a zone.

If multiple Scenes declare the same zone id, the first keeps it. Later duplicates render as ordinary scenes and report `INVALID_COMPONENT_HIERARCHY` through `onError`; development builds also warn.

## Two sets of sizing rules

`sceneSizing` accepts `'content'` (default) or `'screen'`, applying exclusively to standard flow scenes: `'screen'` enforces a one-viewport minimum height, while `'content'` derives height directly from content. Locked-zone scenes behave identically under both settings.

For a locked zone, viewport units such as `vh` or `vw` provide an explicit visual span. Other declared lengths fall back to the Scene's measured DOM size.

The visual container clips content beyond the viewport. Put long reading content in ordinary scenes or divide it into several scenes.

## Related pages

- [Center-lock scrolling](/docs/01-centerlock): segment geometry and the anti-skip mechanism
- [Timeline](/docs/04-orchestration): the full rules for both `after` forms
- [Animate timeline](/docs/02-timeline): what each `timeline.*` field means
- [Scroll troubleshooting](/docs/06-scroll-pitfalls): the common failures for zero budget and phase
