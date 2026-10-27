---
title: 概览
eyebrow: GETTING STARTED / OVERVIEW
---

Cineview 用一组自定义元素（`cv-*`）在普通 HTML 里写落地页。页面分成若干场景，每个场景有自己的时间线；读者滚动或拖动时，时间线随之前进。它不依赖任何前端框架，也可以放进 React 等框架的页面里。

## 一个页面由什么组成

| 元素 | 作用 |
| --- | --- |
| `cv-stage` | 整个页面，决定读者用滚动还是拖动前进 |
| `cv-scene` | 一个场景，讲一件事，有自己的时间线 |
| `cv-animate` | 场景里的一个元素，声明它在时间线上的效果 |
| `cv-stack`、`cv-video`、`cv-fixed`、`cv-pause` | 叠卡、随时间线播放的视频、固定层、暂停按钮 |

```html
<cv-stage>
  <cv-scene>
    <cv-animate fx="rise(line)" duration="900"><h1>每个场景，各有自己的时间线</h1></cv-animate>
    <cv-animate fx="rise(soft)" duration="700" delay="400"><p>标题先升起，说明随后出现。</p></cv-animate>
  </cv-scene>
</cv-stage>
```

<!-- example:first-page -->

## 三个基本概念

- 时间线：同一场景里的元素按 `duration`、`delay`、`after` 排在一条时间线上，详见[时间线](/docs/05-timeline)。
- 进度来源：时间线由什么推进。普通滚动里，元素进入视口后按时间播放；锁定区里，滚动距离就是时间；拖动模式里，手指推进时间，详见[进度来源](/docs/06-progress-sources)。
- 写在属性上：效果、时长和先后都写成属性。脚本只在需要时读取状态、监听事件或订阅时间线。

## 从哪里开始

1. [安装与加载](/docs/02-setup)：从 npm 安装或从 CDN 引入，在 `<head>` 里放三样东西。
2. [滚动与拖动](/docs/03-input-modes)：决定页面怎么前进。
3. [与 AI 一起设计](/docs/04-working-with-ai)：让 AI 助手先商定分场和素材，再写页面。
4. [cv-animate](/docs/10-animate)：效果预设和属性的完整列表。
