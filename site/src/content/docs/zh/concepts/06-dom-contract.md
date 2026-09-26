---
title: DOM 与布局契约
eyebrow: CONCEPTS / DOM
---

选择器没有命中 Scene、内容被裁切，或定位的元素跟着错误的区域移动时，可从这里检查。

## 样式应用在哪些元素上

Cineview 在模式容器外渲染一层响应式容器。drag 模式会加入场景导航所需的包装元素；scroll 模式会加入滚动和锁定区包装元素。每个 `Scene` 仍在这些元素内渲染自己的节点。

如果选择器假定 `Scene` 是 `.cineview-container` 的直接 DOM 子节点，可能无法命中。可给 Scene 设置 class；需要选中场景外层元素时，使用 `[data-scene-index]`。

## 让自定义 CSS 跟随设计稿缩放

响应式容器提供 `--cineview-unit`，表示当前一个设计像素对应的 CSS 长度。自定义样式需要跟随 `designWidth` 时，可以使用它：

```css
.my-panel {
  padding: calc(24 * var(--cineview-unit));
  border-radius: calc(12 * var(--cineview-unit));
}
```

两种模式都按视窗宽度换算这个值。锁定区的滚动距离仍按声明时长每 1ms 对应 1px 计算。

## 直接声明 Scene

Cineview 只检查下一层的 `Scene` 元素。Scene 数组可以使用；Fragment 或返回 Scene 的自定义组件会隐藏内部元素。完全找不到 Scene 时，`onError` 会收到 `EMPTY_SCENES`。

```tsx
import { Cineview, Scene } from 'cineview';

export default function App() {
  return (
    <Cineview mode="drag" designWidth={750}>
      <Scene sceneId="intro"><h1>介绍</h1></Scene>
      <Scene sceneId="details"><h2>细节</h2></Scene>
    </Cineview>
  );
}
```

用数组渲染且顺序可能变化时，给每个 Scene 设置稳定的 React `key`。

## Scene 样式与裁切

Scene 的 `style` 可设置一般视觉属性。场景尺寸、位置、溢出、变换和指针行为由 Cineview 按模式控制。尺寸和溢出应使用 Scene 的布局属性，见[拖动布局](/docs/01-layout)和 [Scene](/docs/02-scene)。

每个 Scene 有自己的层叠上下文。增大子元素的 `z-index` 无法让它盖过相邻 Scene。同一 Scene 内需要调整顺序时，可在同级 `Position` 上设置 `style.zIndex`。

## scroll 模式的固定元素

带有变换的 Scene 会改变原生 `position: fixed` 的定位参照。元素需要在所属 Scene 可见期间保持屏幕对齐时，使用 `Position fixed`。跨场景持续显示的 UI 应放在 Cineview 外。详见[固定元素](/docs/04-fixed-layer)。

## 常用选择器

| 选择器 | 对应元素 |
| --- | --- |
| `[data-cineview-container]` | 模式容器 |
| `[data-scene-index]` | 单个 Scene 的外层元素 |
| `[data-cineview-takeover-shell]` | 锁定区的 sticky 包装元素 |
| `[data-scene-fixed-layer]` | Scene 所属的固定层 |
| `[data-cineview-animate-id]` | 应用 Animate 样式的元素 |

普通 Scene 也可能带有 `[data-cineview-scroll-zone]`，因此仅凭这个属性不能判断锁定区是否已激活。需要在重新挂载后继续用同一选择器定位 Animate 时，请显式设置 `animateId`。

## 相关页面

- [运行态](/docs/07-runtime-states)：Scene 何时不接收指针输入
- [固定元素](/docs/04-fixed-layer)：场景内的屏幕对齐元素
- [响应式换算](/docs/05-responsive)：`designWidth` 如何影响设计长度
- [拖动布局](/docs/01-layout)：drag 模式的尺寸与溢出
