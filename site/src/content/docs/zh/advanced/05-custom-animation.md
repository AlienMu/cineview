---
title: 自定义动画
eyebrow: ADVANCED / CUSTOM ANIMATION
---

预设无法提供所需动效时，传入自定义动画对象。对象可包含 `initial`、`animate` 和 `exit` 值。

## 自定义动画配置

`initial`、`animate` 或 `exit` 中至少一个为非空对象，不支持其他顶层键。

```tsx
<Animate
  animateId="title"
  enterAnimation={{
    initial: { y: '62%', opacity: 0 },
    animate: { y: 0, opacity: 1 },
  }}
  duration={{ enter: 640 }}
>
  <h1>Opening title</h1>
</Animate>
```

动画解析规则：

- 字符串按预设名解析，对象按自定义动画配置解析；解析器按类型分派。
- `transformOrigin` 字符串会归一化为百分比对（`'top left'` → `'0% 0%'`、`'center'` → `'50% 50%'`）。
- 普通 Animate 通过 `duration` 和 `timeline.delay` 配置时序。动画对象内的 transition 时间参数用于 stagger、循环等 Framer 原生播放，不改变随位置推进的动画距离。`transition.times` 仍用于设置关键帧位置。

## 关键帧与 times

任何属性值都可以写成数组，即一段完整的关键帧序列。关键帧位置来自 `transition.times`：优先取逐属性形态（`transition: { opacity: { times: [0, 0.3, 0.9, 1] } }`），否则取同长度的顶层 `transition.times`；都没有时按等分排布（`index / (count - 1)`）。

```tsx
// A background that fades in, holds, and fades out across one enter span.
<Animate
  animateId="backdrop"
  enterAnimation={{
    initial: { opacity: 0, filter: 'blur(12px)', scale: 1.04 },
    animate: {
      opacity: [0, 1, 1, 0],
      filter: ['blur(12px)', 'blur(0px)', 'blur(0px)', 'blur(10px)'],
      scale: [1.04, 1, 1, 1.02],
      transition: {
        opacity: { times: [0, 0.3, 0.9, 1] },
        filter: { times: [0, 0.3, 0.9, 1] },
        scale: { times: [0, 0.3, 0.9, 1] },
      },
    },
  }}
  duration={{ enter: 4000 }}
>
  <div className="backdrop" />
</Animate>
```

数值目标在起止值之间插值，数组在关键帧之间插值。`100%`、`12px` 和 `45deg` 等字符串保留其单位，动画值不会自动按 `designWidth` 换算。

## 关键帧如何随滚动进度求值

用一个属性走一遍求值过程。设 `opacity: [0, 1, 1, 0]`、`times: [0, 0.3, 0.9, 1]`：

| progress | 所处分段                           | 结果                                              |
| -------- | ---------------------------------- | ------------------------------------------------- |
| 0.15     | 0 → 0.3                            | 从 0 向 1 插值，走到一半：`0.5`                   |
| 0.45     | 0.3 → 0.9 内部（两个关键帧都是 1） | 保持 `1`                                          |
| 0.95     | 0.9 → 1                            | 从 1 向 0 插值，`(0.95 − 0.9) / 0.1 = 0.5`：`0.5` |

关键帧可让元素在同一个 `duration.enter` 中入场、保持可见并离场，按效果需要设置关键帧数量。

## 复用动画对象

静态透明度配置可为自绘内容提供时间轴，而不改变其透明度。位移与淡入也可在同一段入场中使用：

```tsx
// 进度变化时保持透明度不变。
export function solidVariant() {
  return {
    initial: { opacity: 1 },
    animate: { opacity: 1, transition: { duration: 0 } },
  };
}

// 使用受支持的属性完成位移与淡入。
export function riseVariant(amplitude: string) {
  return {
    initial: { y: amplitude, opacity: 0 },
    animate: { y: 0, opacity: 1, transition: { duration: 0 } },
  };
}
```

内容需要通过 `useAnimateTimeline()` 读取进度，或为 `after` 依赖提供时序时，可使用 `solidVariant()`。AnimateVideo 默认采用静态透明度入场。

## 退场动画配置

`exitAnimation` 接受同样的形态，但真正起作用的是 `exit` 记录，`initial`/`animate` 只为对称存在，通常保持静止：

```tsx
<Animate
  animateId="board"
  enterAnimation={{
    initial: { opacity: 0, scale: 0.94, y: '4%' },
    animate: { opacity: 1, scale: 1, y: '0%' },
  }}
  exitAnimation={{ exit: { opacity: 0, scale: 1.04 } }}
  duration={{ enter: 2400, exit: 900 }}
>
  <div className="board" />
</Animate>
```

示例先位移并淡入，再缩放并淡出。

退场关键帧数组的规则与入场完全一致（包括 `times`），元素的完成态取最后一个关键帧。反向滚动时沿同一套插值逆向回放，因此用关键帧编写的退场会逐关键帧反向还原。

## 哪些属性可动画

enter/exit 可动画的属性一共十个：

`opacity`、`x`、`y`、`scale`、`rotate`、`rotateX`、`rotateY`、`skewX`、`skewY`、`filter`。

属性列表适用于普通 Animate 的入退场。stagger 使用 Framer 子元素动画，还支持 `clipPath` 和 `width` 等属性。

canvas 等自绘内容可直接读取时间轴 MotionValue，绘制所需画面。

## 组合动画

`ComposedAnimation` 将多个步骤（预设名、自定义动画配置或两者混用）组合为一个完整动画：

```tsx
<Animate
  enterAnimation={{
    animations: ['fade-in', { animate: { scale: [0.9, 1], transition: { duration: 0.4 } } }],
    mode: 'sequential',
    delays: [0, 200],
  }}
  duration={{ enter: 1600 }}
>
  <div className="card" />
</Animate>
```

组合配置字段：

| 字段         | 含义                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| `animations` | 预设名或自定义动画配置构成的数组；不可为空。                                                           |
| `mode`       | `'sequential'`：每步在前序步骤的时长加自身 delay 之后开始；`'parallel'`：所有步骤在各自 delay 处开始。 |
| `delays`     | 每步的额外延迟（ms），按书写位置索引。                                                                 |

- `sequential` 模式在前一步的时长与延迟之后开始后续步骤。步骤未声明 `transition.duration` 时，计算采用 1s。`initial` 取第一步，`exit` 取最后一步。
- `parallel` 模式保留各步骤的延迟，合并初始与退场属性，同名属性采用后面的值。
- 动画目标及逐属性 transition 按同一方式合并。多个步骤修改同一属性时，最后一步提供目标值；需要同一属性多次变化时，使用关键帧数组。随位置推进的动画读取映射值和关键帧时间，不使用 transition 延迟。

要排的是**元素之间**的先后而非单元素内部的步骤时，用 `after` 级联，见 [时间线](/docs/04-orchestration)。
