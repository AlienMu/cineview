---
title: 锁定区与时长预算
eyebrow: SCROLL / BUDGET
---

锁定区的时长预算取子元素动画最晚结束的位置，时长、延迟和依赖都会影响该位置。

## 1ms = 1px

锁定区的时间与滚动距离换算率固定为 1（1ms = 1px）。例如 `duration={{ enter: 2000 }}` 表示用户需滚动 2000px 的物理距离以完成该元素的入场动画。

锁定区总预算取所有已注册元素时间轴终点的最大值：

| 量              | 规则                                                   |
| --------------- | ------------------------------------------------------ |
| `enterDuration` | 最小为 1ms/1px。声明 `duration: { enter: 0 }` 仍占 1px |
| `exitDuration`  | 未声明 `exitAnimation` 时按 0 计算，不占预算           |
| 元素终点        | `delay`（含 `after` 链累加）+ enter + exit             |
| `totalBudgetPx` | 所有元素终点的最大值，`> 0` 时至少 1px                 |

`duration.enter` 与 `duration.exit` 的默认值均为 600。

## 零预算退化机制

预算为零时，不增加动画行程。场景仍占据视觉跨度与一个视窗中的较大值。`onZoneEnter` 和 `onZoneLeave` 不触发，`onZoneProgress` 报告初始零进度。只有长度超过 0.5px 的区间参与防跳过限制。

跟随场景的元素在声明入场或退场动画时注册时长预算，仅有循环动画的 Scene 不产生动画预算。

```tsx
{
  /* 仅包含循环动画的锁定区没有额外动画行程。 */
}
<Scene sceneId="loop" scroll={{ zoneId: 'loop' }}>
  <Animate animateId="pulse" loopAnimation="pulse">
    <div className="dot" />
  </Animate>
</Scene>;
```

若需启用滚动锁定，应至少为其中一个子元素配置 `enterAnimation` 与 `duration.enter`。

## timeline.phase 映射规则

`timeline.phase: { start, end }` 用于将元素的动画进度映射至锁定区的指定比例区间。

声明 `phase` 时，起始和结束数值相对于整个锁定区总预算（`[0, totalBudgetPx]`），而非该元素自身的时长。例如 `phase: { start: 0.5 }` 表示在整个锁定区进度达到 50% 时启动入场。

配置了 `phase` 的元素，其退场动画默认对齐至锁定区末尾（`exitEndPx = totalBudgetPx`，`exitStartPx = max(phaseEndPx, totalBudgetPx - exitDurationPx)`）。若希望退场动画在锁定区中段执行，请通过标准 `delay` 与 `duration` 设置时序，而非使用 `phase`。

引擎对区间终点施加保底约束：`phaseEndPx` 始终不小于 `phaseStartPx + 1`。

## after 链的连接基准

在跟随滚动的锁定区内，`after` 依赖在编译期折叠为累加延迟。连接基准选取前序元素的入场完成点：

```text
follower.start = leader.phaseEndPx + follower.delay
```

`after` 跟随元素从前序入场终点开始。前序使用 `phase` 时，可将结束比例设为小于 1 的数值，例如 0.95，为后续元素预留空间。

## 锁定区标识

| 来源            | 优先级 | 说明                                    |
| --------------- | ------ | --------------------------------------- |
| `scroll.zoneId` | 最高   | 显式声明                                |
| `sceneId`       | 次之   | 未设置 `zoneId` 时，用作锁定区标识      |
| 自动标识        | 兜底   | 由 Scene 自动生成，需要导航时应显式声明 |

需要使用 `goToZone`，或将 Animate 显式绑定到锁定区时，设置 `scroll.zoneId` 或 `sceneId`。

多个 Scene 声明相同标识时，第一个保留锁定区，后续重复项作为普通场景渲染，并通过 `onError` 报告 `INVALID_COMPONENT_HIERARCHY`；开发构建还会提示。

## 场景尺寸的两套规则

`sceneSizing` 包含 `'content'`（默认）与 `'screen'` 两种模式，仅作用于常规流场景：`'screen'` 为其设置视窗高度的最小跨度，`'content'` 则完全由内容高度决定。锁定区场景在此两种设置下的行为一致。

锁定区可通过 `vh`、`vw` 等视窗单位明确视觉跨度。其他声明长度使用 Scene 的实际 DOM 测量尺寸。

视觉容器会裁切超出视窗的内容，长篇阅读内容适合放在普通场景中，或拆成多个场景。

## 相关页面

- [center-lock 滚动](/docs/01-centerlock)：锁定几何与边界约束
- [时间线](/docs/04-orchestration)：`after` 两种语义的完整规则
- [Animate 时间轴](/docs/02-timeline)：`timeline.*` 各字段语义
- [scroll 排错](/docs/06-scroll-pitfalls)：零预算与 phase 的常见故障
