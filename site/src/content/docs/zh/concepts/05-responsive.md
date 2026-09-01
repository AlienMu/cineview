---
title: 响应式换算模型
eyebrow: CONCEPTS / RESPONSIVE
---

CineView 响应式体系依托单一设计稿宽度基准：`designWidth`（默认 750）。所有布局数值统一按 `scale = viewportWidth / designWidth` 换算，水平与垂直轴共用该比例：布局严格依据视窗宽度等比缩放，元素高度依比例联动，几何宽高比保持恒定。

## 换算规则

```tsx
<CineView designWidth={750}>   // 设计稿宽度 750px
```

- 视窗宽度为 750px 时 scale=1，设计稿 1px 等于屏幕 1px。
- 视窗宽度为 1500px 时 scale=2，所有设计 px ×2，画面等比放大，长宽比不变。
- 垂直方向同样应用基于宽度推导的 scale，元素不会因屏幕高度拉伸而失真。

## 哪些值参与换算

两个组件共用相同的换算规则，职责清晰划分：

- `Position`：`at.x / at.y / at.offsetX / at.offsetY`，元素放置坐标。**坐标**换算。
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

基于宽度的等比换算不强制约束垂直容纳空间。若特定场景内容超出视窗高度，应允许其在文档流中自然延伸。无需为适应垂直高度人为压缩元素尺寸，布局节奏交由场景切换或滚动区间调度。

## 居中对齐与基准配置

`Position` 的 `at.anchor` 支持 `'center' | 'center-x' | 'center-y'`：

```tsx
<Position at={{ anchor: 'center' }}>   {/* 视窗正中 */}
<Position at={{ anchor: 'center-x', y: 120 }}>   {/* 水平居中，y 从顶部量 */}
```

配置居中对齐后，对应轴上的 `x`/`y` 坐标转化为相对于视窗中心的偏移（仍按设计稿 px 进行比例换算），该轴的原 offset 计算链被忽略。底层实现采用 `calc(50% + 换算后偏移)` 与 `translate(-50%)` 组合，无需手动补偿元素几何尺寸。

## 下一步

- [Position API](/docs/05-position)：坐标与对齐基准的完整配置表
- [Container API](/docs/07-container)：盒模型换算的完整行为
- [双模式引擎](/docs/01-modes)：drag/scroll 下布局的共同前提
