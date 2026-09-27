# Arrange an animation timeline

Applies to `cineview@1.0.1`. Each Scene owns its element timeline. Read [quick start](./quickstart.md) for a runnable example and [modes](./modes.md) for how user input advances time.

## Calculate entrances

For drag scene timelines and scene-driven scroll zones, with no `timeline.phase`:

- An independent element starts at its `timeline.delay`, or zero when omitted.
- A follower starts at its predecessor's entrance end plus the follower's delay.
- Entrance end is start plus `duration.enter`.

For the quick-start example:

| Element     | Entrance duration | Dependency | Own delay | Entrance interval |
| ----------- | ----------------- | ---------- | --------- | ----------------- |
| Title       | 600ms             | None       | 0ms       | 0–600ms           |
| Explanation | 400ms             | Title      | 100ms     | 700–1100ms        |

The quick-start Scene's entrance duration is the latest entrance end: 1100ms here. Concurrent animations overlap, so their durations are not simply added. Drag element entrance timelines exclude exit durations. In scroll zones, authored exits can extend the total scroll duration; include those exits when calculating zone distance.

## Use after precisely

Reference an `animateId` in the same Scene. Give dependency targets unique ids and declare both elements in the render. JSX order does not establish playback order. Dependencies must not form cycles.

`after` means entrance completion. If A has a 600ms entrance and a 400ms exit, B with `after: 'A'` and no delay starts at 600ms. It does not wait until 1000ms. Changing A's entrance to 900ms moves B's start to 900ms automatically.

On drag and scroll timelines, these values are positions advanced by input; reaching B's position does not introduce an extra wall-clock wait. Visibility animations instead wait for the predecessor to finish an entrance, then apply their own visibility condition and delay.

## Select the driver

`timeline.driver` accepts `'scene'` or `'clock'`. Its default is `'scene'`.

| Context                             | Behavior                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| Drag, scene driver                  | Uses the owning Scene's element time during navigation and continuation         |
| Scroll zone, scene driver           | Follows the zone's real scroll progress                                         |
| Scroll without a zone, scene driver | Plays over time when visibility conditions are met                              |
| Scroll, clock driver                | Plays over time on visibility, including inside a zone; adds no zone distance   |
| Drag, clock driver                  | Plays independently after official Scene arrival; contributes no Scene duration |

A drag clock animation cannot precede or follow another animation through `after`, and its `exitAnimation` is ignored. Keep a drag dependency sequence on the scene driver.

In scroll mode, a zone follower can wait only for another zone animation in the same Scene. A visibility follower can wait for either a visibility animation or a zone animation. Outside zones, the default scene driver also uses visibility playback, so compatibility depends on actual playback behavior, not just the `driver` value. For the full dependency table, read [sequencing](../../site/src/content/docs/en/concepts/04-orchestration.md).

## Add advanced timing only when needed

For a scroll zone, `timeline.phase` expresses an interval as fractions of the Scene's total duration. In this case `after` follows the effective entrance interval. Phase bounds, dependency positions, delays, and exits must remain compatible. Start with explicit durations and dependencies; read [zones and duration](../../site/src/content/docs/en/scroll/02-zones-budget.md) before adding phase constraints.

`stagger` plays direct children sequentially by time, including inside scroll zones. For children that each follow scroll progress, use separate Animate elements.

For custom drawing, place a component using `useAnimateTimeline()` inside Animate and subscribe to its MotionValues. Read [custom drawing](../../site/src/content/docs/en/advanced/09-use-animate-timeline.md) for subscription cleanup and examples. Do not copy per-frame progress into React state.

If an animation starts at an unexpected point, inspect its target id, driver, owning Scene, delay, and phase. Missing or incompatible dependencies report `INVALID_ANIMATION`; cycles report `CIRCULAR_DEPENDENCY`. Check [public types](../../src/types/index.ts) before inventing an additional scheduling property.
