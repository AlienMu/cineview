---
title: 预设动画总览
eyebrow: ADVANCED / PRESETS
---

CineView 内置 43 个字符串名预设动画，分 11 个族。用 `enterAnimation="fade-in"` 这种写法按名引用；名字是 `PresetAnimation` union 的合法成员，拼错名字在编译期就报错，不用等运行时。

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

`-in` / `-out` 后缀是进出场方向的语义约定：成对使用的常规写法是 `-in` 入场、`-out` 退场。无后缀的名字（`fade`、`spin`、`pulse`、`shake` 等）双向通用，也更适合交给 `loopAnimation` 做常驻循环：常驻循环由 `shouldRunInfinite` 判定，只在元素处于自己 phase 且在视口内时运行，规则见 [Animate](/docs/03-animate)。

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

- `CustomAnimation`：自己写 Framer Motion variant 子集 `{ initial, animate, exit }`。
- `ComposedAnimation`：`{ animations, mode: 'sequential' | 'parallel', delays }`，把预设和自定义串成顺序或并行组合，一个数组里可以混用。

写法与组合规则见[自定义动画](/docs/05-custom-animation)；三层类型的完整定义见[公共类型速查](/docs/10-types)。
