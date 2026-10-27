---
title: 时间线
eyebrow: CONCEPTS / TIMELINE
---

同一个场景里的元素排在一条时间线上。每个元素声明自己的时长，再用 `delay`、`after` 或 `at` 决定它从哪里开始。场景之间的时间线互不影响。

## 时长与等待

| 属性 | 含义 |
| --- | --- |
| `duration` | 入场时长，单位毫秒；省略时用效果预设自带的时长 |
| `delay` | 从起点等多久再开始 |
| `exit`、`exit-duration` | 离开时的样子和时长 |

```html
<cv-animate fx="rise(soft)" duration="600" delay="200"><p>200 毫秒后开始，播放 600 毫秒</p></cv-animate>
```

## 接在谁后面

`after` 让一个元素接在同一场景里另一个元素的入场结束之后。被接的元素用 `name` 命名：

```html
<cv-animate name="title" fx="rise(soft)" duration="600"><h2>标题</h2></cv-animate>
<cv-animate fx="fade" duration="400" after="title"><p>标题结束后开始</p></cv-animate>
<cv-animate fx="fade" duration="400" after="title -200"><p>提前 200 毫秒，与标题重叠</p></cv-animate>
<cv-animate fx="fade" duration="400" after="title +300"><p>标题结束后再等 300 毫秒</p></cv-animate>
```

- `after` 等的是对方的入场结束，不是退场。
- 名字只在同一场景里有效；名字对不上、两个元素重名或形成循环时，会派发 `cv-error`。
- 场景加上 `sequence` 后，没写 `after` 的元素依次接在前一个元素之后，`sequence` 的值是间隔毫秒数，可以为负。
- 普通滚动里，一条 `after` 链由链头决定什么时候开始，后面的元素不各自等待进入视口。纵向隔得很远、需要各自出现的内容，用各自的入场和 `delay` 来安排。

## 按比例放进场景

`at` 用百分比把元素放到这一场的某一段：`at="20% 60%"` 表示从全长的 20% 播到 60%。只写一个值时只定起点，`auto 80%` 只定终点。每个值都要带 `%`。

```html
<cv-scene zone>
  <cv-animate from="scale-x:0" to="scale-x:1" duration="2400" ease="linear"><span class="bar"></span></cv-animate>
  <cv-animate fx="fade" at="20% 40%"><p>在全长的 20% 到 40% 之间出现</p></cv-animate>
</cv-scene>
```

## 锁定区的长度

锁定区里，1 毫秒的时间线对应 1 像素的滚动距离。这一场的总长等于最晚结束的元素：它的 `delay` 加 `duration`（以及 `after` 带来的推迟和退场）。写了 `at` 的元素也会把自己的时长计入总长，再按比例放进去。

常见的做法是放一个锚点元素，用它的 `duration` 决定这一场的长度，其余元素用 `at` 或 `after` 排进去。下面这个案例里，进度条的 `duration` 是 2400，所以这一场占 2400 像素：

<!-- example:timeline -->

## 读取时间线

每个 `cv-animate` 都有 `timeline` 属性，可以读取当前进度，也可以订阅变化：

```js
const el = document.querySelector('#anchor');
await customElements.whenDefined('cv-animate');
const stop = el.timeline.subscribe((frame) => {
  console.log(frame.progress, frame.phase, frame.source);
});
```

`frame.progress` 从 0 到 1，`frame.phase` 是 `idle`、`entering`、`entered`、`exiting` 或 `exited`。用它驱动自己画的内容见[自定义绘制](/docs/17-custom-drawing)。
