---
title: Image
eyebrow: MEDIA
---

Image 走 CineView 预加载管线，但不阻塞普通内容的可见性。

## 优先媒体

首屏媒体在 Scene.assets 或 Image priority 上声明。其余资源留在后台队列。

```tsx
<Scene assets={{ preloadImages: ['/hero.webp'] }}>
  <Image src="/hero.webp" alt="Opening frame" priority />
</Scene>
```
