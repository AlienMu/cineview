---
title: Dual-mode engines
eyebrow: CONCEPTS / MODES
---

CineView ships two engines. `drag` is a full-screen paging engine where one gesture flips one scene. `scroll` uses the real document flow: native scrolling keeps working, and a scene with `Scene.scroll` adds a locked zone. `mode` defaults to `'drag'`. Before selecting an engine, read [Choosing a mode](/docs/04-choosing-mode).

## drag: the paging engine

Scenes transition and stack as slides. Adjacent scenes stay mounted while a gesture is in flight; on release the gesture either commits the switch or rebounds based on commit thresholds.

A page turn relies on two independent scheduling states (details in [Page movement and element time](/docs/03-two-track)):

- **Scene displacement**: how far the whole screen has followed the gesture. Only this progress commits a scene switch.
- **Element progress**: a MotionValue owned by each Scene, driving the enter progress of that scene's `Animate` elements. Nothing is shared across scenes.

### drag configuration

| prop                 | type                                               | default             | description                                                                                                                                                                                                         |
| -------------------- | -------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `direction`          | `'x' \| 'y'`                                       | none                | slide direction                                                                                                                                                                                                     |
| `transitionDuration` | number                                             | 800                 | **Programmatic navigation only.** Gesture page movement and rebound use an engine-internal duration fixed at 800ms that no public prop reaches; this only decides when `onSceneLeave` fires after `ref.goToScene()` |
| `threshold`          | `{ minVelocity, maxVelocity, minRatio, maxRatio }` | none                | gesture commit thresholds                                                                                                                                                                                           |
| `unit`               | `'time' \| 'percent'`                              | `'time'`            | drag mapping unit for scene element timelines                                                                                                                                                                       |
| `scale`              | number                                             | time=10 / percent=1 | mapping amount per 1% dragged                                                                                                                                                                                       |
| `firstSceneTimeout`  | number                                             | 3000                | first-screen priority image wait limit (ms)                                                                                                                                                                         |

`unit` and `scale` control how drag distance maps onto element timelines: with `unit: 'time'`, dragging 1% advances 10ms of the enter timeline; with `unit: 'percent'`, it maps directly to 1% progress. Per-scene overrides live on `Scene.drag` (see the [Scene reference](/docs/02-scene)).

When `firstSceneTimeout` expires, `FIRST_SCENE_TIMEOUT` fires: the default fallback statically places the first scene in its rest state (no more waiting on assets). Call `preventDefault` in `onError` to intercept that fallback.

## scroll: real document flow with locked zones

The page is an ordinary document flow, and long content rides on native scrolling and standard browser feel. Only a Scene that declares `scroll={{ zoneId, trigger: 'center-lock' }}` becomes a locked zone: a narrative segment that drives progress during scrolling. At any moment exactly one scene drives progress, never two in parallel.

### Zones and budget

A zone's time budget corresponds directly to physical scroll distance: **1ms = 1px**. Setting `duration: { enter: 2000 }` means the element enters across 2000px of actual scrolling. Scrolling back into a zone reduces progress from 100% to 0% continuously. Oversized inputs are constrained to valid in-segment frames, so the gesture cannot skip the zone. Full center-lock semantics are in [Center-lock scrolling](/docs/01-centerlock).

### scroll configuration

| prop                         | type                    | default | description                                                 |
| ---------------------------- | ----------------------- | ------- | ----------------------------------------------------------- |
| `direction`                  | `'x' \| 'y'`            | none    | scroll direction                                            |
| `zoneTrigger`                | `'center-lock'`         | none    | the only trigger                                            |
| `sceneSizing`                | `'content' \| 'screen'` | none    | scene sizing strategy                                       |
| `enterMargin` / `exitMargin` | number                  | 50      | global default margin for visibility conditions (design px) |

`enterMargin` / `exitMargin` set the default margins used by the visibility conditions: an element starts entering once it is within 50 design px of the viewport. Override per element with `visibility.enterMargin/exitMargin` on `Animate` (see the [Animate reference](/docs/03-animate)).

```tsx
<CineView mode="scroll" designWidth={750} direction="y" sceneSizing="content">
  <article>Ordinary document content, natively scrolled.</article>
  <Scene sceneId="seq" scroll={{ zoneId: 'seq', trigger: 'center-lock' }}>
    {/* inside the zone: progress = real scroll distance */}
  </Scene>
</CineView>
```
