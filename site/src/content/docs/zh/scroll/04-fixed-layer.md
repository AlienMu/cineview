---
title: Scene 作用域固定层
eyebrow: SCROLL / FIXED LAYER
---

操作栏、指示器等元素需要在 Scene 可见期间保持相对于屏幕的位置时，使用 `Position fixed`。

## 让元素随场景保持屏幕对齐

在 Scene 内的 `Position` 上设置 `fixed`。场景可见时，元素保持相对于屏幕的位置；场景离开后，元素也会离开。需要跨多个场景持续显示的导航应放在 Cineview 外。

## 示例

```tsx
import { Animate, Cineview, Position, Scene } from 'cineview';

export default function App() {
  return (
    <Cineview mode="scroll" designWidth={750}>
      <Scene sceneId="hero" layout={{ height: '100vh' }} scroll={{ zoneId: 'hero-seq' }}>
        <Animate enterAnimation="fade-in" duration={{ enter: 800 }} timeline={{ driver: 'scene' }}>
          <h1>标题</h1>
        </Animate>
        <Position at={{ anchor: 'center' }} fixed>
          <div>向下滚动继续</div>
        </Position>
      </Scene>
      <Scene sceneId="next" layout={{ height: '100vh' }}><h2>下一个场景</h2></Scene>
    </Cineview>
  );
}
```

动画给锁定区提供 800px 的滚动距离。指示文字在这段距离内保持屏幕居中，场景离开后消失。固定元素仍受所属 Scene 的可见区域裁切。若使用 `at.y` 数值定位，它会按 `designWidth` 换算；较大的设计坐标可能让元素移出屏幕。

## 原生 fixed 为何会偏移

scroll 场景使用 transform。原生 `position: fixed` 子元素会相对变换后的 Scene 定位，而不是相对浏览器视窗。`Position fixed` 使用场景自己的固定层保持屏幕对齐。固定层的空白区域不拦截指针事件，定位的元素仍可接收输入。

## drag 模式下的行为

drag 模式下，`fixed` 仍在所属 Scene 内使用 `position: absolute` 定位，不使用 scroll 固定层。

## 相关页面

- [Position API](/docs/05-position)：`at` 与 `fixed` 的完整 prop 表
- [center-lock 滚动](/docs/01-centerlock)：场景滚动区间与锁定机制
- [DOM 与布局契约](/docs/06-dom-contract)：框架会覆盖哪些作者样式
- [scroll 排错](/docs/06-scroll-pitfalls)：同类症状的其他成因
