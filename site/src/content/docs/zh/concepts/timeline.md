---
title: 时间轴与所有权
eyebrow: OWNERSHIP
---

每个时间轴输入都有唯一所有者。消费者读 MotionValue，不写 progress。

## 零渲染消费者

在 Animate 的子元素里使用这个 hook，服务于 canvas、video、WebGL，或任何需要响应 MotionValue 而不必每帧触发 React 渲染的消费者。

```tsx
function CanvasLayer() {
  const timeline = useAnimateTimeline();
  useMotionValueEvent(timeline.progress, 'change', drawFrame);
  return <canvas />;
}

<Animate enterAnimation="fade-in">
  <CanvasLayer />
</Animate>
```

## 只读契约

progress 取值 0..1，signedProgress 保留退场方向，phase 是共享的六态相位词表。返回对象没有任何 setter。
