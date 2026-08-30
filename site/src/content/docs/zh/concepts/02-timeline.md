---
title: Animate 时间轴
eyebrow: CONCEPTS / TIMELINE
---

每个 `Animate` 元素都跑在一条时间轴上：`phase` 告诉你它此刻在哪一段，`timeline.*` 决定它由什么驱动、何时开始，`enterRef` / `exitRef` 提供手动接管。

## phase：六个相位

| phase      | 含义                           |
| ---------- | ------------------------------ |
| `idle`     | 静止，尚未排上                 |
| `waiting`  | 已排上，在等 `delay` / `after` |
| `entering` | 入场进行中                     |
| `entered`  | 入场完成                       |
| `exiting`  | 退场进行中                     |
| `exited`   | 退场完成（replay 前的静止）    |

两种读法：render-prop children 拿到 `{ enterProgress, phase }`；子组件里用 `useAnimateTimeline()` 拿只读 MotionValue，读进度不触发 React 重新渲染（见 [useAnimateTimeline](/docs/09-use-animate-timeline)）。入场进度 0→1，退场沿来路回卷。

**元素在锁定区（locked zone）内时，`phase` 不更新。** 此时它一直停在 `idle`，而 `progress` 照常跟随滚动。所以「按 phase 判断该不该继续画」的写法在 zone 内会立刻停住，zone 内改用 `signedProgress` 或 `frame.source`。drag 模式不受此限，`phase` 按完整流程更新。见 [useAnimateTimeline](/docs/09-use-animate-timeline)。

## driver：驱动来源

`timeline.driver` 决定 progress 由谁驱动，可取 `'scene'`（默认）或 `'clock'`，五种组合讲全：

| driver    | 环境                           | 驱动                                                  |
| --------- | ------------------------------ | ----------------------------------------------------- |
| `'scene'` | scroll 锁定区内（继承 zoneId） | zone 真实滚动预算驱动，可配 `timeline.phase` 限定区间 |
| `'scene'` | scroll 非 zone                 | 降级为可见性条件驱动                                  |
| `'scene'` | drag                           | Scene 共享元素时间轴驱动（跟随手势）                  |
| `'clock'` | scroll                         | 强制独立的可见性条件驱动（即使在 zone 内）            |
| `'clock'` | drag                           | Scene 到场后按真实时间独立播放                        |

最后一行需要留意：`driver: 'clock'` + drag 时元素**不参与 registry / `after` / T_self，且忽略 `exitAnimation`**：退场动画不会播，别指望它。

## delay、after 与 phase 区间

- `timeline.delay`（ms)：入场前的等待时长，加在 `after` 链之后。
- `timeline.after`：指向另一个 `animateId` 的等待链。指向不存在的 id 报 `INVALID_ANIMATION`；链成环报 `CIRCULAR_DEPENDENCY`。
- `timeline.zoneId`：显式指定隶属的锁定区。
- `timeline.phase: { start, end }`：把元素跟随滚动的区间限制在 zone 进度的某一段，只在「`'scene'` + scroll 锁定区」那行有效。

`after` 的完整时间线规则（链式解析、stagger、退场镜像）见[时间线](/docs/04-orchestration)。先记住一条强制规则：**入场用 `after` 做了级联，退场就要有对应的反向时间线**，否则所有元素在同一帧一起退场。

## enterRef / exitRef：手动接管

两个 ref 都是时间轴上的手动触发器，类型是 `MutableRefObject<(() => void) | null>`，调 `ref.current?.()` 触发。

**`enterRef`** 的行为规则：

- 调用即立即入场，打断仍在等待中的 `after` / `delay`。
- 同时传了 ref 和 `after` / `delay`：`after` / `delay` 兜底：没人调手动触发时，时间轴照常自动播。
- 传了 ref 但没传 `after` / `delay`：**永不自动触发**，只认手动调用。

**`exitRef`** 更严格：

- 传了即禁用全部自动退场：scroll 滚出 zone、drag 切走场景都不会让它退场，必须手动调。
- **不支持 `delay` 兜底**。传了 `exitRef` 又没在合适的时机调用，元素就永远留在屏上。要自动兜底就别传 `exitRef`。

完整 props 表见 [Animate 参考](/docs/03-animate)。
