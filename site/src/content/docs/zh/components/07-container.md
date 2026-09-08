---
title: Container
eyebrow: COMPONENTS / CONTAINER
---

Container 按 `viewportWidth / designWidth` 换算数值宽高与受支持的样式长度，宽度和高度使用同一比例。

## Props

| prop        | 类型                                          | 说明                                 |
| ----------- | --------------------------------------------- | ------------------------------------ |
| `width`     | number                                        | 容器宽度（设计 px）                  |
| `height`    | number                                        | 容器高度（设计 px）                  |
| `style`     | CSSProperties                                 | 整块样式；数值型长度量按设计 px 换算 |
| `className` | string                                        | 根 div 类名                          |
| `children`  | ReactNode                                     | 必填                                 |
| 其余        | HTMLAttributes（除 children/style/className） | 透传根 div                           |

转发的 `ref` 指向根 div。

Container 只能在 `<CineView>` 下使用：换算依赖上下文。脱离 CineView 渲染时，开发构建直接抛错。

## 换算行为

`scale = viewportWidth / designWidth`（`designWidth` 默认 750）。`width={520}` 在 375px 屏幕宽度下（scale 0.5）渲染为 260px。

`style` 里的数值按键名许可清单换算，覆盖：

- 尺寸：`width` / `height` / `minWidth` / `maxWidth` / `minHeight` / `maxHeight`
- 定位与 inset：`top` / `right` / `bottom` / `left` / `inset*`
- 内外边距：`margin*` / `padding*`
- 边框：`borderWidth*` / `borderRadius*`
- 间距与字体：`gap` / `columnGap` / `rowGap` / `fontSize` / `letterSpacing` / `outlineWidth` / `outlineOffset`

`'50%'`、`'1rem'` 等 CSS 字符串保持不变。`zIndex`、`opacity`、`fontWeight` 和 `lineHeight` 等非长度数值不参与缩放。

```tsx
<Container width={520} style={{ padding: 24, borderRadius: 12, fontSize: 28 }}>
  …
</Container>
```

## 常见误用

- 按设计坐标放置内容时使用 [Position](/docs/05-position)。Container 不设置定位方式。
- 数值 `fontSize: 28` 会按设计比例换算，字符串 `'28px'` 则保持为 28 CSS 像素。
- 场景尺寸使用 `Scene.layout`，场景内部内容使用 Container。

---

设计稿宽度的换算方式见[响应式换算](/docs/05-responsive)。
