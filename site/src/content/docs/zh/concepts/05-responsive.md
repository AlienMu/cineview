---
title: 响应式换算基准
eyebrow: CONCEPTS / RESPONSIVE
---

CineView 整套响应式只有一个换算基准：`designWidth`（设计稿宽度，默认 750）。任何布局数值都按 `scale = viewportWidth / size` 换算，x 和 y 共用这同一个比例：布局只按宽度缩放，高度跟着走，图形不会变形。

## 换算规则

```tsx
<CineView designWidth={750}>   // 设计稿宽度 750px
```

- 视口 750px 时 scale=1，设计稿 1px = 屏幕 1px。
- 视口 1500px 时 scale=2，所有设计 px ×2，画面等比放大，长宽比不变。
- y 方向也用宽度换算出来的 scale。元素不会因为屏幕变高而纵向拉长，正方形在任何屏幕上都是正方形。

## 哪些值参与换算

两个组件消费同一个基准，职责正交：

- `Position`：`at.x / at.y / at.offsetX / at.offsetY`，元素放在哪。**坐标**换算。
- `Container`：`width` / `height` 便捷属性，以及整个 `style` 里的所有长度量（padding/margin/gap/borderRadius/fontSize …）。**盒模型**换算。

```tsx
<Position at={{ x: 96, y: 160 }}>
  <Container width={420} height={240} style={{ padding: 24, gap: 12 }}>
    {/* 全部按 750 设计稿宽度换算 */}
  </Container>
</Position>
```

`Image` 的 width/height 数字同样按这个基准换算。数字=设计稿 px；想写百分比、auto 或 CSS 函数就直接写在 style 里，原样透传。

## 纵向超出交给文档流

只按宽度换算不保证纵向装得下所有设计内容。某个场景内容超过一屏时，让它自然超出、走文档流。不要为了纵向拟合去缩小元素，那会破坏比例。节奏由 drag 切场解决，不由缩放解决。

## 居中锚点

`Position` 的 `at.anchor` 支持 `'center' | 'center-x' | 'center-y'`：

```tsx
<Position at={{ anchor: 'center' }}>   {/* 视口正中 */}
<Position at={{ anchor: 'center-x', y: 120 }}>   {/* 水平居中，y 从顶部量 */}
```

锚点居中后，被居中的轴上 `x`/`y` 变成「相对中心的偏移」（还是设计 px，走换算），该轴的 offset 链被忽略。内部实现是 `calc(50% + 换算后偏移)` + `translate(-50%)`，所以你不用手动补元素宽高。

## 下一步

- [Position API](/docs/05-position)：坐标与锚点的完整 prop 表
- [Container API](/docs/07-container)：盒模型换算的完整行为
- [双模式引擎](/docs/01-modes)：drag/scroll 下布局的共同前提
