---
title: 自定义动画
eyebrow: ADVANCED / CUSTOM ANIMATION
---

当没有合用的预设时，直接书写变体对象。自定义动画是 Framer Motion 变体的一个子集（`initial`、`animate`、`exit` 三个记录），以内联对象传到预设名所在的位置。

## 自定义变体

`CustomAnimation` 的形状只允许这三个键，且至少一个为非空对象；其余形态会被解析器拒绝（`src/animations/animationParser.ts` 的 `validateCustomAnimation`）。

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

值得记住的解析规则：

- 字符串按预设名解析，对象按自定义变体解析；`parseAnimation` 按类型分派。
- `transformOrigin` 字符串会归一化为百分比对（`'top left'` → `'0% 0%'`、`'center'` → `'50% 50%'`）。
- 变体内的 transition 时间参数（`transition.duration` 单位秒、`transition.delay` 单位秒）只在时间驱动的动画里生效。跟随滚动位置的动画（scroll 锁定区内、drag 场景驱动的元素）按位置插值，忽略 transition 时间参数；那里的时长来自 `duration.enter`，即跟随滚动的跨度。

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

跟随滚动时，运行时按滚动进度逐属性求值：标量目标是 from→to 的 lerp；数组目标沿关键帧分段推进。字符串插值器支持数字、带单位字符串（`100%`、`12px`、`45deg`）与单参变换函数（`translateY(100%)`），因此端点可以按设计单位书写。

## 关键帧如何随滚动进度求值

用一个属性走一遍求值过程。设 `opacity: [0, 1, 1, 0]`、`times: [0, 0.3, 0.9, 1]`：

| progress | 所处分段                           | 结果                                              |
| -------- | ---------------------------------- | ------------------------------------------------- |
| 0.15     | 0 → 0.3                            | 从 0 向 1 插值，走到一半：`0.5`                   |
| 0.45     | 0.3 → 0.9 内部（两个关键帧都是 1） | 保持 `1`                                          |
| 0.95     | 0.9 → 1                            | 从 1 向 0 插值，`(0.95 − 0.9) / 0.1 = 0.5`：`0.5` |

关键帧让跟随滚动的元素在自己的跨度里拥有**形状**：在同一个 `duration.enter` 内完成入场、停留与离场，这是朴素的 from-to 变体表达不了的。需要在同一个锁定区内既到达又离开的元素，标准写法就是：一个元素、一个跨度、四个关键帧。

## 站点实战中的两个形态

站点里有两个值得照抄的小工厂（来自 `site/src/components/CapabilityScene.tsx`）：

```tsx
/* Neutral lane: establishes the shared timeline without fading the carried
   content across the whole span. transition duration 0. Under scroll the
   position drives the value, so the variant only fixes the endpoints. */
export function solidVariant() {
  return {
    initial: { opacity: 1 },
    animate: { opacity: 1, transition: { duration: 0 } },
  };
}

/* Allowlist-only rise: custom variants on scrub lanes should stick to the
   ten lane-owned properties. */
export function riseVariant(amplitude: string) {
  return {
    initial: { y: amplitude, opacity: 0 },
    animate: { y: 0, opacity: 1, transition: { duration: 0 } },
  };
}
```

`solidVariant()` 是「元素需要挂到共享时间轴上（给 render-prop、`useAnimateTimeline` 消费者、或做 after 锚点），但不需要自己的视觉动画」时的惯用写法，`AnimateVideo` 包装层的默认变体内部用的是同一种做法。

## 退场变体

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

（这个形态取自站点的场记板场景：入场上浮落定，退场边放大边淡出，像放映机拉远。）

退场关键帧数组的规则与入场完全一致（包括 `times`），元素的终态取最后一个关键帧。反向滚动时沿同一套插值逆走，因此用关键帧写的退场会逐关键帧地解开。

## 哪些属性可动画

enter/exit 可动画的属性一共十个：

`opacity`、`x`、`y`、`scale`、`rotate`、`rotateX`、`rotateY`、`skewX`、`skewY`、`filter`。

跟随滚动的自定义变体应限于这十个。两种被许可的越界方式：

- `stagger` 属性经 Framer 原生 variant 传播逐个揭示直接子元素，接受任意 Framer 可动画属性（`clipPath`、`width`……），由时间驱动，不跟随滚动位置。
- canvas 与自绘渲染器直接读 `useAnimateTimeline()` 的 MotionValue（canvas 豁免）。

## 组合动画

`ComposedAnimation` 把多个步骤（预设名、自定义变体或两者混用）缝合成一个动画：

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

组合规则（来自 `src/animations/composer.ts`）：

| 字段         | 含义                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| `animations` | 预设名和/或自定义变体构成的数组；不可为空。                                                            |
| `mode`       | `'sequential'`：每步在前序步骤的时长加自身 delay 之后开始；`'parallel'`：所有步骤在各自 delay 处开始。 |
| `delays`     | 每步的额外延迟（ms），按书写位置索引。                                                                 |

- `sequential`：步骤 delay 按「前序 duration + 前序 customDelay」累加；未声明 `transition.duration` 的步骤按 1s 计（Framer 的隐式时长在编译期读不出，请显式声明时长）。`initial` 取第一步，`exit` 取最后一步。
- `parallel`：每步保留自己的 delay；`initial` 与 `exit` 合并全部步骤（同名属性 last-wins）。
- 合并后的 `animate` 采用 Framer 的逐值 transition 形态（`transition: { opacity: {...}, y: {...} }`），每个属性携带自己所属步骤的 delay/duration。注意该形态为时间驱动服务；跟随滚动时按值插值、忽略 transition。

要排的是**元素之间**的先后而非单元素内部的步骤时，用 `after` 级联，见 [时间线](/docs/04-orchestration)。
