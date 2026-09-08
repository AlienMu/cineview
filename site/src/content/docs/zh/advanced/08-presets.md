---
title: 预设动画总览
eyebrow: ADVANCED / PRESETS
---

CineView 提供 43 个预设，分为 11 组。传入 `enterAnimation="fade-in"` 等名称，`PresetAnimation` 类型会检查拼写。

## 预设目录

| 族   | 预设                                                                           |
| ---- | ------------------------------------------------------------------------------ |
| 基础 | `fade`、`fade-in`、`fade-out`                                                  |
| 滑动 | `slide-up`、`slide-down`、`slide-left`、`slide-right`                          |
| 缩放 | `zoom-in`、`zoom-out`、`scale-up`、`scale-down`                                |
| 旋转 | `rotate`、`rotate-in`、`rotate-out`、`spin`                                    |
| 翻转 | `flip`、`flip-x`、`flip-y`                                                     |
| 弹跳 | `bounce`、`bounce-in`、`bounce-out`                                            |
| 闪烁 | `blink`、`flash`、`pulse`                                                      |
| 抖动 | `shake`、`shake-x`、`shake-y`、`vibrate`、`jello`                              |
| 模糊 | `blur-in`、`blur-out`、`focus-in`                                              |
| 弹性 | `elastic`、`rubber-band`、`wobble`、`swing`                                    |
| 特殊 | `heartbeat`、`tada`、`wave`、`roll-in`、`roll-out`、`hinge`、`jack-in-the-box` |

## 命名约定

以 `-in` 和 `-out` 结尾的名称通常分别用于入场和退场。`spin`、`pulse`、`shake` 等也可用于循环，播放受元素可见性与动画阶段约束，详见 [Animate](/docs/03-animate)。

## 用法示例

预设可传给 Animate 的动画属性，也可用于 scroll 模式的 Scene 转场。

```tsx
<Animate
  animateId="title"
  enterAnimation="slide-up"
  exitAnimation="fade-out"
  duration={{ enter: 800, exit: 400 }}
>
  <h1>开场标题</h1>
</Animate>
```

进出场的时间轴语义（delay、after、退场配对）见 [Animate 组件参考](/docs/03-animate)。

## 预设之外的两种来源

`enterAnimation` 等字段的类型是 `AnimationType = PresetAnimation | CustomAnimation | ComposedAnimation`：

- `CustomAnimation`：开发者自定义声明的 Framer Motion 动画对象子集 `{ initial, animate, exit }`。
- `ComposedAnimation`：`{ animations, mode: 'sequential' | 'parallel', delays }`，将预设动画与自定义动画配置组合为顺序或并行序列，支持在同一数组中混用。

写法与组合规则见[自定义动画](/docs/05-custom-animation)；三层类型的完整定义见[公共类型速查](/docs/10-types)。
