---
title: 时间线
eyebrow: CONCEPTS / SEQUENCING
---

`timeline.after` 设置多个元素的动画顺序，`stagger` 按间隔显示同一容器的直接子元素。

## after 链

将 `timeline.after` 设为同一 Scene 中另一个元素的 `animateId`。目标完成入场后，再经过自身延迟，跟随元素开始入场。

```tsx
<Scene sceneId="titles">
  <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 600 }}>
    <h1>标题</h1>
  </Animate>
  <Animate animateId="sub" enterAnimation="fade-in" timeline={{ after: 'title', delay: 100 }}>
    <p>副标题</p>
  </Animate>
  <Animate animateId="cta" enterAnimation="fade-in" timeline={{ after: 'sub' }}>
    <button>继续</button>
  </Animate>
</Scene>
```

## after 如何触发动画

触发方式取决于元素的驱动方式。

### 跟随进度的元素

跟随场景的 drag 元素，以及 scroll 锁定区内跟随场景进度的元素，使用累加后的时间偏移：

```text
跟随元素起点 = 自身延迟 + 前序元素起点 + 前序入场时长
```

示例中的副标题从 700ms 开始，按钮从 1300ms 开始。拖拽或滚动经过这些位置时，对应元素开始变化，无需在到达位置后额外等待。

### 可见性触发的元素

由可见性驱动的 scroll 元素等待前序元素至少完成一次入场，然后检查自身的可见性条件与延迟。

```text
开始条件 = 前序已入场 + 自身可见性条件 + 自身延迟
```

前序元素退场或跟随元素重播，不会撤销这次已完成的入场。跟随元素仅等待自己的延迟，不会再次加上前序元素已经经过的播放时间。

### 混合驱动方式

| 跟随元素                 | 前序元素           | 是否支持                   |
| ------------------------ | ------------------ | -------------------------- |
| 可见性驱动               | 可见性驱动         | 支持                       |
| 跟随场景进度             | 相同的进度驱动方式 | 支持                       |
| 可见性驱动的 scroll 元素 | scroll 锁定区动画  | 支持，在前序入场完成后开始 |
| scroll 锁定区动画        | 可见性驱动         | 不支持                     |
| 跟随场景的 drag 元素     | 其他驱动方式       | 不支持                     |

不支持的依赖会报告 `INVALID_ANIMATION` 并被忽略，跟随元素保留自己的延迟与驱动方式。固定的滚动位置无法等待一个时机由用户输入决定的可见性事件。

drag 模式下的 `driver: 'clock'` 元素不能作为 `after` 链的前序或跟随元素。

## 错误处理

| 错误码                | 条件                                      |
| --------------------- | ----------------------------------------- |
| `INVALID_ANIMATION`   | 目标 `animateId` 不存在，或驱动方式不兼容 |
| `CIRCULAR_DEPENDENCY` | 依赖链包含循环                            |

Scene 中的动画声明就绪时，目标必须存在。JSX 的书写顺序不决定动画顺序，同一次渲染中可以先写跟随元素，再写前序元素。标识必须完全匹配，依赖不能成环。

## stagger

使用 `stagger` 时，传入单个容器元素，其直接子元素按顺序使用同一入场动画。

```tsx
<Animate enterAnimation="fade-in" stagger={{ each: 40, from: 'first' }}>
  <ul>
    <li>第一项</li>
    <li>第二项</li>
    <li>第三项</li>
  </ul>
</Animate>
```

`each` 为间隔毫秒数，默认 40。`from` 可取 `'first'`、`'last'` 或 `'center'`，默认 `'first'`。

stagger 按经过的时间播放，在锁定区内也一样。若子元素需要分别跟随滚动区间变化，可从 `useAnimateTimeline()` 的进度映射视觉值，或分别使用 Animate。

## 配置退场行为

`after` 只控制入场顺序。设计需要时再添加退场，入场顺序不要求对应的反向退场。

`exitAnimation` 声明视觉变化，`duration.exit` 设置时长，两者都不会增加退场依赖。需要可见性驱动的 scroll 元素依次退场时，按所需顺序调用各自的 `exitRef`。详见[手动触发](/docs/03-animate)。

反向滚动锁定区时，映射的动画会随之倒放。通过时长、延迟与关键帧定义各滚动位置对应的画面。

## drag 的正向与反向退场

| 方向                 | 动画                                     |
| -------------------- | ---------------------------------------- |
| 前往后一个场景       | 执行声明的 `exitAnimation`               |
| 返回前一个场景       | 反向播放入场动画，不使用 `exitAnimation` |
| 正向离开，未声明退场 | 页面移动，元素保持入场完成态             |

两个方向需要相近的视觉效果时，可让退场接近入场的反向变化。不声明退场时，正向切换中的场景内容保持静止。

## 相关页面

- [Animate](/docs/03-animate)：时长、时间线与手动 ref
- [Animate 时间线](/docs/02-timeline)：驱动方式与阶段
- [排错](/docs/07-common-pitfalls)：时序问题
