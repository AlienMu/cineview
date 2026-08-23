---
title: Image
eyebrow: MEDIA
---

Image 走 CineView 预加载管线，但不阻塞普通内容的可见性。

## When to use

- 图片要走框架预加载缓存（与 `Scene.assets`、根 `preload()` 同一份），避免与浏览器原生加载双轨并行时。
- 需要设计 px 数值尺寸随单尺子换算的 `<img>` 时。
- 普通内容图片——首屏优先级仍由 `Scene.assets.preloadImages` 声明，Image 只负责消费缓存。

## 优先媒体

首屏媒体在 Scene.assets 或 Image preload 上声明。其余资源留在后台队列。

```tsx
<Scene assets={{ preloadImages: ['/hero.webp'] }}>
  <Image src="/hero.webp" alt="Opening frame" preload />
</Scene>
```

队列成员资格的裁决：`Scene.assets.preloadImages` 声明的图片进**首屏优先队列**（drag 当前场景 / scroll 首场景），结算完触发 `priorityComplete` 冷启动门控——`onReady` 等它；`Image preload`（默认 `true`）只是把 URL 登记进同一份共享缓存（**后台队列**），不阻塞冷启动。首屏大图两处都要写：Scene 上声明优先级，Image 上消费缓存。

组件挂载即渲染 `<img>`——预加载管的是网络与缓存命中，不 gate 可见性；需要「图到才显示」的编排用 `Animate` 的 visibility/timeline 语义做。

## 常见误用

- **用 `Image preload` 声明首屏优先级**——成员资格由 `Scene.assets` 决定，`preload` 只登记缓存。
- **显式 `loading='lazy'` 又指望 `preload` 生效**——前者会把后者强制关闭。
- **数字尺寸当渲染像素写**——`width={375}` 是设计稿尺寸，经单尺子换算；字符串不换算。

---

完整字段与预加载语义见 [Image API](/docs/image-api)。
