---
title: 滚动条主题化
eyebrow: SCROLL / SCROLLBAR
---

scroll 模式内置自绘滚动条覆盖层。开启即隐藏原生 gutter；rail 与 thumb 是普通 DOM，外观逐字段交给你主题化。

## 开关只认对象

`scrollbar` 的类型是 `false | ScrollbarConfig`，解析规则是「`typeof scrollbar === 'object'` 且 `scrollbar.enabled !== false`」：

| 写法                             | 结果                                       |
| -------------------------------- | ------------------------------------------ |
| 省略整个 prop                    | 什么都不注入：无覆盖层，原生滚动条照常显示 |
| `scrollbar={{}}`                 | 开启，全部走默认值                         |
| `scrollbar={{ enabled: false }}` | 关闭                                       |
| `scrollbar={false}`              | 关闭                                       |
| `scrollbar={true}`               | **无效**，过不了对象判断，等同省略         |

`scrollbar={true}` 是类型层就会报错的写法，但如果绕过类型（JS 调用方、`as any`）它会静默什么都不做。要开启就传对象，最小写法是 `scrollbar={{}}`。

开启时框架往容器注入一段 CSS 把原生滚动条隐藏（`scrollbar-width: none` + `::-webkit-scrollbar` 归零），并把容器的 `scrollbarGutter` 设成 `auto`；不开启时 gutter 为 `stable`。

## 字段与默认值

下列每个字段都在覆盖层组件内解析，默认值与钳制在此生效。

| 字段              | 类型      | 默认值                        | 钳制     | 渲染为                                        |
| ----------------- | --------- | ----------------------------- | -------- | --------------------------------------------- |
| `enabled`         | `boolean` | `true`                        | 无       | 覆盖层开关，见「开关只认对象」                |
| `width`           | `number`  | `6`                           | 下限 `4` | rail 与 thumb 的粗细（px）                    |
| `radius`          | `number`  | `999`                         | 下限 `0` | rail 与 thumb 圆角（px）                      |
| `inset`           | `number`  | `0`                           | 下限 `0` | 距滚动容器边缘的内缩（px）                    |
| `trackColor`      | `string`  | `'transparent'`               | 无       | rail 的 `background`                          |
| `thumbColor`      | `string`  | `'rgba(255, 255, 255, 0.28)'` | 无       | thumb 的 `background`                         |
| `thumbHoverColor` | `string`  | `'rgba(255, 255, 255, 0.42)'` | 无       | thumb 四周的 1px 描边环（box-shadow），恒存在 |
| `autoHide`        | `boolean` | `true`                        | 无       | 空闲时淡出，见「autoHide 时序」               |
| `ariaLabel`       | `string`  | `'CineView scroll position'`  | 无       | rail 的无障碍名称                             |

`thumbHoverColor` 这一格的字段名与实际行为不符：它不是 hover 态颜色，而是 thumb 恒定的描边环色，任何交互状态下都在。想做 hover 变化得自己在外层写 CSS。

三处写死不可配置：thumb 不会缩到 40px 以下（rail 本身更短时以 rail 为限）；内容装得下视口（可滚动跨度不足 1px）时覆盖层整体不渲染；rail 的外描边、投影与键盘聚焦描边都是固定样式。

覆盖层的 `z-index` 是 80，位于固定层（20）与活跃的锁定区（locked zone）壳（30）之上。

## 拖拽与键盘

rail 有 `role="scrollbar"` 与 `tabIndex={0}`，聚焦后方向键、PageUp/PageDown、空格、Home/End 都可用，步长与滚轮路径共用同一张表（见[四条输入路径](/docs/03-inputs)）。

按在 thumb 上开始的手势进入拖拽，按在 rail 空白处是一次跳转（不进入拖拽）。拖拽写入的目标偏移与其他三条路径过同一道意图钳，所以拖滚动条同样不能跳过锁定段。同时只有一个指针拥有 thumb，第二根手指不会打断第一根。

## CSS 变量联动

颜色字符串原样写入 `background`，因此任何 CSS 颜色值都可用，包括 `var()` 引用。一个被页面其他部分实时改写的自定义属性，能让 thumb 零 JS 耦合地跟着换肤。

站点首页正是这么做的：强调色 token 被背景色带随滚动位置逐帧改写，thumb 逐帧跟着变色。

```tsx
<CineView
  mode="scroll"
  designWidth={1440}
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

淡入淡出刻意不对称：滚动一开始 80ms 内 snap 到可见；停止后先经 120ms 空闲计时器翻转滚动标志，再等 0.15s、用 0.5s 缓缓淡出。

不对称是必需的而非风格选择。单一对称时长要么做不到「立刻出现」，要么在短促滚动里根本来不及到全不透明就开始淡出，因为可见窗口本身只有约 120ms。rail 上的键盘聚焦则恒保可见，与滚动状态无关。时序数值固定，不可配置。

## 相关页面

- [四条输入路径](/docs/03-inputs)：拖滚动条与其他输入的共同钳
- [CineView 参考](/docs/01-cineview)：`scrollbar` 在根 props 里的位置
- [横向 direction: 'x'](/docs/04-direction-x)：横向模式下 rail 贴底而非贴右
