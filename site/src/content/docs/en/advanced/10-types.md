---
title: Public types
eyebrow: ADVANCED / TYPES
---

Import shared types from `cineview`. Component pages describe their individual props; this page lists the types used across components and callbacks.

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

`AnimationType = PresetAnimation | CustomAnimation | ComposedAnimation`. Animate's animation props accept it. Scene transitions and AnimateVideo also accept it for their supported entrance and exit fields.

| Layer               | Definition                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `PresetAnimation`   | A string union of 43 preset names; full table in [presets](/docs/08-presets).                                  |
| `CustomAnimation`   | A Framer variant subset: `{ initial?, animate?, exit? }`, each field `Record<string, unknown>`.                |
| `ComposedAnimation` | `{ animations: (PresetAnimation \| CustomAnimation)[], mode: 'sequential' \| 'parallel', delays?: number[] }`. |

## Error codes

`CineViewErrorCode` contains eight string values. Use a `never` check when a switch needs to handle every value.

| Code                          | Triggered when                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `EMPTY_SCENES`                | CineView has no Scene children, or a Scene has no content.                                                       |
| `IMAGE_LOAD_FAILED`           | A queued resource failed in drag mode.                                                                           |
| `FIRST_SCENE_TIMEOUT`         | Initial priority resource wait timed out. Call `preventDefault?.()` only when providing an application fallback. |
| `INVALID_ANIMATION`           | A dependency is missing or incompatible, or manual control is unsupported.                                       |
| `CIRCULAR_DEPENDENCY`         | The `after` chain contains a cycle.                                                                              |
| `INVALID_COMPONENT_HIERARCHY` | A duplicate animateId or duplicate zone identity in the component tree.                                          |
| `INVALID_DRAG_CONFIG`         | Illegal drag unit / scale / enabled config. Recoverable.                                                         |
| `ANIMATION_ASSET_LOAD_FAILED` | A preset animation asset failed to load. Retryable.                                                              |

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

Props types are exported from `cineview`. Their field references are [AnimateVideo](/docs/04-animate-video), [Image](/docs/06-image), and [Container](/docs/07-container).

| Type                | Extends                                                                  | Own fields                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AnimateVideoProps` | Native events: `onEnded`, `onPlay`, `onPause`, `onTimeUpdate`, `onError` | `src`, `poster`, `width`, `height`, `style`, `preload`, `playbackRate`, `scrubRange`, `animateId`, `duration`, `enterAnimation`, `exitAnimation`, `timeline`, `visibility`, `releaseOnLeave` |
| `ImageProps`        | `img` attributes minus `src` / `alt` / `width` / `height` / `style`      | `src` (required), `alt` (required), `width`, `height`, `style`, `preload`                                                                                                                    |
| `ContainerProps`    | `div` attributes minus `children` / `style` / `className`                | `width`, `height`, `children` (required), `style`, `className`                                                                                                                               |

Numeric dimensions and supported numeric style lengths use `designWidth` conversion. `scrubRange` is a readonly `[fromSeconds, toSeconds]` pair and can run in reverse. `releaseOnLeave` applies only inside scroll locked zones; see [AnimateVideo](/docs/04-animate-video).

```tsx
import type { AnimateVideoProps, ImageProps, ContainerProps } from 'cineview';
```

## Animate-specific types

| Type                   | Definition                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AnimateRenderState`   | The state passed to render-prop children: `{ enterProgress: number (0..1), phase: AnimatePhase }`.                                                           |
| `AnimateStaggerConfig` | `{ each?: number, from?: 'first' \| 'last' \| 'center' }`, defaulting to each 40ms, from `'first'`.                                                          |
| `AnimateTimeline`      | `mode`, `lane`, `progress`, `signedProgress`, `phase`, and `frame`. The last four are MotionValues; see [useAnimateTimeline](/docs/09-use-animate-timeline). |
