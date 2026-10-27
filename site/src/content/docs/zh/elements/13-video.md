---
title: cv-video
eyebrow: ELEMENTS / VIDEO
---

`cv-video` 是一段跟着时间线播放的视频。它也是 `cv-animate`：`fx`、时长、`after`、退场和进度来源的写法都一样。没写 `fx` 时，它只是一个不带效果的入场，入场的进度用来定位视频的时间。

```html
<cv-scene zone>
  <cv-video src="ride.mp4" poster="ride-first-frame.jpg" duration="2400" ease="linear"
            aria-label="城市夜骑"></cv-video>
</cv-scene>
```

<!-- example:video -->

## 属性

| 属性 | 默认 | 说明 |
| --- | --- | --- |
| `src` | 未设置 | 视频地址 |
| `range` | 整个文件 | 时间线对应文件的哪一段，单位秒，如 `range="0 3.2"`；可以倒着写 |
| `preload` | 开启 | 把整个文件预先下载到缓存，任意一帧都能马上定位；`preload="none"` 关闭 |
| `poster` | 未设置 | 封面图 |
| `playback-rate` | `1` | 时间线结束后自然播放的速度 |
| `aria-label` | 未设置 | 视频的说明文字 |

`range` 结束在文件末尾之前时，时间线走完后，剩下的部分会按正常速度播放下去。这样可以先跟着滚动，再接着自己播放。

## 准备视频文件

- 跟着滚动或拖动定位的视频，每一帧都要是关键帧，否则倒退和跳转时会卡顿。可以用 ffmpeg 转码：

```bash
ffmpeg -i source.mp4 -an -c:v libx264 -preset slow -crf 24 -g 1 -keyint_min 1 \
  -pix_fmt yuv420p -movflags +faststart scrub.mp4
```

- 封面图用视频的第一帧，这样封面和开始播放时的画面一致：

```bash
ffmpeg -i scrub.mp4 -frames:v 1 -q:v 3 first-frame.jpg
```

- 去掉音轨（`-an`）。跟着滚动的视频不出声。
- 每帧都是关键帧会让文件变大，可以缩小尺寸或调高 `-crf`。

## 样式和事件

视频节点在影子树里，用 `::part(video)` 写样式：

```css
cv-video::part(video) { width: 100%; height: 100%; object-fit: cover; }
```

- `play`、`pause`、`ended`、`error` 会在 `cv-video` 上重新派发。
- 加载失败时同时派发 `asset-failed` 的 `cv-error`。
- `el.video` 是当前的 `<video>` 节点；缓存的副本到达后会换成新节点，所以每次用时都重新读取。

## 播放之外

`cv-video` 只负责跟着时间线播放。点击后开始播放、作为背景循环、播完自动切到下一场这类用法，用普通的 `<video>` 元素加上 `stage.goTo()` 来写：

```js
const clip = document.querySelector('#intro-film');
clip.addEventListener('ended', () => stage.goTo('after-film'));
```
