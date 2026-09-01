---
title: Image
eyebrow: COMPONENTS / IMAGE
---

Image 是接入框架预加载缓存的 `<img>` 组件：`src` 与 `alt` 为必填项，数值宽高基于设计稿像素按统一尺度换算。组件不会阻塞普通内容的首次呈现。

## Props

| prop               | 类型                                               | 默认 | 说明                                                                          |
| ------------------ | -------------------------------------------------- | ---- | ----------------------------------------------------------------------------- |
| `src`              | string                                             | 无   | 必填                                                                          |
| `alt`              | string                                             | 无   | 必填                                                                          |
| `width` / `height` | `number \| string`                                 | 无   | 数字 = 设计稿像素，按统一尺度换算；字符串原样透传                             |
| `style`            | CSSProperties                                      | 无   | 数值型盒模型属性（padding/margin/borderRadius/fontSize 等）同样按统一尺度换算 |
| `preload`          | boolean                                            | true | 挂载时把 URL 登记进共享预加载缓存                                             |
| `loading`          | `'eager' \| 'lazy'`                                | 无   | 显式 `'lazy'` 会强制关闭 `preload`                                            |
| 其余               | ImgHTMLAttributes（除 src/alt/width/height/style） | 无   | 透传 `<img>`                                                                  |

forwardRef 指向 `<img>` 元素。

## 换算行为

`width={375}` 是设计稿尺寸，渲染时换算为 `375 × scale`；`scale = viewportWidth / designWidth`（默认 750）。字符串值（`'50%'`、`'12rem'`）不换算、原样透传。`style` 里的数值长度量走与 [Container](/docs/07-container) 完全相同的换算逻辑。

## 预加载语义

- `preload` 为真时，组件挂载就把 `src` 登记进框架的共享预加载缓存，与 `Scene.assets.preloadImages`、根 ref 的 `preload()` 是同一份缓存，同一 URL 不重复加载。
- 该缓存只是后台预热，**不声明首屏优先级**：首屏优先队列的成员资格由 `Scene.assets.preloadImages` 决定，它计入冷启动就绪判定；`Image` 的 `preload` 不参与。
- 加载策略联动：`preload` 为真时 `loading` 默认 `'eager'`，否则默认 `'lazy'`；显式声明 `loading='lazy'` 时，`preload` 会被强制关闭。
- 组件挂载即渲染 `<img>`。预加载管的是网络与缓存命中，不阻断可见性；要「图到才显示」这类时间线，用 [Animate](/docs/03-animate) 的 visibility/timeline 语义。

冷启动就绪判定与优先队列的完整语义见 [预加载](/docs/02-preload)。

## 常见误用

- **用 `preload` 声明首屏优先级**：成员资格归 `Scene.assets`，首屏大图两边都要写：Scene 上声明优先级，Image 上消费缓存。
- **写了 `loading='lazy'` 又指望 `preload` 生效**：前者把后者强制关闭。
- **把数字尺寸当渲染像素写**：`width={375}` 是设计稿 px，会换算；不想换算就用字符串。
