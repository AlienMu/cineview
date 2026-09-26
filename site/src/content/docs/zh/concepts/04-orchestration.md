---
title: 动画组合与顺序
eyebrow: CONCEPTS / SEQUENCING
---

同一元素可以组合多个预设或自定义动画。多个元素之间用 `timeline.after` 设置顺序，同一容器的直接子元素可用 `stagger` 依次出现。

`after` 的作用是表达元素之间的先后关系。标题时长从 600ms 改成 900ms，跟随它的说明会自动后移 300ms。直接填写绝对 `delay` 则需要同时修改每个后续元素。

## 用 after 排列多个元素

将 `timeline.after` 设为同一 Scene 中另一元素的 `animateId`。这个例子没有退场动画，副标题在标题之后出现，按钮在副标题之后出现：

```tsx
<Scene sceneId="titles">
  <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 600 }}>
    <h1>标题</h1>
  </Animate>
  <Animate
    animateId="subtitle"
    enterAnimation="fade-in"
    duration={{ enter: 600 }}
    timeline={{ after: 'title', delay: 100 }}
  >
    <p>副标题</p>
  </Animate>
  <Animate enterAnimation="fade-in" duration={{ enter: 400 }} timeline={{ after: 'subtitle' }}>
    <button>继续</button>
  </Animate>
</Scene>
```

目标 `animateId` 必须存在于同一 Scene。JSX 书写顺序不决定动画顺序，所以前序元素可以写在跟随元素之后。

## 不同驱动方式如何等待

### 跟随拖拽或滚动

示例的副标题从 700ms 开始，按钮从 1300ms 开始。拖拽或滚动到对应位置时，元素开始变化，**无需停在那里再等待一段时间**。

drag 与 scroll 中，`after` 都等待前序入场完成。例如前序入场 600ms、退场 400ms，未配置延迟的跟随元素从 600ms 开始。锁定区内若声明了 `phase`，跟随元素从该入场区间的终点开始。

跟随元素自己的 `timeline.delay` 加在这个位置之后。锁定区的更多时长示例见[时长预算](/docs/02-zones-budget)。

### 按可见性播放

可见性动画等待前序元素至少完成一次入场。之后，自身的可见性条件与延迟决定何时开始。

前序元素随后退场，不会撤销已经完成的入场。跟随元素重播时也只等待自己的延迟，不再重复等待前序已经播放过的时间。

### 混合驱动方式

| 跟随元素           | 前序元素           | 是否支持               |
| ------------------ | ------------------ | ---------------------- |
| 可见性动画         | 可见性动画         | 支持                   |
| 跟随场景进度的动画 | 相同进度来源的动画 | 支持                   |
| scroll 可见性动画  | scroll 锁定区动画  | 支持，等待前序入场完成 |
| scroll 锁定区动画  | 可见性动画         | 不支持                 |
| drag 场景动画      | 其他驱动方式       | 不支持                 |

不支持的依赖会报告 `INVALID_ANIMATION` 并被忽略。跟随元素保留自己的延迟与驱动方式。固定的滚动位置无法等待一个时机由用户输入决定的可见性事件。

drag 中的 `driver: 'clock'` 元素不能作为 `after` 的前序或跟随元素。

## 在同一元素上组合动画

将预设和自定义动画放进 `animations`，并选择组合方式。这个标题同时淡入并向上移动：

```tsx
<Animate
  enterAnimation={{
    animations: ['fade-in', { initial: { y: 32 }, animate: { y: 0 } }],
    mode: 'parallel',
  }}
  duration={{ enter: 800 }}
>
  <h1>产品细节</h1>
</Animate>
```

同一属性出现多次时，后面的配置优先。需要在同一属性上连续改变多个值时，使用关键帧。完整写法见[自定义动画](/docs/05-custom-animation)。

普通 `Animate` 入退场（包括可见性与 clock 播放）会把组合动画的属性合并到同一段进度中；`sequential` 和 `delays` 不会让它们分段播放。要让属性按顺序变化，使用关键帧；要让不同元素依次入场，使用 `timeline.after`。

## 让子元素依次出现

使用 `stagger` 时，传入单个容器元素。容器的直接子元素依次播放同一入场动画：

```tsx
<Animate enterAnimation="fade-in" stagger={{ each: 40, from: 'first' }}>
  <ul>
    <li>第一项</li>
    <li>第二项</li>
    <li>第三项</li>
  </ul>
</Animate>
```

`each` 是相邻元素的时间间隔，默认 40ms。`from` 支持 `'first'`、`'last'` 和 `'center'`，默认从第一个元素开始。

stagger 按时间播放，锁定区内也一样。需要每个子元素分别跟随滚动时，使用独立的 Animate，或按 [Canvas 示例](/docs/02-timeline)订阅进度并绘制。

## 配置退场

`after` 为跟随元素安排入场，不会自动生成一组反向退场动画。需要可见性动画依次退场时，按顺序调用各自的 `exitRef`。详见[手动触发](/docs/03-animate)。

锁定区内，反向滚动会反向经过相同动画。无需为返回较早的画面额外声明退场。添加 `exitAnimation` 会在向前滚动时增加一段退场变化。

| drag 导航方向    | 元素行为                       |
| ---------------- | ------------------------------ |
| 前往后一个场景   | 执行 `exitAnimation`           |
| 返回前一个场景   | 反向播放入场动画               |
| 前进但未声明退场 | 页面移动，元素保持入场完成画面 |

若正向与反向导航需要相近的效果，将退场写成入场的反向变化。

## 检查依赖错误

| 错误码                | 检查内容                                         |
| --------------------- | ------------------------------------------------ |
| `INVALID_ANIMATION`   | 目标 id 是否存在、拼写是否一致、驱动方式是否兼容 |
| `CIRCULAR_DEPENDENCY` | 是否存在 A 等待 B、B 又等待 A 的循环             |

前序和跟随元素应在同一次渲染中声明。更多排查方法见[常见问题](/docs/07-common-pitfalls)。
