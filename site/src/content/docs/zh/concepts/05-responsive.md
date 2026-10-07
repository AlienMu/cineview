---
title: 响应式换算模型
eyebrow: CONCEPTS / RESPONSIVE
---

将 `designWidth` 设为设计稿宽度和最大显示宽度，默认 750。页面在父容器内自适应，达到上限后水平居中。数值尺寸按 `contentWidth / designWidth` 换算，`contentWidth` 是页面实际可用宽度。

## 换算规则

```tsx
<Cineview designWidth={750}>   // 设计稿宽度 750px
```

- 父容器宽 375px 时，页面宽 375px，scale=0.5。
- 父容器宽 1500px 时，页面最多宽 750px 并居中，scale=1。原生滚动条占用的宽度会从可用内容宽度中扣除。
- `Position`、`Container`、`Image` 的纵向设计数值也使用由实际内容宽度计算出的比例；`Scene.layout.height` 不参与换算。

## 最小自适应宽度

```tsx
<Cineview designWidth={1920} minWidth={1440}>
  <Scene>{/* Content */}</Scene>
</Cineview>
```

父容器宽 1000px 时，页面仍按 1440px 排版；父容器宽 1800px 时按 1800px 排版；超过 1920px 后停止放大并居中。窄屏可通过外层横向滚动条查看溢出内容。横向拖拽仍用于场景切换。

将两个值都设为 1440，即可固定宽度。`minWidth` 可省略，必须在 0 到 `designWidth` 之间；无效值会被忽略。浏览器缩放保持原生行为，这些限制使用 CSS 像素。

## 哪些值参与换算

`Position` 换算设计坐标，`Container` 换算数值宽高及 `style` 中受支持的长度属性，例如内外边距、间距、圆角与字号。

```tsx
<Position at={{ x: 96, y: 160 }}>
  <Container width={420} height={240} style={{ padding: 24, gap: 12 }}>
    {/* 全部按 750 设计稿宽度换算 */}
  </Container>
</Position>
```

`Image` 的数值型 width/height 也按设计稿像素缩放。百分比、`auto` 和 CSS 函数可以写在 `style` 中；这些字符串值保持原样。

`Scene.layout.width` 和 `layout.height` 与上述组件不同：数值直接作为 CSS px，字符串按 CSS 原样使用。drag 的 `layout.height` 改变幕内内容盒，不改变整屏切幕距离。

`Animate` 自定义动画中的数值 `x`、`y` 使用 CSS 像素，不参与这套设计尺寸换算。

## 内容高度超过视窗时

按宽度换算不保证内容能在垂直方向全部显示。长内容适合普通滚动场景，全屏展示也可拆为多个场景。根据需要配置场景高度与溢出行为。

## 居中对齐与基准配置

`Position` 的 `at.anchor` 支持 `'center' | 'center-x' | 'center-y'`：

```tsx
<Position at={{ anchor: 'center' }}>{/* 定位包含块的中心 */}</Position>
<Position at={{ anchor: 'center-x', y: 120 }}>{/* 水平居中 */}</Position>
```

居中以定位包含块为参照，通常是 Scene 或固定层容器。居中轴上的 `x` 或 `y` 表示相对中心的设计像素偏移，该轴的 `offsetX` 或 `offsetY` 不再参与计算。Position 先应用居中变换，再应用自定义的 `style.transform`。

## 下一步

- [Position API](/docs/05-position)：坐标与对齐基准的完整配置表
- [Container API](/docs/07-container)：盒模型换算的完整行为
- [双模式引擎](/docs/01-modes)：drag/scroll 下布局的共同前提
