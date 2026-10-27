---
title: cv-pause
eyebrow: ELEMENTS / PAUSE
---

`cv-pause` 是一个开关按钮，暂停和继续舞台上按时间播放的动效（入场和循环），对应 WCAG 2.2.2。读者自己的滚动和拖动不受影响。

```html
<cv-pause>暂停动效</cv-pause>
<cv-pause for="story">暂停</cv-pause>
```

## 用法

- 不写 `for` 时控制最近的舞台，没有就控制文档里的第一个舞台；写了 `for` 时控制那个 id 的舞台。
- 没有内容时显示 Pause motion 和 Play motion。
- `aria-pressed` 跟着舞台的状态变化，可以按它写样式：`cv-pause[aria-pressed="true"]`。
- 页面有超过 5 秒的循环或自动播放时，提供一个这样的按钮。

## 用脚本控制

同样的效果也可以用舞台的 `stage.pause()` 和 `stage.play()`，或者 `paused` 属性实现；暂停和继续时舞台派发 `cv-pause` 和 `cv-play`，见 [cv-stage](/docs/09-stage)。
