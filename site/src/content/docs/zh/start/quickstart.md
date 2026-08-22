---
title: 快速开始
eyebrow: QUICK START
---

一个完整的 drag 场景：响应式 px2vw 布局，外加一个带 delay 的子动画。

## 编写一个场景

坐标与盒尺寸都以设计稿宽度为唯一尺子。换算由框架负责；书写时始终保持设计像素。

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
