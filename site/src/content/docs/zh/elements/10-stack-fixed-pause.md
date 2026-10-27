---
title: 叠卡、固定层与暂停
eyebrow: ELEMENTS / STACK FIXED PAUSE
---

这三个元素各管一件事：`cv-stack` 让卡片一张张叠上来，`cv-fixed` 让内容在场景经过时停在屏幕上，`cv-pause` 是暂停动效的按钮。

## cv-stack

`cv-stack` 的每个子元素是一张卡片。

```html
<cv-scene zone>
  <cv-stack step="52" duration="600" covered="recede">
    <article class="card">…</article>
    <article class="card">…</article>
    <article class="card">…</article>
  </cv-stack>
</cv-scene>
```

| 属性 | 说明 |
| --- | --- |
| `step` | 被盖住的卡片还露出多少像素 |
| `covered` | 被盖住时的样子：`dim` 或 `recede` |
| `duration` | 每张卡片叠上来的时长 |
| `delay`、`after`、`name`、`at`、`ease` | 与 `cv-animate` 相同 |

- 在锁定区和拖动模式里，第一张卡片一开始就在，后面的卡片沿着这一场的时间线依次从下方升起，落到叠好的位置上。这时 `cv-stack` 带有 `data-cv-dealt`。
- 在普通滚动里，每张卡片比前一张低 `step` 像素吸顶，后面的卡片滚上来盖住前面的。
- 完全被盖住的卡片不再绘制。

<!-- example:stack -->

## cv-fixed

`cv-fixed` 是场景的固定层：场景经过屏幕时，它的内容停在屏幕上，只在这一场的范围里出现。

```html
<cv-scene>
  <cv-fixed><nav class="chapter">第二章</nav></cv-fixed>
  <section>…</section>
</cv-scene>
```

- 它覆盖整个场景，并裁掉超出场景的部分；里面的内容吸在屏幕顶部，高度是一屏。
- 场景顶边到达屏幕顶部之前，固定层待在场景顶部；场景的底边会把它带走。
- 固定层本身不接收指针事件，里面的内容可以点击。
- 要在整页都显示的导航，放在 `cv-stage` 外面。

## cv-pause

`cv-pause` 是一个开关按钮，暂停和继续舞台上按时间播放的动效（入场和循环），对应 WCAG 2.2.2。读者自己的滚动和拖动不受影响。

```html
<cv-pause>暂停动效</cv-pause>
<cv-pause for="story">暂停</cv-pause>
```

- 不写 `for` 时控制最近的舞台，没有就控制文档里的第一个舞台；写了 `for` 时控制那个 id 的舞台。
- 没有内容时显示 Pause motion 和 Play motion。
- `aria-pressed` 跟着舞台的状态变化，可以按它写样式：`cv-pause[aria-pressed="true"]`。
- 页面有超过 5 秒的循环或自动播放时，提供一个这样的按钮。
