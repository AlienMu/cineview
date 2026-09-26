---
title: 可见性条件
eyebrow: CONCEPTS / VISIBILITY
---

scroll 模式下，锁定区外的元素默认在进入可视区域后播放动画。在锁定区内设置 `timeline.driver: 'clock'`，也会采用这一行为。

元素在满足入场条件前保持初始帧。开始后按配置的时长播放，滚动速度不会改变播放时长。

## 先入场，再判断退场

`idle` 的元素不会直接退场。它先满足入场条件，再根据位置决定何时退场。这样，从视窗下方接近的内容不会在出现前执行退场动画。

等待延迟、入场和退场等阶段的定义见 [Animate 时间线](/docs/02-timeline)。

## 普通元素何时入场

以下条件用于纵向滚动。`relTop` 和 `relBottom` 是元素相对滚动容器的顶边和底边位置，`vh` 是容器高度：

```text
入场：relTop >= 0 && relBottom <= vh - enterMargin
退场：relTop <= exitMargin || relBottom >= vh - exitMargin
```

入场时，元素需要完整位于可视区域内。底边还需与视窗底部保持 `enterMargin` 的距离。

退场可从两个方向触发。向下滚动时，元素顶边接近视窗顶部；向上滚动时，元素底边接近视窗底部。

两个边距都用设计 px 填写，比较前按 `viewportWidth / designWidth` 换算。单个 Animate 的 `visibility.enterMargin` 或 `visibility.exitMargin` 优先。未配置时采用根组件对应的值，再未配置则使用 50。

## 条件重叠时保持当前阶段

普通元素可能同时满足入场和退场条件。例如，顶边位于 `0` 到 `exitMargin` 之间时，两项条件就可能重叠。

重叠期间保持当前阶段。只有入场条件成立时开始入场，只有退场条件成立时开始退场。这能避免边缘位置的微小滚动反复切换动画。

## 高度超过可视区域的元素

高度超过 `vh - enterMargin` 的元素无法满足完整入场条件，因此使用另一组位置判断：

```text
入场：relTop <= vh / 2        （顶边越过视窗中线）
退场：relBottom <= vh * 0.7   （底边升过视窗高度的 70%）
```

两项条件同时成立时，退场优先。已经离开的长内容不会因为顶边仍在中线上方而重新入场。

## 声明退场才能再次播放

没有 `exitAnimation` 时，元素入场后保持 `entered`。移出视窗不会重置动画，`visibility.replay` 也不会使它重播。

需要退场后重新播放时，声明 `exitAnimation`。显式设置 `duration.exit: 0` 会在满足退场条件时立即结束退场。大于零的时长则按配置播放。

`visibility.replay` 默认 `true`。设置为 `false` 后，已经退场的元素不会在再次满足入场条件时重播。

## 第一场景与中途刷新

第一场景的元素会等待优先资源加载，期间保持初始帧。该资源等待适用于两种模式，详见[预加载](/docs/02-preload)。scroll 第一场景首次判断入场时会放宽底部边距，使靠近视窗底部的引导元素也能开始播放。

若首次测量时元素已经完全位于视窗上方（`relBottom <= 0`），它会直接显示入场完成的画面。页面在中途刷新时，上方内容因此不会全部重新播放。配置了纯手动入场的 `enterRef` 时，仍需手动触发。

## 相关页面

- [Animate 时间线](/docs/02-timeline)：进度、阶段与手动触发。
- [动画组合与顺序](/docs/04-orchestration)：等待前序元素后再播放。
- [Scene 可见性与输入](/docs/07-runtime-states)：循环动画何时暂停。
- [Animate](/docs/03-animate)：完整属性说明。
