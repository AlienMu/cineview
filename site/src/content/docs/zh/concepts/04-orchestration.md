---
title: 时间线
eyebrow: CONCEPTS / SEQUENCING
---

多元素时序调度主要依托两项机制：`after` 构建元素间的前后依赖链，`stagger` 调度容器内子元素依次揭示。两者均在首帧绘制前完成静态编译，避免运行时的动态状态轮询。

## after 链

`timeline.after` 指向另一个元素的 `animateId`。被等者入场完成后，等待者才开始。

```tsx
<Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 600 }} />
<Animate animateId="sub" enterAnimation="fade-in"
  timeline={{ after: 'title', delay: 100 }} />
<Animate animateId="cta" enterAnimation="fade-in"
  timeline={{ after: 'sub' }} />
```

## after 有两套机制，取决于元素由什么驱动

同样一行 `after` 配置，跟随滚动的元素与可见性驱动的元素遵循不同的运行时机制。在配置时间线前，需首先明确元素的驱动类型。

### 跟随滚动：注册时算好累计延迟

drag 的场景驱动元素与 scroll 锁定区（locked zone）内的元素走这条。依赖在注册阶段就被折成一个累计延迟：

```text
累计延迟(follower) = follower.delay + 累计延迟(leader) + leader 入场时长
```

在上文示例中，`cta` 的起始时间为：title 入场时长 + sub.delay(100) + sub 入场时长 + cta.delay，在初始编译阶段一次性完成计算。

这条路上运行时没有任何等待与订阅：进度直接由拖拽位移或 zone 的滚动进度决定，`after` 只是改变了各元素在同一条时钟上的起跑偏移。

### 可见性驱动：等 leader 完成过入场

scroll 里不在 zone 内的元素走这条。它不复用上面的累计延迟，改为等 leader「曾经完成过一次入场」这个事实成立，再等自己的 `delay`：

```text
放行条件 = leader 已完成过入场 && 自身 gate 满足 && 自身 delay 走完
```

那个完成标记一次性置真、永不撤回：leader 退场、反向滚动、follower 重播都不会让它回到未完成。

为什么不能复用累计延迟：可见性驱动的每个元素各自进入可视区域才起跑，没有共享原点。把 leader 的 delay 加时长再算一遍，等于凭空多等一整段。

### 混合驱动依赖规则

| follower      | leader           | 是否允许                                 |
| ------------- | ---------------- | ---------------------------------------- |
| 可见性驱动    | 可见性驱动       | 允许                                     |
| 跟随滚动      | 同为跟随滚动     | 允许                                     |
| 可见性驱动    | scroll 锁定区    | 允许（运行时按 leader 完成入场状态判定） |
| scroll 锁定区 | 可见性驱动       | 拒绝                                     |
| drag          | 任何其他驱动方式 | 拒绝                                     |

拒绝的方向报 `INVALID_ANIMATION`（内部原因 `incompatible-driver`）并**跳过这条依赖**，follower 仍按自身的可见性条件与 delay 运行。

理由是两条时钟对不上：zone 的预算是确定的 `1ms = 1px`，而可见性驱动的完成时刻取决于何时将元素滚入可视区域，没有任何滚动坐标可以对应它。反过来可以，因为「scroll leader 越过入场终点」这件事本身是一个可以观察到的运行时事实。

另外 drag 下 `driver: 'clock'` 的元素既不能当 leader 也不能当 follower：它不注册进场景的时间线。

## 错误与降级

registry 直接报两个错误码（走 `onError`）：

| 错误码                | 触发                           |
| --------------------- | ------------------------------ |
| `INVALID_ANIMATION`   | `after` 指向不存在的 animateId |
| `CIRCULAR_DEPENDENCY` | 链上出现循环（A 等 B、B 等 A） |

`after` 只能指向已存在的 animateId，先写等待、后补 ID 的写法会在注册时报错。

## stagger

配置 `stagger` 后，`children` 必须为单个 ReactElement，其直接子元素由 `staggerChildren` 逐个揭示，子元素复用 `enterAnimation` 的动画配置。

```tsx
<Animate animateId="list" enterAnimation="fade-in" stagger={{ each: 40, from: 'first' }}>
  <ul>
    <li>第一条</li>
    <li>第二条</li>
    <li>第三条</li>
  </ul>
</Animate>
```

- `each`：相邻子元素间隔 ms，默认 40。
- `from`：`'first'`（默认）| `'last'` | `'center'`，从哪一端开始。

**stagger 按真实时间播放，不跟随滚动。** 在 scroll 锁定区里它按时钟播完，不跟滚动进度走。要逐元素随滚动手动揭示，改用 render-prop children 的 `enterProgress`（0..1）自己映射，见 [Animate API](/docs/03-animate)。

## 入场链必须有退场时间线

强制规则：**入场写了 after 级联，退场就必须写对应的反向时间线**。

`after` 和 `delay` 只管入场，退场没有级联链。只配了 enter 链时，退场信号一到，所有元素的 `exitAnimation` 同帧一起触发，整屏在同一帧退场，跟入场一拍一个的节奏完全不对称。

退场动画需显式声明反向时序规范：

```tsx
<Animate animateId="title" enterAnimation="fade-in" exitAnimation="fade-out"
  duration={{ enter: 600, exit: 400 }} />
<Animate animateId="sub" enterAnimation="fade-in" exitAnimation="fade-out"
  duration={{ exit: 300 }} timeline={{ after: 'title' }} />
```

- 每个元素都写 `exitAnimation` + `duration.exit`，不要只配入场。
- 需要精确控制谁先离场时用 `exitRef` 手动触发退场（注意：传了 `exitRef` 就禁用全部自动退场，退场没有 delay 兜底；且 `exitRef` 只对可见性驱动的元素生效，跟随滚动的元素会忽略它并报错）。
- scroll 锁定区内跟随滚动的元素，反向回滚时按入场原路退回，不受此影响。

## drag 的「退场」是两件事

`exitAnimation` 只覆盖正向离场，不等于「离开场景就播的动画」：

| 离场方向               | 实际播什么                                                                  |
| ---------------------- | --------------------------------------------------------------------------- |
| 正向（往下一屏拖走）   | `exitAnimation` 动画配置，从当前态插值到退场态                              |
| 反向（往上一屏拖回）   | 入场动画倒放（`initial → animate` 取 `1 - 进度`），完全不看 `exitAnimation` |
| 未声明 `exitAnimation` | 正向离场不执行补间，元素保持静止完成态                                      |

所以在 drag 下写 `exitAnimation` 只影响一半的手势方向。想让两个方向观感一致，让退场尽量接近入场的镜像；想要「拖回去等于撤销」，不写 `exitAnimation` 反而是对的。详见 [drag 排错](/docs/06-drag-pitfalls)。

## 下一步

- [Animate API](/docs/03-animate)：timeline/duration/render-prop 全表
- [时间轴概念](/docs/02-timeline)：phase 与 driver 的判定
- [排错](/docs/07-common-pitfalls)：after 与 stagger 的常见故障汇总
