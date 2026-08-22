---
title: Image
eyebrow: MEDIA
---

Image 走 CineView 预加载管线，但不阻塞普通内容的可见性。

## 优先媒体

首屏媒体在 Scene.assets 或 Image preload 上声明。其余资源留在后台队列。

```tsx
<Scene assets={{ preloadImages: ['/hero.webp'] }}>
  <Image src="/hero.webp" alt="Opening frame" preload />
</Scene>
```

## 属性

字段与默认值逐项核对自 `src/components/Image/Image.tsx` 的 `ImageProps` 与 Image 实现。`Image` 还接受其余原生 `<img>` 属性（`Omit<ImgHTMLAttributes, 'src' | 'alt' | 'width' | 'height' | 'style'>`）。

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `src` | `string` | `required` | 图片地址。 |
| `alt` | `string` | `required` | 无障碍替代文本。 |
| `width` | `number \| string` | — | 宽度。数字为设计 px，经单尺子 `convert` 换算；字符串原样透传。 |
| `height` | `number \| string` | — | 高度，同上。 |
| `style` | `React.CSSProperties` | — | 额外样式；长度量经 `convertStyle` 换算。 |
| `preload` | `boolean` | `true` | 是否把 URL 登记进框架预加载管线（与 `useImagePreloader` 共享同一缓存）；`loading='lazy'` 时强制关闭。此时原生 `loading` 属性缺省按 `preload` 推导：预加载为 `eager`，否则 `lazy`。 |
