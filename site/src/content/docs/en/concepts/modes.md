---
title: Drag vs Scroll
eyebrow: TWO ENGINES
---

Drag is a scene stack. Scroll is native document flow with optional center-lock takeover zones.

## Drag

Drag uses a render lane for scene travel and a scene-owned element lane for authored enter timing. Adjacent scenes remain mounted during a gesture.

```tsx
<CineView mode="drag" config={{ size: 750 }}>
  <Scene sceneId="chapter-01">...</Scene>
  <Scene sceneId="chapter-02">...</Scene>
</CineView>
```

## Scroll

Scroll preserves native document distance. A Scene.scroll zone consumes only its declared timeline segment and releases the document at 0 or 100 percent.

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
