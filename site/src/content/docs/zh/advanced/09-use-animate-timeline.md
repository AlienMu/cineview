---
title: useAnimateTimeline
eyebrow: ADVANCED / USEANIMATETIMELINE
---

`useAnimateTimeline()` 提供最近 Animate 的 MotionValue，可绑定到 motion 样式，或订阅变化用于自绘。除非消费方将值写入 React state，否则更新不会触发 React 渲染。

## 在 Animate 后代组件中调用

在后代 React 组件内调用，包括由 render-prop children 返回的组件。在 Animate 外部调用会抛出错误：

```text
useAnimateTimeline must be used inside an <Animate> child.
```

将返回值作为只读数据使用。需要变化后的值时，派生新的 MotionValue，不修改框架进度。

## 返回字段

| 字段             | 类型                              | 含义                                                            |
| ---------------- | --------------------------------- | --------------------------------------------------------------- |
| `mode`           | ScrollMode                        | `'drag'` 或 `'scroll'`                                          |
| `lane`           | AnimateTimelineLane               | 实际驱动方式：`'drag'`、`'scroll'` 或 `'visibility'`            |
| `progress`       | MotionValue<number>               | 归一化元素进度，0–1                                             |
| `signedProgress` | MotionValue<number>               | 带符号进度，需结合模式与阶段理解                                |
| `phase`          | MotionValue<AnimatePhase>         | `idle`、`waiting`、`entering`、`entered`、`exiting` 或 `exited` |
| `frame`          | MotionValue<AnimateTimelineFrame> | 同一个值中的进度、带符号进度、阶段与来源                        |

`frame.source` 可取 `idle`、`gesture`、`continuation`、`programmatic`、`scroll` 或 `visibility`。同一操作需要一次更新中的多个关联值时，使用 `frame`。

## 将进度绑定到样式

```tsx
import { motion, useTransform } from 'framer-motion';
import { Animate, useAnimateTimeline } from 'cineview';

function MovingContent() {
  const { progress } = useAnimateTimeline();
  const y = useTransform(progress, [0, 1], [80, -80]);
  return <motion.div style={{ y }}>内容</motion.div>;
}

export function Example() {
  return (
    <Animate enterAnimation="fade-in" duration={{ enter: 1200 }}>
      <MovingContent />
    </Animate>
  );
}
```

Motion 直接应用这些样式更新，不触发 React 渲染。JSX 需要普通数值时，也可使用 render-prop children，此时更新会经过 React 渲染。

## 按驱动方式理解 phase

scroll 锁定区内跟随场景的入退场动画，其 phase 保持为 `idle`，进度仍随滚动变化。独立计时元素使用可见性阶段，仅有循环动画的元素处于 `entered`。

scroll 模式中，负的带符号进度表示退场。drag 正向退场时，带符号进度也可能为正，因此需通过 phase 区分入场与退场。

phase 或 source 本身不能证明内容仍可见。仅有入场的元素离开视窗后，也可能继续处于 `entered`。

## 进度变化时绘制画布

画布仅取决于进度时，先绘制一次，再订阅变化，无需自行启动 requestAnimationFrame（rAF）循环。

```tsx
import { useEffect, useRef } from 'react';
import { useAnimateTimeline } from 'cineview';

export function Meter() {
  const { progress } = useAnimateTimeline();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.arc(64, 64, 48, -Math.PI / 2, progress.get() * Math.PI * 2 - Math.PI / 2);
      ctx.stroke();
    };

    draw();
    return progress.on('change', draw);
  }, [progress]);

  return <canvas ref={ref} width={128} height={128} aria-label="动画进度" />;
}
```

画面还随实际时间变化时，通过明确的可见性条件控制 rAF 循环，并在清理时取消。仅有 `entered` 阶段不表示画布仍在屏幕内。

## 保持派生动效同步

`useTransform` 用于直接映射进度。额外的 `useSpring` 会引入独立时序，可能落后或超出滚动、拖拽位置，只有设计需要时才添加这种行为。
