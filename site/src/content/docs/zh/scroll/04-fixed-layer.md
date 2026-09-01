---
title: Scene 作用域固定层
eyebrow: SCROLL / FIXED LAYER
---

在 scroll 模式下若需固定特定元素（如操作栏、滚动指示器或水印），推荐为 `Position` 配置 `fixed` 属性。节点将通过 React Portal 挂载至当前 Scene 专属的作用域固定层。

## 原生 fixed 的层叠上下文限制

根据 CSS 规范，当祖先元素包含非 `none` 的 `transform` 属性时，`position: fixed` 的定位参照上下文将重置为该祖先元素而非视窗。在 scroll 模式下，每个 Scene 容器均带有合成层提升样式 `transform: translateZ(0)`，导致直接书写的原生 `position: fixed` 局限于 Scene 边界内部。

## 固定层渲染架构

`Position` 的 `fixed` 属性基于三层结构实现：

| 层    | data 属性                       | 尺寸                                          | 作用                             |
| ----- | ------------------------------- | --------------------------------------------- | -------------------------------- |
| clip  | `data-scene-fixed-role="clip"`  | 覆盖整个场景滚动区间并配置 `overflow: hidden` | 边界约束：场景移出视野时整层隐藏 |
| frame | `data-scene-fixed-role="frame"` | 占据一个视窗高度，按该偏移在 clip 内位移      | 保持视觉固定                     |
| host  | `data-scene-fixed-role="host"`  | 铺满 frame                                    | portal 挂载点                    |

frame 的偏移量计算公式为 `clamp(视窗滚动偏移 - sceneStart, 0, 场景跨度 - frame 跨度)`。frame 采用 `position: absolute` 并根据该偏移跟随滚动同步位移，在视觉上呈现贴合视窗的效果，同时规避了 transform 对 fixed 定位参照上下文的影响。

该机制具备以下特征：

- **场景作用域隔离**：clip 区域尺寸与当前场景的滚动跨度完全对齐，场景移出视窗范围后整体置为 `visibility: hidden`。
- **跨场景常驻需外部定义**：固定层宿主挂载于单场景内部；若需跨场景常驻全局浮层（如全局导航栏），应将其置于 `CineView` 组件外部声明。

## 指针事件处理

固定层外层容器的 `pointerEvents` 均设为 `none`，避免遮挡场景内的正常交互内容。通过 portal 挂载进入的 `Position` 节点默认恢复 `pointerEvents: 'auto'`（以元素显式声明的 style 优先），使固定元素自身可正常响应指针事件，而其余固定层空白区域保持点击穿透。

## 用法

```tsx
<Scene sceneId="hero" scroll={{ zoneId: 'hero-seq', trigger: 'center-lock' }}>
  {/* 普通内容，照常随文档流滚动 */}
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
