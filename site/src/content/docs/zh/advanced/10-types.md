---
title: 公共类型速查
eyebrow: ADVANCED / TYPES
---

共享类型从 `cineview` 导入，各组件页面说明自身 props。本页列出跨组件与回调使用的类型。

```tsx
import type { SlideDirection, CineviewRef, CineviewErrorCode } from 'cineview';
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

## AnimationType 的三种形式

`AnimationType = PresetAnimation | CustomAnimation | ComposedAnimation`，用于 Animate 的动画属性。Scene 转场与 AnimateVideo 支持的入场、退场字段也使用该类型。

| 类型                | 定义                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| `PresetAnimation`   | 43 个预设名的字符串 union，全表见[预设动画](/docs/08-presets)。                                                 |
| `CustomAnimation`   | Framer variant 子集：`{ initial?, animate?, exit? }`，字段为 `Record<string, unknown>`。                        |
| `ComposedAnimation` | `{ animations: (PresetAnimation \| CustomAnimation)[], mode: 'sequential' \| 'parallel', delays?: number[] }`。 |

接受相同类型的属性，其播放能力仍有区别：普通 Animate 入退场支持十种动画属性，循环与 stagger 播放会使用逐属性 transition 时间。详见[自定义动画](/docs/05-custom-animation)。

## 错误码

`CineviewErrorCode` 包含八个字符串值。switch 需要处理每个值时，可加入 `never` 检查。

| 错误码                        | 触发条件                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `EMPTY_SCENES`                | Cineview 没有 Scene，或 Scene 没有内容。                                      |
| `IMAGE_LOAD_FAILED`           | drag 模式的队列资源加载失败。                                                 |
| `FIRST_SCENE_TIMEOUT`         | 初始优先资源等待超时。应用提供自己的处理方式时，再调用 `preventDefault?.()`。 |
| `INVALID_ANIMATION`           | 依赖缺失或不兼容、不支持手动控制，或 phase 无法在有限区域预算内完成。                                          |
| `CIRCULAR_DEPENDENCY`         | `after` 链存在循环。                                                          |
| `INVALID_COMPONENT_HIERARCHY` | `animateId` 或锁定区标识重复。                                                |
| `INVALID_DRAG_CONFIG`         | drag 的 unit / scale / enabled 配置非法。可恢复。                             |
| `ANIMATION_ASSET_LOAD_FAILED` | 动画预设资源加载失败。可重试。                                                |

回调参数类型为 `CineviewErrorDetail = { code, message, context?, preventDefault? }`；`preventDefault` 只在可恢复错误上存在。处理模式见[回调速查](/docs/03-callbacks)。

## Ref 与预加载目标

| 类型                    | 定义                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CineviewRef`           | 五个必填方法（`goToScene` / `refreshLayout` / `preload` / `getCurrentIndex` / `getPerformanceMetrics`）+ scroll 专属可选的 `goToZone`。见 [Cineview](/docs/01-cineview)。 |
| `CineviewScrollRef`     | `CineviewRef` 的 scroll 视图，`goToZone` 必填。                                                                                                                           |
| `CineviewPreloadTarget` | `number`（场景索引）`\| string`（sceneId；scroll 下也可匹配 zoneId）。                                                                                                    |
| `PerformanceMetrics`    | `{ fps, avgFrameTime, memoryUsage?, bundleSize }`；`avgFrameTime` 单位 ms，`bundleSize` 单位 KB，`memoryUsage` 单位 MB。                                                  |

## 回调 Detail 类型

| 类型                    | 用于                                                           | 字段                                                                    |
| ----------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `SceneChangeDetail`     | onSceneEnter / onSceneLeave                                    | `fromIndex`、`toIndex`、`direction?: 'forward' \| 'backward' \| null`   |
| `DragDetail`            | onDragProgress / onDragCancel                                  | `sceneIndex`、`progress`、`direction?: 'forward' \| 'backward' \| null` |
| `DragStartDetail`       | onDragStart（首个方向确认的手势才发）                          | 同 `DragDetail`，但 `direction: 'forward' \| 'backward'`（必填）        |
| `DragBlockedDetail`     | onDragBlocked                                                  | `fromIndex`、`targetSceneIndex`、`direction: 'forward' \| 'backward'`   |
| `DragEndDetail`         | onDragEnd                                                      | `DragDetail` + `targetSceneIndex`、`elapsedMs`、`timelineDurationMs`    |
| `ZoneDetail`            | onZoneEnter / onZoneLeave                                      | `zoneId`、`sceneIndex`                                                  |
| `ZoneProgressDetail`    | onZoneProgress                                                 | `ZoneDetail` + `progress: number`                                       |
| `SceneVisibilityDetail` | onSceneVisibilityChange / `Scene.callbacks.onVisibilityChange` | `sceneIndex?`、`visible`、`progress`                                    |
| `CineviewErrorDetail`   | onError                                                        | 见「错误码」小节                                                        |

## 组件 Props 类型

Props 类型从 `cineview` 导出，字段说明见 [AnimateVideo](/docs/04-animate-video)、[Image](/docs/06-image) 与 [Container](/docs/07-container)。

| 类型                | 继承自                                                              | 自有字段                                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AnimateVideoProps` | 原生事件：`onEnded`、`onPlay`、`onPause`、`onTimeUpdate`、`onError` | `src`、`aria-label`、`poster`、`width`、`height`、`style`、`preload`、`playbackRate`、`scrubRange`、`animateId`、`duration`、`enterAnimation`、`exitAnimation`、`timeline`、`visibility`、`releaseOnLeave` |
| `ImageProps`        | `img` 属性去掉 `src` / `alt` / `width` / `height` / `style`         | `src`（必填）、`alt`（必填）、`width`、`height`、`style`、`preload`                                                                                                                                        |
| `ContainerProps`    | `div` 属性去掉 `children` / `style` / `className`                   | `width`、`height`、`children`（必填）、`style`、`className`                                                                                                                                                |

数值尺寸与受支持的数值型样式长度使用 `designWidth` 换算。`scrubRange` 为只读 `[起始秒, 结束秒]`，支持反向区间。`releaseOnLeave` 仅在 scroll 锁定区生效，详见 [AnimateVideo](/docs/04-animate-video)。

```tsx
import type { AnimateVideoProps, ImageProps, ContainerProps } from 'cineview';
```

## Animate 专用类型

| 类型                   | 定义                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AnimateRenderState`   | render-prop children 收到的状态：`{ enterProgress: number (0..1), phase: AnimatePhase }`。                                                              |
| `AnimateStaggerConfig` | `{ each?: number, from?: 'first' \| 'last' \| 'center' }`，默认 each 40ms、from `'first'`。                                                             |
| `AnimateTimeline`      | 包含 `mode`、`lane`、`progress`、`signedProgress`、`phase` 和 `frame`，后四项为 MotionValue，详见 [useAnimateTimeline](/docs/09-use-animate-timeline)。 |
