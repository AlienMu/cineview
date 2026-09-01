---
title: useAnimateTimeline
eyebrow: ADVANCED / USEANIMATETIMELINE
---

`useAnimateTimeline()` 返回最近的 `Animate` 时间轴的只读视图：`progress` / `signedProgress` / `phase` / `frame` 全部是 MotionValue，更新不经过 React 渲染管线。适用于连续值 style 样式映射或 canvas 自绘场景；若仅需在 React 渲染逻辑中消费数值标量，直接使用 render-prop children 暴露的 `enterProgress` 即可，见 [Animate](/docs/03-animate)。

## 调用约束

必须在 `<Animate>` 的 children 内调用（普通 children 或 render-prop 内部都可以），否则直接 throw：

```text
useAnimateTimeline must be used inside an <Animate> child.
```

时间轴数据由引擎内部统一维护与驱动；返回对象字段均为 `readonly`，不暴露任何外部写入接口。

## 返回字段

| 字段             | 类型                                | 说明                                                                                                                                                                          |
| ---------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`           | `ScrollMode`                        | 根模式（`'drag' \| 'scroll'`），只读静态值。                                                                                                                                  |
| `driver`         | `AnimateTimelineLane`               | 该元素实际的驱动方式：`'drag' \| 'scroll' \| 'visibility'`。scroll 模式下不在锁定区内的元素按 `visibility` 算。                                                               |
| `progress`       | `MotionValue<number>`               | 入场进度 0..1。                                                                                                                                                               |
| `signedProgress` | `MotionValue<number>`               | 带符号进度，退场时向负方向推进，用来区分「进入中」和「退出中」。                                                                                                              |
| `phase`          | `MotionValue<AnimatePhase>`         | 动画六态阶段：`'idle' \| 'waiting' \| 'entering' \| 'entered' \| 'exiting' \| 'exited'`。                                                                                     |
| `frame`          | `MotionValue<AnimateTimelineFrame>` | 一次更新里的完整快照 `{ progress, signedProgress, phase, source }`：四个值总是一起更新。分开订阅 progress 和 phase 可能读到新旧混搭（新 progress 配旧 phase），`frame` 不会。 |

`frame.source` 的类型是 `AnimateTimelineSource`，六个取值：`'idle' | 'gesture' | 'continuation' | 'programmatic' | 'scroll' | 'visibility'`。

## 绑定连续值到 style

需要随进度插值的视觉值，把 MotionValue 直接挂到 `motion.*` 的 style 上，用 `useTransform` 从 `progress` 派生，`motion.*` 元素不触发 React 重渲染：

```tsx
import { motion, useTransform } from 'framer-motion';

function ParallaxLayer() {
  const { progress } = useAnimateTimeline();
  const y = useTransform(progress, [0, 1], [80, -80]);
  return <motion.div style={{ y }} />;
}

<Animate animateId="layer" enterAnimation="fade-in" duration={{ enter: 1200 }}>
  <ParallaxLayer />
</Animate>;
```

## scroll 锁定区内 phase 不更新

**元素在 scroll 锁定区（locked zone）内时，`phase` 不会更新，保持在 `'idle'`。** phase 描述基于视窗可见性进出时的动画状态；锁定区内的动画由滚动位置精确驱动，不经过可见性阶段状态机推进，因此不会切换至 `entering` / `entered` / `exiting`。**该行为仅适用于 scroll 锁定区**：drag 模式下阶段状态正常推进（`hidden→idle`、`enter→entering/entered`、`rest→entered`、`outgoing→exiting`），在 drag 模式下依据 phase 执行状态判断符合设计预期。此时 `progress` 与 `signedProgress` 仍跟随滚动实时变化，仅 `phase` 维持在 `idle`。

render-prop children 拿到的 `state.phase` 同源，同样停在 `idle`。

在锁定区内如果仅依赖 `phase !== 'idle'` 控制 rAF 循环的暂停与唤醒，会导致渲染循环过早终止且无法重新启动。锁定区内如需判断绘制周期，可选用以下两种判定方案之一：

- `signedProgress`：`0` 是初始帧，`1` 是完全进入，负值表示退场方向。
- `frame.source`：`frame` 快照里带着驱动来源，可用来区分 `scroll` 与 `visibility`。

## canvas 自绘

唯一允许自建 rAF 的场景是 canvas 自绘：每帧从 MotionValue `.get()` 现读现画，并订阅 `phase` 在 `exited` / `idle` 时停循环。**这段适用于锁定区之外的所有情况**（scroll 的区外元素、drag 的场景驱动元素与独立播放元素）；锁定区内按「scroll 锁定区内 phase 不更新」一节改判断条件：

```tsx
function Meter() {
  const { progress, phase } = useAnimateTimeline();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let raf = 0;
    const ctx = ref.current!.getContext('2d')!;
    const draw = () => {
      drawArc(ctx, progress.get());
      raf = requestAnimationFrame(draw);
    };
    const stop = phase.on('change', (p) => {
      cancelAnimationFrame(raf);
      if (p !== 'exited' && p !== 'idle') raf = requestAnimationFrame(draw);
    });
    if (phase.get() !== 'exited' && phase.get() !== 'idle') raf = requestAnimationFrame(draw);
    return () => {
      stop();
      cancelAnimationFrame(raf);
    };
  }, [progress, phase]);

  return <canvas ref={ref} />;
}
```

不订阅 `phase` 就停不住：元素已退场、canvas 还在全速重绘。

## 避免引入外部弹簧驱动

连续值一律从本 hook 返回的 MotionValue 派生，避免自建 `useSpring` 或独立的动画循环。弹簧物理模拟具备独立的阻尼与衰减节奏，无法与手势驱动的滚动位移严格同步，两者的叠加会导致视觉过冲或定位偏差。
