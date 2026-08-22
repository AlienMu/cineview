---
title: Timeline & Ownership
eyebrow: OWNERSHIP
---

Every timeline input has one owner. Consumers read MotionValues; they do not write progress.

## Zero-render consumer

Use the hook inside an Animate child for canvas, video, WebGL, or any consumer that should react to a MotionValue without a React render per frame.

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

## Read-only contract

progress is 0..1, signedProgress retains exit direction, and phase is the shared six-state phase vocabulary. The returned object has no setters.
