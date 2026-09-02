---
title: Public types
eyebrow: ADVANCED / TYPES
---

Component prop references are available on their respective documentation pages ([CineView](/docs/01-cineview), [Scene](/docs/02-scene), [Animate](/docs/03-animate), [AnimateVideo](/docs/04-animate-video), [Position](/docs/05-position)). This document provides shared core type definitions exported from the package root:

```tsx
import type { SlideDirection, CineViewRef, CineViewErrorCode } from 'cineview';
```

## Basic enums

| Type                  | Definition                                                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SlideDirection`      | `'x' \| 'y'`                                                                                                                                                |
| `ScrollMode`          | `'drag' \| 'scroll'`                                                                                                                                        |
| `SceneAnchor`         | Nine-grid: `'top-left' \| 'top-center' \| 'top-right' \| 'center-left' \| 'center' \| 'center-right' \| 'bottom-left' \| 'bottom-center' \| 'bottom-right'` |
| `SceneStackMode`      | `'replace' \| 'cover'`                                                                                                                                      |
| `DragTimelineUnit`    | `'time' \| 'percent'`                                                                                                                                       |
| `AnimatePhase`        | `'idle' \| 'waiting' \| 'entering' \| 'entered' \| 'exiting' \| 'exited'`                                                                                   |
| `AnimateTimelineLane` | `'drag' \| 'scroll' \| 'visibility'`                                                                                                                        |

## The three layers of AnimationType

`AnimationType = PresetAnimation | CustomAnimation | ComposedAnimation`. It is what `enterAnimation` / `exitAnimation` / `loopAnimation` accept (including on `Scene.transition` and `AnimateVideo`).

| Layer               | Definition                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `PresetAnimation`   | A string union of 43 preset names; full table in [presets](/docs/08-presets).                                  |
| `CustomAnimation`   | A Framer variant subset: `{ initial?, animate?, exit? }`, each field `Record<string, unknown>`.                |
| `ComposedAnimation` | `{ animations: (PresetAnimation \| CustomAnimation)[], mode: 'sequential' \| 'parallel', delays?: number[] }`. |

## Error codes

`CineViewErrorCode` is an 8-value union; switching on `code` inside `onError` provides compile-time exhaustiveness checking.

| Code                          | Triggered when                                                                                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EMPTY_SCENES`                | CineView has no Scene children.                                                                                                                                                                               |
| `IMAGE_LOAD_FAILED`           | A preloaded image failed.                                                                                                                                                                                     |
| `FIRST_SCENE_TIMEOUT`         | First-screen priority assets did not settle within `firstSceneTimeout` (default 3000ms). Recoverable: call `preventDefault()` to take over; otherwise the default fallback places the first scene statically. |
| `INVALID_ANIMATION`           | `after` points at a nonexistent animateId.                                                                                                                                                                    |
| `CIRCULAR_DEPENDENCY`         | The `after` chain contains a cycle.                                                                                                                                                                           |
| `INVALID_COMPONENT_HIERARCHY` | A duplicate animateId or duplicate zone identity in the component tree.                                                                                                                                       |
| `INVALID_DRAG_CONFIG`         | Illegal drag unit / scale / enabled config. Recoverable.                                                                                                                                                      |
| `ANIMATION_ASSET_LOAD_FAILED` | A preset animation asset failed to load. Retryable.                                                                                                                                                           |

The payload type is `CineViewErrorDetail = { code, message, context?, preventDefault? }`; `preventDefault` exists only on recoverable errors. Handling patterns: [Callbacks](/docs/03-callbacks).

## Refs and preload targets

| Type                    | Definition                                                                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CineViewRef`           | Five required methods (`goToScene` / `refreshLayout` / `preload` / `getCurrentIndex` / `getPerformanceMetrics`) plus the scroll-only optional `goToZone`. See [CineView](/docs/01-cineview). |
| `CineViewScrollRef`     | The scroll view of `CineViewRef`, with `goToZone` required.                                                                                                                                  |
| `CineViewPreloadTarget` | `number` (scene index) `\| string` (sceneId; under scroll it may also match a zoneId).                                                                                                       |
| `PerformanceMetrics`    | `{ fps, avgFrameTime, memoryUsage?, bundleSize }`; `avgFrameTime` in ms, `bundleSize` in KB, `memoryUsage` in MB.                                                                            |

## Callback detail types

| Type                    | Used by                                                           | Fields                                                                             |
| ----------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `SceneChangeDetail`     | onSceneEnter / onSceneLeave                                       | `fromIndex`, `toIndex`, `direction?: 'forward' \| 'backward' \| null`              |
| `DragDetail`            | onDragProgress / onDragCancel                                     | `sceneIndex`, `progress`, `direction?: 'forward' \| 'backward' \| null`            |
| `DragStartDetail`       | onDragStart (fires only after the first direction-qualified move) | Same as `DragDetail`, but `direction: 'forward' \| 'backward'` (settled, required) |
| `DragBlockedDetail`     | onDragBlocked                                                     | `fromIndex`, `targetSceneIndex`, `direction: 'forward' \| 'backward'`              |
| `DragEndDetail`         | onDragEnd                                                         | `DragDetail` + `targetSceneIndex`, `elapsedMs`, `timelineDurationMs`               |
| `ZoneDetail`            | onZoneEnter / onZoneLeave                                         | `zoneId`, `sceneIndex`                                                             |
| `ZoneProgressDetail`    | onZoneProgress                                                    | `ZoneDetail` + `progress: number`                                                  |
| `SceneVisibilityDetail` | onSceneVisibilityChange / `Scene.callbacks.onVisibilityChange`    | `sceneIndex?`, `visible`, `progress`                                               |
| `CineViewErrorDetail`   | onError                                                           | See "Error codes"                                                                  |

## Component prop types

Every component's props are exported from the package root, so a wrapper can name them
without re-declaring the shape. The three below have no page of their own; the rest are
documented on their component pages.

| Type                | Extends                                                             | Own fields                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AnimateVideoProps` | Native video events (`onPlay`, `onSeeked`, …)                       | `src`, `poster`, `width`, `height`, `style`, `preload`, `playbackRate`, `scrubRange`, `animateId`, `duration`, `enterAnimation`, `exitAnimation`, `timeline`, `visibility`, `releaseOnLeave` |
| `ImageProps`        | `img` attributes minus `src` / `alt` / `width` / `height` / `style` | `src` (required), `alt` (required), `width`, `height`, `style`, `preload`                                                                                                                    |
| `ContainerProps`    | `div` attributes minus `children` / `style` / `className`           | `width`, `height`, `children` (required), `style`, `className`                                                                                                                               |

`width` / `height` / `style` accept design pixels as numbers on all three, converted
through the same `designWidth` ruler as everywhere else. `AnimateVideoProps.scrubRange`
is a readonly `[fromSeconds, toSeconds]` pair and may run backwards; see
[AnimateVideo](/docs/04-animate-video). `releaseOnLeave` applies to scroll takeover
zones only and is ignored in drag mode.

```tsx
import type { AnimateVideoProps, ImageProps, ContainerProps } from 'cineview';
```

## Animate-specific types

| Type                   | Definition                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AnimateRenderState`   | The state passed to render-prop children: `{ enterProgress: number (0..1), phase: AnimatePhase }`.                                                                                         |
| `AnimateStaggerConfig` | `{ each?: number, from?: 'first' \| 'last' \| 'center' }`, defaulting to each 40ms, from `'first'`.                                                                                        |
| `AnimateTimeline`      | The return of `useAnimateTimeline()`: six readonly fields; progress / signedProgress / phase / frame are MotionValues. Field table in [useAnimateTimeline](/docs/09-use-animate-timeline). |
