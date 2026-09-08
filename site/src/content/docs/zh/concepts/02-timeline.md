---
title: Animate 时间线
eyebrow: CONCEPTS / TIMELINE
---

`Animate` 通过 `timeline` 选择进度来源与播放时序。`phase` 表示动画阶段，支持手动控制的动画还可通过 ref 触发入场或退场。

## phase：六种生命周期状态

| phase      | 含义                           |
| ---------- | ------------------------------ |
| `idle`     | 静止，尚未排上                 |
| `waiting`  | 已排上，在等 `delay` / `after` |
| `entering` | 入场进行中                     |
| `entered`  | 入场完成                       |
| `exiting`  | 退场进行中                     |
| `exited`   | 退场完成（replay 前的静止）    |

render-prop children 以 React 数值的形式接收 `{ enterProgress, phase }`。后代组件可调用 `useAnimateTimeline()`，获取更新时不触发 React 渲染的 MotionValue。详见 [useAnimateTimeline](/docs/09-use-animate-timeline)。

scroll 锁定区内跟随场景进度的入退场动画，其 `phase` 保持为 `idle`，进度仍随滚动变化。独立计时元素使用可见性阶段；仅配置循环动画的元素处于 `entered`。drag 模式可通过 phase 区分入场与退场。

## driver：驱动来源

`timeline.driver` 可取 `'scene'`（默认）或 `'clock'`，在不同模式中的行为如下：

| driver    | 环境                           | 驱动                                                 |
| --------- | ------------------------------ | ---------------------------------------------------- |
| `'scene'` | scroll 锁定区内（继承 zoneId） | 跟随锁定区的滚动位置，可配 `timeline.phase` 限定区间 |
| `'scene'` | scroll 锁定区外                | 由可见性条件触发                                     |
| `'scene'` | drag                           | Scene 共享元素时间轴驱动（跟随手势）                 |
| `'clock'` | scroll                         | 独立按时间播放，由可见性条件触发，锁定区内也相同     |
| `'clock'` | drag                           | Scene 到场后按真实时间独立播放                       |

drag 模式下，`driver: 'clock'` 在 Scene 到达后开始播放。它不参与 `after` 依赖，自身时长不计入场景元素总时长，也不执行 `exitAnimation`。

## delay、after 与 phase 区间

- `timeline.delay`（ms)：入场前的等待时长，加在 `after` 链之后。
- `timeline.after`：指向另一个 `animateId` 的时序依赖。指向不存在的 id 报 `INVALID_ANIMATION`；形成循环依赖报 `CIRCULAR_DEPENDENCY`。
- `timeline.zoneId`：显式指定隶属的锁定区。
- `timeline.phase: { start, end }`：让元素在锁定区进度的指定范围内播放，仅适用于 scroll 锁定区内使用 `driver: 'scene'` 的动画。

`after` 控制入场顺序，只有设计需要时才另行配置有序退场。入场级联不会自动生成退场顺序，详见[时间线](/docs/04-orchestration)。

## enterRef / exitRef：手动触发

ref 中保存触发函数，调用 `ref.current?.()` 使用。

可见性驱动的 scroll 动画支持两个 ref，包括锁定区内设置了 `driver: 'clock'` 的元素。drag 的 `driver: 'clock'` 只支持 `enterRef`。跟随场景的 drag 动画和跟随锁定区进度的动画会忽略两个 ref，并报告 `INVALID_ANIMATION`。

支持 `enterRef` 时：

- 调用后立即入场，并中断正在等待的触发。
- 在该动画支持相应选项的前提下，声明的 `after` 依赖或大于零的 `timeline.delay` 仍可自动触发入场。
- 没有自动触发条件时，入场必须由手动调用开始。

支持 `exitRef` 时，传入该 ref 会关闭自动退场。调用后立即退场，并中断尚未完成的入场；退场没有延迟兜底。场景的挂载与可见性规则仍然适用，ref 不会让内容在所属场景离开后继续显示。

完整 props 表见 [Animate 参考](/docs/03-animate)。
