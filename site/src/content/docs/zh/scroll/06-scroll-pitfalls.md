---
title: scroll 排错
eyebrow: SCROLL / TROUBLESHOOTING
---

八个 scroll 专属的故障。每条先说你会看到什么，再说为什么会这样、怎么改。两种模式都可能遇到的故障见[排错](/docs/07-common-pitfalls)。

## 1. 场景整个不见了，还没有任何报错

页面空白或少了几屏，控制台干净，type-check 也过。

`Scene` 必须是 `CineView` 的直接 JSX 子节点。框架只遍历一层子节点来找 Scene。数组会被 React 展平（`{list.map(...)}` 可以），但 **Fragment 不展平**，包在 `<>...</>` 里的 Scene 一个都找不到。自定义包装组件的情况稍好：识别能沿组件类型向内解包，`memo` / `forwardRef` 这类包装能看到六层；但包装组件在渲染函数里返回 `Scene` 时，框架看到的只是你的组件。

没被发现的 Scene 收不到运行时注入，模式回落 `'drag'`。它被渲染成 `position: absolute` 且运行态 `inactive`，也就是 `pointerEvents: 'none'`。不可见，不可点，子 `Animate` 被当作 drag 元素处理却没有 drag 运行时，停在初始帧。

**而且一个警告都不发。** `EMPTY_SCENES` 只在一个场景都没找到时才报，混合情形（一个直接的 Scene 加一个含两个 Scene 的 Fragment）完全无信号。

改法：把 `Scene` 平铺为 `CineView` 的直接子节点。要复用一组场景，导出返回**数组**的函数再展开，不要返回 Fragment。

## 2. 锁定区内 phase 一直是 idle

zone 内元素正常跟随滚动，但 render-prop 的 `phase` 和 `useAnimateTimeline().phase` 永远读到 `'idle'`。

这是预期行为，不是故障。锁定区（locked zone）的 phase 不更新，别拿它判断元素活没活。`phase` 由可见性判定写入，而跟随滚动的元素不走这套判定，所以没人写它。唯一的例外是纯 `loopAnimation` 元素，会被设成 `'entered'`。其余元素停在初始的 `'idle'`，画面本身照常跟随滚动。

这条对 canvas 自绘尤其危险。常见写法是「订阅 `timeline.phase`，在 `exited` / `idle` 时暂停 rAF（requestAnimationFrame）」。在锁定区里照做，循环一启动就暂停，而且再不恢复，一帧都不画。

改法：锁定区内用 `signedProgress` 判断（0 表示未开始、正值表示跟随滚动中、负值表示退场中），或者看 `frame.source`（`'scroll'` 即元素跟随滚动）。锁定区外（或 `timeline.driver: 'clock'`）的 `phase` 六态照常可用，见 [Animate 时间轴](/docs/02-timeline)。

## 3. 声明了 zone 却什么都不锁

Scene 写了 `scroll={{ zoneId }}`，滚动一路穿过，`onZoneEnter` / `onZoneLeave` 一次不发。注意 `onZoneProgress` 会在首帧发一次 `progress: 0`，它不能说明 zone 生效。

原因是预算为 0。只有带 authored `enterAnimation` 或 `exitAnimation` 的 `Animate` 会注册 zone 预算；子元素全是 `loopAnimation` 的 zone 总预算为 0，而只有段长超过 0.5px 的段才参与锁定。没有段就没有锁、没有回调，wrapper 退回视觉高度，整个场景等同普通 section。

改法：至少给一个子元素写 `enterAnimation` + `duration.enter`，把预算拉起来。只想要循环动效的场景本来就不需要声明 zone。预算规则见 [zone 与滚动预算](/docs/02-zones-budget)。

## 4. goToZone 的 align 不起作用

调 `goToZone(id, { align: 'center' })`，页面停下的位置不是 zone 中点。

`align` 在公共类型里存在，实现直接丢弃。跳转总是停在 `centerLockOffset`，也就是这个 zone 的**进度 0**（sticky 刚开始钉住的位置）。这一格是公共类型与实现不一致的地方。

改法：把 `goToZone` 理解成「跳到 zone 开头，从头播」。要停在 zone 中段，得自己算 `centerLockOffset + 预算 / 2` 再调原生 `scrollTo`；那样会绕开框架的段内语义，不推荐。

## 5. zoneTrigger 和 trigger 写了没反应

改 `zoneTrigger` 或 `Scene.scroll.trigger`，行为完全没有变化。

两个字段都会被解析，但解析结果从未被读取。`center-lock` 是唯一实现的行为，也是两者的默认值。

改法：当它们是占位。判断一个场景是不是锁定区，只看有没有 `scroll` 这个 prop 对象，`trigger` 写不写都一样。

## 6. 每帧数值在 render 里读到的是旧值

在 render 里读 `sceneProgress` / `enterProgress` / `progressPx`，数字要么不动，要么落后好几帧；同一个量绑到 motion style 上却是准的。

这是刻意的性能取舍。每帧都变的量不参与 React 快照的变更判断：`visualViewportOffset`、`sceneProgress` / `enterProgress` / `exitProgress`、zone 的 `progressPx` 都被排除在外。否则每滚一个像素，整棵 Scene 子树都要重渲染。代价就是 render 路径上这些字段是旧值。

改法：每帧数值只从 MotionValue 读。子组件里用 `useAnimateTimeline()` 拿 `progress` / `signedProgress` / `frame`（不经过 React 渲染管线），根级用 `onZoneProgress` 回调。不要把连续进度存进 `useState`。见 [useAnimateTimeline](/docs/09-use-animate-timeline) 与[性能](/docs/01-performance)。

## 7. onVisibilityChange 在 scroll 下每帧都触发

在 `Scene.callbacks.onVisibilityChange` 里做点事，滚动时明显掉帧。

scroll 下这个回调**逐滚动帧触发且不去重**：`visible` 与 `progress` 没变也照发。子树不会因此重渲染（这是设计），但回调本身每帧都跑，里面的任何 `setState`、DOM 读写、布局测量都会按帧放大。

改法：回调里只做常数时间的纯计算，或者自己做阈值去重（`visible` 变化时才动作、`progress` 变化超过某个量才动作）。需要连续进度驱动视觉的，改走 MotionValue，不要用这个回调。

## 8. 场景进度在锁定期间停住

期待 `onVisibilityChange` 的 `progress` 在锁定期间继续推进，实际它冻在某个值上。

zone active 期间，场景级时间轴的视口偏移被钉在 `centerLockOffset`（画面确实没动，这是 center-lock 的定义）。场景级 `enterProgress` / `exitProgress` / `sceneProgress` 全是这个偏移的函数，于是整条场景时间轴在锁定期间冻结。两条时间轴在这里分工明确：**场景级时间轴描述场景在文档流里的位置，zone 时间轴描述锁定段内的进度。**

改法：锁定期间的进度从 zone 侧读：根级 `onZoneProgress`，或 zone 内元素的 `useAnimateTimeline().progress`。场景级回调留给「这一屏进了视口没有」这类判断。

## 相关页面

- [center-lock 滚动接管](/docs/01-centerlock)：段几何、纯函数进度、防跳过
- [zone 与滚动预算](/docs/02-zones-budget)：预算如何由子元素时长累加得出，phase 如何改写窗口
- [四条输入路径](/docs/03-inputs)：键盘劫持与嵌套滚动容器
- [排错](/docs/07-common-pitfalls)：跨模式共通的故障
