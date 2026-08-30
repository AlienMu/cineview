---
title: Choosing a mode
eyebrow: GETTING STARTED / CHOOSING A MODE
---

The conclusion first: if each screen is one narrative beat flipped by gestures, use drag. If the page is a long document flow where a few scenes lock scrolling to drive a timeline, use scroll.

## When to use drag

- Full-screen paging: one screen per act, flipped by gesture or ref.
- No resting state between screens. A switch is a single 800ms (default) transition.
- Scene element timelines follow gesture progress (`unit: 'time'` by default; every 1% of drag maps to 10 time units).

## When to use scroll

- The page body is an ordinary long document flow. Native scrolling, keyboard, and scrollbar behave as users expect.
- Scenes declaring `scroll={{ zoneId, trigger: 'center-lock' }}` become locked zones. Inside a locked zone, scrolling drives the in-scene Animate timelines. The budget is 1ms=1px of real scroll distance, and scrolling back moves progress from 100% to 0%.
- Scenes without a locked zone are plain scrolling content and can sit between locked zones.

## Comparison

|                     | drag                                                                                                  | scroll                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Interaction model   | Gesture paging, one screen per act                                                                    | Real document flow + local locked zones |
| Timeline driver     | Gesture progress + transition                                                                         | Scroll position inside a zone (1ms=1px) |
| Between scenes      | A scene is a whole screen                                                                             | Plain content mixes with zone scenes    |
| Transition duration | Gestures fixed at 800ms (not configurable); `transitionDuration` governs programmatic navigation only | No transitions; budget = scrolled px    |
| Extra callbacks     | onDragStart/Commit/Cancel, and more                                                                   | onZoneEnter/Progress/Leave, and more    |
| Entry point         | `cineview/drag`                                                                                       | `cineview/scroll`                       |
| Default             | The default mode                                                                                      | Enabled explicitly with `mode="scroll"` |

## drag skeleton

```tsx
import { CineView, Scene, Animate } from 'cineview/drag';

<CineView designWidth={750} mode="drag" direction="y" transitionDuration={800}>
  <Scene sceneId="beat-1">
    <Animate enterAnimation="fade-in">
      <h1>Beat 1</h1>
    </Animate>
  </Scene>
  <Scene sceneId="beat-2">
    <Animate enterAnimation="fade-in">
      <h1>Beat 2</h1>
    </Animate>
  </Scene>
</CineView>;
```

## scroll skeleton

```tsx
import { CineView, Scene, Animate } from 'cineview/scroll';

<CineView designWidth={750} mode="scroll" direction="y" zoneTrigger="center-lock">
  <Scene sceneId="intro">{/* plain scrolling content */}</Scene>
  <Scene sceneId="hero" scroll={{ zoneId: 'hero-seq', trigger: 'center-lock' }}>
    <Animate duration={{ enter: 1200 }} enterAnimation="fade-in">
      <h1>A headline that plays with scrolling</h1>
    </Animate>
  </Scene>
</CineView>;
```

## Entry points and bundle size

Undecided? Use the full `cineview` entry; it dispatches by `mode` at runtime. Once you settle on one mode, switch to `cineview/drag` or `cineview/scroll`. A single-file Universal Module Definition (UMD) bundle has no code splitting: staying on the full entry ships the unused engine for nothing. See [Installation](/docs/02-installation) and [Performance](/docs/01-performance).
