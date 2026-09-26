---
title: 锁定区与时长预算
eyebrow: SCROLL / BUDGET
---

锁定区的滚动距离由最晚结束的子元素动画决定。动画时长、延迟和 `after` 依赖都计入这个时长预算。

## 1ms = 1px

`duration={{ enter: 2000 }}` 对应 2000 px 的真实滚动距离。`designWidth` 与视窗尺寸不会缩放这段距离。

| 配置 | 计算规则 |
| --- | --- |
| `duration.enter` | 默认 600 ms，至少占 1 px；显式设置 0 也占 1 px |
| `duration.exit` | 默认 600 ms；声明了 `exitAnimation` 才计入预算 |
| 元素结束时间 | 开始延迟 + 入场时长 + 退场时长 |
| 锁定区总预算 | 所有参与元素结束时间的最大值 |

只有跟随场景的入场和退场动画计入预算。`timeline.driver: 'clock'` 和循环动画不增加锁定距离。

## 用 after 排列预设动画

```tsx
<Scene sceneId="details" scroll={{ zoneId: 'details' }}>
  <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 600 }}>
    <h2>产品细节</h2>
  </Animate>
  <Animate
    animateId="description"
    enterAnimation="slide-up"
    duration={{ enter: 400 }}
    timeline={{ after: 'title', delay: 100 }}
  >
    <p>标题出现后，再显示说明。</p>
  </Animate>
  <AnimateVideo
    src="/product.mp4"
    duration={{ enter: 2000 }}
    timeline={{ after: 'description' }}
    aria-label="产品演示"
  />
</Scene>
```

标题占 600 px，随后等待 100 px，说明占 400 px，最后视频占 2000 px。锁定区总预算为 3100 px。

**跟随元素在前序入场完成后，加上自身延迟开始。** 例如前序入场 600ms、退场 400ms，未配置延迟的跟随元素从 600px 开始。有 `phase` 时，使用前序实际入场区间的终点。退场仍计入锁定区总预算。

元素有后续动画或退场时，`phase.end` 需要小于 1，为它们留出滚动距离。依赖规则见[时间线](/docs/04-orchestration)，单个元素组合多个预设见[动画预设](/docs/08-presets)。

## 用 phase 指定入场区间

`timeline.phase: { start, end }` 按锁定区总进度指定入场区间。例如 `{ start: 0.5, end: 0.8 }` 让元素在锁定区的 50% 到 80% 之间入场。

配置了 `phase` 的元素，其退场结束时间对齐锁定区末尾。需要在区间中段退场时，使用 `delay` 与 `duration` 配置时间，省略 `phase`。

计算后的入场区间至少长 1 px。`phase` 的比例值按整个锁定区计算，省略的端点保留该元素原本的时间设置。与 `after` 同时使用时，入场起点不会早于前序入场完成加上自身延迟的位置。

声明了退场时，预算还会为退场留出至少 1 px。若某个 `phase` 无法在有限预算内完成，Cineview 会报告 `INVALID_ANIMATION` 并忽略该项 `phase`，保留 `duration`、`delay` 和 `after`。例如 `phase.end: 1` 无法为后续动画或退场留出距离；`phase.start: 1` 则无法容纳入场本身。

## 只有循环动画时不产生锁定距离

仅含循环动画的 Scene，时长预算为零。场景仍占据其可见尺寸与一个视窗尺寸中的较大值，但没有额外动画距离。

此时 `onZoneProgress` 报告初始零进度，`onZoneEnter` 和 `onZoneLeave` 不触发。要让滚动推进动画，为至少一个子元素配置入场或退场动画。

## 为锁定区设置标识

| 来源 | 优先级 | 说明 |
| --- | --- | --- |
| `scroll.zoneId` | 最高 | 显式设置锁定区标识 |
| `sceneId` | 次之 | 未设置 `zoneId` 时使用 |
| 自动标识 | 最后 | 由 Scene 生成 |

使用 `goToZone` 时，显式设置 `scroll.zoneId` 或 `sceneId`。子元素动画使用所属 Scene 的区域。

多个 Scene 使用相同标识时，第一个保留锁定区。后续重复项作为普通场景渲染，并通过 `onError` 报告 `INVALID_COMPONENT_HIERARCHY`。开发构建也会提示。

## 普通场景与锁定区的尺寸

`sceneSizing` 只影响未声明 `scroll` 的普通场景。默认的 `'content'` 按内容确定尺寸；`'screen'` 使滚动方向上的尺寸至少为一个视窗。

锁定区可用 `vh` 或 `vw` 明确可见尺寸。其他长度使用 Scene 的 DOM 实测尺寸。`sceneSizing` 不改变锁定区的尺寸规则。

锁定区会裁切超出视窗的内容。长篇阅读内容适合放在普通场景，或拆成多个场景。

## 相关页面

- [center-lock 滚动](/docs/01-centerlock)：滚动位置与进度
- [时间线](/docs/04-orchestration)：不同驱动方式下的依赖规则
- [Animate 时间线](/docs/02-timeline)：时间设置与进度区间
- [scroll 排错](/docs/06-scroll-pitfalls)：没有锁定或进度不更新
