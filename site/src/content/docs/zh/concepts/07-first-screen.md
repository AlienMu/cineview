---
title: 首屏
eyebrow: CONCEPTS / FIRST SCREEN
---

页面打开的第一屏最容易出问题：模块还没运行，图片还没到，读者已经在看了。2.0 用启动样式和首屏等待处理这段时间。

## 模块运行之前

`cineview.css` 在模块运行前就定好页面结构，并决定第一个场景里的元素先怎么显示：

- 第一个场景里的元素都只用一个内置预设、且没有写参数时（例如 `fx="rise"`、`fx="fade"`），这些入场直接用 CSS 从第一帧开始播放。模块到达后接着播，不会重来。
- 其他情况下，第一个场景里的动画元素先隐藏，由运行时显示出来。如果 4 秒内模块都没有运行，CSS 会自己把它们显示出来，保证内容可读。
- 模块晚于这 4 秒才到时，已经显示出来的内容直接停在完成的样子，不会再隐藏、重新入场一次。

写了 `delay`、`after`、`at`、`stagger`、`split`、`from`、`to`、`duration`、`ease` 或 `target` 的元素，以及 `preload`、`zone`、`track`、`sequence` 的场景，都按第二种情况处理。写了 `on` 的元素不在这两种处理之内，模块运行前按 HTML 原样显示。

这一切的前提是加载了 head 里那段脚本和 `cineview.css`，写法见[安装与加载](/docs/02-setup)。

## 等首屏素材到齐

给第一个场景加上 `preload`，它的入场会等场景里的图片和视频准备好再开始：

```html
<cv-stage first-scene-timeout="3000">
  <cv-scene preload="hero-2x.jpg">
    <img src="hero.jpg" alt="…">
    <cv-animate fx="rise(soft)"><h1>标题</h1></cv-animate>
  </cv-scene>
</cv-stage>
```

- `preload` 不写值时，等场景里的图片解码完成、视频可以逐帧定位；写了地址列表时，再加上这些文件。
- 每准备好一个，舞台会派发一次 `cv-progress`，`detail` 是 `{ kind: 'load', progress, loaded, total }`，可以用来做加载进度。
- 最多等 `first-scene-timeout` 毫秒，默认 3000。超时会派发可取消的 `cv-timeout`；不取消就开始入场，取消后继续等，直到素材到齐。
- 加载失败的素材也算完成，同时派发 `asset-failed` 的 `cv-error`。

## 刷新在页面中间

刷新时，浏览器先恢复滚动位置，舞台再按那个位置构建。锁定区的高度在舞台构建时才写上，所以在很长的锁定区中间刷新时，第一帧可能先画出页面顶部。在 CSS 里先给锁定区写好同样的高度可以避免：

```css
/* duration 最长为 2400 的锁定区 */
#story { height: calc(2400px + 100svh); }
cv-stage, cv-scene { display: block; }
```

需要连当前场景的配色一起恢复时，可以在 `<head>` 里用一小段脚本记录并预先套用，做法见[与 AI 一起设计](/docs/04-working-with-ai)里提到的设计技能（`checks.md` 中的 K3）。
