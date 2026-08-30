---
title: center-lock 滚动接管
eyebrow: SCROLL / CENTER-LOCK
---

给 `Scene` 配 `scroll={{ zoneId, trigger: 'center-lock' }}`，这个场景就成为锁定区（locked zone）：滚到它时视觉盒钉在视口中央，之后滚过的每一像素都变成 zone 的动画进度，预算走完页面才继续往下。`center-lock` 是唯一的 trigger。

## center-lock 就是 sticky 居中

这套机制不模拟滚动。锁定区场景渲染成三层：外层 wrapper 参与文档流并撑出高度，中间一层 `position: sticky` 的视觉壳，壳内是内容层。壳开始钉住的 `scrollTop` 是算出来的：在这个位置，视觉盒的中心正好对上视口中心。

| 量                 | 公式                                                     | 含义                          |
| ------------------ | -------------------------------------------------------- | ----------------------------- |
| `visualSpan`       | 声明的 `vh`/`vw` 跨度，否则 DOM 实测                     | 视觉盒主轴尺寸                |
| `centerLockOffset` | `max(sceneStart + visualSpan / 2 - viewportSpan / 2, 0)` | sticky 开始钉住的 `scrollTop` |
| `segmentStart`     | `centerLockOffset`                                       | 锁定段起点                    |
| `segmentEnd`       | `centerLockOffset + totalBudgetPx`                       | 锁定段终点                    |

超屏场景（视觉盒高于视口）靠 wrapper 的 `paddingTop` 把壳压到那个位置，不足屏场景靠壳自身的 `top` inset，两种情形算出同一个 `centerLockOffset`。JS 里的 segment 只是对这段 sticky 行程的**描述**，不是驱动它的东西：把脚本全停掉，壳照样钉在那儿。

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

这段 JSX 的 zone 预算是 800px：观众要真实滚过 800px，标题才从 0 走到 1。

## 进度是纯函数

zone 进度没有累加器，也没有所有权记忆：

```text
progressPx = clamp(nativeOffset - segmentStart, 0, totalBudgetPx)
```

一个 `clamp` 就是全部，它直接带来两个结果。反向滚回段内时 `nativeOffset` 从 `segmentEnd` 递减，进度自然 `100% → 0%`，动画停在对应那一帧，没有反向特判，也没有要配置的东西。刷新、跳转、resize 之后也不存在状态跑偏：进度永远只由当前 `scrollTop` 决定。

段的两端各有 0.01px 的吸附：进度落在端点附近时直接取 0 或满值，避免浮点残差让最后一帧永远差一点。

## 防跳过

一次大 flick 或长按键会产生远大于段长的滚动增量。引擎在写入 `scrollTop` 之前先过一道防跳过钳制，规则按方向镜像：

| 情形                       | 最终位置                            |
| -------------------------- | ----------------------------------- |
| 正向从段外一跃跨过整段     | `min(segmentStart + 1, segmentEnd)` |
| 正向已在段内、目标越过段尾 | 精确钳到 `segmentEnd`               |
| 反向从段外一跃跨过整段     | `max(segmentEnd - 1, segmentStart)` |
| 反向已在段内、目标越过段首 | 精确钳到 `segmentStart`             |

第一行是这条规则最要紧的一种情况：**再大的 flick 也被压成「段内一像素」**，观众必然看到锁定段的第一帧，而不是瞬移过去。段外的普通滚动完全不受影响。

只有段长超过 0.5px 的段参与这道钳制。程序化滚动（`goToScene` / `goToZone`）刻意不经过这道钳制，原因在「程序化跳转」一节。

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

跳转后总是停在 `centerLockOffset`，也就是这个 zone 的**进度 0**，不是 zone 的中点。`align: 'center'` 那一格是公共类型与实现不一致的地方，别按它的字面意思规划跳转。

平滑滚动在途期间引擎不做防跳过钳制：那道钳的纠正性 `scrollTo` 会按 CSSOM 规范中断平滑动画，滚动停在中途、到不了目标。程序化滚动的每一帧本来就是连续的，跨过的每个段都会自然产生段内帧，不需要钳制。任何真实用户输入（滚轮、触摸、按键、拖滚动条）会当场收回控制权，把在途目标作废。

## 观测 zone

三个 scroll 专属回调覆盖 zone 生命周期：

| 回调             | detail                             | 触发条件                         |
| ---------------- | ---------------------------------- | -------------------------------- |
| `onZoneEnter`    | `{ zoneId, sceneIndex }`           | zone 从非 active 变 active       |
| `onZoneProgress` | `{ zoneId, sceneIndex, progress }` | 相对**上次上报值**移动超过 0.5px |
| `onZoneLeave`    | `{ zoneId, sceneIndex }`           | zone 从 active 变非 active       |

`progress` 是 0 到 1 的归一化值（`progressPx / totalBudgetPx`）。0.5px 的阈值比的是上次上报值而不是上一帧，否则慢速滚动会每帧重置基线、永远不上报。0 与满值两个端点强制透出，即使最后一帧只动了不到 0.5px。

active 的判据比「进度非零」更严：`nativeOffset` 必须严格落在段内 0.5px 以外，且进度也在两端 0.5px 以外。零预算的 zone 永远不 active，这三个回调一次都不会发，见 [zone 与滚动预算](/docs/02-zones-budget)。

完整 callback 表见[回调](/docs/03-callbacks)。

## 相关页面

- [zone 与滚动预算](/docs/02-zones-budget)：预算怎么算出来，phase 怎么改写窗口
- [四条输入路径](/docs/03-inputs)：防跳过钳制上游的四种输入与释放机制
- [Scene 作用域固定层](/docs/04-fixed-layer)：锁定区里怎么钉住元素
- [scroll 排错](/docs/06-scroll-pitfalls)：本页机制对应的常见故障
