---
title: scroll 排错
eyebrow: SCROLL / TROUBLESHOOTING
---

先对照页面上看到的结果，再检查控制该行为的配置。两种模式共有的问题见[排错](/docs/07-common-pitfalls)。

## 场景没有显示

页面空白，或只显示部分 Scene。有时控制台也没有报错。

把每个 `Scene` 直接放在 `Cineview` 下。Scene 数组可以使用；Fragment 或返回 Scene 的自定义组件会使场景无法被发现。完全找不到 Scene 时，Cineview 会报告 `EMPTY_SCENES`。

## 锁定区内的 `phase` 保持 `idle`

动画随滚动变化，但 `phase` 一直是 `idle`。锁定区内跟随场景进度的动画会这样工作。

随滚动变化的画面应读取 `useAnimateTimeline()` 的 `progress`。Canvas 可以先绘制一次，再通过 `progress.on('change', draw)` 更新。`phase` 不能判断元素是否在屏幕中。详见[自定义绘制](/docs/09-use-animate-timeline)。

## 声明了锁定区，场景却没有停留

滚动直接通过设置了 `scroll={{ zoneId }}` 的 Scene，`onZoneEnter` 和 `onZoneLeave` 也不触发。即使锁定区没有滚动距离，首次 `onZoneProgress` 仍可能报告 0。

给子元素的 `Animate` 配置跟随场景的 `enterAnimation`，需要退场时再加 `exitAnimation`。动画时长决定锁定区的滚动距离；未写入场时长时默认 600ms。没有参与时长预算的动画，锁定区就没有可停留的距离。详见[锁定区与时长预算](/docs/02-zones-budget)。

## `goToZone` 没有到达预期进度

调用 `goToZone(id)` 后，页面到达锁定区起点。

该方法把场景对齐到锁定位置，并把区域进度设为 0。继续滚动可以推进区域动画；`{ animated: false }` 可以关闭前往起点的平滑滚动。

## 升级后触发设置出现类型错误

旧代码中的 `zoneTrigger`、`Scene.scroll.trigger` 或 `goToZone` 的 `align` 提示字段不存在。

删除这三个字段。锁定区只有一种触发行为，使用 `scroll={{ zoneId: 'film' }}` 声明即可；导航使用 `goToZone('film', { animated: false })`。场景位置和区域时长保持原来的含义。

`Animate.timeline.zoneId` 也已移除。将 Animate 放在它需要跟随的 Scene 中；导航仍使用 `Scene.scroll.zoneId` 标识区域。

## 页面上的进度数值不再更新

在 React render 中调用 `.get()` 只会读取当时的值，画面不会自动订阅后续变化。

把 MotionValue 绑定到 motion 样式，订阅 `useAnimateTimeline()` 返回的值，或对少量需要重渲染的 JSX 使用 render-prop children。观察整个锁定区可用 `onZoneProgress`。

## 可见性回调频繁执行

`Scene.callbacks.onVisibilityChange` 可能每个滚动帧都执行，即使报告的值没有变化。

减少回调内的工作量。可以过滤重复值，或只处理选定的进度变化。连续变化的画面使用 MotionValue。

## 锁定时 Scene 进度暂停

锁定区动画继续推进时，Scene 的可见性进度可能保持不变。它们对应不同的区间。

整个锁定区的进度使用 `onZoneProgress`；单个元素使用 `useAnimateTimeline()`。Scene 可见性进度用于判断它在文档中的位置。

## 视频画面跟不上滚动

视频定位可能延迟，关键帧稀疏的素材在反向滚动时尤其明显。开发构建会在采样后的定位延迟过高时提示。

使用便于逐帧定位的视频素材，详见 [AnimateVideo](/docs/04-animate-video)。页面有多个视频锁定区时，可用 `releaseOnLeave` 在视频离开活动区域后释放解码画面。

## 相关页面

- [center-lock 滚动](/docs/01-centerlock)：锁定从哪里开始
- [锁定区与时长预算](/docs/02-zones-budget)：动画时长如何变成滚动距离
- [四条输入路径](/docs/03-inputs)：滚轮、触屏、键盘与滚动条的行为
- [排错](/docs/07-common-pitfalls)：两种模式共有的问题
