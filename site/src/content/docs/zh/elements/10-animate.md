---
title: cv-animate
eyebrow: ELEMENTS / ANIMATE
---

`cv-animate` 包住一段内容，声明它在时间线上的样子。效果写在 `fx` 里，也可以用 `from` 和 `to` 直接写数值。

## 属性

| 属性 | 例子 | 说明 |
| --- | --- | --- |
| `fx` | `rise(soft), wipe(left)` | 效果预设，可用逗号写多个 |
| `from`、`to` | `from="opacity:0; y:40"` | 直接写起止数值 |
| `duration`、`delay` | `600` | 时长和等待，单位毫秒；锁定区里也是滚动像素 |
| `name`、`after` | `after="title -200"` | 接在同一场景另一个元素的入场之后，见[时间线](/docs/05-timeline) |
| `at` | `20% 60%` | 按这一场长度的比例放置 |
| `on` | `clock` | 进度来源，见[进度来源](/docs/06-progress-sources) |
| `ease` | `linear` | 缓动 |
| `exit`、`exit-duration` | `exit="opacity:0; y:-16"` | 离开时的样子和时长，可以写数值，也可以写预设 |
| `split` | `lines`、`words` | 按行或按词分别播放 |
| `target`、`stagger` | `target=".card" stagger="120"` | 对匹配的子元素依次播放 |
| `loop`、`loop-duration` | `loop="float"` | 入场结束后的循环，只在屏幕内运行 |
| `replay` | 无值 | 普通滚动里，每次重新进入视口都重播入场 |
| `margin` | `50 30` | 只对这个元素生效的入场边距 |

## 效果预设

| 预设 | 参数 | 效果 |
| --- | --- | --- |
| `fade` | 无 | 透明度从 0 到 1 |
| `rise` | `soft`（20 像素）、`strong`（80）、像素、`%`、`line`；不写为 40 像素 | 从下方升起并淡入；`rise(line)` 从自身的裁切里升起，不淡入 |
| `grow` | `soft`、`strong`、倍数；不写为 0.9 | 从略小放大到原大并淡入 |
| `focus` | `soft`、`strong`、像素、`band`；不写为 4.5 像素 | 从模糊变清晰，透明度从 0.34 到 1；`focus(band)` 只在穿过视口的中段清晰 |
| `wipe` | `left`（默认）、`right`、`top`、`bottom`、`up`、`down`、`center` | 裁切边从一侧扫过；`center` 从中线向两边打开 |
| `push` | `in`、`out`，或起止倍数和焦点 | 围绕焦点缓慢缩放 |
| `reveal` | 方向和模糊程度，如 `reveal(left, soft)` | `wipe`、`focus`、`push` 合在一起 |
| `develop` | 无 | 图片加载时从模糊的占位图显影 |
| `duotone` | `blue`、`orange`、`terracotta`、`mono`，或深浅两种颜色 | 把里面的图片印成双色 |
| `draw` | 无 | 描边按笔画画出来，可以用 `target` 限定 |
| `count` | 无 | 数字按位滚动到目标值 |
| `axis` | `wght 250 650`、`wdth 75 100` | 可变字体的轴随时间变化 |
| `drift` | `soft`（3.5%）、`strong`（16%）、`%`、像素；不写为元素高度的 10%，只写数字时单位是像素 | 随视口位置产生视差位移 |
| `skew` | `soft`、`strong`、角度；不写为 4 度 | 随滚动速度倾斜 |
| `hue` | 一个或两个角度 | 转动 `--cv-hue`，配合 `oklch()` 换色 |
| `invert` | 无 | 与背后的内容做差值混合 |
| `unroll` | 无 | 竖排长条随滚动展开 |
| `keyframes` | 页面里 `@keyframes` 的名字 | 按元素的进度播放自己的关键帧 |
| `fade-in`、`slide-up`、`zoom-in`、`rotate-in`、`blur-in` | 无 | 简单入场：淡入、上移一整个自身高度、从 0 放大、旋转进入、去模糊 |

参数的程度词只有 `soft` 和 `strong`，不写参数就是中间值；写 `normal` 会报错。`rise`、`grow`、`focus` 已经带有淡入，再加 `fade` 会让同一个属性叠两次。改动不同属性的预设可以放心组合，如 `rise(soft), wipe(left)`。

## 直接写数值

`from` 和 `to` 可以写这些属性：`opacity`、`x`、`y`、`scale`、`scale-x`、`scale-y`、`rotate`、`rotate-x`、`rotate-y`、`skew-x`、`skew-y`、`blur`、`clip`、`draw`，以及自定义属性（`--name`）。`x` 和 `y` 的 `%` 相对元素自身。

```html
<cv-animate from="opacity:0; x:-24" to="opacity:1; x:0" duration="500"><p>从左侧滑入</p></cv-animate>
<cv-animate from="--lit:0" to="--lit:1" duration="800"><span class="glow">发光</span></cv-animate>
```

自定义属性写在包裹内容的内层，里面的元素能读到，`cv-animate` 自身读不到；读取时写一个后备值：`opacity: var(--lit, 0)`。

## 内容怎么被包裹

`cv-animate` 的子元素留在原处，但会被放进它影子树里的块中，动效写在这些块上：

- 给子元素排版（grid、flex、gap）要写在里面的一个元素上，不要写在 `cv-animate` 上。
- 要设置变形原点，用 `::part(layer)`：`.bar::part(layer) { transform-origin: left center; }`。
- 要画出会动的东西（例如一条线），画在里面的元素上。

## 拆分文字

`split="lines"` 按行，`split="words"` 按词。真实的文字保留给读屏软件，动的是隐藏的副本：

```html
<cv-animate split="lines" fx="rise(line)" stagger="90"><h2>一段会按行升起的标题</h2></cv-animate>
```

## 循环

`loop` 在入场结束后开始，只在元素位于屏幕内时运行。内置循环有 `float`、`sway`、`pulse`、`breathe`、`spin`，都接受 `soft`、`strong`（`spin` 接受方向）。效果预设也可以写进 `loop`，会来回播放。还可以直接写关键帧列表：

```html
<cv-animate loop="float(soft)"><img src="badge.svg" alt=""></cv-animate>
<cv-animate loop="opacity: 1 .45 1" loop-duration="2400"><span class="dot"></span></cv-animate>
```

## 自定义效果

`defineEffect` 注册一个新预设，之后可以写在 `fx`、`exit` 和 `loop` 里：

```js
import { defineEffect } from 'cineview';

defineEffect('lift', { from: 'opacity:0; y:24; scale:.98', to: 'opacity:1; y:0; scale:1', ease: 'settle', duration: 700 });
defineEffect('swing', (args) => ({ from: `rotate:${args[0] ?? 8}`, to: 'rotate:0' }));
```

从 CDN 加载时，把 `'cineview'` 换成运行时模块的地址。

名字只能用小写字母、数字和连字符，内置预设的名字不能覆盖。在舞台构建之后注册也可以，舞台会重新构建。
