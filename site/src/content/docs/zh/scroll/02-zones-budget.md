---
title: zone 与滚动预算
eyebrow: SCROLL / BUDGET
---

zone 的锁定行程由子元素的动画时长累加得出，没有哪个 prop 直接设定它。本页讲这笔预算的算法，以及会让预算归零或整个改写的几种写法。

## 1ms = 1px

锁定区的时间预算换算率写死为 1，px 字段与 ms 字段数值上是同一个数。`duration={{ enter: 2000 }}` 意味着观众要真实滚过 2000px 才走完这个元素的入场。

zone 总预算取所有已注册元素的时间轴终点最大值，再乘换算率：

| 量              | 规则                                                   |
| --------------- | ------------------------------------------------------ |
| `enterDuration` | 强制最小 1ms/1px。写 `duration: { enter: 0 }` 仍占 1px |
| `exitDuration`  | 没写 `exitAnimation` 时按 0 计，不占预算               |
| 元素终点        | `delay`（含 `after` 链累加）+ enter + exit             |
| `totalBudgetPx` | 所有元素终点的最大值，`> 0` 时至少 1px                 |

`duration.enter` 与 `duration.exit` 两个默认值都是 600。

## 零预算等于零锁定

只有段长超过 0.5px 的段进入 center-lock 钳，而段长就是 `totalBudgetPx`。预算为 0 的 zone 因此完全不参与锁定：wrapper 退回视觉高度，滚动一路穿过，`onZoneEnter` / `onZoneLeave` **一次都不发**；`onZoneProgress` 只在首帧发一次 `progress: 0`，之后静默。

预算归零最常见的原因不是把时长写成 0，而是没有元素去注册预算：只有带 authored `enterAnimation` 或 `exitAnimation` 的 `Animate` 才注册。子元素全是 `loopAnimation` 的 Scene 会静默退化成普通 section：你以为自己声明了 zone，实际什么都没锁。

```tsx
{
  /* 声明了 zone，但预算是 0，行为等同普通 section */
}
<Scene sceneId="loop" scroll={{ zoneId: 'loop' }}>
  <Animate animateId="pulse" loopAnimation="pulse">
    <div className="dot" />
  </Animate>
</Scene>;
```

要真的锁住，至少给一个元素写 `enterAnimation` + `duration.enter`。

## phase 会改写窗口

`timeline.phase: { start, end }` 是把元素跟随滚动的区间钉在 zone 进度的某一段上。它有两个容易误判的后果。

**分数一经声明就是 zone 相对，不是元素相对。** 没写 `phase` 时窗口取元素自身的 `[enterStartPx, enterEndPx]`；写了 `phase` 之后窗口换成 `[0, totalBudgetPx]`，`phase: { start: 0.5 }` 的意思是「整个 zone 预算的一半处」，不是「自身入场走到一半」。

**写了 `phase` 的元素，它的 authored exit 会被搬到 zone 尾部。** 计算方式是 `exitEndPx = totalBudgetPx`、`exitStartPx = max(phaseEndPx, totalBudgetPx - exitDurationPx)`。也就是退场总在整个 zone 的最后收尾，`duration.exit` 只剩下一个「尾窗至少 1px」的意义，不再表示退场跨度。想让退场在 zone 中段发生，就不要给这个元素写 `phase`。

窗口终点还有一条兜底：`phaseEndPx` 至少是 `phaseStartPx + 1`，零宽窗口不存在。

## after 链的锚点

zone 内的 `after` 在编译期折叠成累加 delay（这是跟滚动走的元素的规则，完整版见[时间线](/docs/04-orchestration)）。锚点选的是 leader 的入场窗口关闭点，不是它的退场：

```text
follower.start = leader.phaseEndPx + follower.delay
```

选入场而不选退场，是为了让总长算得出来。leader 写了 `phase` 时退场被钉在 zone 末尾，而 zone 末尾又由所有元素的终点决定。锚在那里，「zone 总长」就要用自己的答案来算自己，解不出来。锚在入场关闭点，链是有界的：follower 起点落在 leader 的 zone 尾退场之前，两者视觉上重叠，但预算有限。

窗口终点参与 zone 总长，总长又决定窗口终点，所以带 `phase` 的 zone 要靠迭代逼近一个确定值。`phase.end` 小于 1 时迭代能稳定下来；`phase.end: 1` 时没有稳定解，follower 会一路堆到 zone 末尾之外，只靠迭代上限兜住。要长窗口就写 `phase.end: 0.95` 这类留余量的值，别写满 1。

## zone 身份

| 来源            | 优先级 | 说明                                                      |
| --------------- | ------ | --------------------------------------------------------- |
| `scroll.zoneId` | 最高   | 显式声明                                                  |
| `sceneId`       | 次之   | 没写 `zoneId` 时直接当 zone id 用                         |
| 自动 id         | 兜底   | 形如 `scene-zone-<实例 id>`，实例级、跨渲染稳定但不可预测 |

两个都没写就落到自动 id：zone 能正常工作，但你没法用 `goToZone` 定位它，也没法在 `timeline.zoneId` 里引用它。想程序化跳转或跨 Scene 指定归属，就得写出 authored 身份。

重复 zoneId 的后来者被降级。 根组件按文档顺序做预检，第一个声明该 id 的 Scene 是所有者；之后同 id 的 Scene 会被 `cloneElement` 剥掉 `scroll` prop，当普通流场景渲染。

这次拒绝会通过 `onError` 报 `INVALID_COMPONENT_HIERARCHY`（`reason: 'duplicate-scroll-zone'`，context 里带所有者与被拒者的 sceneIndex），dev 下另有 console 输出。视觉上就是「其中一个 zone 不锁了」，去看 `onError` 就能对上。

## 场景尺寸的两套规则

`sceneSizing` 有 `'content'`（默认）与 `'screen'` 两个值，只作用于非锁定区场景：`'screen'` 给它们补一个视口的最小跨度，`'content'` 让内容自己撑。锁定区场景两个值下行为完全一样。

锁定区场景的尺寸解析另有一条强制规则：**绝对 px 尺寸被丢弃**。单一换算基准模型下不存在独立的高度基准，所以 `layout.height: 800` 与 `layout.height: '800px'` 一律不换算，回退到 DOM 实测跨度。只有 `vh` / `vw` 存活（并向下取整到至少 1px）。想精确控制锁定区视觉盒的主轴尺寸，用视口相对单位。

还有一条：**锁定区场景是被视口裁剪的，不是可滚动的**。视觉壳带 `maxHeight: 100vh` + `overflow: hidden`，内容层用一个补偿 `translateY` 把中心对齐回来。超出一屏的内容围绕垂直中心被裁掉两头，不会出现内层滚动条。锁定区里放长内容要么自己分段，要么改用普通流场景。

## 相关页面

- [center-lock 滚动接管](/docs/01-centerlock)：段的几何与防跳过钳
- [时间线](/docs/04-orchestration)：`after` 两种语义的完整规则
- [Animate 时间轴](/docs/02-timeline)：`timeline.*` 各字段语义
- [scroll 排错](/docs/06-scroll-pitfalls)：零预算与 phase 的常见故障
