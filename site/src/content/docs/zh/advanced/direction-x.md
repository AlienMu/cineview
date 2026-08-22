---
title: 横向 direction: 'x'
eyebrow: AXIS
---

`direction: 'x'` 让两套引擎都跑在横轴上。它是根级开关——drag 走 `modes.drag.direction`，scroll 走 `modes.scroll.direction`——默认 `'y'`。

## 用法

```tsx
<CineView mode="drag" config={{ size: 750 }} modes={{ drag: { direction: 'x' } }}>
  <Scene sceneId="reel-01">...</Scene>
  <Scene sceneId="reel-02">...</Scene>
</CineView>
```

```tsx
<CineView mode="scroll" config={{ size: 1440 }} modes={{ scroll: { direction: 'x' } }}>
  <Scene sceneId="panorama" scroll={{ zoneId: 'panorama', trigger: 'center-lock' }}>
    ...
  </Scene>
</CineView>
```

## 随轴切换的环节

运行时里每一处轴向决策读的都是同一个解析后的 `direction`，不存在需要单独开启的「横向模式」：

- drag 输入读 `info.offset.x` / `info.velocity.x`，并以 `window.innerWidth` 折算进度；render 轨用 `translate3d(x%, 0, 0)` 而非 `translate3d(0, y%, 0)` 移动场景。
- scroll 输入在 wheel 上消费 `deltaX`、在触摸上消费横向位移，根容器布局为 `overflow-x: scroll; overflow-y: hidden`。接管场景沿宽度生长——编译出的接管跨度写进 `layout.width`，screen 尺寸场景配 `min-width: 100vw` 与左缘 sticky。
- 视口跨度记账（快照、预算、防跳过段）统一用 `viewport.width`，嵌套可滚动让位也在同轴上检查 `overflow-x` / `scrollLeft`。
- 滚动条覆盖层沿底边渲染横向 rail，`aria-orientation="horizontal"`；拖拽 thumb 时把 `clientX` 映射到 `scrollLeft`。

响应式换算尺不受影响：`scale = viewportWidth / size` 在两个轴向下都只认宽。`'x'` 改变的是行进轴，绝不是换算尺。

## 注意事项

- wheel 输入只读 `deltaX`。普通鼠标竖直滚轮产出的是 `deltaY`，在 `'x'` 模式下不会产生位移；Shift+滚轮 与触控板横向滑动产出 `deltaX`，可以驱动页面。
- 键盘翻页跟随配置轴，而不是按键名：ArrowDown 与 PageDown 沿 `'x'` 正向前进，ArrowUp 与 PageUp 反向后退。
- drag 模式下 Scene 布局不随轴旋转——场景在两个维度上仍填满容器，只有场景栈的行进方向变了。
