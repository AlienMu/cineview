---
title: Animate
eyebrow: COMPONENTS / ANIMATE
---

Animate 用于为元素附加动画时序与状态语义。它消费当前模式对应的时间轴：在 drag 模式下跟随场景手势推进，在 scroll 锁定区（locked zone）内跟随物理滚动距离推进，其余场景则依据可见性条件按实际时间播放。所有入场、退场及常驻循环动画均通过 Animate 统一管理，避免手写 CSS 动画。

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

| prop                                    | 类型                                     | 默认      | 说明                                                                                                                                                                                          |
| --------------------------------------- | ---------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `animateId`                             | string                                   | 无        | 元素唯一标识。重复 = `INVALID_COMPONENT_HIERARCHY`；被 `after` 引用时必须声明                                                                                                                 |
| `enterAnimation`                        | AnimationType                            | 无        | 入场动画。与 `loopAnimation` 至少提供一个                                                                                                                                                     |
| `exitAnimation`                         | AnimationType                            | 无        | 退场动画，必须与 `enterAnimation` 或 `loopAnimation` 共存。drag 下只覆盖正向离场：反向拖回是入场逆向播放，不执行退场配置；未声明时正向离场不播放退场补间（元素保持完成态）。见 [时间线](/docs/04-orchestration) |
| `loopAnimation`                         | AnimationType                            | 无        | 常驻循环动画。单独用它时**不要声明** `enterAnimation`（类型上标记为 `never`，即该键必须缺席）                                                                                                                          |
| `duration.enter` / `duration.exit`      | number (ms)                              | `600`     | 入场/退场时长。scroll 锁定区内 `1ms = 1px` 真实滚动距离                                                                                                                                       |
| `timeline.driver`                       | `'scene'\|'clock'`                       | `'scene'` | progress 由谁驱动，见「driver 裁决表」小节                                                                                                                                                    |
| `timeline.delay`                        | number (ms)                              | `0`       | 入场延迟                                                                                                                                                                                      |
| `timeline.after`                        | string                                   | 无        | 等另一个 `animateId` 入场完成再开始。指向不存在 = `INVALID_ANIMATION`，成环 = `CIRCULAR_DEPENDENCY`                                                                                           |
| `timeline.zoneId`                       | string                                   | 无        | 显式绑定某个 scroll 锁定区                                                                                                                                                                    |
| `timeline.phase.start` / `end`          | number                                   | 无        | 元素在 zone 滚动预算内占用的执行区间                                                                                                                                                          |
| `visibility.replay`                     | boolean                                  | `true`    | 重新可见时是否回放入场                                                                                                                                                                        |
| `visibility.enterMargin` / `exitMargin` | number （设计 px)                        | 全局 50   | 可见性条件的边距，默认取 `enterMargin/exitMargin`。超高元素回退 center/70% 规则                                                                                                               |
| `stagger`                               | `{each?, from?}`                         | 无        | 子元素错峰揭示，见「stagger 错峰揭示」小节                                                                                                                                                    |
| `enterRef` / `exitRef`                  | `MutableRefObject<(() => void) \| null>` | 无        | 手动入场/退场触发器，见「enterRef / exitRef 手动触发」小节                                                                                                                                    |
| `children`                              | ReactNode 或 render-prop                 | 无        | 设了 `stagger` 时必须是**单个** ReactElement                                                                                                                                                  |

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
| `'scene'` | scroll 非 zone                 | 降级为可见性条件，进入/离开可视区域触发                                           |
| `'scene'` | drag                           | Scene 共享元素时间轴，随拖拽逐帧定位                                              |
| `'clock'` | scroll                         | 强制走可见性条件，即使在 zone 内也不被接管                                        |
| `'clock'` | drag                           | Scene 到场后按真实时间独立播放；**不参与 registry/after，且忽略 `exitAnimation`** |

需要注意：在 drag 模式下若将 `driver` 指定为 `'clock'`，退场动画将不予播放。若需保留退场动画，请保持默认的 `'scene'`。

## loopAnimation 什么时候运行

常驻循环动画需使用 `loopAnimation`，避免使用 CSS `animation: … infinite`。CSS 无限动画不受 phase 生命周期约束，元素在退场或脱离可视区域后仍会持续运行。`loopAnimation` 仅在元素处于有效生命周期阶段且位于可视区域内时运行，离开即自动停止。

`loopAnimation` 可与 `enterAnimation` 共存（入场完成后接管常驻循环），也可单独使用；单独使用时不要声明 `enterAnimation`（类型标记 `never`，该键必须缺席）。

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
- 依托 `staggerChildren` 逐个揭示直接子元素，子元素应用 `enterAnimation` 的动画配置（支持 `clipPath`、`width` 等任意可动画属性）。
- **时间驱动，不跟随滚动或拖拽**。需要逐帧定位的逐元素揭示，改用 render-prop 拿 `enterProgress` 自己映射。

## render-prop children

```tsx
<Animate animateId="bar" enterAnimation="fade-in">
  {({ enterProgress, phase }) => (
    <div style={{ width: `${enterProgress * 100}%` }} data-phase={phase} />
  )}
</Animate>
```

`AnimateRenderState`：

| 字段            | 类型                                                                      | 说明                                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enterProgress` | number `0..1`                                                             | 0 = 初始帧，1 = 完全进入。visibility 按时间推进，scroll/drag 随滚动或拖拽逐帧定位                                                                                                              |
| `phase`         | `'idle' \| 'waiting' \| 'entering' \| 'entered' \| 'exiting' \| 'exited'` | 六种生命周期状态。**scroll 锁定区内 `phase` 不更新，保持为 `idle`**，不宜以此判断锁定区内的实时进度；锁定区内建议使用 `signedProgress`，见 [useAnimateTimeline](/docs/09-use-animate-timeline) |

需要 MotionValue 形态的连续值（绕过 React 渲染管线）时用 [useAnimateTimeline](/docs/09-use-animate-timeline)。

## enterRef / exitRef 手动触发

`enterRef` 行为规则：

- 调用 `enterRef.current()`：立即播放入场，打断正在等待的 `after`/`delay`。
- 传了 `enterRef` + 传了 `after`/`delay`：若未主动调用 ref，框架将在 `after`/`delay` 结束后兜底触发。
- 传了 `enterRef` 但没传 `after`/`delay`：不会自动触发，需显式调用。

`exitRef` 行为规则：

- 只在时间驱动轨生效：设置后接管该元素的自动退场，需显式调用触发。
- **scrub 轨（drag 场景轨、scroll 接管区）忽略两个 ref**，并报 `INVALID_ANIMATION`：
  这两条轨的进度由手势或滚动位移单向决定，没有可供手动插入的时间原点。需要手动控制时，
  改用 `timeline.driver: 'clock'`（drag）或把元素移出接管区（scroll）。
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
