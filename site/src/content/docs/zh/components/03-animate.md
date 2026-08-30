---
title: Animate
eyebrow: COMPONENTS / ANIMATE
---

Animate 是给元素挂动画语义的组件。它消费当前模式的时间轴：drag 下跟随场景拖拽，scroll 锁定区（locked zone）内跟随真实滚动，其余情况按可见性条件以真实时间播放。所有入场/退场/常驻循环都走它，不要手写 CSS 动画。

```tsx
<Animate
  animateId="title"
  enterAnimation="fade-in"
  exitAnimation="fade-out"
  duration={{ enter: 800, exit: 400 }}
  timeline={{ delay: 200, after: 'subtitle' }}
  visibility={{ replay: true }}
>
  <h1>Hello</h1>
</Animate>
```

## Props 全表

| prop                                    | 类型                                     | 默认      | 说明                                                                                                                                                                        |
| --------------------------------------- | ---------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `animateId`                             | string                                   | 无        | 元素唯一标识。重复 = `INVALID_COMPONENT_HIERARCHY`；被 `after` 引用时必须声明                                                                                               |
| `enterAnimation`                        | AnimationType                            | 无        | 入场动画。与 `loopAnimation` 至少提供一个                                                                                                                                   |
| `exitAnimation`                         | AnimationType                            | 无        | 退场动画，必须与 enter 或 infinite 共存。drag 下只覆盖正向离场：反向拖回是入场倒放，不读此变体；未声明时正向离场也不播（元素保持终态）。见 [时间线](/docs/04-orchestration) |
| `loopAnimation`                         | AnimationType                            | 无        | 常驻循环动画。单独用它时 `enterAnimation` 必须为 `never`（类型强制）                                                                                                        |
| `duration.enter` / `duration.exit`      | number (ms)                              | `600`     | 入场/退场时长。scroll 锁定区内 `1ms = 1px` 真实滚动距离                                                                                                                     |
| `timeline.driver`                       | `'scene'\|'clock'`                       | `'scene'` | progress 由谁驱动，见「driver 裁决表」小节                                                                                                                                  |
| `timeline.delay`                        | number (ms)                              | `0`       | 入场延迟                                                                                                                                                                    |
| `timeline.after`                        | string                                   | 无        | 等另一个 `animateId` 入场完成再开始。指向不存在 = `INVALID_ANIMATION`，成环 = `CIRCULAR_DEPENDENCY`                                                                         |
| `timeline.zoneId`                       | string                                   | 无        | 显式绑定某个 scroll 锁定区                                                                                                                                                  |
| `timeline.phase.start` / `end`          | number                                   | 无        | 元素在 zone 滚动预算内占用的相位区间                                                                                                                                        |
| `visibility.replay`                     | boolean                                  | `true`    | 重新可见时是否回放入场                                                                                                                                                      |
| `visibility.enterMargin` / `exitMargin` | number （设计 px)                        | 全局 50   | 可见性条件的边距，默认取 `enterMargin/exitMargin`。超视口高的元素回退 center/70% 规则                                                                                       |
| `stagger`                               | `{each?, from?}`                         | 无        | 子元素错峰揭示，见「stagger 错峰揭示」小节                                                                                                                                  |
| `enterRef` / `exitRef`                  | `MutableRefObject<(() => void) \| null>` | 无        | 手动入场/退场触发器，见「enterRef / exitRef 手动触发」小节                                                                                                                  |
| `children`                              | ReactNode 或 render-prop                 | 无        | 设了 `stagger` 时必须是**单个** ReactElement                                                                                                                                |

## AnimationType 三层

`enterAnimation`/`exitAnimation`/`loopAnimation` 均接受 `AnimationType`，三种形态：

- 预设名：43 个内置预设之一，如 `"fade-in"`。完整清单见[预设动画](/docs/08-presets)。
- CustomAnimation：Framer Motion variant 子集 `{ initial?, animate?, exit? }`，键是任意 framer 可动画属性。
- ComposedAnimation：`{ animations: (PresetAnimation | CustomAnimation)[], mode: 'sequential' | 'parallel', delays?: number[] }`，把多个动画顺序或并行组合，`delays` 逐动画延迟。

```tsx
<Animate
  animateId="card"
  enterAnimation={{
    animations: ['slide-up', { initial: { opacity: 0 }, animate: { opacity: 1 } }],
    mode: 'parallel',
    delays: [0, 100],
  }}
>
  <Card />
</Animate>
```

## driver 裁决表

`timeline.driver` 决定 progress 由谁驱动，可取 `'scene'`（默认）或 `'clock'`，五种组合：

| driver    | 位置                           | 驱动                                                                              |
| --------- | ------------------------------ | --------------------------------------------------------------------------------- |
| `'scene'` | scroll 锁定区内（继承 zoneId） | zone 真实滚动预算，可配 `timeline.phase`                                          |
| `'scene'` | scroll 非 zone                 | 降级为可见性条件，视口进出触发                                                    |
| `'scene'` | drag                           | Scene 共享元素时间轴，随拖拽 scrub                                                |
| `'clock'` | scroll                         | 强制走可见性条件，即使在 zone 内也不被接管                                        |
| `'clock'` | drag                           | Scene 到场后按真实时间独立播放；**不参与 registry/after，且忽略 `exitAnimation`** |

最后一行需要留意：drag 模式下把 `driver` 设为 `'clock'`，退场动画直接不播。要退场就保持 `'scene'`。

## loopAnimation 什么时候运行

常驻循环动画用 `loopAnimation`，不要用 CSS `animation: … infinite`。CSS 无限动画不受 phase 约束，元素退场或滚出视口后照跑。`loopAnimation` 由 `shouldRunInfinite` 判定：只有元素处于自己的 phase 且在视口内才运行，离开即停。

`loopAnimation` 可与 `enterAnimation` 共存（入场完成后接管常驻循环），也可单独使用；单独使用时类型强制 `enterAnimation` 为 `never`。

## stagger 错峰揭示

```tsx
<Animate animateId="list" enterAnimation="fade-in" stagger={{ each: 40, from: 'first' }}>
  <ul>
    <li>第一项</li>
    <li>第二项</li>
  </ul>
</Animate>
```

- `each`：相邻子元素间隔 ms，默认 `40`。
- `from`：起始方向 `'first'`（默认）/ `'last'` / `'center'`。
- 走 framer 原生 `staggerChildren`，逐个揭示直接子元素，子元素用 `enterAnimation` 的变体（绕过 10 属性许可清单，`clipPath`/`width` 等任意 framer 属性可用）。
- **时间驱动，不随滚动/拖拽 scrub**。要 scrub 的逐元素揭示，改用 render-prop 拿 `enterProgress` 自己映射。

## render-prop children

```tsx
<Animate animateId="bar" enterAnimation="fade-in">
  {({ enterProgress, phase }) => (
    <div style={{ width: `${enterProgress * 100}%` }} data-phase={phase} />
  )}
</Animate>
```

`AnimateRenderState`：

| 字段            | 类型                                                                      | 说明                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `enterProgress` | number `0..1`                                                             | 0 = 初始帧，1 = 完全进入。visibility 按时间推进，scroll/drag 随滚动/拖拽 scrub                                                                                                 |
| `phase`         | `'idle' \| 'waiting' \| 'entering' \| 'entered' \| 'exiting' \| 'exited'` | 六个相位。**scroll 锁定区内 `phase` 不更新，一直是 `idle`**，不要用它判断锁定区内的进度；锁定区内改用 `signedProgress`，见 [useAnimateTimeline](/docs/09-use-animate-timeline) |

需要 MotionValue 形态的连续值（绕过 React 渲染管线）时用 [useAnimateTimeline](/docs/09-use-animate-timeline)。

## enterRef / exitRef 手动触发

`enterRef` 行为规则：

- 调用 `enterRef.current()`：立即播放入场，打断正在等待的 `after`/`delay`。
- 传了 `enterRef` + 传了 `after`/`delay`：用户不调 ref，框架在 `after`/`delay` 结束后兜底触发。
- 传了 `enterRef` 但没传 `after`/`delay`：永不自动触发，必须手动调。

`exitRef` 行为规则：

- 传了即禁用全部自动退场（scroll 离 zone / drag 切 scene 都失效），必须手动调。
- 调用立即播放退场，打断等待中的入场。
- 无 delay 兜底：退场没有「超时自动退」的语义。

典型用法：异步数据到达即显示，失败靠 delay 兜底：

```tsx
const contentEnterRef = useRef<(() => void) | null>(null);

useEffect(() => {
  fetch('/api/data')
    .then((data) => {
      setContent(data);
      contentEnterRef.current?.(); // 成功 → 立即显示
    })
    .catch(() => {
      // 失败 → 不调 ref，等 3 秒兜底触发
    });
}, []);

<Animate
  enterRef={contentEnterRef}
  timeline={{ delay: 3000 }} // 兜底：3 秒后无论如何都显示
  enterAnimation="fade-in"
>
  {content || <EmptyState />}
</Animate>;
```

手动退场：

```tsx
const modalExitRef = useRef<(() => void) | null>(null);

<Animate exitRef={modalExitRef} enterAnimation="fade-in" exitAnimation="fade-out">
  <Modal onClose={() => modalExitRef.current?.()} />
</Animate>;
```

## 时间线的强制规则

入场写了 `after` 级联的，退场必须写对应的反向时间线。只写 `enterAnimation` 链会导致所有元素在同一帧一起退场，与入场的有序级联不对称。详见[时间线](/docs/04-orchestration)与[排错](/docs/07-common-pitfalls)。
