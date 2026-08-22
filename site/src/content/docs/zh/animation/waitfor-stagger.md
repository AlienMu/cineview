---
title: waitFor 级联与 Stagger
eyebrow: SEQUENCING
---

两个互补的时序工具：`waitFor` 在元素之间排先后（B 等 A 入场完成才开始）；`stagger` 把一组子元素逐个揭示。两者都在绘制任何一帧之前编译为延迟。

## waitFor 如何累加

registry（`src/animations/registry.ts`）把每个注册元素解析成一个 `calculatedDelay`：

```text
calculatedDelay(B) = B.delay + calculatedDelay(A) + A.enterDuration
```

其中 `A` 即 `B.waitFor`。一条链编译成时间轴上互不重叠的窗口——没有元素在运行时盯梢另一个：

```tsx
<Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 600 }}>
  <h1>Title</h1>
</Animate>

<Animate
  animateId="subline"
  enterAnimation="slide-up"
  duration={{ enter: 600 }}
  timeline={{ waitFor: 'title', delay: 0 }}
>
  <p>Subline waits for the title to finish</p>
</Animate>

<Animate
  animateId="video"
  enterAnimation="fade-in"
  duration={{ enter: 6000 }}
  timeline={{ waitFor: 'subline', delay: 0 }}
>
  <div className="video-stage" />
</Animate>
```

| 元素 | delay | 前驱时长 | calculatedDelay | 自身窗口 |
| --- | --- | --- | --- | --- |
| title | 0 | — | 0 | 0 – 600 |
| subline | 0 | 600 | 600 | 600 – 1200 |
| video | 0 | 600 | 1200 | 1200 – 7200 |

场景的时间轴总时长取所有元素 `calculatedDelay + duration` 的最大值。scroll 接管下每毫秒即一个真实滚动像素（`1ms = 1px`），上表可直接按 px 读。drag 模式下同一个 `calculatedDelay` 门控场景的元素轨：元素的入场在场景 elapsed 的 `[calculatedDelay, calculatedDelay + enterDuration]` 区间内推进。

退场要有镜像的编排——title → subline → video 入场的链，退场应 video → subline → title，否则反向回放会塌缩成同时打包回滚。

## 链在各模式下如何运行

累加算术是共享的；每个模式用自己的时钟消费它：

- **scroll 接管**：链上的毫秒数变成 zone 内的 px 窗口——follower 的 `startMs` 即其 `startPx`（`1ms = 1px`），滚动 zone 就是字面意义上地走过这条级联。
- **drag**：同一个 `calculatedDelay` 门控场景的元素轨——每个 follower 的入场占据场景 elapsed 的 `[calculatedDelay, calculatedDelay + enterDuration]`，手指在其间 scrub。
- **visibility**（scroll 模式的 zone 外）：链按真实时间播放——`delay` 就是入场开始前流逝的等待时间。

有一条边是特例：**visibility follower 等待 scroll-zone leader** 编译时不累加 delay，而是在运行时等 leader 真正完成的信号——scroll leader 有可发布的真实完成事件。反方向则一律拒绝：

| follower ↓ 等待 → leader | drag | scroll | visibility |
| --- | --- | --- | --- |
| drag | 允许 | 拒绝 | 拒绝 |
| scroll | 拒绝 | 允许 | 拒绝 |
| visibility | 拒绝 | 允许（runtime-completion-only） | 允许 |

另有一类在 registry 之外：drag arrival 轨（`sceneControlled: false`）完全不参与 registry——arrival 元素不是合法的 `waitFor` 目标，它自己写的 `waitFor` 也被忽略。

## 校验与上报

registry 编译整张图并如实上报问题，不做猜测：

| 问题 | 公共错误码 | 行为 |
| --- | --- | --- |
| `waitFor` 目标未注册 | `INVALID_ANIMATION` | 上报；follower 仅回退用自身的 `delay`。 |
| 链上存在环 | `CIRCULAR_DEPENDENCY` | 上报；环上每个成员都回退为仅自身 `delay`——不沿环累加。 |
| `animateId` 重复 | `INVALID_COMPONENT_HIERARCHY` | 上报；registry 拒绝有歧义的引用。 |
| 跨 driver 边 | `INVALID_ANIMATION` | 拒绝（见下）。 |

有一条跨 driver 边被刻意放行：**visibility follower 可以等待 scroll-zone leader**。这个方向上 follower 的 delay **不**累加 leader 的窗口——它在运行时等 leader 真正完成（runtime-completion-only）。反方向——scroll follower 等待 visibility leader——被拒绝：scroll 元素的窗口必须是滚动位置的纯函数，而 visibility leader 没有可用滚动寻址的终点。

## Stagger：单个 Animate 内的分组编排

`stagger` 把单一子元素的直接子元素逐个揭示，用 `enterAnimation` 的变体驱动：

```tsx
<Animate
  animateId="lines"
  enterAnimation="slide-up"
  duration={{ enter: 800 }}
  stagger={{ each: 120, from: 'first' }}
>
  <ul>
    <li>First to reveal</li>
    <li>Second</li>
    <li>Third</li>
  </ul>
</Animate>
```

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `stagger.each` | `number` | `40` | 每个子元素的间隔（ms）。 |
| `stagger.from` | `'first' \| 'last' \| 'center'` | `'first'` | 揭示方向：正序、逆序、由中间向两侧。 |

实践中有意义的规则：

- `children` 必须是单一 React 元素（设 `stagger` 时由类型强制）；它的每个**直接**子元素即一个错峰项。
- 揭示走 Framer 原生 variant 传播，子元素可动画**任意** Framer 可动画属性（`clipPath`、`width`……）——enter/exit 的十属性白名单在此不适用。
- 时间驱动、绝不 scrub：lane 判定「入场」时整组播放，并按 `visibility.replayOnReenter` 在重入时复位。需要逐元素 scrub 时改用 render-prop 的 `enterProgress`。
- 完成时钟是 `max( authored 时长, tail + item 时长)`，其中 `tail = lastOrder × each`。元素注册用的就是这个有效时长——因此错峰组的 `waitFor` follower 等的是整组揭示完成，而非仅 authored 的 `duration.enter`。

## 错峰时序的数字

五个子项、`each: 120`、变体单项时长 600ms（声明了 `transition.duration` 用声明值，否则用 authored 的 `duration.enter`）：

| `from` | 最晚次序 | 尾长（`lastOrder × each`） | 有效时长 |
| --- | --- | --- | --- |
| `'first'` | 4 | 480ms | `max(600, 480 + 600)` = **1080ms** |
| `'last'` | 4 | 480ms | **1080ms**（逆序，总量不变） |
| `'center'` | 2 | 240ms | `max(600, 240 + 600)` = **840ms** |

两个推论：

- `from: 'center'` 明显更早收束——揭示从中间向两侧扇出，最远的子项也只隔半张列表。
- 向时间轴注册的是**有效**时长——这组的 `waitFor` follower 等的是完整的 1080ms，而不是 authored 的 600。链上的算术要按错峰预算，别按变体预算。

退场以同样的 `each`/`from` 错峰，把每个子项送往 `exitAnimation` 的 exit 记录——未声明 `exitAnimation` 时则回到 `initial` 记录。入场退场同一节奏，组怎么组装的就怎么解开。

内部实现是 `StaggerContainer`（`src/components/Animate/StaggerContainer.tsx`），每个模式各有一个薄订阅组件（scroll 读 signed visual 信号、drag 读 visual state、drag arrival 轨读 phase）。它不是公共导出——`Animate` 的 `stagger` 属性才是公共面。

## 编写自查清单

宣布一条级联完成之前：

1. 每个 `waitFor` 目标都在同一 registry 作用域内（drag 同 scene、scroll 接管同 zone）——否则上报 `INVALID_ANIMATION`，follower 按裸 `delay` 起跑。
2. 全树无重复 `animateId`——重复会上报 `INVALID_COMPONENT_HIERARCHY`。
3. 链上无环——环上每个成员上报 `CIRCULAR_DEPENDENCY` 并回退为自身 delay。
4. 链的 leader 不带 `timeline.phase`（见下方约束）。
5. 退场按入场链的逆序镜像，否则反向回放会打包成一坨同时回滚。
6. leader 若是错峰组，链上算术用它的有效时长，不是 authored 时长。

## 当前约束：链的 leader 不应带 phase 窗口

scroll 接管 zone 内，**不要**给链的 leader 写 `timeline.phase` 再挂 `waitFor` follower。

`sceneScrollBudget` 维护两套时钟。ms 时钟（`resolveTiming`）解析 waitFor 链：follower 的起点取 leader 的 `totalEndMs`。px 时钟套用 authored 的 phase 校正——带 phase 窗口的元素其有效终点变成 `phaseEndPx`。而 phase 校正**只落在 px 时钟**上；ms 层的链从不消费 leader 的 `phaseEnd`。于是 follower 的起点 px（从未校正的 ms 时钟推导）会提前落位。

这是实测而非推演（task-flow `2026-08-23-stage3-demo-hub-docs.md`，T1.8）：带 phase 窗口的 title 领链时，subline 在 title 进行到 14% 时就启动了。修复方式是摘掉 phase 窗口，改写成纯三级 waitFor 链。

在框架补上这个缺口之前（要么 budget 让链消费 leader 的 `phaseEnd`，要么约束进类型——目前记档为待裁决项），请按以下规则编写：

- 链写成纯 `waitFor` + `delay` 级联，让链的算术自己安放窗口。
- 带 phase 窗口的元素移出链——写了 `timeline.phase` 的元素可以存在于同一 zone，但不要让任何元素 `waitFor` 它。
