---
title: 响应式换算模型
eyebrow: CONCEPTS / RESPONSIVE
---

将 `designWidth` 设为设计稿宽度，默认值为 750。两个方向的数值型设计长度都按 `viewportWidth / designWidth` 换算。

## 换算规则

```tsx
<CineView designWidth={750}>   // 设计稿宽度 750px
```

- 视窗宽度为 750px 时 scale=1，设计稿 1px 等于屏幕 1px。
- 视窗宽度为 1500px 时 scale=2，数值型设计长度扩大为两倍。
- 高度也使用由视窗宽度计算出的比例。

## 哪些值参与换算

`Position` 换算设计坐标，`Container` 换算数值宽高及 `style` 中受支持的长度属性，例如内外边距、间距、圆角与字号。

```tsx
<Position at={{ x: 96, y: 160 }}>
  <Container width={420} height={240} style={{ padding: 24, gap: 12 }}>
    {/* 全部按 750 设计稿宽度换算 */}
  </Container>
</Position>
```

`Image` 的 width/height 数字同样按这个基准换算。数字=设计稿 px；想写百分比、auto 或 CSS 函数就直接写在 style 里，原样透传。

## 内容高于视窗时

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
