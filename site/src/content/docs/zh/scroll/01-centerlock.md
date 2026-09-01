---
title: center-lock 滚动
eyebrow: SCROLL / CENTER-LOCK
---

当为 `Scene` 配置 `scroll={{ zoneId, trigger: 'center-lock' }}` 时，该场景声明为锁定区（locked zone）：当滚动到达对应位置时，视觉容器固定于视窗中央，后续滚动位移直接转换为动画时间轴进度，预算消耗完毕后页面恢复常规文档流滚动。`center-lock` 是唯一的触发模式。

## center-lock 的定位机制

锁定区场景在 DOM 中分为三层：外层 wrapper 参与文档流并撑开滚动高度，中间层为 `position: sticky` 的视觉壳，内层承载内容。当滚动到达计算出的 `scrollTop` 时，视觉盒中心与视窗中心重合并保持静止。

| 量                 | 公式                                                     | 含义                          |
| ------------------ | -------------------------------------------------------- | ----------------------------- |
| `visualSpan`       | 声明的 `vh`/`vw` 跨度，否则 DOM 实测                     | 视觉盒主轴尺寸                |
| `centerLockOffset` | `max(sceneStart + visualSpan / 2 - viewportSpan / 2, 0)` | sticky 开始钉住的 `scrollTop` |
| `segmentStart`     | `centerLockOffset`                                       | 锁定段起点                    |
| `segmentEnd`       | `centerLockOffset + totalBudgetPx`                       | 锁定段终点                    |

超屏场景（视觉盒高度大于视窗高度）通过 wrapper 的 `paddingTop` 调整视觉壳位置；不足屏场景则通过视觉壳自身的 `top` inset 对齐。两种情形均计算出相同的 `centerLockOffset`。

## 滚动距离从哪来

wrapper 的高度不等于视觉高度：

```text
flowSpan = max(visualSpan, viewportSpan) + timelineDistancePx
```

`timelineDistancePx` 就是这个 zone 的动画预算（1ms = 1px，规则见 [zone 与滚动预算](/docs/02-zones-budget)）。wrapper 比它看起来的样子高出整整一个预算，那段多出来的高度就是观众在「画面钉住不动」时消耗掉的真实滚动距离。预算为 0 时 wrapper 退回视觉高度，锁定行程随之消失。

```tsx
<CineView designWidth={750} mode="scroll" direction="y">
  <Scene sceneId="hero-seq" scroll={{ zoneId: 'hero-seq', trigger: 'center-lock' }}>
    <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 800 }}>
      <h1>锁定段内随滚动进场</h1>
    </Animate>
  </Scene>
</CineView>
```

这段 JSX 的 zone 预算是 800px：需滚动 800px 物理距离，标题动画才完整执行（0 至 1）。

## 进度是纯函数

zone 进度没有累加器，也没有所有权记忆：

```text
progressPx = clamp(nativeOffset - segmentStart, 0, totalBudgetPx)
```

反向滚回段内时 `nativeOffset` 从 `segmentEnd` 递减，进度线性由 `100%` 变为 `0%`，画面回退至对应时间节点。页面刷新、容器 resize 或跳转后，进度始终仅由当前 `scrollTop` 计算确定。

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

ref.current!.goToZone('hero-seq', { animated: true });
```

| 选项       | 类型       | 默认   | 说明                                             |
| ---------- | ---------- | ------ | ------------------------------------------------ |
| `animated` | `boolean`  | `true` | `true` 用 `behavior: 'smooth'`，`false` 立即到位 |
| `align`    | `'center'` | 无     | 公共类型里有，实现丢弃，写不写都一样             |

跳转目标位置始终为 `centerLockOffset`，即该锁定区的进度起始点（进度 0）。

平滑滚动执行期间跳过防跳过拦截，避免纠正性 `scrollTo` 按 CSSOM 规范中断平滑过渡动画。真实用户输入（滚轮、触控、按键、滚动条拖拽）进入时会立即终止平滑动画并收回控制权。

## 观测锁定区状态

三个 scroll 专属回调覆盖 zone 生命周期：

| 回调             | detail                             | 触发条件                         |
| ---------------- | ---------------------------------- | -------------------------------- |
| `onZoneEnter`    | `{ zoneId, sceneIndex }`           | zone 从非 active 变 active       |
| `onZoneProgress` | `{ zoneId, sceneIndex, progress }` | 相对**上次上报值**移动超过 0.5px |
| `onZoneLeave`    | `{ zoneId, sceneIndex }`           | zone 从 active 变非 active       |

`progress` 是 0 到 1 的归一化值（`progressPx / totalBudgetPx`）。0.5px 的阈值比的是上次上报值而不是上一帧，否则慢速滚动会每帧重置基线、永远不上报。0 与满值两个端点强制透出，即使最后一帧只动了不到 0.5px。

锁定区处于 active 状态的判定条件：`nativeOffset` 位于段内且与两端保持 0.5px 以上间距，同时进度亦处于两端 0.5px 范围之外。预算为 0 的锁定区不进入 active 状态，上述回调均不触发，详见 [zone 与滚动预算](/docs/02-zones-budget)。

完整 callback 表见[回调](/docs/03-callbacks)。

## 相关页面

- [zone 与滚动预算](/docs/02-zones-budget)：预算计算与时间轴窗口映射
- [四条输入路径](/docs/03-inputs)：输入归一化与释放机制
- [Scene 作用域固定层](/docs/04-fixed-layer)：锁定区内的元素固定机制
- [scroll 排错](/docs/06-scroll-pitfalls)：常见故障排查
