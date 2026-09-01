---
title: zone 与滚动预算
eyebrow: SCROLL / BUDGET
---

锁定区（zone）的滚动距离由子元素声明的动画时长累加得出。本页说明预算计算、时间轴区间映射和零预算行为。

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

仅当锁定段长度超过 0.5px（即 `totalBudgetPx > 0.5`）时才触发 center-lock 边界约束。预算为 0 的锁定区不产生停留行程：wrapper 回退至视觉高度，滚动连续穿过，`onZoneEnter` 与 `onZoneLeave` 不触发，`onZoneProgress` 仅在初始帧派发一次 `progress: 0`。

仅显式声明了 `enterAnimation` 或 `exitAnimation` 的 `Animate` 节点会注册时间预算。若 Scene 内部仅包含 `loopAnimation`，总预算为 0，场景将作为常规流式 section 渲染。

```tsx
{
  /* 声明了 zone 但未提供入场/退场时长，预算为 0，作为普通 section 渲染 */
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

以入场完成点作为连接基准可保证依赖链具备确定解。当配置 `phase` 时，建议将 `phase.end` 设为 `0.95` 等预留余量的值，以便后续依赖元素在有限预算内完成排布。

## zone 身份

| 来源            | 优先级 | 说明                                                      |
| --------------- | ------ | --------------------------------------------------------- |
| `scroll.zoneId` | 最高   | 显式声明                                                  |
| `sceneId`       | 次之   | 没写 `zoneId` 时直接当 zone id 用                         |
| 自动 id         | 兜底   | 形如 `scene-zone-<实例 id>`，实例级、跨渲染稳定但不可预测 |

两个都没写就落到自动 id：zone 能正常工作，但此时无法使用 `goToZone` 定位它，也无法在 `timeline.zoneId` 里引用它。想程序化跳转或跨 Scene 指定归属，就得写出 authored 身份。

重复 `zoneId` 的后续场景会被自动降级。根组件按文档顺序执行校验，首个声明该 id 的 Scene 获得所有权；后续同名 Scene 的 `scroll` 配置将被移除，并作为常规流场景渲染。

发生降级时，框架通过 `onError` 回调派发 `INVALID_COMPONENT_HIERARCHY`（`reason: 'duplicate-scroll-zone'`），开发环境下同时输出提示信息。

## 场景尺寸的两套规则

`sceneSizing` 包含 `'content'`（默认）与 `'screen'` 两种模式，仅作用于常规流场景：`'screen'` 为其设置视窗高度的最小跨度，`'content'` 则完全由内容高度决定。锁定区场景在此两种设置下的行为一致。

在锁定区场景中，`layout.height` 的绝对 px 数值不参与计算，统一回退为 DOM 实测尺寸；若需精确控制锁定区视觉盒高度，应使用 `vh` 或 `vw` 等视窗相对单位。

锁定区视觉壳设置了 `maxHeight: 100vh` 与 `overflow: hidden`，超出单屏的内容在垂直方向被裁切，不会生成内部滚动条。超长内容建议拆分为多个连续场景或使用常规流式场景承载。

## 相关页面

- [center-lock 滚动](/docs/01-centerlock)：锁定几何与边界约束
- [时间线](/docs/04-orchestration)：`after` 两种语义的完整规则
- [Animate 时间轴](/docs/02-timeline)：`timeline.*` 各字段语义
- [scroll 排错](/docs/06-scroll-pitfalls)：零预算与 phase 的常见故障
