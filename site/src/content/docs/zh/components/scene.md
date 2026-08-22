---
title: Scene
eyebrow: CHAPTER
---

Scene 是布局、资源、可见性回调与 scene-scoped fixed layer 的章节边界。

## Scroll zone

scroll zone 声明的是时间轴所有权，不声明动画样式，也没有虚拟坐标系。

```tsx
<Scene
  sceneId="hero-sequence"
  layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
  scroll={{ zoneId: 'hero-sequence', trigger: 'center-lock' }}
>
  <Position layer={{ fixed: true }}>...</Position>
</Scene>
```
