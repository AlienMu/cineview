---
title: Image
eyebrow: COMPONENTS / IMAGE
---

Image 渲染 `<img>`，并将加载完成的图片记入框架缓存。`src` 和 `alt` 必填，数值宽高使用设计像素。加载不会延迟普通内容的挂载。

## Props

| prop               | 类型                                               | 默认                      | 说明                                                                          |
| ------------------ | -------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------- |
| `src`              | string                                             | 无                        | 必填                                                                          |
| `alt`              | string                                             | 无                        | 必填                                                                          |
| `width` / `height` | `number \| string`                                 | 无                        | 数字 = 设计稿像素，按统一尺度换算；字符串原样透传                             |
| `style`            | CSSProperties                                      | 无                        | 数值型盒模型属性（padding/margin/borderRadius/fontSize 等）同样按统一尺度换算 |
| `preload`          | boolean                                            | true                      | 挂载时把 URL 登记进共享预加载缓存                                             |
| `loading`          | `'eager' \| 'lazy'`                                | 预加载时 eager，否则 lazy | 显式 `'lazy'` 关闭预加载                                                      |
| 其余               | ImgHTMLAttributes（除 src/alt/width/height/style） | 无                        | 透传 `<img>`                                                                  |

转发的 `ref` 指向 `<img>` 元素。

## 换算行为

`width={375}` 是设计稿尺寸，渲染时换算为 `375 × scale`；`scale = viewportWidth / designWidth`（默认 750）。字符串值（`'50%'`、`'12rem'`）不换算、原样透传。`style` 里的数值长度量走与 [Container](/docs/07-container) 完全相同的换算逻辑。

## 预加载语义

- 开启 `preload` 后，组件加载图片，并在共享缓存中记录完成状态。后续预加载可复用已完成的结果，同时挂载的实例仍可能分别创建图片加载器。
- Image 的 `preload` 不声明首屏优先级。首屏入场需要等待的资源应写入 `Scene.assets.preloadImages`。
- 预加载时默认 `'eager'`，否则默认 `'lazy'`。显式设置 `loading='lazy'` 会关闭预加载。
- `<img>` 立即挂载，可通过原生 `onLoad` 和 `onError` 获取单项资源的结果。

冷启动就绪判定与优先队列的完整语义见 [预加载](/docs/02-preload)。

## 常见误用

- 首屏优先资源写入 `Scene.assets.preloadImages`。
- 不需要立即预加载的图片可使用 `loading='lazy'`。
- 数值尺寸使用设计像素，CSS 字符串原样传入。
