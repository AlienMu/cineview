---
title: 从 1.x 迁移
eyebrow: GUIDES / MIGRATING
---

1.x 是一组 React 组件，2.0 是一组自定义元素。页面的结构可以一一对应：舞台、场景、元素、时间线的概念都保留了，写法从 props 变成属性。

## 对照

| 1.x | 2.0 |
| --- | --- |
| `<Cineview mode="scroll">`、`mode="drag"` | `<cv-stage>`、`<cv-stage input="drag">` |
| `<Scene sceneId="intro">` | `<cv-scene id="intro">` |
| `Scene` 的 `scroll={{ zoneId: 'story' }}` | `<cv-scene zone>` |
| `<Animate animateId="title">` | `<cv-animate name="title">` |
| `enterAnimation="slide-up"` | `fx="slide-up"`，或 2.0 的预设如 `fx="rise"` |
| `exitAnimation`、`duration={{ exit }}` | `exit`、`exit-duration` |
| `duration={{ enter: 600 }}` | `duration="600"` |
| `timeline={{ delay: 200, after: 'title' }}` | `delay="200" after="title"` |
| `timeline={{ phase: { start: 0.2, end: 0.6 } }}` | `at="20% 60%"` |
| `timeline={{ driver: 'clock' }}` | `on="clock"` |
| `visibility={{ replay: true }}` | `replay` |
| `loopAnimation` | `loop` |
| `stagger={{ each: 80, from: 'center' }}` | `stagger="80 center"` |
| `<Position fixed>` | `<cv-fixed>` |
| `<AnimateVideo>` | `<cv-video>` |
| `useAnimateTimeline()` 返回的 MotionValue | `el.timeline.subscribe()` |
| `onReady`、`onSceneEnter`、`onSceneLeave` | `cv-ready`、`cv-enter`、`cv-leave` 事件 |
| `onDragStart`、`onDragEnd`、`onDragCancel`、`onDragBlocked` | `cv-dragstart`、`cv-dragend`、`cv-dragcancel`、`cv-dragblocked` 事件 |
| `onError` | `cv-error` 事件 |

## 写法上的变化

- 1.x 的 `replay` 默认开启，2.0 的入场默认只播一次，要重播时写 `replay`。
- 2.0 新增了 1.x 没有的写法：`after` 的负偏移（与前一个重叠）、场景的 `sequence` 和 `split`。
- 1.x 的 `stagger` 只按时间播放；2.0 的 `stagger` 按元素自身进度的比例错开，所以在锁定区和拖动模式里也跟着滚动和手指走。
- 1.x 的预设名（`fade-in`、`slide-up`、`zoom-in`、`rotate-in`、`blur-in`）在 2.0 里仍然可用，数值与 1.x 相同。

## 缓动

1.x 的预设按 `ease-in-out` 播放。2.0 里这几个兼容预设也按 `ease-in-out` 播放，而 2.0 自己的预设各有默认缓动（多数是 `settle`）。迁移后觉得节奏不对时，先检查缓动：

- 要和 1.x 一样，写 `ease="ease-in-out"`。
- 跟着滚动或手指的效果，写 `ease="linear"`，让画面和读者的操作一一对应。

## Canvas 和自己的绘制

1.x 通过 MotionValue 拿到进度，2.0 用 `el.timeline.subscribe()`，做法见[自定义绘制](/docs/13-custom-drawing)。拖动模式里离开的场景，`frame.progress` 表示整个页面移动的进度。一个只想在页面移动的前一段时间里完成的退场，可以自己换算：

```js
const exitProgress = Math.min(1, (frame.progress * transitionDuration) / exitDuration);
```

其中 `transitionDuration` 是舞台的 `transition-duration`，`exitDuration` 是这段退场自己的时长。

## 在 React 里使用

2.0 的元素是普通的自定义元素，可以直接写在 JSX 里，事件用 `ref` 加 `addEventListener` 监听。类型声明在 `dist/types/jsx.d.ts`。服务端渲染的标记在客户端注水后，可以等待 `stage.ready` 再读取状态。
