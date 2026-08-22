---
title: Quick Start
eyebrow: QUICK START
---

A complete drag scene with responsive px2vw layout and a delayed child animation.

## Author a scene

Coordinates and box lengths use the design width as their single ruler. The framework owns the conversion; authoring stays in design pixels.

```tsx
<CineView config={{ size: 1440 }} mode="drag">
  <Scene
    sceneId="hero"
    layout={{ width: '100%', height: '100vh', anchor: 'center' }}
    transition={{ enterAnimation: 'fade-in', exitAnimation: 'fade-out' }}
  >
    <Position at={{ x: 120, y: 180 }}>
      <Animate
        animateId="title"
        enterAnimation="slide-up"
        timeline={{ delay: 120 }}
      >
        <h1>Build the frame</h1>
      </Animate>
    </Position>
  </Scene>
</CineView>
```
