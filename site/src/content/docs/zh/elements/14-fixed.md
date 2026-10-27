---
title: cv-fixed
eyebrow: ELEMENTS / FIXED
---

`cv-fixed` 是场景的固定层：场景经过屏幕时，它的内容停在屏幕上，只在这一场的范围里出现。适合章节标签、场景内的说明、跟着这一段走的按钮。

```html
<cv-scene>
  <cv-fixed><nav class="chapter">第二章</nav></cv-fixed>
  <section>…</section>
</cv-scene>
```

## 表现

- 它覆盖整个场景，并裁掉超出场景的部分；里面的内容吸在屏幕顶部，高度是一屏。
- 场景顶边到达屏幕顶部之前，固定层待在场景顶部；场景的底边会把它带走。
- 固定层本身不接收指针事件，里面的内容可以点击。

## 整页都要显示的内容

`cv-fixed` 只属于它所在的场景。要在整页都显示的导航或按钮，放在 `cv-stage` 外面，用普通的 CSS 固定定位。
