---
title: 预设动画总览
eyebrow: ADVANCED / PRESETS
---

CineView 内置 43 个预设动画，分为 11 个动画类别。通过 `enterAnimation="fade-in"` 等字面量名称直接声明；所有名称均属于 `PresetAnimation` 联合类型，非法名称在编译期即可触发类型校验拦截，避免运行时异常。

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

`-in` / `-out` 后缀是进出场方向的语义约定：成对使用的常规写法是 `-in` 入场、`-out` 退场。无后缀的名字（`fade`、`spin`、`pulse`、`shake` 等）双向通用，也更适合交给 `loopAnimation` 做常驻循环：常驻循环只在元素处于自身生命周期阶段且位于视窗内时运行，规则见 [Animate](/docs/03-animate)。

## 用法示例

预设名直接传给 `Animate` 的 `enterAnimation` / `exitAnimation`，也可用于 `Scene.transition`：

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
