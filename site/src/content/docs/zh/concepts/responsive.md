---
title: 单尺子换算
eyebrow: ONE RULER
---

CineView 从设计稿宽度换算长度，不推断第二把高度比例尺。

## 设计宽度换算

把 config.size 设为设计稿文件的宽度。Position 坐标与 Container 盒尺寸按当前视口宽度换算。百分比、auto 与 CSS 函数保留书写时的原语义。

```tsx
<CineView config={{ size: 750 }}>
  <Scene>
    <Position at={{ x: 96, y: 160 }}>
      <Container width={420} height={240} />
    </Position>
  </Scene>
</CineView>
```
