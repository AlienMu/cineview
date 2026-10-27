---
title: 舞台与场景
eyebrow: ELEMENTS / STAGE AND SCENE
---

`cv-stage` 是整个页面，`cv-scene` 是其中的一个场景。场景必须是舞台的直接子元素，舞台里至少要有一个场景。

## cv-stage

| 属性 | 默认 | 说明 |
| --- | --- | --- |
| `input` | `scroll` | `scroll` 或 `drag`，见[滚动与拖动](/docs/03-input-modes) |
| `design-width` | `750` | 设计稿宽度（像素）。舞台的内容区最宽到这个宽度并居中；`--cv-unit` 按它换算 |
| `margin` | `50` | 入场边距（设计像素），可写两个值分别给入场和退场 |
| `first-scene-timeout` | `3000` | 首屏等待素材的最长时间，见[首屏](/docs/06-first-screen) |
| `paused` | `false` | 暂停按时间播放的动效：入场和循环 |
| `fallback` | `false` | 关闭浏览器原生的滚动时间线，改由脚本逐帧计算；用于测试 |
| `transition-duration` | `800` | 拖动模式：松手后切换的时长（毫秒） |
| `threshold` | 未设置 | 拖动模式：切换门槛，见[拖动模式](/docs/12-drag-mode) |
| `unit`、`scale` | `time`、`10` | 拖动模式：手指距离怎么换算成时间 |

### 设计宽度和单位

场景里可以用 `--cv-unit` 按设计稿写尺寸。`design-width="1200"` 时，`calc(var(--cv-unit) * 24)` 在 1200 像素宽的内容区里是 24 像素，在 600 像素宽时是 12 像素：

```css
h1 { font-size: calc(var(--cv-unit) * 64); }
```

舞台的内容区最宽到 `design-width`，所以全宽的页面要把它设成足够大，例如 `1920`。

## cv-scene

| 属性 | 说明 |
| --- | --- |
| `zone` | 锁定区：画面停住，滚动距离推进这一场的时间，见[时间线](/docs/04-timeline) |
| `track="x"` | 内容排成一行，随滚动横向移动 |
| `stack` | 这一场停在原处，下一场从下方盖上来 |
| `covered` | 被盖住时的样子：`dim` 变暗，`recede` 变暗并缩小 |
| `theme` | 这一场作为当前场景时，舞台的 `data-cv-theme` 取这个值 |
| `sequence` | 没写 `after` 的元素依次接在前一个之后，值是间隔毫秒数 |
| `preload` | 首屏等待这一场的素材，见[首屏](/docs/06-first-screen) |
| `drag="off"` | 拖动模式：不能拖进这一场，只能用链接或脚本切换过去 |
| `unit`、`scale` | 拖动模式：只对这一场生效的换算 |

### 叠盖与遮罩

`stack` 的场景被下一场盖住时，`covered` 决定它的样子。遮罩默认是黑色，`dim` 最深 50%，`recede` 最深 30% 并缩小到 92%。在场景或它的祖先上设置 `--cv-veil` 可以换成页面自己的颜色，这时颜色的透明度就是盖满时的深度：

```css
#intro { --cv-veil: rgb(154 102 64 / 30%); }
```

### 横向移动

`track="x"` 的场景把内容排成一行，纵向滚动时横向移动，移动距离等于这一行超出屏幕的宽度。滚到这一场时画面停住，横向走完后继续往下。

## 场景的切换

当前场景是位于屏幕中线上的那一个。切换时，离开的场景派发 `cv-leave`，进入的场景派发 `cv-enter`，舞台的 `data-cv-direction` 写上方向。场景的 `theme` 在它成为当前场景时写到舞台的 `data-cv-theme` 上：滚动时是它越过屏幕中线，拖动时是页面移过一半、还没滑到位的时候。没有 `theme` 的场景会清掉这个属性。用它切换整页配色：

```html
<cv-scene id="night" theme="dark">…</cv-scene>
```

```css
cv-stage[data-cv-theme="dark"] { --ground: #0b0e1a; --ink: #eef1ff; }
```
