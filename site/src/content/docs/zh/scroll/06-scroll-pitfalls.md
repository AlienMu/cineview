---
title: scroll 排错
eyebrow: SCROLL / TROUBLESHOOTING
---

以下八项问题只出现在 scroll 模式。跨模式通用问题见[排错](/docs/07-common-pitfalls)。

## 1. 场景消失且没有报错

当 `Scene` 不是 `CineView` 的直接子节点时，页面可能空白或缺少场景，控制台和 type-check 都没有提示。React 会展平数组，但不会展平 Fragment。自定义组件在 render 函数内返回 `Scene` 也会隐藏内部节点。`memo` 和 `forwardRef` 包装最多向内解包六层。

未被发现的 Scene 收不到运行时注入，会回落到 drag 模式，渲染为 `pointerEvents: 'none'` 的非活动绝对定位元素，子 `Animate` 停在初始帧。只有完全找不到有效 Scene 时才会出现 `EMPTY_SCENES`，因此直接子节点和 Fragment 混用可能静默失败。

将 Scene 直接声明在 CineView 下。复用一组场景时，让函数返回 Scene 元素数组，并在 CineView 的 children 中调用。

## 2. 锁定区内 `phase` 保持 `idle`

锁定区内跟随场景进度的入退场动画保持 `phase: 'idle'`，进度仍随滚动变化。独立计时元素使用可见性阶段，仅有循环动画的元素处于 `entered`。

随位置变化的视觉效果读取时间轴进度。画布仅取决于进度时，绘制一次后订阅进度变化即可。phase 和驱动来源本身不能表示元素是否位于视窗中，详见 [useAnimateTimeline](/docs/09-use-animate-timeline)。

## 3. 声明锁定区后，场景仍未停留

Scene 配置了 `scroll={{ zoneId }}`，滚动仍直接通过，`onZoneEnter` 和 `onZoneLeave` 也不触发。首帧发送的 `onZoneProgress` 事件若为 `progress: 0`，不能证明该锁定区已生成有效区间。

没有跟随场景的入场或退场动画时，锁定区预算为零，不增加动画行程。外层仍占据视觉跨度与一个视窗中的较大值，不超过 0.5px 的区间不参与防跳过限制。

至少为一个子元素配置 `enterAnimation` 和 `duration.enter` 以建立区间。只有循环效果时不需要声明锁定区。详见[锁定区与时长预算](/docs/02-zones-budget)。

## 4. `goToZone` 不处理 `align`

`goToZone(id, { align: 'center' })` 始终前往锁定区起点，唯一支持的对齐值是 center。

使用 `goToZone` 导航到起点，它不提供按进度偏移的选项。

## 5. `zoneTrigger` 和 `trigger` 没有作用

center-lock 是唯一支持的触发方式，根属性和 Scene 属性都不会选择其他锁定行为。

通过 `Scene.scroll` 声明锁定区，再配置跟随场景的动画时长，使其产生滚动行程。

## 6. render 中读到旧的每帧数值

在 render 中调用一次 `.get()` 不会让 React 订阅后续进度变化，按这种方式读取的数值可能保持不变。

将 MotionValue 绑定到 motion 样式，订阅 `useAnimateTimeline()` 返回的值，或在 JSX 需要更新数值时使用 render-prop children。render-prop 更新会经过 React 渲染。根级可以使用 `onZoneProgress`。

## 7. `onVisibilityChange` 每个滚动帧都会触发

scroll 模式下，`Scene.callbacks.onVisibilityChange` 每个滚动帧都会执行，不做去重，即使 `visible` 和 `progress` 没变也一样。该回调不会让 Scene 内容重渲染，但回调内部的工作仍会按帧执行。

让回调只执行常量时间的工作，或在回调外做过滤，仅在 `visible` 改变或 progress 超过阈值时处理。连续视觉效果使用 MotionValue 驱动。

## 8. 锁定期间场景进度停止

锁定区动画推进时，Scene 的可见性进度可能保持不变，两者描述不同的区间。

锁定区进度使用 `onZoneProgress`，单个元素进度使用 `useAnimateTimeline()`。Scene 可见性回调描述场景在文档中的位置。

## 相关页面

- [center-lock 滚动](/docs/01-centerlock)：区间几何与防跳过
- [锁定区与时长预算](/docs/02-zones-budget)：时长如何形成锁定区间
- [四条输入路径](/docs/03-inputs)：键盘拦截与嵌套滚动容器
- [排错](/docs/07-common-pitfalls)：跨模式通用问题
