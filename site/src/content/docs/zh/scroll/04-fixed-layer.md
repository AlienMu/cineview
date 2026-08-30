---
title: Scene 作用域固定层
eyebrow: SCROLL / FIXED LAYER
---

scroll 模式下想钉住一个元素（工具条、滚动提示、水印），别在 Scene 里裸写 `position: fixed`，它必然失效。正确写法是给 `Position` 传 `fixed`，节点会被 portal 进这个 scene 自己的固定层。锁定区（locked zone）里的钉件也走同一套。

## 裸写 fixed 为什么必然失效

CSS 规则：只要某个祖先带了非 `none` 的 `transform`，`position: fixed` 就不再相对视口，而是相对那个祖先。scroll 模式下每个 Scene 容器**恒带 `transform: translateZ(0)`**（用于提升合成层，不是按条件开的），所以 Scene 子树里的每个 fixed 元素都被框在这个祖先里。锁定区场景更严格，它的内容层还有一层无条件 transform。

「必然」不是修辞：这不是某些配置下才出现的边缘情况，scroll 下没有任何写法能让裸 fixed 相对视口。没有报错，也没有警告，只能靠观察渲染结果发现。症状对上了就别再回头查自己的 CSS。

## 三层结构

`Position` 的 `fixed` prop 不靠 `position: fixed` 实现，而是三层 div 加算术：

| 层    | data 属性                       | 尺寸                                               | 作用                         |
| ----- | ------------------------------- | -------------------------------------------------- | ---------------------------- |
| clip  | `data-scene-fixed-role="clip"`  | 跨整个场景滚动区间 + `overflow: hidden`            | 边界：场景走出视野时整层隐藏 |
| frame | `data-scene-fixed-role="frame"` | 一个视口高（主轴），按 `hostOffset` 在 clip 内滑动 | 视觉钉住                     |
| host  | `data-scene-fixed-role="host"`  | 铺满 frame                                         | portal 挂载点                |

`hostOffset` 是 `clamp(视口偏移 - sceneStart, 0, 场景跨度 - frame 跨度)`。frame 用 `absolute` + 这个算出来的偏移，在 clip 内跟着滚动同步位移，视觉效果就是「贴在屏幕上不动」。全程走 `absolute`，一次 `position: fixed` 都没用到，所以那条 transform 规则碰不到它。

这个结构决定了两件事，都不是配置项：

- **天然 scene-scoped**。clip 的尺寸就是这个场景的滚动区间，`overflow: hidden` 把越界部分裁掉，场景退出视野时整层 `visibility: hidden`。可见、裁剪、退场都以 scene 边界为准。
- **跨 scene 常驻结构上不可能**。「一个元素贯穿多个场景钉在屏上」没有对应能力，因为宿主本身位于某一个场景的 clip 内部。每个需要钉件的 scene 各自声明一份，或者把全局钉件（站点导航之类）放到 `CineView` 外面自己写。

首渲染有一帧例外：宿主元素是靠 ref 回调写进 state 的，那一帧 portal 目标还是 null，`Position` 退化成 `position: sticky`。之后正常走 portal。

## 交互

三层 div 的 `pointerEvents` 全是 `none`。空的宿主层如果拦指针，会盖住整个场景的可交互内容，所以整条链都不接事件。交互只在 portal 进来的 `Position` 节点上恢复：传了 `fixed` 的 `Position` 默认 `pointerEvents: 'auto'`（作者在 `style` 里显式写的值优先）。

也就是说钉件本身可以点，钉件之外的固定层区域对指针完全透明。

## 用法

```tsx
<Scene sceneId="hero" scroll={{ zoneId: 'hero-seq', trigger: 'center-lock' }}>
  {/* 普通内容，照常随文档流滚动 */}
  <Position at={{ x: 40, y: 200 }}>
    <h1>标题</h1>
  </Position>

  {/* 钉住，作用域 = 本 scene */}
  <Position at={{ anchor: 'center-x', y: 600 }} fixed>
    <div>向下滚动继续</div>
  </Position>
</Scene>
```

`at` 的坐标语义不变：仍是设计 px，按同一个换算基准折算，只是参照系换成了固定层宿主。

## drag 下是静默 no-op

drag 模式没有固定层宿主，也没有 sticky 兜底。`fixed` 在 drag 下的**唯一**残留效果是把 `pointerEvents` 强制成 `'auto'`；定位照常走 `position: absolute`，与不传这个 prop 没有区别。drag 场景本来就不滚动，视觉上通常看不出差异，但要清楚这不是「drag 下也钉住」，而是「drag 下这个 prop 基本不做事」。

同一段 JSX 在两个模式间搬运时，这一格不会报错也不会警告。

## 相关页面

- [Position API](/docs/05-position)：`at` 与 `fixed` 的完整 prop 表
- [center-lock 滚动接管](/docs/01-centerlock)：场景滚动区间是怎么算出来的
- [DOM 与布局契约](/docs/06-dom-contract)：框架会覆盖哪些作者样式
- [scroll 排错](/docs/06-scroll-pitfalls)：同类症状的其他成因
