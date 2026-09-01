---
title: 横向 direction: 'x'
eyebrow: ADVANCED / HORIZONTAL AXIS
---

`direction: 'x'` 允许引擎在横轴上运行。该配置为根级属性，drag 与 scroll 模式均通过 `direction` 配置，默认值为 `'y'`。

## 用法

```tsx
<CineView mode="drag" designWidth={750} direction="x">
  <Scene sceneId="reel-01">...</Scene>
  <Scene sceneId="reel-02">...</Scene>
</CineView>
```

```tsx
<CineView mode="scroll" designWidth={1440} direction="x">
  <Scene sceneId="panorama" scroll={{ zoneId: 'panorama', trigger: 'center-lock' }}>
    ...
  </Scene>
</CineView>
```

## 随轴切换的环节

运行时中所有轴向分支均读取统一解析后的 `direction`，无需单独启用额外的横向开关。

drag 输入读取 `info.offset.x` 与 `info.velocity.x`，并以 `window.innerWidth` 折算位移进度；场景切换通过 `translate3d(x%, 0, 0)` 代替 `translate3d(0, y%, 0)` 执行平移。

scroll 输入在 wheel 事件中消费 `deltaX`，在触摸手势中消费横向位移；根容器应用 `overflow-x: scroll; overflow-y: hidden` 样式；锁定区场景沿宽度方向展开，构建产物将锁定区跨度写入 `layout.width`，视窗尺寸场景配置 `min-width: 100vw` 与左侧 sticky 定位。视窗跨度度量（包含快照、时长预算、防跳过段）统一使用 `viewport.width`，嵌套可滚动元素的让位逻辑在相同轴向上检测 `overflow-x` 与 `scrollLeft`。滚动条覆盖层沿底边渲染横向滑轨，标注 `aria-orientation="horizontal"`，拖拽滑块时将 `clientX` 映射至 `scrollLeft`。

响应式基准保持不变：`scale = viewportWidth / designWidth` 在两个轴向下均基于视窗宽度计算。`'x'` 仅改变场景行进轴，不改变缩放映射基准。

## 注意事项

- wheel 输入仅消费 `deltaX`。标准鼠标竖直滚轮派发 `deltaY`，在 `'x'` 模式下不驱动位移；Shift+滚轮或触控板横向手势派发 `deltaX`，可正常驱动页面。
- 键盘翻页跟随配置轴，而非按键物理名称：ArrowDown 与 PageDown 沿 `'x'` 正向前进，ArrowUp 与 PageUp 反向后退。
- drag 模式下 Scene 布局不随轴旋转，场景在两个维度上仍填满容器，仅场景栈的行进方向发生变更。
