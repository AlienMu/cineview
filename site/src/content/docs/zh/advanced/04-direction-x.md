---
title: 横向 direction: 'x'
eyebrow: ADVANCED / HORIZONTAL AXIS
---

在 Cineview 上设置 `direction="x"`，即可在两种模式中使用横向导航。默认方向为 `'y'`。

## 用法

```tsx
<Cineview mode="drag" designWidth={750} direction="x">
  <Scene sceneId="reel-01">...</Scene>
  <Scene sceneId="reel-02">...</Scene>
</Cineview>
```

```tsx
<Cineview mode="scroll" designWidth={1440} direction="x">
  <Scene sceneId="panorama" scroll={{ zoneId: 'panorama' }}>
    ...
  </Scene>
</Cineview>
```

## 横向模式改变什么

drag 读取横向位移与速度，并水平移动场景。手势进度按当前视窗宽度计算。

scroll 使用 `scrollLeft`、横向触摸位移与滚轮 `deltaX`。场景滚动范围和固定层使用横向跨度。自绘滚动条显示在底部，并设置 `aria-orientation="horizontal"`。

响应式基准保持不变：`scale = viewportWidth / designWidth` 在两个轴向下均基于视窗宽度计算。`'x'` 仅改变场景行进轴，不改变缩放映射基准。

## 注意事项

- wheel 输入仅消费 `deltaX`。标准鼠标竖直滚轮派发 `deltaY`，在 `'x'` 模式下不驱动位移；Shift+滚轮或触控板横向手势派发 `deltaX`，可正常驱动页面。
- drag 键盘导航使用左右方向键，scroll 使用上下方向键控制主轴。PageUp、PageDown、Home 和 End 在两种模式中都可用。
- drag 模式下 Scene 布局不随轴旋转，导航区域仍为完整视窗，高度不能按 Scene 单独修改；幕内内容可单独设置尺寸。
