---
title: 安装与加载
eyebrow: GETTING STARTED / SETUP
---

2.0 还没有发布到 npm。在仓库里构建出运行时，再把它放到页面能访问的位置。

## 构建运行时

```bash
node v2/build.mjs
```

构建结果在 `v2/dist/`：

| 文件 | 内容 |
| --- | --- |
| `cineview.js` | 运行时模块，首屏需要的部分不超过 40 KiB（gzip） |
| `chunks/` | 按需加载的模块：拆分文字、图片处理、数字滚动、关键帧、拖动 |
| `cineview.css` | 启动样式：模块运行前的结构和首屏初始状态 |
| `head.js` | 放进 `<head>` 的一小段脚本 |
| `dev/cineview.js` | 开发版，会在控制台打印警告和错误 |
| `types/` | 类型声明，包括 JSX 用的 `jsx.d.ts` |

## 在页面里加载

三样东西都放在 `<head>` 里，顺序不要变：

```html
<!-- 1. head.js 的内容：浏览器满足要求时，给 <html> 加上 cv-js -->
<script>(function(s){if(s&&s('selector(:has(*))')&&s('width:1lh')&&s('color:color-mix(in srgb,red,red)'))document.documentElement.classList.add('cv-js')})(window.CSS&&CSS.supports);</script>
<!-- 2. 启动样式 -->
<link rel="stylesheet" href="/v2/cineview.css">
<!-- 3. 运行时 -->
<script type="module" src="/v2/cineview.js"></script>
```

缺少前两项时，每个动画元素会先以完成的样子画出来，等模块运行后再跳回起点，每次加载都会闪一下。

不满足要求的浏览器不会加上 `cv-js`，页面按静态内容显示，文字和图片都能正常阅读。要求是 Safari 16.4、Chrome 111、Firefox 128 及以上。

## 内容安全策略

页面启用了内容安全策略时，内联的那段脚本需要按哈希放行。哈希写在 `head.js` 的第一行。

## 开发时的检查

开发时加载 `dev/cineview.js`，属性写错、名字对不上时控制台会给出说明。两个版本都会在出错的元素上派发 `cv-error` 事件，可以统一监听：

```js
document.addEventListener('cv-error', (e) => {
  console.warn(e.detail.code, e.detail.message, e.detail.element);
});
```

错误代码的含义见[状态与事件](/docs/v2/07-states-and-events)。
