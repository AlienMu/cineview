---
title: 安装与加载
eyebrow: GETTING STARTED / SETUP
---

从 npm 安装，或者直接从 CDN 引入。两种方式都要在 `<head>` 里放三样东西：一小段脚本、启动样式和运行时模块。

## 安装

```bash
npm install cineview
```

这个包没有依赖。文件在 `node_modules/cineview/dist/` 里：

| 文件 | 内容 |
| --- | --- |
| `cineview.js` | 运行时模块，首屏需要的部分不超过 44 KiB（gzip） |
| `chunks/` | 按需加载的模块：拆分文字、图片处理、数字滚动、关键帧、拖动 |
| `cineview.css` | 启动样式：模块运行前的结构和首屏初始状态 |
| `head.js` | 放进 `<head>` 的那一小段脚本，附有内容安全策略用的哈希 |
| `dev/cineview.js` | 开发版，会在控制台打印警告和错误 |
| `types/` | 类型声明，包括 JSX 用的 `jsx.d.ts` |

## 在页面里加载

三样东西都放在 `<head>` 里，顺序不要变。从 CDN 引入：

```html
<!-- 1. head.js 的内容：浏览器满足要求时，给 <html> 加上 cv-js -->
<script>(function(s){if(s&&s('selector(:has(*))')&&s('width:1lh')&&s('color:color-mix(in srgb,red,red)'))document.documentElement.classList.add('cv-js')})(window.CSS&&CSS.supports);</script>
<!-- 2. 启动样式 -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/cineview@2/dist/cineview.css">
<!-- 3. 运行时 -->
<script type="module" src="https://cdn.jsdelivr.net/npm/cineview@2/dist/cineview.js"></script>
```

要自己托管文件，就把 `dist/` 复制到网站上，再把两个地址改成它的位置。

缺少前两项时，每个动画元素会先以完成的样子画出来，等模块运行后再跳回起点，每次加载都会闪一下。

不满足要求的浏览器不会加上 `cv-js`，页面按静态内容显示，文字和图片都能正常阅读。要求是 Safari 16.4、Chrome 111、Firefox 128 及以上。

## 使用打包工具

在页面脚本里任意位置导入一次模块，元素会自己注册：

```js
import 'cineview';
```

head 里那段脚本和 `cineview/cineview.css` 照样放在页面的 `<head>` 里，这样脚本运行前首屏就是对的。打开代码分割（Vite 和 Rollup 默认开启，esbuild 要加 `--splitting`），按需加载的模块才会保持为单独的文件。

## 内容安全策略

页面启用了内容安全策略时，内联的那段脚本需要按哈希放行。哈希写在 `head.js` 的第一行。

## 开发时的检查

开发时加载 `dev/cineview.js`，属性写错、名字对不上时控制台会给出说明。两个版本都会在出错的元素上派发 `cv-error` 事件，可以统一监听：

```js
document.addEventListener('cv-error', (e) => {
  console.warn(e.detail.code, e.detail.message, e.detail.element);
});
```

错误代码的含义见[状态与事件](/docs/07-states-and-events)。
