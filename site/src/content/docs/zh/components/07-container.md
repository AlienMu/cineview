---
title: Container
eyebrow: COMPONENTS / CONTAINER
---

Container 按同一个设计宽度基准折算 `width` / `height` 和 `style` 里的所有数值长度量。设计稿上的盒模型数值原样写进代码，框架负责把它缩放到任何屏幕：横纵两轴共用同一个缩放系数，宽高比保持不变。

## Props

| prop        | 类型                                          | 说明                                 |
| ----------- | --------------------------------------------- | ------------------------------------ |
| `width`     | number                                        | 容器宽度（设计 px）                  |
| `height`    | number                                        | 容器高度（设计 px）                  |
| `style`     | CSSProperties                                 | 整块样式；数值型长度量按设计 px 换算 |
| `className` | string                                        | 根 div 类名                          |
| `children`  | ReactNode                                     | 必填                                 |
| 其余        | HTMLAttributes（除 children/style/className） | 透传根 div                           |

forwardRef 指向根 div。

Container 只能在 `<CineView>` 下使用：换算依赖上下文。脱离 CineView 渲染时，开发构建直接抛错。

## 换算行为

`scale = viewportWidth / designWidth`（`designWidth` 默认 750）。`width={520}` 在 375px 屏幕宽度下（scale 0.5）渲染为 260px。

`style` 里的数值按键名许可清单换算，覆盖：

- 尺寸：`width` / `height` / `minWidth` / `maxWidth` / `minHeight` / `maxHeight`
- 定位与 inset：`top` / `right` / `bottom` / `left` / `inset*`（但 Container 不是坐标所有者，见「常见误用」小节）
- 内外边距：`margin*` / `padding*`
- 边框：`borderWidth*` / `borderRadius*`
- 间距与字体：`gap` / `columnGap` / `rowGap` / `fontSize` / `letterSpacing` / `outlineWidth` / `outlineOffset`

字符串值（`'50%'`、`'1rem'`）不换算、原样透传；非长度类纯数值属性（`zIndex`、`opacity`、`fontWeight`、`lineHeight` 等）也不换算：它们是纯数值，不是长度。

```tsx
<Container width={520} style={{ padding: 24, borderRadius: 12, fontSize: 28 }}>
  …
</Container>
```

## 常见误用

- **当坐标所有者用**：定位始终归 [Position](/docs/05-position)，层级是 `Scene → Position → Container`；给 Container 传 `top` / `left` 属于职责误用。
- **字号写 `'28px'` 字符串**：不换算。设计稿量出的字号直接写数值 `28`。
- **拿它做 Scene 布局**：Scene 的 `layout.width` / `layout.height` 有自己的语义，Container 面向 Scene 内部的盒模型。

---

关于响应式换算模型（仅按视窗宽度缩放、纵向融入文档流）的完整说明，请参阅 [响应式模型](/docs/05-responsive)。
