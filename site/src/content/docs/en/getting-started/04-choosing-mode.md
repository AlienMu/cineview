---
title: Choosing a mode
eyebrow: GETTING STARTED / CHOOSING A MODE
---

Use drag for full-screen pages with discrete scene changes. Use scroll for a continuous document that includes sections whose animations follow scroll distance.

## When to use drag

- Navigate by pointer gesture, keyboard, or ref method.
- After release, page movement completes the switch or returns to the current scene.
- Scene-driven element timelines follow the gesture. With the default `unit: 'time'` and `scale: 10`, each 1% of drag advances 10ms.

## When to use scroll

- Content moves in a native scroll container, with wheel, touch, keyboard, and scrollbar input.
- Scenes declaring `scroll={{ zoneId, trigger: 'center-lock' }}` become locked zones. Inside a locked zone, scrolling drives the in-scene Animate timelines. The budget is 1ms=1px of real scroll distance, and scrolling back moves progress from 100% to 0%.
- Scenes without a locked zone are plain scrolling content and can sit between locked zones.

## Comparison

|                     | drag                                                                               | scroll                                         |
| ------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------- |
| Interaction model   | Gesture paging, one screen per act                                                 | Real document flow + local locked zones        |
| Timeline driver     | Gesture progress + transition                                                      | Scroll position inside a zone (1ms=1px)        |
| Between scenes      | A scene is a whole screen                                                          | Plain content mixes with zone scenes           |
| Transition duration | `transitionDuration` configures ref navigation; gesture timing depends on movement | Zone duration maps to scroll distance          |
| Callbacks           | `onDragStart`, `onDragEnd`, `onDragCancel`                                         | `onZoneEnter`, `onZoneProgress`, `onZoneLeave` |
| CommonJS entry      | `cineview/drag`                                                                    | `cineview/scroll`                              |
| Default             | The default mode                                                                   | Enabled explicitly with `mode="scroll"`        |

## drag skeleton

```tsx
import { CineView, Scene, Animate } from 'cineview';

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
import { CineView, Scene, Animate } from 'cineview';

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

Use `cineview` with ES module (ESM) bundlers. It includes both engines and selects one through `mode`. Mode subpaths support CommonJS; separate Universal Module Definition (UMD) files support browser script loading with supplied peer runtimes. See [Installation](/docs/02-installation) and [Performance](/docs/01-performance).
