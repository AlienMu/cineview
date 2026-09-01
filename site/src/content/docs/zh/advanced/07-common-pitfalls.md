---
title: 排错
eyebrow: ADVANCED / TROUBLESHOOTING
---

以下六项问题在两种模式中都可能出现。每项直接说明运行时行为和处理方式。

## 1. 循环动画在退场后仍继续运行

使用 CSS `animation: ... infinite` 的元素在 Scene 退场后仍会重绘。CSS 动画不跟随元素生命周期停止。

将常驻动效放到 `Animate` 的 `loopAnimation` 属性中。元素离开活动阶段或移出视窗时，循环会停止。`loopAnimation` 可以和 `enterAnimation` 共存；仅做循环时省略 `enterAnimation`，因为它的类型是 `enterAnimation?: never`。详见[Animate](/docs/03-animate)。

## 2. 设置 `exitRef` 后元素不再自动退场

传入 `exitRef` 会接管时间驱动轨上的自动退场（接管区之外的可见性驱动元素，或 `timeline.driver: 'clock'`）。应用代码必须主动调用这个 ref，它也没有 `delay` 或 `after` 兜底。它适用于 scroll 的可见性驱动动画。`enterRef` 还适用于 drag 中 `driver: 'clock'` 的独立播放元素。两个 ref 都不适用于跟随位置的动画，例如锁定区内的 scroll 元素或场景驱动的 drag 元素，这些用法会报告 `INVALID_ANIMATION`。

删除 `exitRef` 以恢复自动退场，或在业务事件发生时调用它。`enterRef` 传入后，只要同时提供 `after` 或 `delay`，它们仍作为兜底触发条件；如果没有任何兜底，元素不会自动开始。详见[Animate 时间线](/docs/02-timeline)和[Animate](/docs/03-animate)。

## 3. `driver: 'clock'` 的元素没有退场动画

drag 模式下，`timeline.driver: 'clock'` 会在 Scene 到场后独立于场景时间线播放，不参与 `after` 顺序，也不会执行 `exitAnimation`。

元素需要有序入场或退场时，使用默认的 `driver: 'scene'`。不属于叙事顺序的装饰性动效才使用独立时钟。详见[Animate 时间线](/docs/02-timeline)。

## 4. scroll zone 中 `duration: 2000` 表示滚动 2000 px

锁定区内的时长直接映射到真实滚动距离：1 毫秒等于 1 px。因此 `duration.enter: 2000` 需要滚动 2000 px 才能完成，不是按真实时间播放两秒。

按区间需要的滚动距离设置时长。反向滚动时进度自然从 100% 回到 0%。大输入会被限制在区间内部的一帧，避免跳过整个 zone。详见[center-lock 滚动](/docs/01-centerlock)和[zone 与滚动预算](/docs/02-zones-budget)。

## 5. `after` 报错或 `stagger` 不跟随滚动

`after` 指向不存在的目标时报告 `INVALID_ANIMATION`，A → B → A 这类循环报告 `CIRCULAR_DEPENDENCY`。组件挂载时 registry 会检查这两类情况，通过 `onError` 和开发警告报告，只忽略无效的那条依赖，其余动画继续运行。`stagger` 使用 Framer Motion 的 `staggerChildren`，按经过的时间运行，不读取滚动位置。

先声明 `after` 目标，再声明跟随者，并逐字匹配 id。发现循环时拆成多条独立序列。需要随滚动逐个显示子元素时，使用 render prop 的 `enterProgress` 为子元素分配进度区间。详见[时间线](/docs/04-orchestration)和[Animate](/docs/03-animate)。

## 6. 退场时所有元素在同一帧消失

`after` 只控制入场顺序。场景切换时，如果没有单独定义退场时序，每个元素会同时收到退场信号。

用 `exitAnimation` 和 `duration.exit` 写出反向顺序，或显式错开每个元素的退场时间。入场和退场不对称是有效配置，但只有入场链不会自动产生有序退场。详见[时间线](/docs/04-orchestration)。
