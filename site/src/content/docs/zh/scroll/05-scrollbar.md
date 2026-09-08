---
title: 滚动条主题化
eyebrow: SCROLL / SCROLLBAR
---

在 scroll 模式传入 `scrollbar` 对象可显示自绘滚动条，替代原生滚动条。轨道、滑块、尺寸与颜色均有配置项。

## 配置与启用规则

传入对象开启滚动条，传入 `false` 关闭：

| 写法                             | 结果                                       |
| -------------------------------- | ------------------------------------------ |
| 省略整个 prop                    | 什么都不注入：无覆盖层，原生滚动条照常显示 |
| `scrollbar={{}}`                 | 开启，全部走默认值                         |
| `scrollbar={{ enabled: false }}` | 关闭                                       |
| `scrollbar={false}`              | 关闭                                       |
| `scrollbar={true}`               | **无效**，过不了对象判断，等同省略         |

不支持 `scrollbar={true}`，使用 `scrollbar={{}}` 开启默认外观。

开启时框架往容器注入一段 CSS 把原生滚动条隐藏（`scrollbar-width: none` + `::-webkit-scrollbar` 归零），并把容器的 `scrollbarGutter` 设成 `auto`；不开启时保留 `stable`，为原生滚动条预留空间。

## 字段与默认值

自绘滚动条使用以下默认值与限制：

| 字段              | 类型      | 默认值                        | 边界约束 | 渲染为                                |
| ----------------- | --------- | ----------------------------- | -------- | ------------------------------------- |
| `enabled`         | `boolean` | `true`                        | 无       | 开启或关闭                            |
| `width`           | `number`  | `6`                           | 下限 `4` | 轨道与滑块的粗细（px）                |
| `radius`          | `number`  | `999`                         | 下限 `0` | 轨道与滑块的圆角（px）                |
| `inset`           | `number`  | `0`                           | 下限 `0` | 距滚动容器边缘的内缩（px）            |
| `trackColor`      | `string`  | `'transparent'`               | 无       | 轨道的 `background`                   |
| `thumbColor`      | `string`  | `'rgba(255, 255, 255, 0.28)'` | 无       | 滑块的 `background`                   |
| `thumbHoverColor` | `string`  | `'rgba(255, 255, 255, 0.42)'` | 无       | 滑块四周的 1px 描边，所有状态下均显示 |
| `autoHide`        | `boolean` | `true`                        | 无       | 空闲时淡出，见「autoHide 时序」       |
| `ariaLabel`       | `string`  | `'CineView scroll position'`  | 无       | 轨道的无障碍名称                      |

`thumbHoverColor` 设置滑块在所有状态下的一像素描边颜色，并非仅用于悬停。

滑块长度至少为 40px，轨道更短时以轨道长度为准。可滚动距离不超过一个像素时不显示滚动条，外描边、投影与焦点样式为固定配置。

覆盖层的 `z-index` 是 80，位于固定层（20）与活跃锁定区（locked zone）的容器（30）之上。

## 拖拽与键盘

滚动条获得焦点后支持上下方向键、PageUp、PageDown、空格、Home 和 End。步长与其他键盘滚动一致，详见[输入方式](/docs/03-inputs)。

按住滑块可以拖动滚动条；按下轨道空白处则跳转到对应位置。拖动遵循与其他输入相同的锁定区间边界规则，因此也会在区间边界停下。同时只有一个指针可以拖动滑块，其他触点不会中断当前拖动。

## CSS 变量联动

颜色选项接受 CSS 颜色与自定义属性引用。例如 `thumbColor: 'var(--accent)'` 会使用 `--accent` 的当前值。

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
  <Scene sceneId="content">可滚动内容</Scene>
</CineView>
```

## autoHide 时序

开始滚动时，滚动条在 80ms 内显示。120ms 内没有滚动输入后，再等待 150ms，并在 500ms 内淡出。

获得键盘焦点时保持显示，这些时序不可配置。

## 相关页面

- [四条输入路径](/docs/03-inputs)：拖滚动条与其他输入的边界约束机制
- [CineView 参考](/docs/01-cineview)：`scrollbar` 在根 props 里的位置
- [横向 direction: 'x'](/docs/04-direction-x)：横向模式下，滚动条显示在容器底部
