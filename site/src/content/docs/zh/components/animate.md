---
title: Animate
eyebrow: TIMELINE CONSUMER
---

Animate 消费当前模式的时间语义，编排 delay、waitFor、phase、visibility 与 stagger。

## When to use

- 任何需要「入场 / 退场 / 常驻循环」语义的元素。不要手写 opacity/transform 生命周期，也不要用 CSS `animation: … infinite`。
- 需要级联编排（`waitFor` + `delay`）或子元素错峰揭示（`stagger`）。
- 需要把动画进度暴露给自定义渲染器：用 render-prop 形态（拿 `enterProgress`）或 `useAnimateTimeline()`，不要自建驱动。

## 当前时间轴 API

`timeline.sceneControlled` 默认为 true。位于 scroll 接管 zone 内时绑定该 zone；不在时优雅降级为 visibility。设为 false 可强制使用 visibility。

典型用法：给元素声明入场/退场动画名（`enterAnimation`/`exitAnimation`）与各自时长（`duration.enter`/`duration.exit`），再经 `timeline.delay`/`waitFor` 挂进级联，经 `visibility.replayOnReenter` 声明重入回放。取值清单见 API 参考。

轨道裁决（`timeline.sceneControlled`）决定这个元素的 progress 由谁驱动：

- **scroll 接管轨**：在接管 zone 内且 `sceneControlled` 未关。滚动 px 驱动，`duration.enter` 就是真实滚动距离（`1ms = 1px`），反向滚动即倒放。
- **visibility 时间轨**：scroll 模式但不在 zone 内，或显式 `sceneControlled: false`。真实时间驱动，进出场由视口边距闸门触发。
- **drag 元素轨 / arrival 轨**：drag 模式下 scene-controlled 元素随场景元素轨 scrub；`sceneControlled: false` 则走独立 arrival 轨，真实时间播放，没有退场段。

手动控制（`enterRef`/`exitRef`）只对时间轨有意义。scrub 轨上视觉位置是唯一所有者的纯函数，手动写入会被上报并忽略。轨道 × ref 的完整支持矩阵见 API 参考。

## 常见误用

- **常驻循环用 CSS `animation: … infinite`**：不受 phase 约束，离屏不停止，出现「其他元素都已退场、这个还在动」的破窗。`infiniteAnimation` 是唯一许可通道。
- **只编排入场不编排退场**：`waitFor`/`delay` 做了入场级联的，退场要写对应的反向编排，否则退场全部同时触发（「打包回滚」），时序不对称。
- **在 scrub 轨上传 `enterRef`**：结构上不可能生效。drag 用 `sceneControlled: false`，scroll 把元素移出接管 zone。
- **`enterAnimation` 与 `infiniteAnimation` 都不传**：上报 `INVALID_ANIMATION`，两者至少提供其一。

---

完整字段与轨道支持矩阵见 [Animate API](/docs/animate-api)。
