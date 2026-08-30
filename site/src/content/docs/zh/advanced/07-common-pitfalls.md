---
title: 排错
eyebrow: ADVANCED / TROUBLESHOOTING
---

六个最常见的故障。每条先说你看到什么，再说怎么改，中间讲清原因。遇到问题时先按现象定位，再查对应的组件页。

## 1. 循环动画退场后还在跑

你会看到：场景退场了，某个循环动效仍在渲染，离屏了还在每帧重绘。

原因是你用了 CSS `animation: ... infinite`。CSS 无限动画不受动画 phase 约束，元素退了它照跑。

怎么改：常驻/循环动效一律用 `Animate` 的 `loopAnimation` prop，由 `shouldRunInfinite` 控制：元素离开自己的 phase、或滚出视口即停。`loopAnimation` 与 `enterAnimation` 可共存；只做循环时整个 `enterAnimation` prop 省略不写（类型上它是 `enterAnimation?: never`，意思是「这个键不能出现」，不是「传字符串 never」；`'never'` 不是预设名，写了会既过不了类型检查、又在运行时解析失败）。见 [Animate](/docs/03-animate)。

## 2. 调了 `exitRef` 后元素永不自动退场

你会看到：给 Animate 传了 `exitRef`，之后 scroll 离开 zone、drag 切场景，元素都不再退场，像「卡死」了。

传了 `exitRef` 就是显式接管退场：自动退场（离 zone、切 scene）全部失效，必须由你调用。这是设计语义，不是异常状态；且 `exitRef` **没有 delay/after 兜底**，不像 `enterRef`。注意生效范围：`exitRef` 只在 scroll 的可见性驱动动画上生效；`enterRef` 另外在 drag 的独立播放元素（`driver: 'clock'`）上生效。两个 ref 在跟随滚动位置的动画（scroll 锁定区、drag 场景驱动的元素）上都不生效，会被忽略并上报 `INVALID_ANIMATION`。

怎么改：要么删掉 `exitRef` 恢复自动退场；要么在正确的业务时机（用户确认、数据就绪）手动调用。`enterRef` 则相反：传了 ref 但仍有 after/delay 时，after/delay 是兜底；只有「传 ref 且无任何 after/delay」才永不自动触发。完整行为矩阵见 [Timeline 概念](/docs/02-timeline) 与 [Animate](/docs/03-animate)。

## 3. `driver: 'clock'` 的元素没有退场动画

你会看到：drag 模式下某元素直接消失或闪现，配的 `exitAnimation` 完全没生效。

`timeline.driver: 'clock'` 配 drag 模式时，元素在 Scene 到场后按真实时间独立播放，**不参与 after 时间线，也忽略 `exitAnimation`**。这是五行推断表里最容易踩的一格。

怎么改：要退场时间线，用默认的 `driver: 'scene'`（元素时间轴随切场景推进，exit 自然按序回放）。独立播放适合「装饰性的、不需要排进叙事」的动效。见 [Timeline 概念](/docs/02-timeline)。

## 4. scroll zone 里 `duration: 2000` 滚了 2000px 才演完

你会看到：以为 `duration: { enter: 2000 }` 是两秒的动画，实际要滚动满 2000px 才走完。

scroll 锁定区里，动画时长就是真实滚动距离，**1ms = 1px**。`duration.enter` 的毫秒数直接换算成滚动 px 数。这不是 bug，而是把「动画时长」翻译成「用户要多滚多少屏幕」的换算关系。

怎么改：排 zone 时间轴时直接按像素计：2000ms 就是 2000px 的滚动跨度。反向滚回段内时进度自然 100%→0%，不需要任何反向特判。大输入（长 flick）会被压回段内一帧，防跳过。机制见 [center-lock & zones](/docs/01-centerlock)。

## 5. `after` 报错 / stagger 不跟随滚动

你会看到，三种情况之一：

- `after: 'title'` 挂载时上报 `INVALID_ANIMATION`，dev 下打 console 警告，该条依赖被忽略，动效照常跑。
- 串了 `after` 链后报 `CIRCULAR_DEPENDENCY`。
- zone 内给 Animate 配了 `stagger`，滚动时子元素不随进度逐个出现，而是按真实时间自己跑完了。

`after` 只能指向**已存在的 animateId**：指向不存在的 id 报 `INVALID_ANIMATION`，A→B→A 回环报 `CIRCULAR_DEPENDENCY`。两者都在 mount 时由 registry 静态校验，但**不拒绝挂载**：走 `onError` 上报 + dev 警告，无效依赖被忽略、其余照常运行（fail-open，为的是不打断开发节奏）。`stagger` 用的是 Framer 原生 `staggerChildren`，**由时间驱动，不跟随滚动位置**。

怎么改：`after` 目标先声明、id 字符串逐字对齐；链里有环就拆开。要做「随滚动逐元素揭示」，用 render-prop 的 `enterProgress` 自己按子元素个数分桶。规则见 [时间线](/docs/04-orchestration) 与 [Animate](/docs/03-animate)。

## 6. 退场时所有元素在同一帧一起消失

你会看到：入场是精致的 `after` 级联（标题→副题→按钮依次出现）；退场时所有元素却在同一帧一起触发 exit，整组在同一帧里一起消失。

入场级联不等于退场时间线。`timeline.after` 只描述入场图；退场没有反向依赖图时，场景切换信号到达后每个元素**同时**开始自己的 `exitAnimation`，于是全部在同一帧退场。

怎么改：入场用了 after 级联的，退场就用 `exitAnimation` + `duration.exit` 把反向顺序显式排出来（相互错开的 exit，或为退场单写一条等待链）。入场退场不对称是允许的设计，只写一半就会出现本条现象。见 [时间线](/docs/04-orchestration)。
