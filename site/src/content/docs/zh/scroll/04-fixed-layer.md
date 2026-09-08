---
title: Scene 作用域固定层
eyebrow: SCROLL / FIXED LAYER
---

操作栏、指示器等元素需要在 Scene 可见期间保持相对于屏幕的位置时，使用 `Position fixed`。

## 原生 fixed 的层叠上下文限制

scroll 模式下，Scene 的 transform 使其成为原生 `position: fixed` 后代的定位包含块。需要跟随视窗对齐时，使用框架提供的固定层。

## 固定层渲染架构

`Position` 的 `fixed` 属性基于三层结构实现：

| 层    | data 属性                       | 尺寸                                          | 作用                             |
| ----- | ------------------------------- | --------------------------------------------- | -------------------------------- |
| clip  | `data-scene-fixed-role="clip"`  | 覆盖整个场景滚动区间并配置 `overflow: hidden` | 边界约束：场景移出视野时整层隐藏 |
| frame | `data-scene-fixed-role="frame"` | 占据一个视窗高度，按该偏移在 clip 内位移      | 保持视觉固定                     |
| host  | `data-scene-fixed-role="host"`  | 铺满 frame                                    | portal 挂载点                    |

frame 的偏移量计算公式为 `clamp(视窗滚动偏移 - sceneStart, 0, 场景跨度 - frame 跨度)`。frame 采用 `position: absolute` 并根据该偏移跟随滚动同步位移，在视觉上呈现贴合视窗的效果，同时规避了 transform 对 fixed 定位参照上下文的影响。

固定层仅在所属 Scene 的滚动范围内可见。导航等需要跨场景持续显示的 UI 放在 CineView 外部。

## 指针事件处理

固定层外层容器的 `pointerEvents` 均设为 `none`，避免遮挡场景内的正常交互内容。通过 portal 挂载进入的 `Position` 节点默认恢复 `pointerEvents: 'auto'`（以元素显式声明的 style 优先），使固定元素自身可正常响应指针事件，而其余固定层空白区域保持点击穿透。

## 用法

```tsx
<Scene sceneId="hero" scroll={{ zoneId: 'hero-seq', trigger: 'center-lock' }}>
  {/* 属于这个 Scene 的内容 */}
  <Position at={{ x: 40, y: 200 }}>
    <h1>标题</h1>
  </Position>

  {/* 固定元素，作用域限定于当前场景 */}
  <Position at={{ anchor: 'center-x', y: 600 }} fixed>
    <div>向下滚动继续</div>
  </Position>
</Scene>
```

`at` 坐标属性语义保持一致：仍以设计稿 px 为基准并按响应式比例换算，定位参照系对齐至固定层宿主。

## drag 模式下的行为

在 drag 模式下，Scene 内部不设固定层宿主。`fixed` 属性在 drag 模式下仅将 `pointerEvents` 设为 `'auto'`，元素依旧按 `position: absolute` 在场景内绝对定位。

## 相关页面

- [Position API](/docs/05-position)：`at` 与 `fixed` 的完整 prop 表
- [center-lock 滚动](/docs/01-centerlock)：场景滚动区间与锁定机制
- [DOM 与布局契约](/docs/06-dom-contract)：框架会覆盖哪些作者样式
- [scroll 排错](/docs/06-scroll-pitfalls)：同类症状的其他成因
