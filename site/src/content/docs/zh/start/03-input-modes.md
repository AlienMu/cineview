---
title: 滚动与拖动
eyebrow: GETTING STARTED / INPUT MODES
---

`cv-stage` 的 `input` 属性决定读者怎么前进：`scroll`（默认）是普通网页式的滚动，`drag` 是一屏一个场景、用手指拖动切换。

## 滚动

滚动页面里，场景按文档顺序排列，可以混用几种场景：

| 场景写法 | 读者看到 |
| --- | --- |
| `<cv-scene>` | 普通区块，元素完整进入视口后按时间播放入场 |
| `<cv-scene zone>` | 锁定区：画面停住，滚动距离推进这一场的时间，1 毫秒对应 1 像素 |
| `<cv-scene track="x">` | 内容排成一行，随滚动横向移动 |
| `<cv-scene stack>` | 这一场停在原处，下一场从下方盖上来 |

锁定区的长度由这一场里最晚结束的元素决定，例子见[时间线](/docs/04-timeline)。

## 拖动

```html
<cv-stage input="drag" transition-duration="600">
  <cv-scene id="one">…</cv-scene>
  <cv-scene id="two">…</cv-scene>
</cv-stage>
```

每个场景占满一屏。手指拖动时，下一场的入场跟着手指走；松手时超过门槛就切换，不够就弹回。键盘的上下方向键、Page Up、Page Down、Home、End 也能切换。完整说明见[拖动模式](/docs/12-drag-mode)。

## 怎么选

- 内容长、要读文字，或者读者习惯普通网页：用滚动。
- 一屏一个画面、主要在手机上看、像翻相册或看短片：用拖动。
- 同一套内容想两种都给：两个页面共用同样的场景标记，只改 `input`。

## 跳到某个场景

页面里指向场景 id 的链接（`<a href="#two">`）会切到那个场景，滚动和拖动都适用。脚本里用 `stage.goTo('two')` 或 `stage.goTo(1)`；传 `{ animated: false }` 时直接跳过去，不带过渡。
