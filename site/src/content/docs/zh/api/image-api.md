---
title: Image
eyebrow: API REFERENCE
---

`<Image>` 走 CineView 预加载管线，但不阻塞普通内容的可见性。本页是全量字段参考；用法见 [Image 组件指南](/docs/image)。

## Props

字段与默认值逐项核对自 `src/components/Image/Image.tsx` 的 `ImageProps` 与 Image 实现。`Image` 还接受其余原生 `<img>` 属性（`Omit<ImgHTMLAttributes, 'src' | 'alt' | 'width' | 'height' | 'style'>`）。

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `src` | `string` | `required` | 图片地址。 |
| `alt` | `string` | `required` | 无障碍替代文本。 |
| `width` | `number \| string` | — | 宽度。数字为设计 px，经单尺子 `convert` 换算；字符串原样透传。 |
| `height` | `number \| string` | — | 高度，同上。 |
| `style` | `React.CSSProperties` | — | 额外样式；长度量经 `convertStyle` 换算。 |
| `preload` | `boolean` | `true` | 是否把 URL 登记进框架预加载管线（与 `useImagePreloader` 共享同一缓存）；`loading='lazy'` 时强制关闭。此时原生 `loading` 属性缺省按 `preload` 推导：预加载为 `eager`，否则 `lazy`。 |

## 预加载语义

`preload`（默认 `true`）把 URL 登记进共享预加载缓存，与 `Scene.assets.preloadImages`、`CineView` 根的 `preload()` 走**同一份缓存**（`useImagePreloader`），不重复下载：

- **首屏优先队列**：`Scene.assets.preloadImages` 声明的图片，drag 模式当前场景 / scroll 模式首场景的进优先队列，结算完触发 `priorityComplete` 冷启动门控（`onReady` 等它）。
- **后台队列**：`Image preload` 登记的图片与其余资源，不阻塞冷启动。
- **`loading` 推导**：未显式传原生 `loading` 时按 `preload` 推导，即 `preload: true` → `eager`，`preload: false` → `lazy`；显式传了 `loading='lazy'` 则 `preload` 被强制关闭。

```tsx
<Scene assets={{ preloadImages: ['/hero.webp'] }}>
  {/* Priority: declared on Scene.assets, gates the cold start */}
  <Image src="/hero.webp" alt="Opening frame" preload />
</Scene>

{/* Background: registered in the same cache, does not gate onReady */}
<Image src="/diagram.png" alt="Architecture" />
```

## 约束与常见误用

- **不要用 `Image` 的 `preload` 声明首屏优先级。** 优先队列的成员资格由 `Scene.assets.preloadImages` 决定；`Image preload` 只是把 URL 放进共享缓存。首屏大图两处都要写（`Scene.assets` 声明优先级 + `Image` 消费缓存）。
- **数字尺寸走设计 px。** `width={375}` 是设计稿尺寸，不是渲染像素；字符串 `'375px'` / `'50%'` 原样透传、不换算。
- **可见性不受预加载阻塞。** 组件挂载即渲染 `<img>`；预加载管的是网络与缓存命中，不 gate 普通内容的可见性，需要「图到才显示」的编排用 `Animate` 的 visibility / timeline 语义做。

## 相关页面

- 预加载管线全貌与冷启动门控 → [Preload 深度页](/docs/preload)
- `onLoadProgress` / `onReady` 的先后关系 → [CineView API](/docs/cineview-api)
- 媒体用法教程 → [Image 组件指南](/docs/image)
