---
title: cv-scene
eyebrow: ELEMENTS / SCENE
---

`cv-scene` 是一个场景：讲一件事，有自己的时间线。它是 `cv-stage` 的直接子元素，里面放内容和 `cv-animate` 等元素。

```html
<cv-scene id="story" zone theme="dark">
  <cv-animate fx="rise(line)" duration="900"><h2>标题</h2></cv-animate>
</cv-scene>
```

## 属性

| 属性 | 说明 |
| --- | --- |
| `zone` | 锁定区：画面停住，滚动距离推进这一场的时间，见[时间线](/docs/05-timeline) |
| `track="x"` | 内容排成一行，随滚动横向移动 |
| `stack` | 这一场停在原处，下一场从下方盖上来 |
| `covered` | 被盖住时的样子：`dim` 变暗，`recede` 变暗并缩小 |
| `theme` | 这一场作为当前场景时，舞台的 `data-cv-theme` 取这个值 |
| `sequence` | 没写 `after` 的元素依次接在前一个之后，值是间隔毫秒数 |
| `preload` | 首屏等待这一场的素材，见[首屏](/docs/07-first-screen) |
| `drag="off"` | 拖动模式：不能拖进这一场，只能用链接或脚本切换过去 |
| `unit`、`scale` | 拖动模式：只对这一场生效的换算 |

## 锁定区

`zone` 的场景在滚到时停住，滚动距离就是这一场的时间，1 毫秒对应 1 像素；停下就停，往回滚动就倒回去。这一场的长度由最晚结束的元素决定，写法和例子见[时间线](/docs/05-timeline)。

## 横向移动

`track="x"` 的场景把内容排成一行，纵向滚动时横向移动，移动距离等于这一行超出屏幕的宽度。滚到这一场时画面停住，横向走完后继续往下。

## 叠盖与遮罩

`stack` 的场景被下一场盖住时，`covered` 决定它的样子。遮罩默认是黑色，`dim` 最深 50%，`recede` 最深 30% 并缩小到 92%。在场景或它的祖先上设置 `--cv-veil` 可以换成页面自己的颜色，这时颜色的透明度就是盖满时的深度：

```css
#intro { --cv-veil: rgb(154 102 64 / 30%); }
```

## 场景的切换

当前场景是位于屏幕中线上的那一个。切换时，离开的场景派发 `cv-leave`，进入的场景派发 `cv-enter`，舞台的 `data-cv-direction` 写上方向。

场景的 `theme` 在它成为当前场景时写到舞台的 `data-cv-theme` 上：滚动时是它越过屏幕中线，拖动时是页面移过一半、还没滑到位的时候。没有 `theme` 的场景会清掉这个属性。用它切换整页配色：

```html
<cv-scene id="night" theme="dark">…</cv-scene>
```

```css
cv-stage[data-cv-theme="dark"] { --ground: #0b0e1a; --ink: #eef1ff; }
```
