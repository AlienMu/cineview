---
title: Scene 可见性与输入
eyebrow: CONCEPTS / STATES
---

场景是否可见、处于哪个转场阶段，会影响内容能否响应输入，以及 Animate 的循环动画是否运行。

## 场景活动与输入

| 场景情况          | 指针输入 |
| ----------------- | -------- |
| 尚未进入活动状态  | 关闭     |
| 正在入场          | 开启     |
| 可见且已稳定      | 开启     |
| 正在执行退场动画  | 开启     |
| 被其他 Scene 覆盖 | 关闭     |
| 已超出滚动范围    | 关闭     |

非活动内容也受框架的无障碍规则约束。场景恢复可交互状态后，重新接收指针输入。

## 持续动画何时停止

`loopAnimation` 仅在元素可见且处于可播放阶段时运行。场景进入非活动状态、被覆盖、超出范围或开始退场时，循环会暂停。

CSS 动画不会自动跟随这些条件。需要动效随场景停止时，使用 `loopAnimation`，详见 [Animate](/docs/03-animate)。

## scroll 场景的转场

| 滚动阶段             | 场景行为                                   |
| -------------------- | ------------------------------------------ |
| 入场                 | Scene 进入                                 |
| 已声明退场动画的离场 | Scene 执行退场                             |
| 未声明退场动画的离场 | Scene 进入被覆盖状态                       |
| 主要可见区间         | 当前 Scene 接收输入，被覆盖的 Scene 不接收 |
| 超出区间             | Scene 不再响应交互                         |

没有退场动画的 Scene 直接进入被覆盖状态。上层 Scene 也可能在其滚动范围结束前覆盖它。

## 观察可见性

通过 `Scene.callbacks.onVisibilityChange` 读取 `visible` 和 `progress`。根级的 `onSceneVisibilityChange` 提供同类信息。

这些回调描述场景可见性，不表示所有子元素动画都已完成。单个 Animate 的进度和阶段通过 [useAnimateTimeline](/docs/09-use-animate-timeline) 读取，锁定区的滚动进度使用 `onZoneProgress`。

## 相关页面

- [Animate 时间线](/docs/02-timeline)：元素阶段与驱动方式
- [可见性条件](/docs/03-visibility-conditions)：按时间入退场的触发条件
- [DOM 与布局](/docs/06-dom-contract)：指针事件与层叠
- [排错](/docs/07-common-pitfalls)：循环动画持续运行的问题
