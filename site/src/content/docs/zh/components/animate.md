---
title: Animate
eyebrow: TIMELINE CONSUMER
---

Animate 消费当前模式的时间语义，编排 delay、waitFor、phase、visibility 与 stagger。

## 当前时间轴 API

sceneControlled 默认为 true。位于 scroll 接管 zone 内时绑定该 zone；不在时优雅降级为 visibility。设为 false 可强制使用 visibility。

```tsx
<Animate
  animateId="subtitle"
  enterAnimation="slide-up"
  exitAnimation="fade-out"
  duration={{ enter: 800, exit: 400 }}
  timeline={{ delay: 160, waitFor: 'title' }}
  visibility={{ replayOnReenter: true }}
>
  <p>Chapter copy</p>
</Animate>
```
