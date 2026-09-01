---
title: 公共类型速查
eyebrow: ADVANCED / TYPES
---

组件 props 的逐字段参考见各组件文档（[CineView](/docs/01-cineview)、[Scene](/docs/02-scene)、[Animate](/docs/03-animate)、[AnimateVideo](/docs/04-animate-video)、[Position](/docs/05-position)）。本文汇总核心公共类型定义，均从包顶层导出：

```tsx
import type { SlideDirection, CineViewRef, CineViewErrorCode } from 'cineview';
```

## 基础枚举

| 类型                  | 定义                                                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SlideDirection`      | `'x' \| 'y'`                                                                                                                                             |
| `ScrollMode`          | `'drag' \| 'scroll'`                                                                                                                                     |
| `SceneAnchor`         | 九宫格：`'top-left' \| 'top-center' \| 'top-right' \| 'center-left' \| 'center' \| 'center-right' \| 'bottom-left' \| 'bottom-center' \| 'bottom-right'` |
| `SceneStackMode`      | `'replace' \| 'cover'`                                                                                                                                   |
| `DragTimelineUnit`    | `'time' \| 'percent'`                                                                                                                                    |
| `AnimatePhase`        | `'idle' \| 'waiting' \| 'entering' \| 'entered' \| 'exiting' \| 'exited'`                                                                                |
| `AnimateTimelineLane` | `'drag' \| 'scroll' \| 'visibility'`                                                                                                                     |

## AnimationType 三层结构

`AnimationType = PresetAnimation | CustomAnimation | ComposedAnimation`，`enterAnimation` / `exitAnimation` / `loopAnimation`（含 `Scene.transition`、`AnimateVideo`）都接受它。

| 层                  | 定义                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| `PresetAnimation`   | 43 个预设名的字符串 union，全表见[预设动画](/docs/08-presets)。                                                 |
| `CustomAnimation`   | Framer variant 子集：`{ initial?, animate?, exit? }`，字段为 `Record<string, unknown>`。                        |
| `ComposedAnimation` | `{ animations: (PresetAnimation \| CustomAnimation)[], mode: 'sequential' \| 'parallel', delays?: number[] }`。 |

## 错误码

`CineViewErrorCode` 是 8 个值的 union，`onError` 里对 `code` 做 switch 可获得穷尽性检查。

| 错误码                        | 触发条件                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `EMPTY_SCENES`                | CineView 没有任何 Scene 子节点。                                                                                         |
| `IMAGE_LOAD_FAILED`           | 预加载图片失败。                                                                                                         |
| `FIRST_SCENE_TIMEOUT`         | 首屏优先资源等待超过 `firstSceneTimeout`（默认 3000ms）。可恢复：`preventDefault()` 接管，否则默认回退为静态放置首场景。 |
| `INVALID_ANIMATION`           | `after` 指向不存在的 animateId。                                                                                         |
| `CIRCULAR_DEPENDENCY`         | `after` 链存在循环。                                                                                                     |
| `INVALID_COMPONENT_HIERARCHY` | 组件树里出现重复 animateId 或重复 zone identity。                                                                        |
| `INVALID_DRAG_CONFIG`         | drag 的 unit / scale / enabled 配置非法。可恢复。                                                                        |
| `ANIMATION_ASSET_LOAD_FAILED` | 动画预设资源加载失败。可重试。                                                                                           |

payload 类型是 `CineViewErrorDetail = { code, message, context?, preventDefault? }`；`preventDefault` 只在可恢复错误上存在。处理模式见[回调速查](/docs/03-callbacks)。

## Ref 与预加载目标

| 类型                    | 定义                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CineViewRef`           | 五个必填方法（`goToScene` / `refreshLayout` / `preload` / `getCurrentIndex` / `getPerformanceMetrics`）+ scroll 专属可选的 `goToZone`。见 [CineView](/docs/01-cineview)。 |
| `CineViewScrollRef`     | `CineViewRef` 的 scroll 视图，`goToZone` 必填。                                                                                                                           |
| `CineViewPreloadTarget` | `number`（场景索引）`\| string`（sceneId；scroll 下也可匹配 zoneId）。                                                                                                    |
| `PerformanceMetrics`    | `{ fps, avgFrameTime, memoryUsage?, bundleSize }`；`avgFrameTime` 单位 ms，`bundleSize` 单位 KB，`memoryUsage` 单位 MB。                                                  |

## 回调 Detail 类型

| 类型                    | 用于                                                           | 字段                                                                    |
| ----------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `SceneChangeDetail`     | onSceneEnter / onSceneLeave                                    | `fromIndex`、`toIndex`、`direction?: 'forward' \| 'backward' \| null`   |
| `DragDetail`            | onDragProgress / onDragCancel                                  | `sceneIndex`、`progress`、`direction?: 'forward' \| 'backward' \| null` |
| `DragStartDetail`       | onDragStart（首个方向确认的手势才发）                          | 同 `DragDetail`，但 `direction: 'forward' \| 'backward'`（已决，必填）  |
| `DragBlockedDetail`     | onDragBlocked                                                  | `fromIndex`、`targetSceneIndex`、`direction: 'forward' \| 'backward'`   |
| `DragEndDetail`         | onDragEnd                                                      | `DragDetail` + `targetSceneIndex`、`elapsedMs`、`timelineDurationMs`    |
| `ZoneDetail`            | onZoneEnter / onZoneLeave                                      | `zoneId`、`sceneIndex`                                                  |
| `ZoneProgressDetail`    | onZoneProgress                                                 | `ZoneDetail` + `progress: number`                                       |
| `SceneVisibilityDetail` | onSceneVisibilityChange / `Scene.callbacks.onVisibilityChange` | `sceneIndex?`、`visible`、`progress`                                    |
| `CineViewErrorDetail`   | onError                                                        | 见「错误码」小节                                                        |

## Animate 专用类型

| 类型                   | 定义                                                                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AnimateRenderState`   | render-prop children 收到的状态：`{ enterProgress: number (0..1), phase: AnimatePhase }`。                                                                                   |
| `AnimateStaggerConfig` | `{ each?: number, from?: 'first' \| 'last' \| 'center' }`，默认 each 40ms、from `'first'`。                                                                                  |
| `AnimateTimeline`      | `useAnimateTimeline()` 返回值：六个只读字段，其中 progress / signedProgress / phase / frame 是 MotionValue。逐字段表见 [useAnimateTimeline](/docs/09-use-animate-timeline)。 |
