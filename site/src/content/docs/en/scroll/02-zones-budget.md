---
title: Zones and scroll budgets
eyebrow: SCROLL / BUDGET
---

A locked zone's travel distance comes from the cumulative animation durations of its child elements. The sections on this page define the budget, map timeline phase ranges, and describe zero-budget behavior.

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

Only segments longer than 0.5px (`totalBudgetPx > 0.5`) participate in center-lock boundary clamping. A zero-budget zone produces no locked travel: the wrapper collapses to the visual box height, scroll displacement flows without interruption, `onZoneEnter` and `onZoneLeave` do not trigger, and `onZoneProgress` emits a single initial frame with `progress: 0`.

Only `Animate` nodes with explicit `enterAnimation` or `exitAnimation` declarations register timeline budget. If a Scene contains only `loopAnimation` elements, its total budget evaluates to 0 and the scene renders as a normal flow section.

```tsx
{
  /* Declares a zone without entrance/exit durations; budget is 0, renders as normal section */
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

Connecting to entrance completion ensures that dependency graphs resolve deterministically. When using `phase`, setting `phase.end` to values with headroom (such as `0.95`) allows subsequent chained elements to resolve within finite budget bounds.

## Zone identity

| Source          | Priority | Notes                                                                                    |
| --------------- | -------- | ---------------------------------------------------------------------------------------- |
| `scroll.zoneId` | highest  | explicit declaration                                                                     |
| `sceneId`       | next     | used directly as the zone id when `zoneId` is absent                                     |
| auto id         | fallback | shaped `scene-zone-<instance id>`, per-instance, stable across renders but unpredictable |

When neither is declared, the zone receives an automatic id: it functions correctly, but cannot be targeted via `goToZone` or referenced in `timeline.zoneId`. Programmatic navigation and cross-Scene membership require an authored identity.

Duplicate `zoneId` declarations trigger automatic demotion. The root component evaluates scenes in document order; the first Scene declaring an identifier retains ownership, while subsequent scenes with identical IDs have their `scroll` properties stripped and render as standard flow scenes.

Demotions emit an `INVALID_COMPONENT_HIERARCHY` error via `onError` (`reason: 'duplicate-scroll-zone'`), accompanied by diagnostic console warnings in development.

## Two sets of sizing rules

`sceneSizing` accepts `'content'` (default) or `'screen'`, applying exclusively to standard flow scenes: `'screen'` enforces a one-viewport minimum height, while `'content'` derives height directly from content. Locked-zone scenes behave identically under both settings.

Within locked zones, absolute pixel heights declared on `layout.height` are ignored and fall back to measured DOM dimensions. To define exact locked visual heights, use viewport-relative units (`vh` or `vw`).

Locked-zone visual shells enforce `maxHeight: 100vh` with `overflow: hidden`. Content exceeding viewport bounds is clipped rather than scrolled. Divide long-form content into consecutive scenes, or place it in standard flow scenes.

## Related pages

- [Center-lock scrolling](/docs/01-centerlock): segment geometry and the anti-skip mechanism
- [Timeline](/docs/04-orchestration): the full rules for both `after` forms
- [Animate timeline](/docs/02-timeline): what each `timeline.*` field means
- [Scroll troubleshooting](/docs/06-scroll-pitfalls): the common failures for zero budget and phase
