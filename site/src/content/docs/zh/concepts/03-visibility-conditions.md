---
title: 可见性条件
eyebrow: CONCEPTS / VISIBILITY
---

scroll 模式下，锁定区外的元素默认使用可见性条件。在锁定区内设置 `timeline.driver: 'clock'`，也会采用同一行为。元素在满足入场条件前保持初始帧，满足后按配置的时长播放。

滚动决定动画何时开始，播放时长不随滚动速度改变；实际帧率仍受浏览器负载影响。

## 六种生命周期状态

| 状态       | 含义                                    |
| ---------- | --------------------------------------- |
| `idle`     | 尚未排上，且永不退场                    |
| `waiting`  | 进场条件已满足，在等 `after` 或 `delay` |
| `entering` | 入场补间进行中                          |
| `entered`  | 入场完成                                |
| `exiting`  | 退场补间进行中                          |
| `exited`   | 退场完成                                |

处于 `idle` 的元素不会退场，因此从视窗外接近的内容可以先入场，再参与退场判定。

## 判定几何

判定条件基于元素相对滚动容器的几何位置。设 `vh` 为容器高度：

```text
进场条件：relTop >= 0 && relBottom <= vh - enterMargin
退场条件：relTop <= exitMargin  ||  relBottom >= vh - exitMargin
```

进场要求元素完全进入可视区域，且底边距视窗底端保持 `enterMargin` 的预留边距。退场判定分为对称的两项：顶边接近视窗顶端（正向滚动向上离场），或底边接近视窗底端（反向滚动向下离场）。

`enterMargin` 与 `exitMargin` 采用设计 px 作为单位，经由 `scale = viewportWidth / designWidth` 映射为物理像素后参与几何计算。默认值为 50，具备三级回落机制：单个 `Animate` 的 `visibility.enterMargin` → 根组件的 `enterMargin` → 50。

## 状态防抖区间

当 `relTop ∈ [0, exitMargin]` 时，入场与顶部退场条件存在重叠。

两项条件同时满足时，元素保持当前阶段。越过重叠范围后开始入场，跨过另一侧边界后开始退场。

## 超高元素判定规则

当元素高度超出 `vh - enterMargin` 时，无法同时满足标准进场几何条件。此类元素自动采用高度适配规则：

```text
进场：relTop <= vh / 2        （顶边越过视窗中线）
退场：relBottom <= vh * 0.7   （底边升过视窗 70%）
```

这两项条件的重叠范围较大。当元素高度超出视窗时，在重叠区间内退场判定优先（退场条件满足时阻止进场触发），以确保离场过程平稳完成。

## 未声明 exitAnimation 时的表现

未声明 `exitAnimation` 时，元素入场后保持 `entered`。移出视窗不会重置动画，`visibility.replay` 对此也不生效。

需要元素退场后再次播放时，声明退场动画。

显式声明 `exitAnimation` 且设置 `duration.exit: 0` 时，满足退场条件就立即切换状态。解析后非空的退场配置与大于零的退场时长也会启用退场判定。

## 首屏与首帧的两个特例

**首屏冷启动就绪约束**：场景 0 的元素在首屏关键资源加载就绪前保持在初始帧。该约束适用于所有模式。此外，首屏初次计算时会自动放宽底部边距，确保紧贴视窗边缘的引导元素能顺利入场。

**首帧已处于视窗上方**：若元素在初始测量时底边已位于视窗上方（`relBottom <= 0`），元素将直接就绪于入场完成态，跳过入场补间。页面在非顶部位置刷新时，上方元素保持静止呈现，避免全量重播。

## replay

默认 `true`。它只影响 `exiting` / `exited` → 进场这条迁移：元素退场后再次满足进场条件时是否重播。

对「无 `exitAnimation`」的元素它没有意义，因为那类元素根本不会进入 `exited`。

## 相关页面

- [Animate 时间线](/docs/02-timeline)：phase 的读取方式与元素驱动来源
- [时间线](/docs/04-orchestration)：可见性驱动时 `after` 如何等待前置元素完成
- [运行态](/docs/07-runtime-states)：场景运行态如何控制连续动画
- [Animate](/docs/03-animate)：`visibility.*` 属性完整说明
