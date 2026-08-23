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

对象身份稳定：effect 依赖里放 `timeline` 不会每帧重跑。全部字段 `readonly`，没有任何写入方法——CineView 仍是时间轴的唯一写者。

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

为什么需要它：分开订阅 `progress` 和 `phase` 的消费者，可能读到跨提交的组合——新的 progress 配上旧的 phase，画出一帧从未存在过的中间态。`frame` 把四个值在同一次提交里原子发布。

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

订阅用 MotionValue 的 `.on('change', ...)`，返回取消函数，天然适配 effect 清理。一条纪律：**传 MotionValue 本身，不要传 `.get()` 的快照**——快照是订阅那一刻的静态值，之后永远不再更新。

## 相关页面

- 六态词表的运行语义、canvas 豁免与 rAF 纪律 → [useAnimateTimeline 指南](/docs/use-animate-timeline)
- `ScrollMode` / `AnimatePhase` / 相关类型 → [类型字典](/docs/types)
