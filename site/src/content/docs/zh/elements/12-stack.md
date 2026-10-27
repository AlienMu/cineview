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
