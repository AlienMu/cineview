---
title: Dual-mode engines
eyebrow: CONCEPTS / MODES
---

`mode` selects drag or scroll and defaults to `'drag'`. Drag moves between full-screen scenes. Scroll keeps content in a native scroll container and can add locked zones whose animation progress follows scroll distance. See [Selecting a mode](/docs/04-choosing-mode).

## drag: the paging engine

During a gesture, the current and adjacent scenes remain mounted. On release, velocity and displacement determine whether the page switches or returns.

Page movement and element animation can finish at different times (see [Page movement and element time](/docs/03-two-track)):

- Page movement determines when the scene switch commits.
- Each Scene's elements follow their own animation durations and can continue entering after the switch.

### drag configuration

| prop                 | type                                               | default                 | description                                                                                        |
| -------------------- | -------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------- |
| `direction`          | `'x' \| 'y'`                                       | `'y'`                   | Drag direction                                                                                     |
| `transitionDuration` | number                                             | 800                     | Timing for programmatic navigation with `ref.goToScene()`; gesture timing is calculated separately |
| `threshold`          | `{ minVelocity, maxVelocity, minRatio, maxRatio }` | `0 / 1000 / 0.15 / 0.3` | Gesture commit thresholds, see [Gestures](/docs/02-gestures)                                       |
| `unit`               | `'time' \| 'percent'`                              | `'time'`                | drag mapping unit for scene element timelines                                                      |
| `scale`              | number                                             | time=10 / percent=1     | mapping amount per 1% dragged                                                                      |
| `firstSceneTimeout`  | number                                             | 3000                    | first-screen priority image wait limit (ms)                                                        |

`unit` and `scale` control how drag distance maps onto element timelines: with `unit: 'time'`, dragging 1% advances 10ms of the enter timeline; with `unit: 'percent'`, it maps directly to 1% progress. Per-scene overrides live on `Scene.drag` (see the [Scene reference](/docs/02-scene)).

After `firstSceneTimeout`, the framework reports `FIRST_SCENE_TIMEOUT` and shows the first scene at its completed state. Calling `detail.preventDefault?.()` in `onError` suppresses that fallback so the application can handle the wait.

## scroll: real document flow with locked zones

Scenes scroll normally unless they declare a locked zone with a non-zero animation budget. A locked zone holds its scene in place while scroll distance advances its animations. Only one locked zone is active at a time.

### Zones and budget

A zone's time budget corresponds directly to physical scroll distance: **1ms = 1px**. Setting `duration: { enter: 2000 }` means the element enters across 2000px of actual scrolling. Scrolling back into a zone reduces progress from 100% to 0% continuously. Oversized inputs are constrained to valid in-segment frames, so the gesture cannot skip the zone. Full center-lock semantics are in [Center-lock scrolling](/docs/01-centerlock).

### scroll configuration

| prop                         | type                    | default         | description                                                 |
| ---------------------------- | ----------------------- | --------------- | ----------------------------------------------------------- |
| `direction`                  | `'x' \| 'y'`            | `'y'`           | Scroll direction                                            |
| `zoneTrigger`                | `'center-lock'`         | `'center-lock'` | Supported trigger                                           |
| `sceneSizing`                | `'content' \| 'screen'` | `'content'`     | Scene sizing strategy                                       |
| `enterMargin` / `exitMargin` | number                  | 50              | global default margin for visibility conditions (design px) |

`enterMargin` and `exitMargin` set viewport margins for visibility-triggered animation. Override them on an Animate through `visibility.enterMargin` and `visibility.exitMargin`. The exact conditions, including tall elements, are in [Visibility conditions](/docs/03-visibility-conditions).

```tsx
<CineView mode="scroll" designWidth={750} direction="y" sceneSizing="content">
  <Scene sceneId="intro">
    <article>Ordinary scrolling content.</article>
  </Scene>
  <Scene sceneId="seq" scroll={{ zoneId: 'seq', trigger: 'center-lock' }}>
    <Animate enterAnimation="fade-in" duration={{ enter: 800 }}>
      <h1>Sequence</h1>
    </Animate>
  </Scene>
</CineView>
```
