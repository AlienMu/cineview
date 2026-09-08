---
title: 排错
eyebrow: ADVANCED / TROUBLESHOOTING
---

先检查动画的模式与 driver，它们决定时序、手动控制和退场行为。

## 1. 循环动画在退场后仍继续运行

CSS `animation: ... infinite` 不会自动随 Scene 停止，元素离开后仍可能运行。

将常驻动效放到 `Animate` 的 `loopAnimation` 属性中。元素离开活动阶段或移出视窗时，循环会停止。`loopAnimation` 可以和 `enterAnimation` 共存；仅做循环时省略 `enterAnimation`，因为它的类型是 `enterAnimation?: never`。详见[Animate](/docs/03-animate)。

## 2. 设置 `exitRef` 后元素不再自动退场

可见性驱动的 scroll 动画支持 `exitRef`。传入后关闭自动退场，需要应用主动调用。drag 的 `driver: 'clock'` 仅支持 `enterRef`；跟随场景的 drag 动画和跟随锁定区进度的动画拒绝两个 ref。

删除 `exitRef` 可恢复受支持的自动退场，或在所需事件中调用 `exitRef.current?.()`。详见[手动控制](/docs/03-animate)。

## 3. `driver: 'clock'` 的元素没有退场动画

drag 模式下，`timeline.driver: 'clock'` 会在 Scene 到场后独立于场景时间线播放，不参与 `after` 顺序，也不会执行 `exitAnimation`。

元素需要有序入场或退场时，使用默认的 `driver: 'scene'`。不属于叙事顺序的装饰性动效才使用独立时钟。详见[Animate 时间线](/docs/02-timeline)。

## 4. 锁定区动画需要的滚动距离超出预期

没有 phase 覆盖时，锁定区内的 `duration.enter: 2000` 占据 2000 像素的真实滚动距离，不表示经过两秒。

按需要的滚动距离配置时长。反向滚动会回退进度，过大的用户输入会受到区间边界限制。详见[锁定区与时长预算](/docs/02-zones-budget)。

## 5. `after` 报错或 `stagger` 不跟随滚动

`after` 目标缺失报告 `INVALID_ANIMATION`，循环报告 `CIRCULAR_DEPENDENCY`。不支持的依赖会被忽略，其余动画保留自身时序。stagger 按经过的时间播放，不跟随滚动位置。

匹配同一 Scene 中已有的 `animateId` 并移除循环，JSX 书写顺序不影响依赖。子元素需要跟随进度依次出现时，可分别使用 Animate，或从时间轴 MotionValue 派生样式。

## 6. 退场时所有元素在同一帧消失

`after` 只控制入场顺序，不定义退场顺序。不同退场时长会改变完成时间，不会设置开始顺序。

可见性驱动的 scroll 元素需要有序退场时，依次调用手动退场 ref。跟随位置的效果可通过时间轴区间或关键帧定义顺序，入场序列也可以不配置退场。详见[时间线](/docs/04-orchestration)。
