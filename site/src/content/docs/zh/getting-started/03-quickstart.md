---
title: 快速上手
eyebrow: GETTING STARTED / QUICKSTART
---

以下为适用于快速落地的最小完整配置：包含两个场景与四个核心组件（CineView / Scene / Animate / Position），基于 drag 模式实现手势分页。

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

## 核心参数解析

- `designWidth={750}`：设计稿宽度基准（750px）。全站所有 Position 坐标与盒模型尺寸均按 `scale = viewportWidth / 750` 统一进行单轴响应式缩放。未显式声明时默认值固定为 750。
- `mode="drag"`：启用手势分页引擎（默认配置，此处显式声明以明确语义）。
- `direction: 'y'`：竖向滑动手势。横向滑动手势用 `'x'`。
- `transitionDuration: 800`：**仅影响程序化导航**（`ref.goToScene()`）的触发时机。手势翻页的位移与回弹时长固化为引擎内部常量（800ms），不受该参数控制。
- `scrollbar={{ enabled: true, width: 6, autoHide: true }}`：注入一条 6px 宽、闲置时自动隐藏的滚动条。传 `scrollbar={false}` 则完全关闭。
- `sceneId`：场景的唯一标识，回调函数和 `ref.preload` 均以此作为目标识别依据。
- `layout.anchor: 'top-center'`：场景内容在对齐网格中的基准位置。`overflow: 'hidden'` 隐藏超出场景边界的溢出内容。
- `at={{ x: 60, y: 200 }}`：设计稿坐标，单位 px，按 `designWidth` 换算。
- `animateId` / `timeline.after: 'title'`：声明在 `title` 动画完成后播放。若 `after` 指向未定义的标识将触发 `INVALID_ANIMATION`，若依赖链构成闭环则触发 `CIRCULAR_DEPENDENCY`。
- `duration={{ enter: 800 }}`：入场 800ms。

## 换成 scroll 模式

保持相同的组件声明结构，仅需两处调整即可迁移至滚动模式：将 `mode` 设为 `"scroll"`，并在目标场景上声明 `scroll={{ zoneId: 'hero-seq', trigger: 'center-lock' }}`。页面随之接入真实文档流；普通内容保持原生滚动，锁定区内由滚动位移直接驱动时间轴（1ms = 1px）。详见 [选择模式](/docs/04-choosing-mode) 与 [center-lock 接管](/docs/01-centerlock)。

## 下一步

- [CineView 参考](/docs/01-cineview)：根组件全部 props 与 ref 方法。
- [Scene 参考](/docs/02-scene)：layout / stack / transition / assets 全表。
- [Animate 参考](/docs/03-animate)：时间轴推断、enterRef/exitRef、stagger。
