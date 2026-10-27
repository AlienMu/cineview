---
title: cv-stage
eyebrow: ELEMENTS / STAGE
---

`cv-stage` 是整个页面。场景（`cv-scene`）必须是它的直接子元素，舞台里至少要有一个场景。它决定读者用滚动还是拖动前进，也提供脚本接口。

```html
<cv-stage design-width="1200">
  <cv-scene>…</cv-scene>
  <cv-scene zone>…</cv-scene>
</cv-stage>
```

## 属性

| 属性 | 默认 | 说明 |
| --- | --- | --- |
| `input` | `scroll` | `scroll` 或 `drag`，见[滚动与拖动](/docs/03-input-modes) |
| `design-width` | `750` | 设计稿宽度（像素）。舞台的内容区最宽到这个宽度并居中；`--cv-unit` 按它换算 |
| `margin` | `50` | 入场边距（设计像素），可写两个值分别给入场和退场 |
| `first-scene-timeout` | `3000` | 首屏等待素材的最长时间，见[首屏](/docs/07-first-screen) |
| `paused` | `false` | 暂停按时间播放的动效：入场和循环 |
| `fallback` | `false` | 关闭浏览器原生的滚动时间线，改由脚本逐帧计算；用于测试 |
| `transition-duration` | `800` | 拖动模式：松手后切换的时长（毫秒） |
| `threshold` | 未设置 | 拖动模式：切换门槛，见[拖动模式](/docs/16-drag-mode) |
| `unit`、`scale` | `time`、`10` | 拖动模式：手指距离怎么换算成时间 |

## 设计宽度和单位

场景里可以用 `--cv-unit` 按设计稿写尺寸。`design-width="1200"` 时，`calc(var(--cv-unit) * 24)` 在 1200 像素宽的内容区里是 24 像素，在 600 像素宽时是 12 像素：

```css
h1 { font-size: calc(var(--cv-unit) * 64); }
```

舞台的内容区最宽到 `design-width`，所以全宽的页面要把它设成足够大，例如 `1920`。

## 脚本接口

| 成员 | 作用 |
| --- | --- |
| `stage.ready` | 第一次构建完成时兑现的 Promise；`cv-ready` 已派发过之后再等待，也会立即兑现 |
| `stage.current` | 当前场景的序号，构建前是 -1 |
| `stage.goTo(target, { animated })` | 按序号或 id 跳到某个场景；`animated: false` 时直接跳过去 |
| `stage.pause()`、`stage.play()` | 暂停和继续按时间播放的动效（入场和循环） |
| `stage.refresh()` | 页面布局有了舞台察觉不到的变化后，重新测量 |

```js
const stage = document.querySelector('cv-stage');
await stage.ready;
stage.goTo('pricing');
```

舞台派发的事件和写在它上面的状态属性见[状态与事件](/docs/08-states-and-events)。
