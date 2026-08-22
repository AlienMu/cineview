---
title: drag 与 scroll
eyebrow: TWO ENGINES
---

drag 是场景栈；scroll 是原生文档流，外加可选的 center-lock 接管 zone。

## Drag

drag 用 render 轨驱动场景位移，用 scene 自持的 element 轨承载编排好的入场时机。手势期间相邻场景保持挂载。

```tsx
<CineView mode="drag" config={{ size: 750 }}>
  <Scene sceneId="chapter-01">...</Scene>
  <Scene sceneId="chapter-02">...</Scene>
</CineView>
```

## Scroll

scroll 保留原生文档距离。Scene.scroll zone 只消费自己声明的时间轴段，并在 0% 或 100% 处把文档交还。

```tsx
<CineView mode="scroll" config={{ size: 1440 }}>
  <article>Normal document content.</article>
  <Scene
    sceneId="sequence"
    scroll={{ zoneId: 'sequence', trigger: 'center-lock' }}
  >
    ...
  </Scene>
</CineView>
```
