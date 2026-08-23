---
title: useAnimateTimeline()
eyebrow: API REFERENCE
---

`useAnimateTimeline()` 是 Animate 时间轴的零渲染出口：返回对象里的 `progress` / `signedProgress` / `phase` / `frame` 全部是 MotionValue，更新绕过 React 渲染管线，且不暴露任何写入方法。本页是接口全字段参考；canvas 豁免、rAF 纪律与「不要自建驱动」见 [该 hook 的指南页](/docs/use-animate-timeline)。

## 返回对象

```ts
import type { MotionValue } from 'framer-motion';

interface AnimateTimeline {
  readonly mode: ScrollMode; // 'drag' | 'scroll'
  readonly driver: AnimateTimelineDriver; // 'drag' | 'scroll' | 'visibility'
  readonly progress: MotionValue<number>; // 0..1, 0 = initial frame, 1 = fully entered
  readonly signedProgress: MotionValue<number>; // retains the exit direction
  readonly phase: MotionValue<AnimatePhase>;
  readonly frame: MotionValue<AnimateTimelineFrame>; // atomic snapshot for imperative consumers
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `mode` | `ScrollMode` | 根声明（`'drag' \| 'scroll'`），只读静态值。 |
| `driver` | `AnimateTimelineDriver` | 这个 Animate 实际挂载的轨道（`'drag' \| 'scroll' \| 'visibility'`），只读静态值。scroll 模式下不在接管 zone 内的元素会优雅降级为 `visibility` 驱动——读 `driver` 区分真实时间与几何可见性。 |
| `progress` | `MotionValue<number>` | `0..1`：0 为 initial 帧，1 为完全进入。 |
| `signedProgress` | `MotionValue<number>` | 保留退场方向——退场时它是负向推进的进度，需要区分「进入中」与「退出中」的渲染器用它。 |
| `phase` | `MotionValue<AnimatePhase>` | 六态相位词表（见下节）。 |
| `frame` | `MotionValue<AnimateTimelineFrame>` | 原子快照（见下节）——四个值在同一次提交里发布。 |

对象身份稳定：effect 依赖里放 `timeline` 不会每帧重跑。全部字段 `readonly`，没有任何写入方法，CineView 仍是时间轴的唯一写者。

## AnimatePhase 六态词表

| 取值 | 语义 |
| --- | --- |
| `'idle'` | 从未开始。 |
| `'waiting'` | 被 `delay` / `waitFor` 门控在 initial 帧。 |
| `'entering'` | 入场进行中。 |
| `'entered'` | 入场完成。 |
| `'exiting'` | 退场进行中。 |
| `'exited'` | 退场完成。 |

## AnimateTimelineFrame：原子快照

```ts
interface AnimateTimelineFrame {
  progress: number;
  signedProgress: number;
  phase: AnimatePhase;
  source: AnimateTimelineSource;
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `progress` | `number` | 与顶层 `progress` 同值的标量。 |
| `signedProgress` | `number` | 与顶层 `signedProgress` 同值。 |
| `phase` | `AnimatePhase` | 与顶层 `phase` 同值。 |
| `source` | `AnimateTimelineSource` | 本次变化的来源（六值，见下表）。 |

为什么需要它：分开订阅 `progress` 和 `phase` 的消费者，可能读到跨提交的组合，即新的 progress 配上旧的 phase，画出一帧从未存在过的中间态。`frame` 把四个值在同一次提交里原子发布。

`source` 的六个取值：

| 取值 | 语义 |
| --- | --- |
| `'idle'` | 尚无任何驱动（初始）。 |
| `'gesture'` | 手势——拖拽中的手指位移。 |
| `'continuation'` | 松手后的 release 续跑（settle 动画）。 |
| `'programmatic'` | 程序化导航（`goToScene` / `goToZone` 等 ref 方法）。 |
| `'scroll'` | 滚动 scrub。 |
| `'visibility'` | 可见性闸门（时间驱动）。 |

做调试面板或遥测时 `source` 比 `phase` 更能回答「为什么动了」。

## 调用约束

必须在 `<Animate>` 的子元素里调用（普通 children 与 render-prop 内都行），在别处调用直接抛错：

```tsx
function PhaseLogger() {
  const timeline = useAnimateTimeline();

  useEffect(() => {
    const stop = timeline.frame.on('change', (frame) => {
      // One atomic read: progress and phase from the same commit.
      console.log(frame.phase, frame.source, frame.progress);
    });
    return stop;
  }, [timeline]);

  return null;
}

<Animate animateId="logger" enterAnimation="fade-in" duration={{ enter: 800 }}>
  <PhaseLogger />
</Animate>
```

订阅用 MotionValue 的 `.on('change', ...)`，返回取消函数，天然适配 effect 清理。一条纪律：**传 MotionValue 本身，不要传 `.get()` 的快照**。快照是订阅那一刻的静态值，之后永远不再更新。

## 相关页面

- 六态词表的运行语义、canvas 豁免与 rAF 纪律 → [When to use](#when-to-use)
- `ScrollMode` / `AnimatePhase` / 相关类型 → [类型字典](/docs/types)

## When to use

- 自定义渲染器（canvas / WebGL / 逐帧绘制）需要动画进度或相位作为输入，而 `Animate` 的声明式属性表达不了。
- 调试面板或遥测需要原子地读「progress + phase + 来源」，而不引入任何重渲染。
- 需要区分「进入中」与「退出中」（`signedProgress`），或「为什么动了」（`frame.source`）。

返回对象的全部字段（`mode` / `driver` / `progress` / `signedProgress` / `phase` / `frame`）、六态相位词表与帧快照的逐字段表见 [useAnimateTimeline API](/docs/use-animate-timeline-api)。两个快速事实：`mode` 是根声明（drag / scroll），`driver` 是这个 Animate 实际挂载的轨道。scroll 模式下不在接管 zone 内的元素会优雅降级为 `visibility` 驱动，读 `driver` 能区分真实时间与几何可见性。`frame` 把 progress / signedProgress / phase / source 四个值在同一次提交里原子发布，避免跨提交读到「新 progress 配旧 phase」。

调用位置有硬约束：必须在 `<Animate>` 的子元素里调用（普通 children 与 render-prop 内都行），在别处调用直接抛错 `useAnimateTimeline must be used inside an <Animate> child.`。返回对象身份稳定，effect 依赖里放 `timeline` 不会每帧重跑。

## 基本用法

订阅用 MotionValue 的 `.on('change', ...)`，它返回取消函数，天然适配 effect 清理。典型写法：在一个挂在 `Animate` 内的子组件里取 `timeline`，在 effect 里订阅 `timeline.frame.on('change', ...)`，回调中读同一提交的 `frame.phase` / `frame.source` / `frame.progress`，清理函数调用取消订阅。完整示例见 API 参考。

另一种消费方式是把 MotionValue 原样传给自定义渲染器（canvas / video / WebGL），由渲染器自己订阅，这是下一节的正题。两种方式共同的纪律：**传 MotionValue 本身，不要传 `.get()` 的快照**，快照是订阅那一刻的静态值，之后永远不再更新。

## canvas 豁免模式

框架的许可清单里，canvas 自绘是唯一的自绘豁免：子元素读 MotionValue 自驱 rAF，零 per-frame setState。适用场景是 `Animate` 的声明式属性表达不了的渲染，比如粒子场、波形、逐帧绘制的仪表盘。站点实装的 ClapperboardCanvas 是参考实现。

结构分两层：内层组件在 Animate 里调用本 hook，把 `progress` 与 `phase` 两个 MotionValue 传下去；canvas 组件拿到后自驱 rAF。`draw` 是 `(progress, phase)` 的纯函数，每帧从 `.get()` 现读现画，不缓存派生状态。

## rAF 纪律

豁免附带两条不可协商的纪律：

1. **必须订阅 `timeline.phase`，并在 `exited` / `idle` 暂停 rAF。** 暂停时要 `cancelAnimationFrame` 已排队的回调并把句柄归零，恢复时先画一帧再重新武装循环。不暂停的后果是离屏空转：元素已退场、canvas 还在全速重绘，恰好是「其他元素都已退场、这个还在动」的破窗。
2. **文件头注释标注豁免理由。** 写明为什么这里不用 Animate 声明式属性，粒子场、波形、仪表盘这类理由。这行注释是给下一个读者（和审查 agent）的许可证：他知道这里自建 rAF 是经过裁决的，不是漏网之鱼。

另外两条工程细节：卸载时取消 phase 订阅并 cancel rAF，effect cleanup 里两件事都做；用 `ResizeObserver` 监听 canvas 自身尺寸而不是 window，布局变化不一定伴随窗口变化。

## 不要自建驱动

这条规则针对站点与应用组件：**禁止直接 import framer-motion 自建动画驱动**，`motion.*` 元素、`useSpring`、`useTransform` 自建映射都在禁止之列。需要读进度 / 相位时，用本 hook。

理由不是风格洁癖：

- 自建 `useSpring` 有自己的时间常数。框架的退场是 scrub 语义，进度收敛由手势决定；spring 却按自己的弹簧参数收敛，两者叠加，退场永远「差一点到位」或者过冲，视觉上就是不受控。
- 绕过 Animate 的相位门控，循环类动效脱离 phase 约束后会出现离屏空转（同上节的破窗）。
- 双轨模型（见 concepts 组的双轨页）保证 progress 唯一写者；自建驱动是事实上的第二写者，写入会被下一帧覆盖，白白付出实现成本。

注意边界：禁令针对「动画驱动」。数据源型 hook（比如随时间码更新的 `useTimecode`）不算动画，不受限；从 framer-motion import 纯类型（`type MotionValue`）也不算驱动。

---

接口全字段、六态词表与帧快照六来源见 [useAnimateTimeline API](/docs/use-animate-timeline-api)。
