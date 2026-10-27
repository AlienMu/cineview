---
title: 自定义绘制
eyebrow: GUIDES / CUSTOM DRAWING
---

预设和 `from`、`to` 处理不了的画面，例如 Canvas、WebGL 或要按进度计算的 SVG，可以订阅一个元素的时间线，按它的进度自己绘制。

<!-- example:drawing -->

## 订阅时间线

找一个 `cv-animate` 当锚点，它的时间线决定绘制的进度：

```html
<cv-scene zone>
  <cv-animate id="anchor" from="opacity:.35" to="opacity:1" duration="2000" ease="linear">
    <canvas id="art" aria-hidden="true"></canvas>
  </cv-animate>
</cv-scene>
```

```js
const anchor = document.getElementById('anchor');
await customElements.whenDefined('cv-animate');
const stop = anchor.timeline.subscribe((frame) => draw(frame.progress));
draw(anchor.timeline.progress);
```

- 回调在每一帧最多调用一次，参数里有 `progress`、`phase` 和 `source`。
- 订阅后先按当前的 `timeline.progress` 画一次，不必等第一次变化。
- 锁定区和拖动场景里，进度跟着读者的滚动或手指；普通滚动里，进度是按时间播放的入场，只在有订阅者时逐帧计算。

## 进度从哪里来

时间线只反映时间类的来源（`scene`、`enter`、`eye`、`clock`）。只用 `view`、`page` 或速度、方向信号的元素，时间线一直是 `idle`，因为它们的进度是位置而不是时间。要按滚动位置绘制，就把锚点放在锁定区里，或者在页面脚本里自己读滚动位置。

## 开始和停止

- 绘制只在需要时进行：场景进入渲染范围时派发 `cv-activate`，离开时派发 `cv-deactivate`，在这两个事件里开始和停止自己的动画循环。
- 页面移除这部分内容时，调用 `subscribe` 返回的函数取消订阅，并停止自己的 `requestAnimationFrame` 和观察器。
- 画布尺寸跟着元素大小变化：用 `ResizeObserver` 重设画布的像素尺寸，再按当前进度重画一次。

## 无障碍和减弱动态效果

- 画布本身对读屏软件没有意义：加 `aria-hidden="true"`，把要传达的内容写成真实的文字。
- 系统开启减弱动态效果时，可以直接画最终画面：

```js
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
anchor.timeline.subscribe((frame) => draw(still ? 1 : frame.progress));
```
