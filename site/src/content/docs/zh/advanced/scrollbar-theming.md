---
title: 滚动条主题化
eyebrow: OVERLAY
---

scroll 模式内置自绘滚动条覆盖层。开启即隐藏原生 gutter；rail 与 thumb 是普通 DOM，外观逐字段交给你主题化。

## 字段与默认值

下表每个字段都在覆盖层组件内解析，默认值与钳制在此生效。

| 字段 | 默认值 | 钳制 | 渲染为 |
| --- | --- | --- | --- |
| `enabled` | `true` | — | 覆盖层开关。传入 `scrollbar` 对象即开启，只有对象内 `enabled: false` 才关闭。 |
| `width` | `6` | 下限 `4` | rail 与 thumb 的粗细（px）。 |
| `radius` | `999` | 下限 `0` | rail 与 thumb 圆角（px）。 |
| `inset` | `0` | 下限 `0` | 距滚动容器边缘的内缩（px）。 |
| `trackColor` | `'transparent'` | — | rail 背景。 |
| `thumbColor` | `'rgba(255, 255, 255, 0.28)'` | — | thumb 背景。 |
| `thumbHoverColor` | `'rgba(255, 255, 255, 0.42)'` | — | thumb 四周的 1px 描边环（box-shadow），恒存在。 |
| `autoHide` | `true` | — | 空闲时淡出（见下文）。 |
| `ariaLabel` | `'CineView scroll position'` | — | rail 的无障碍名称。 |

两处上限是写死的而非可配置：thumb 不会缩到 40px rail 长度以下；内容装得下视口（可滚动跨度 ≤ 1px）时覆盖层整体不渲染。rail 的外描边与投影、键盘聚焦描边同样是固定样式。

## CSS 变量联动

颜色字符串原样写入 `background`，因此任何 CSS 颜色值都可用——包括 `var()` 引用。一个被页面其他部分实时改写的自定义属性，能让 thumb 零 JS 耦合地跟着换肤。

站点首页正是这么做的：强调色 token 被背景色带随滚动位置逐帧改写，thumb 亦步亦趋。

```tsx
<CineView
  mode="scroll"
  config={{ size: 1440 }}
  scrollbar={{
    enabled: true,
    width: 8,
    autoHide: true,
    trackColor: 'rgba(26, 24, 20, 0.06)',
    thumbColor: 'var(--accent)',
    thumbHoverColor: 'rgba(255, 255, 255, 0.9)',
  }}
>
```

## autoHide 时序

淡入淡出刻意不对称：滚动一开始 80ms 内 snap 到可见；停止后先经 120ms 空闲计时器翻转滚动标志，再等 0.15s、用 0.5s 缓缓淡出。单一对称时长做不到「立刻出现」与「短暂滚动后仍有余韵」兼得。rail 上的键盘聚焦则恒保可见。时序数值固定，不可配置。
