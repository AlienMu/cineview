---
title: Animate
eyebrow: API REFERENCE
---

`<Animate>` 消费当前模式的时间语义，编排 delay、waitFor、phase、visibility 与 stagger。本页是全量字段参考；时间轴语义与教程见 [Animate 组件指南](/docs/animate)。

## Props

字段与默认值逐项核对自 `src/types/index.ts` 的 `AnimateProps`（判别联合：`enterAnimation` 必填分支，或仅 `infiniteAnimation` 分支）与 Animate 实现。`enterAnimation` 与 `infiniteAnimation` 至少提供其一，二者都不传会上报 `INVALID_ANIMATION`。

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `animateId` | `string` | `auto` | 元素唯一标识（缺省自动生成 `animate-{n}`），是 `waitFor` 的引用目标。 |
| `enterAnimation` | `AnimationType` | — | 入场动画（预设名 / 自定义 variant / 组合）。与 `infiniteAnimation` 至少提供其一；仅 infinite 的分支不允许再传 enter。 |
| `infiniteAnimation` | `AnimationType` | — | 常驻循环动效的唯一许可通道（站点侧禁止 CSS `animation: … infinite`）。仅在元素处于自身 phase 且在视口内时运行，离屏/退场自动停止。与 `enterAnimation` 至少提供其一。 |
| `exitAnimation` | `AnimationType` | — | 退场动画，必须与 `enterAnimation` 或 `infiniteAnimation` 其一共存。drag 模式 `sceneControlled: false` 的轨上被忽略（见轨道矩阵）。 |
| `duration.enter` | `number` | `600` | 入场动画时长（ms）。scroll 接管下即真实滚动 px（`1ms = 1px`）。 |
| `duration.exit` | `number` | `600` | 退场动画时长（ms）。 |
| `timeline.sceneControlled` | `boolean` | `true` | 是否允许场景接管本元素的时间轴。`true` 时：scroll 接管 zone 内由该 zone 的滚动预算驱动；scroll 模式但不在 zone 内优雅降级为 visibility；drag 模式由 Scene 共享元素轨驱动。`false` 时：scroll 强制 visibility；drag 走独立 arrival 轨（真实时间播放，不参与 registry/waitFor/T_self，忽略 `exitAnimation`）。 |
| `timeline.delay` | `number` | `0` | 入场延迟（ms；scroll 接管下即真实滚动 px）。 |
| `timeline.waitFor` | `string` | — | 等待另一 `animateId` 的入场完成后才开始入场，构成级联。指向不存在的组件上报 `INVALID_ANIMATION`，链上循环上报 `CIRCULAR_DEPENDENCY`。drag 模式 `sceneControlled: false` 时被忽略。 |
| `timeline.zoneId` | `string` | — | 显式覆盖继承来的 zone 绑定（scroll 模式下据此决定走接管还是 visibility 轨）。 |
| `timeline.phase.start` | `number` | — | scroll 接管 zone 内的 enter 子窗口起点（`0..1`，占整段 zone 预算的分数）。缺省时用 `delay`/`waitFor` 推导的自身窗口。 |
| `timeline.phase.end` | `number` | — | 同上，子窗口终点。 |
| `visibility.replayOnReenter` | `boolean` | `true` | 重新进入视口时是否重放入场。 |
| `visibility.enterMargin` | `number` | `inherit` | 入场闸门的视口边距（设计 px），继承 `modes.scroll.enterMargin`（默认 `50`）。 |
| `visibility.exitMargin` | `number` | `inherit` | 退场闸门的视口边距（设计 px），继承 `modes.scroll.exitMargin`（默认 `50`）。 |
| `stagger` | `AnimateStaggerConfig` | — | 子元素错峰入场编排。要求 `children` 为单一 React 元素：每个直接子元素用 `enterAnimation` 的变体经 framer 原生 `staggerChildren` 逐个揭示（绕过 enter/exit 的 10 属性白名单，可用任意 framer 可动画属性）。时间驱动、不随滚动/拖拽 scrub；需要 scrub 的逐元素揭示改用 render-prop。 |
| `stagger.each` | `number` | `40` | 每个子元素的错峰间隔（ms）。 |
| `stagger.from` | `'first' \| 'last' \| 'center'` | `'first'` | 错峰起始方向。 |
| `enterRef` | `React.MutableRefObject<(() => void) \| null>` | — | 手动入场触发函数，见下方轨道支持矩阵。与 `waitFor`/`delay` 并存时，等待期满框架仍会兜底触发；两者都不传时永不自动入场，必须手动调用。 |
| `exitRef` | `React.MutableRefObject<(() => void) \| null>` | — | 手动退场触发函数。传入即禁用自动退场（scroll 离开 zone / drag 切换 scene 都不再触发退场）；不支持 `delay` 兜底（退场没有"超时后自动退"的语义）。 |
| `children` | `ReactNode \| ((state: AnimateRenderState) => ReactNode)` | `required` | 内容；render-prop 形态拿到 `{ enterProgress, phase }`，进度天然跟随当前时间轴来源。 |

## 手动控制与轨道支持

`enterRef`/`exitRef` 只对时间驱动的轨有意义。scrub 轨上视觉位置是其唯一所有者（zone 的 progressPx、或拖拽中的手指）的纯函数，手动写入会被下一帧重算覆盖——此时框架上报 `INVALID_ANIMATION` 并忽略 ref，而不是静默假装生效。

| 轨道 | enterRef | exitRef | 行为 |
| --- | --- | --- | --- |
| visibility 时间轨（scroll 模式，未被接管） | 支持 | 支持 | 手动触发立即播放入场/退场。enterRef 与 `waitFor`/`delay` 并存时等待期满仍兜底触发；两者都不传则永不自动入场。exitRef 传入即禁用自动退场。 |
| arrival 时间轨（drag 模式 + `sceneControlled: false`） | 支持 | 忽略 | 该轨没有退场段（同时忽略 `exitAnimation` 与 `waitFor`）；传入 exitRef 会被上报忽略。 |
| scrub 轨（scroll 接管 zone；drag 模式 scene-controlled 元素轨） | 忽略 | 忽略 | 上报 `INVALID_ANIMATION`。需要手动控制时：drag 用 `timeline.sceneControlled: false`，scroll 把元素移出接管 zone。 |

## 类型

### AnimateRenderState

render-prop 形态的 `children` 收到的状态对象：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `enterProgress` | `number` | `0..1`，0 为初始帧、1 为完全进入。天然跟随当前时间轴来源：visibility 按时间推进，scroll / drag 随滚动与拖拽 scrub。 |
| `phase` | `AnimatePhase` | 六态相位（见下）。 |

### AnimatePhase

`'idle' | 'waiting' | 'entering' | 'entered' | 'exiting' | 'exited'` 六态词表，逐态语义与原子快照说明见 [useAnimateTimeline API](/docs/use-animate-timeline-api)。

### AnimateStaggerConfig

`stagger` 的两个字段：`each`（默认 `40`，每个直接子元素的错峰间隔 ms）与 `from`（默认 `'first'`，`'first' | 'last' | 'center'` 三向）。

### 共享类型

- `AnimationType` = 预设名（43 个）/ 自定义 variant / 组合动画 → [类型字典](/docs/types)；预设目录 → [预设动画](/docs/presets)，组合编排 → [自定义与组合](/docs/custom)
- `waitFor` 级联与错峰的语义指南 → [waitFor 与 stagger](/docs/waitfor-stagger)

## 约束注记

- **`INVALID_ANIMATION` 的四个来源**：`waitFor` 指向不存在的 `animateId`；`enterAnimation` 与 `infiniteAnimation` 都未提供；未知预设名；在 scrub 轨上传入 `enterRef`/`exitRef`（上报并忽略）。
- **`sceneControlled` 的裁决路径**：默认 `true`。scroll 模式下「在接管 zone 内 → zone 滚动预算驱动；不在 → 优雅降级 visibility」；显式 `false` 是强制 visibility 的唯一开关。drag 模式下 `false` 切换到 arrival 轨——真实时间播放、不参与 registry/waitFor、忽略 `exitAnimation`，这是「需要手动控制（`enterRef`）」时 drag 侧的标准动作。
- **`stagger` 与 render-prop 二选一**。`stagger` 是时间驱动的子元素揭示（不随 scrub），且要求 `children` 为单一 React 元素；需要逐元素跟随滚动 scrub 时用 render-prop 形态（`children` 为函数，拿 `enterProgress`）。
- **仅 infinite 的分支**：只传 `infiniteAnimation` 时不允许再传 `enterAnimation`——常驻循环元素没有入场语义，`exitAnimation` 可以共存（退场仍受 phase 门控）。

