---
title: Animate 时间线
eyebrow: CONCEPTS / TIMELINE
---

`timeline` 决定 Animate 跟随手势、滚动位置还是经过的时间。自定义组件可读取它的进度，绘制与动画同步的画面。

## 选择进度来源

`timeline.driver` 默认为 `'scene'`。设置 `'clock'` 可让元素独立按时间播放。

| driver | 所在位置 | 播放方式 |
| --- | --- | --- |
| `'scene'` | drag | 跟随所属 Scene 的元素动画进度 |
| `'scene'` | scroll 锁定区内 | 跟随锁定区的滚动位置 |
| `'scene'` | scroll 锁定区外 | 满足可见性条件后按时间播放 |
| `'clock'` | drag | Scene 到达后独立播放 |
| `'clock'` | scroll，包括锁定区内 | 满足可见性条件后独立播放 |

drag 中的 `driver: 'clock'` 不参与 `after` 顺序。它的时长不增加 Scene 的元素总时长，也不执行 `exitAnimation`。

## 用进度绘制 Canvas

在 Animate 的后代组件中调用 `useAnimateTimeline()`。返回的 `progress` 是 0–1 的 MotionValue，可订阅变化后直接绘制。

```tsx
import { useEffect, useRef } from 'react';
import { Animate, useAnimateTimeline } from 'cineview';

function ProgressCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { progress } = useAnimateTimeline();

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const draw = (value: number) => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#0e7490';
      context.fillRect(0, 0, canvas.width * value, canvas.height);
    };

    draw(progress.get());
    return progress.on('change', draw);
  }, [progress]);

  return <canvas ref={canvasRef} width={320} height={32} aria-label="动画进度" />;
}

export function ProgressExample() {
  return (
    <Animate
      enterAnimation={{ initial: { opacity: 1 }, animate: { opacity: 1 } }}
      duration={{ enter: 1200 }}
    >
      <ProgressCanvas />
    </Animate>
  );
}
```

将 `ProgressExample` 放进 drag 场景或 scroll 锁定区即可使用。它在进度变化时绘制，卸载时取消订阅。画面只依赖进度，因此不需要额外的动画循环。

需要在 JSX 中使用数字时，也可传入函数式 children：`{({ enterProgress }) => ...}`。这种写法会随进度更新触发 React 渲染。更多绘制方式见 [useAnimateTimeline](/docs/09-use-animate-timeline)。

## 读取 phase

`phase` 描述元素的播放阶段：

| phase | 含义 |
| --- | --- |
| `idle` | 尚未开始或等待 |
| `waiting` | 等待延迟或前序动画 |
| `entering` | 正在入场 |
| `entered` | 入场完成 |
| `exiting` | 正在退场 |
| `exited` | 退场完成 |

函数式 children 提供普通的 `phase` 值。`useAnimateTimeline()` 提供可订阅的 `phase` MotionValue。

**scroll 锁定区内跟随滚动的入退场动画，应读取进度判断画面位置。** 这类动画的 `phase` 保持 `idle`，不会随滚动切换阶段。独立按时间播放的元素使用可见性阶段，仅有循环动画的元素处于 `entered`。

## 设置延迟与播放区间

`timeline.delay` 以毫秒设置入场延迟。跟随拖拽或滚动时，它表示动画起点之前的一段距离；独立按时间播放时，它表示等待时间。

`timeline.after` 指向同一 Scene 内另一元素的 `animateId`。当前元素等前序入场完成，再加上自身 `delay` 后开始，不等待退场。支持的驱动方式见[动画组合与顺序](/docs/04-orchestration)。不存在的目标会报告 `INVALID_ANIMATION`，循环依赖会报告 `CIRCULAR_DEPENDENCY`。

锁定区内的 Animate 使用所属 Scene 的区域。需要跟随哪个区域的进度，就将元素放在对应 Scene 中。`timeline.phase: { start, end }` 用 0–1 指定该区域内的入场范围，仅适用于 scroll 中跟随场景进度的动画。

## 手动触发入场与退场

传入 `enterRef` 或 `exitRef` 后，框架会把触发函数写入 ref。调用 `enterRef.current?.()` 可立即开始入场。

| 动画 | enterRef | exitRef |
| --- | --- | --- |
| scroll 可见性动画，包括锁定区内的 clock 动画 | 支持 | 支持 |
| drag clock 动画 | 支持 | 不支持 |
| 跟随场景的 drag 动画 | 不支持 | 不支持 |
| 跟随锁定区滚动的动画 | 不支持 | 不支持 |

不支持的 ref 会被忽略，并报告 `INVALID_ANIMATION`。支持的 `enterRef` 会中断当前等待并立即入场。若同时声明有效的 `after` 或大于零的 `delay`，仍可自动触发入场；没有这些条件时，必须手动调用。

传入受支持的 `exitRef` 会关闭自动退场。调用后立即退场，并中断尚未完成的入场。退场不会在等待一段时间后自动触发。Scene 离开后，手动 ref 也不会让内容继续显示。

完整示例见 [Animate 参考](/docs/03-animate)。
