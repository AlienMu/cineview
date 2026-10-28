---
title: cv-stack
eyebrow: ELEMENTS / STACK
---

`cv-stack` 让卡片一张张叠上来。它的每个子元素是一张卡片。

```html
<cv-scene zone>
  <cv-stack step="52" duration="600" covered="recede">
    <article class="card">…</article>
    <article class="card">…</article>
    <article class="card">…</article>
  </cv-stack>
</cv-scene>
```

<!-- example:stack -->

## 属性

| 属性 | 说明 |
| --- | --- |
| `step` | 被盖住的卡片还露出多少像素 |
| `covered` | 被盖住时的样子：`dim` 或 `recede` |
| `duration` | 每张卡片叠上来的时长 |
| `delay`、`after`、`name`、`at`、`ease` | 与 `cv-animate` 相同 |

## 两种表现

- 在锁定区和拖动模式里，第一张卡片一开始就在，后面的卡片沿着这一场的时间线依次从下方升起，落到叠好的位置上。这时 `cv-stack` 带有 `data-cv-dealt`。
- 在普通滚动里，每张卡片比前一张低 `step` 像素吸顶，后面的卡片滚上来盖住前面的。
- 完全被盖住的卡片不再绘制。

## 遮罩颜色

被盖住的卡片默认变暗。在 `cv-stack` 或它的祖先上设置 `--cv-veil`，被盖住的卡片会改为铺上这种颜色，卡片里的文字也一起着色；颜色的透明度就是盖满时的深度：

```css
.deck { --cv-veil: rgb(200 120 80 / 45%); }
```

彩色遮罩要求卡片使用 `article` 或 `div` 等 HTML 容器，图片、视频和 SVG 放在容器内部：

```html
<cv-stack class="deck" covered="dim" step="36">
  <article class="card"><img src="photo.jpg" alt="一幅风景"></article>
  <article class="card"><svg viewBox="0 0 400 240" aria-label="一个圆" role="img"><circle cx="200" cy="120" r="80" /></svg></article>
</cv-stack>
```

如果设置了 `--cv-veil`，却直接用媒体或 SVG 作为卡片，整个 stack 会派发 `invalid-attribute` 的 `cv-error`，并使用默认变暗效果。给媒体加上外层容器即可使用颜色。

彩色遮罩使用卡片的 `::after`。自定义伪元素和滤镜放在内部元素上：卡片的位置、移动、缩放、可见性和默认变暗滤镜由 stack 控制。
