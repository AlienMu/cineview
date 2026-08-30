---
title: 快速上手
eyebrow: GETTING STARTED / QUICKSTART
---

一个可以直接抄走的最小应用：两个场景、四个组件（CineView / Scene / Animate / Position），drag 模式翻页。

## 完整示例

```tsx
import { CineView, Scene, Animate, Position } from 'cineview';

export default function App() {
  return (
    <CineView
      designWidth={750}
      mode="drag"
      direction="y"
      transitionDuration={800}
      scrollbar={{ enabled: true, width: 6, autoHide: true }}
    >
      <Scene
        sceneId="hero"
        layout={{ width: '100%', height: '100vh', anchor: 'top-center', overflow: 'hidden' }}
      >
        <Position at={{ x: 60, y: 200 }}>
          <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 800 }}>
            <h1>第一幕</h1>
          </Animate>
        </Position>
        <Position at={{ x: 60, y: 320 }}>
          <Animate
            animateId="subtitle"
            enterAnimation="slide-up"
            duration={{ enter: 600 }}
            timeline={{ after: 'title' }}
          >
            <p>跟着标题入场的副标题</p>
          </Animate>
        </Position>
      </Scene>
      <Scene
        sceneId="closing"
        layout={{ width: '100%', height: '100vh', anchor: 'top-center', overflow: 'hidden' }}
      >
        <Position at={{ x: 60, y: 200 }}>
          <Animate animateId="end-title" enterAnimation="fade-in" duration={{ enter: 800 }}>
            <h1>谢幕</h1>
          </Animate>
        </Position>
      </Scene>
    </CineView>
  );
}
```

## 关键 prop 逐行讲

- `designWidth={750}`：设计稿宽度 750px。这是全站唯一的换算基准：所有 Position 坐标和盒模型长度都按 `scale = viewportWidth / 750` 换算。不写时默认就是 750。
- `mode="drag"`：用拖拽分页引擎。默认值就是 `'drag'`，这里写出来只是为了看得清楚。
- `direction: 'y'`：竖向滑动手势。横向滑动手势用 `'x'`。
- `transitionDuration: 800`：**只影响程序化导航**（`ref.goToScene()`）的收尾时机。手势翻页的时长固定为 800ms，这个 prop 改不了它。
- `scrollbar={{ enabled: true, width: 6, autoHide: true }}`：注入一条 6px 宽、闲置时自动隐藏的滚动条。传 `scrollbar={false}` 则完全关闭。
- `sceneId`：场景的唯一标识，回调和 `ref.preload` 都用它寻址。
- `layout.anchor: 'top-center'`：场景内容块在九宫格里的锚点。`overflow: 'hidden'` 裁掉溢出内容。
- `at={{ x: 60, y: 200 }}`：设计稿坐标，单位 px，按 `designWidth` 换算。
- `animateId` / `timeline.after: 'title'`：副标题等 `title` 入场完成后再播。after 指向不存在的 animateId 会报 `INVALID_ANIMATION`，连成环会报 `CIRCULAR_DEPENDENCY`。
- `duration={{ enter: 800 }}`：入场 800ms。

## 换成 scroll 模式

同一棵树，做两处改动：把 `mode` 换成 `"scroll"`，在要加锁定区的场景上声明 `scroll={{ zoneId: 'hero-seq', trigger: 'center-lock' }}`。页面于是变成真实文档流。普通内容正常滚动，锁定区里滚动驱动时间轴（1ms=1px）。见 [选择模式](/docs/04-choosing-mode) 和 [center-lock](/docs/01-centerlock)。

## 下一步

- [CineView 参考](/docs/01-cineview)：根组件全部 props 与 ref 方法。
- [Scene 参考](/docs/02-scene)：layout / stack / transition / assets 全表。
- [Animate 参考](/docs/03-animate)：时间轴推断、enterRef/exitRef、stagger。
