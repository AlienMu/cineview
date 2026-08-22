---
title: Scene
eyebrow: CHAPTER
---

Scene is the chapter boundary for layout, assets, visibility callbacks, and scene-scoped fixed layers.

## Scroll zone

A scroll zone declares timeline ownership. It does not declare animation style or a virtual coordinate system.

```tsx
<Scene
  sceneId="hero-sequence"
  layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
  scroll={{ zoneId: 'hero-sequence', trigger: 'center-lock' }}
>
  <Position layer={{ fixed: true }}>...</Position>
</Scene>
```
