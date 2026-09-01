---
title: scroll 排错
eyebrow: SCROLL / TROUBLESHOOTING
---

以下八项问题只出现在 scroll 模式。跨模式通用问题见[排错](/docs/07-common-pitfalls)。

## 1. 场景消失且没有报错

当 `Scene` 不是 `CineView` 的直接子节点时，页面可能空白或缺少场景，控制台和 type-check 都没有提示。React 会展平数组，但不会展平 Fragment。自定义组件在 render 函数内返回 `Scene` 也会隐藏内部节点。`memo` 和 `forwardRef` 包装最多向内解包六层。

未被发现的 Scene 收不到运行时注入，会回落到 drag 模式，渲染为 `pointerEvents: 'none'` 的非活动绝对定位元素，子 `Animate` 停在初始帧。只有完全找不到有效 Scene 时才会出现 `EMPTY_SCENES`，因此直接子节点和 Fragment 混用可能静默失败。

将所有 `Scene` 直接声明为 `CineView` 的子节点。需要复用一组场景时，导出返回 `Scene[]` 的函数并展开结果，不要返回 Fragment。

## 2. 锁定区内 `phase` 保持 `idle`

锁定区内的元素能正常跟随滚动，但 render prop 和 `useAnimateTimeline().phase` 仍为 `'idle'`。这是预期行为。phase 来自视口可见性判定，锁定区元素读取连续滚动进度。只有单独使用 `loopAnimation` 的元素会进入 `'entered'`，其他锁定区元素在视觉上跟随滚动时仍保持 `'idle'`。

连续读取锁定区活动状态时使用 `signedProgress`。canvas 自绘不要只因为 phase 为 `'idle'` 就停止 `requestAnimationFrame`，应读取 zone 进度，并在元素确实离开活动范围时暂停。离开锁定区，或使用 `timeline.driver: 'clock'` 后，phase 会按正常生命周期变化。详见[Animate 时间线](/docs/02-timeline)。

## 3. 声明了 zone 却没有锁定效果

Scene 配置了 `scroll={{ zoneId }}`，滚动仍直接通过，`onZoneEnter` 和 `onZoneLeave` 也不触发。首帧发送的 `onZoneProgress` 事件若为 `progress: 0`，不能证明该 zone 已生成有效区间。

没有子元素声明带时长的 `enterAnimation` 或 `exitAnimation` 时，zone 预算为零。只有 `loopAnimation` 的 zone 没有锁定区间。长度小于 0.5 px 的区间也会被排除，wrapper 会回落为视觉高度，场景行为等同普通 section。

至少为一个子元素配置 `enterAnimation` 和 `duration.enter` 以建立区间。只有循环效果时不需要声明 zone。详见[zone 与滚动预算](/docs/02-zones-budget)。

## 4. `goToZone` 不处理 `align`

调用 `goToZone(id, { align: 'center' })` 后，页面仍停在 `centerLockOffset`，也就是 zone 的起点和进度 0。公共类型接受 `align`，但实现不会读取它。

将 `goToZone` 当作跳转到 zone 起点使用。需要停在其他位置时，将目标偏移加到 `centerLockOffset`，再调用原生 `scrollTo`。

## 5. `zoneTrigger` 和 `trigger` 没有作用

修改根级 `zoneTrigger` 或 `Scene.scroll.trigger` 不会改变行为。两个字段会被解析，但解析结果没有参与运行。center-lock 是唯一实现的行为，也是默认值。

判断场景是否为锁定区时，只依据有效的 `scroll` 配置，不要用这两个 trigger 字段切换模式。

## 6. render 中读到旧的每帧数值

在 render 中读取 `sceneProgress`、`enterProgress` 或 `progressPx` 可能得到较早的值，但将同一数值绑定到 motion style 时仍然实时。连续变化的数值不参与 React 快照更新，避免每滚动一个像素就重渲染整棵 Scene 子树。

连续数值通过 MotionValue 订阅和 `useAnimateTimeline().progress`、`signedProgress`、`frame` 读取。根级使用 `onZoneProgress`。不要把每帧数值写入 React state。详见[useAnimateTimeline](/docs/09-use-animate-timeline)与[性能](/docs/01-performance)。

## 7. `onVisibilityChange` 每个滚动帧都会触发

scroll 模式下，`Scene.callbacks.onVisibilityChange` 每个滚动帧都会执行，不做去重，即使 `visible` 和 `progress` 没变也一样。该回调不会让 Scene 子树重渲染，但回调内部的工作仍会按帧执行。

让回调只执行常量时间的工作，或在回调外做过滤，仅在 `visible` 改变或 progress 超过阈值时处理。连续视觉效果使用 MotionValue 驱动。

## 8. zone 锁定期间场景进度停止

锁定区间内，场景时间线使用固定的 `centerLockOffset`。因此 `enterProgress`、`exitProgress` 和 `sceneProgress` 保持不变，而 zone 时间线继续推进。

锁定区的进度从根级 `onZoneProgress`，或区间内部的 `useAnimateTimeline().progress` 读取。场景级回调用于文档流中的可见性，不用于读取锁定区间内的进度。

## 相关页面

- [center-lock 滚动](/docs/01-centerlock)：区间几何与防跳过
- [zone 与滚动预算](/docs/02-zones-budget)：时长如何形成锁定区间
- [四条输入路径](/docs/03-inputs)：键盘拦截与嵌套滚动容器
- [排错](/docs/07-common-pitfalls)：跨模式通用问题
