---
title: Container
eyebrow: BOX MODEL
---

Container 用同一把设计宽度尺子换算 width、height 以及受支持的 style 长度。

## 尺寸不另设尺子

盒尺寸交给 Container。不要把它当坐标所有者用；定位始终归 Position。

```tsx
<Container width={520} height={300} style={{ padding: 24 }}>
  <Card />
</Container>
```
