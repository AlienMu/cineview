---
title: center-lock 滚动
eyebrow: SCROLL / CENTER-LOCK
---

Scene 的 `scroll` 声明锁定区。动画时长预算大于零时，场景保持居中，由滚动推进动画；区间结束后，场景继续随内容移动。支持的触发方式为 `center-lock`。

## center-lock 的定位机制

锁定区由预留滚动空间的外层元素、sticky 视觉容器及内容组成。竖向公式使用 `scrollTop`，横向则对应宽度与 `scrollLeft`。

| 量                 | 公式                                                     | 含义                          |
| ------------------ | -------------------------------------------------------- | ----------------------------- |
| `visualSpan`       | 声明的 `vh`/`vw` 跨度，否则 DOM 实测                     | 视觉盒主轴尺寸                |
| `centerLockOffset` | `max(sceneStart + visualSpan / 2 - viewportSpan / 2, 0)` | sticky 开始钉住的 `scrollTop` |
| `segmentStart`     | `centerLockOffset`                                       | 锁定段起点                    |
| `segmentEnd`       | `centerLockOffset + totalBudgetPx`                       | 锁定段终点                    |

超屏场景（视觉盒高度大于视窗高度）通过 wrapper 的 `paddingTop` 调整视觉容器位置；不足屏场景则通过视觉容器自身的 `top` inset 对齐。两种情形均计算出相同的 `centerLockOffset`。

## 滚动距离从哪来

外层元素为可见内容与动画行程预留空间：

```text
flowSpan = max(visualSpan, viewportSpan) + timelineDistancePx
```

`timelineDistancePx` 为按 `1ms = 1px` 换算的动画时长预算。预算为零时没有动画行程，但外层仍占据视觉跨度与视窗跨度中的较大值。详见[锁定区与时长预算](/docs/02-zones-budget)。

```tsx
<CineView designWidth={750} mode="scroll" direction="y">
  <Scene sceneId="hero-seq" scroll={{ zoneId: 'hero-seq', trigger: 'center-lock' }}>
    <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 800 }}>
      <h1>锁定段内随滚动进场</h1>
    </Animate>
  </Scene>
</CineView>
```

这段 JSX 的锁定区占用 800px 滚动距离，对应标题动画从 0 到 1 的完整进度。

## 从滚动位置计算进度

竖向滚动中，`nativeOffset` 为 `scrollTop`；横向则为 `scrollLeft`：

```text
progressPx = clamp(nativeOffset - segmentStart, 0, totalBudgetPx)
```

反向滚动时，进度沿同一区间递减。尺寸或布局变化会重新计算区间几何，进度根据调整后的位置更新。

段的两端各有 0.01px 的吸附：进度落在端点附近时直接取 0 或满值，避免浮点残差让最后一帧永远差一点。

## 防跳过拦截机制

快速甩动（flick）或长按键盘可能产生远大于锁定段长度的滚动增量。引擎在更新 `scrollTop` 之前执行防跳过边界拦截，规则按方向对称处理：

| 情形                       | 最终位置                            |
| -------------------------- | ----------------------------------- |
| 正向从段外一跃跨过整段     | `min(segmentStart + 1, segmentEnd)` |
| 正向已在段内、目标越过段尾 | 精确对齐到 `segmentEnd`             |
| 反向从段外一跃跨过整段     | `max(segmentEnd - 1, segmentStart)` |
| 反向已在段内、目标越过段首 | 精确对齐到 `segmentStart`           |

当快速正向划过整个区间时，目标位置被约束为 `segmentStart + 1`，确保画面展示锁定段初始帧而非直接跳过。锁定段外部的普通滚动不受此约束影响。

仅段长超过 0.5px 的区间参与该项边界约束。程序化滚动（`goToScene` / `goToZone`）不执行防跳过拦截，具体原因见程序化跳转章节。

## 程序化跳转

`goToZone` 是 scroll 专属的 ref 方法：

```tsx
const ref = useRef<CineViewScrollRef>(null);

<CineView mode="scroll" ref={ref}>
  {/* ... */}
</CineView>;

ref.current?.goToZone('hero-seq', { animated: true });
```

| 选项       | 类型       | 默认   | 说明                              |
| ---------- | ---------- | ------ | --------------------------------- |
| `animated` | `boolean`  | `true` | true 请求平滑滚动，false 立即定位 |
| `align`    | `'center'` | 无     | 唯一可用值，目标始终是锁定区起点  |

跳转目标位置始终为 `centerLockOffset`，即该锁定区的进度起始点（进度 0）。

程序化导航不执行防跳过限制，以便到达指定目标。新的有效滚轮、触控、按键或滚动条输入会中断平滑滚动，并恢复用户控制。

## 观测锁定区状态

三个 scroll 专属回调报告锁定区状态：

| 回调             | detail                             | 触发条件                         |
| ---------------- | ---------------------------------- | -------------------------------- |
| `onZoneEnter`    | `{ zoneId, sceneIndex }`           | 锁定区变为活动状态               |
| `onZoneProgress` | `{ zoneId, sceneIndex, progress }` | 相对**上次上报值**移动超过 0.5px |
| `onZoneLeave`    | `{ zoneId, sceneIndex }`           | 锁定区不再处于活动状态           |

`progress` 为 `progressPx / totalBudgetPx`，范围 0 到 1。位移与上次上报值比较，到达零或满值时，即使最后一段变化不足 0.5px 也会上报。

只有滚动位置与进度都距离两端超过 0.5px 时，锁定区才处于活动状态。零预算区间不会激活：会报告初始零进度，不触发进入或离开事件。

完整 callback 表见[回调](/docs/03-callbacks)。

## 相关页面

- [锁定区与时长预算](/docs/02-zones-budget)：预算计算与时间轴窗口映射
- [四条输入路径](/docs/03-inputs)：输入归一化与释放机制
- [Scene 作用域固定层](/docs/04-fixed-layer)：锁定区内的元素固定机制
- [scroll 排错](/docs/06-scroll-pitfalls)：常见故障排查
