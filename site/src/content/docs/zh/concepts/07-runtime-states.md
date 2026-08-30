---
title: 运行态
eyebrow: CONCEPTS / STATES
---

框架给每个场景维护一个运行态读数，供 `Animate` 与指针事件消费。它决定了「这个场景现在该不该动、能不能点」，也是持续动画不会在离屏后台空转的机制之一。

## 六个取值

| 运行态     | 含义                           | 可交互 |
| ---------- | ------------------------------ | ------ |
| `inactive` | 当前位置的场景，但尚未进入活跃 | 否     |
| `entering` | 正在进场                       | 是     |
| `active`   | 已到场、稳定                   | 是     |
| `exiting`  | 正在退场（有退场动画时）       | 是     |
| `covered`  | 被上层场景覆盖                 | 否     |
| `parked`   | 已滚过或已让位，停在边界状态   | 否     |

`covered` 与 `parked` 都意味着该场景不再接收指针事件（框架把 `pointer-events` 置为 `none`），区别在语义：`covered` 是「被别的场景盖住」，`parked` 是「自己已经退到边界之外」。

## 持续动画在这些态下自动停

**运行态处于 `covered` / `inactive` / `parked` / `exiting` 时，默认停止持续动画。**

这是 `loopAnimation` 与 CSS `animation: … infinite` 的关键差别之一：CSS 无限动画不受任何运行态约束，元素退场后照样每帧重绘；而 `loopAnimation` 由框架按运行态与视口相交共同裁决，退出自己的相位或滚出视口即停。

所以「其他元素都退场了，这一个还在动」这类不一致行为，通常是没用 `loopAnimation`、自写了 CSS 无限动画造成的。见 [排错](/docs/07-common-pitfalls)。

## scroll 下按相位推导

scroll 模式的运行态由场景时间轴的相位推导，而不是由索引距离推导：

| 场景相位 | 推导出的运行态                         |
| -------- | -------------------------------------- |
| `enter`  | `entering`                             |
| `exit`   | 有退场动画 → `exiting`；否则 `covered` |
| `hold`   | 是活跃场景 → `active`；否则 `covered`  |
| `after`  | 有退场动画 → `parked`；否则 `covered`  |

「有没有退场动画」会改变结果：没写退场的场景不经过 `exiting` / `parked`，直接算 `covered`。另外当上层场景以覆盖方式堆叠时，被覆盖的那一个也会被判为 `covered`。

## 与 sceneState 的区别

框架内部还有一个 `sceneState`（`initial` / `entering` / `active` / `exiting`），两者容易混：

|      | `sceneState`               | 运行态                                  |
| ---- | -------------------------- | --------------------------------------- |
| 性质 | 内部 React state           | **派生读数**                            |
| 写者 | 每模式各有唯一写者         | 无写者，由输入推导                      |
| 用途 | 驱动场景自身的视觉与进退场 | 下发给 `Animate`、决定 `pointer-events` |
| 取值 | 四个                       | 六个（多 `covered` / `parked`）         |

公共 API 上你不会直接读到这两个值中的任何一个。从外部能观察到的是 `Scene.callbacks.onVisibilityChange`（可见性与进度）以及元素侧的相位，见 [Animate 时间轴](/docs/02-timeline)。

## 相关页面

- [Animate 时间轴](/docs/02-timeline)：元素级相位与运行态的关系
- [可见性条件](/docs/03-visibility-conditions)：非 zone 元素的进退场判据
- [DOM 与布局契约](/docs/06-dom-contract)：`pointer-events` 与层叠实际在哪里生效
- [排错](/docs/07-common-pitfalls)：CSS 无限动画为什么不受约束
