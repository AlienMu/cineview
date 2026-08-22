---
title: useAnimateTimeline()
eyebrow: ESCAPE HATCH
---

`useAnimateTimeline()` 是 Animate 时间轴的零渲染出口：返回对象里的 `progress` / `signedProgress` / `phase` / `frame` 全部是 MotionValue，更新绕过 React 渲染管线，且不暴露任何写入方法。CineView 仍是时间轴的唯一写者——这个 hook 只给你读的资格，而且读的过程不触发渲染。

## 返回值

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

- `mode` 是根声明（drag / scroll）；`driver` 是这个 Animate 实际挂载的轨道——scroll 模式下不在 takeover zone 内的元素会优雅降级为 `visibility` 驱动，读 `driver` 能区分真实时间与几何可见性。
- `progress` 取值 0..1：0 为 initial 帧，1 为完全进入。
- `signedProgress` 保留退场方向——退场时它是负向推进的进度，需要区分「进入中」与「退出中」的渲染器用它。
- `phase` 与 `frame` 见下节。

调用位置有硬约束：必须在 `<Animate>` 的子元素里调用（普通 children 与 render-prop 内都行），在别处调用直接抛错 `useAnimateTimeline must be used inside an <Animate> child.`。返回对象身份稳定——effect 依赖里放 `timeline` 不会每帧重跑。

## 基本用法

订阅用 MotionValue 的 `.on('change', ...)`，它返回取消函数，天然适配 effect 清理：

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

另一种消费方式是把 MotionValue 原样传给自定义渲染器（canvas / video / WebGL），由渲染器自己订阅——这是下一节的正题。两种方式共同的纪律：**传 MotionValue 本身，不要传 `.get()` 的快照**——快照是订阅那一刻的静态值，之后永远不再更新。

## phase 词表与 frame 快照

`phase` 是共享的相位词表，六个状态：

```ts
type AnimatePhase = 'idle' | 'waiting' | 'entering' | 'entered' | 'exiting' | 'exited';
```

`idle` 是从未开始；`waiting` 是被 `delay` / `waitFor` 门控在 initial 帧；`entering` / `entered` / `exiting` / `exited` 依次覆盖入场、入场完成、退场与退场完成。

`frame` 是为命令式消费者准备的原子快照：

```ts
interface AnimateTimelineFrame {
  progress: number;
  signedProgress: number;
  phase: AnimatePhase;
  source: AnimateTimelineSource; // 'idle' | 'gesture' | 'continuation' | 'programmatic' | 'scroll' | 'visibility'
}
```

为什么需要它：分开订阅 `progress` 和 `phase` 的消费者，可能读到跨提交的组合——新的 progress 配上旧的 phase，画出一帧从未存在过的中间态。`frame` 把四个值在同一次提交里原子发布。`source` 进一步告诉你这次变化从哪来：手势（`gesture`）、release 续跑（`continuation`）、程序化导航（`programmatic`）、滚动（`scroll`）还是可见性闸门（`visibility`）——做调试面板或遥测时它比 phase 更能回答「为什么动了」。

## canvas 豁免模式

框架的许可清单里，canvas 自绘是唯一的自绘豁免：子元素读 MotionValue 自驱 rAF，零 per-frame setState。适用场景是 `Animate` 的声明式属性表达不了的渲染——粒子场、波形、逐帧绘制的仪表盘。完整模式（简化自站点实装的 ClapperboardCanvas）：

```tsx
import { type MotionValue } from 'framer-motion';
import { Animate, useAnimateTimeline } from 'cineview';
import type { AnimatePhase } from 'cineview';

interface ParticleCanvasProps {
  progress: MotionValue<number>;
  phase: MotionValue<AnimatePhase>;
}

function ParticleLayer() {
  const timeline = useAnimateTimeline();
  // MotionValues are stable: pass them down, never their .get() snapshots.
  return <ParticleCanvas progress={timeline.progress} phase={timeline.phase} />;
}

function ParticleCanvas({ progress, phase }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let paused = phase.get() === 'exited' || phase.get() === 'idle';

    const draw = () => {
      const raw = Math.min(1, Math.max(0, progress.get()));
      // Paint the frame as a pure function of (raw, phase). No setState, no layout reads.
    };

    const tick = () => {
      if (paused) {
        raf = 0;
        return;
      }
      draw();
      raf = requestAnimationFrame(tick);
    };

    const applyPhase = (next: AnimatePhase) => {
      paused = next === 'exited' || next === 'idle';
      if (paused) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else {
        draw();
        if (raf === 0) raf = requestAnimationFrame(tick);
      }
    };

    applyPhase(phase.get());
    const stopPhase = phase.on('change', applyPhase);
    return () => {
      stopPhase();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [progress, phase]);

  return <canvas ref={canvasRef} aria-hidden="true" />;
}

<Animate animateId="particles" enterAnimation="fade-in" duration={{ enter: 4000 }}>
  <ParticleLayer />
</Animate>
```

结构分两层：`ParticleLayer` 在 Animate 内取 timeline，把两个 MotionValue 传下去；`ParticleCanvas` 拿到后自驱 rAF。`draw` 是 `(progress, phase)` 的纯函数——每帧从 `.get()` 现读现画，不缓存派生状态。

## rAF 纪律

豁免附带两条不可协商的纪律：

1. **必须订阅 `timeline.phase`，并在 `exited` / `idle` 暂停 rAF。** 上面 `applyPhase` 的写法就是标准姿势：暂停时要 `cancelAnimationFrame` 已排队的回调并把句柄归零，恢复时先 `draw()` 立即出一帧再重新武装循环。不暂停的后果是离屏空转——元素已退场、canvas 还在全速重绘，恰好是「其他元素都已退场、这个还在动」的破窗。
2. **文件头注释标注豁免理由。** 写明「为什么这里不用 Animate 声明式属性」——粒子场、波形、仪表盘这类理由。这行注释是给下一个读者（和审查 agent）的许可证：他知道这里自建 rAF 是经过裁决的，不是漏网之鱼。

另外两条工程细节：卸载时取消 phase 订阅并 cancel rAF（effect cleanup 里两件事都做）；`ResizeObserver` 监听 canvas 自身尺寸而不是 window（布局变化不一定伴随窗口变化）。

## 不要自建驱动

这条规则针对站点与应用组件：**禁止直接 import framer-motion 自建动画驱动**——`motion.*` 元素、`useSpring`、`useTransform` 自建映射都在禁止之列。需要读进度 / 相位时，用本 hook。

理由不是风格洁癖：

- 自建 `useSpring` 有自己的时间常数。框架的退场是 scrub 语义，进度收敛由手势决定；spring 却按自己的弹簧参数收敛——两者叠加，退场永远「差一点到位」或者过冲，视觉上就是不受控。
- 绕过 Animate 的相位门控，循环类动效脱离 phase 约束后会出现离屏空转（同上节的破窗）。
- 双轨模型（见 concepts 组的双轨页）保证 progress 唯一写者；自建驱动是事实上的第二写者，写入会被下一帧覆盖，白白付出实现成本。

注意边界：禁令针对「动画驱动」。数据源型 hook（比如随时间码更新的 `useTimecode`）不算动画，不受限；从 framer-motion import 纯类型（`type MotionValue`）也不算驱动，上节示例第一行就是合法用法。
