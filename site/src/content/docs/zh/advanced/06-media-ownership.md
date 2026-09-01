---
title: 媒体所有权
eyebrow: ADVANCED / MEDIA
---

`AnimateVideo` 内部的 `<video>` 元素存在两种驱动来源：引擎（依据时间轴位置逐帧 seek）与浏览器原生播放。两者在任意时刻保持互斥，状态转移由纯函数判定。本文阐述该所有权协议及其三处边界特征。

## 进度如何变成 currentTime

映射是一次线性插值，没有别的：`currentTime = range[0] + progress × (range[1] - range[0])`（`src/media/videoPlaybackOwnership.ts:81-90`）。

`scrubRange` 缺省时 `range` 为 `[0, duration]`，即 progress 0 对应首帧、progress 1 对应末帧。显式传入 `scrubRange` 时，两个端点自动限制在 `[0, duration]` 有效范围内：传入超出素材时长的数值不会抛错，而是截断至真实时长（`:70-79`）。progress 本身也限制在 `[0, 1]` 区间。

`duration` 是从 `<video>` 元素读到的真实时长。素材元数据还没到时 `duration` 无效，映射返回 `null`，这一帧不发 seek 指令。

计算与执行是分开的：这个纯函数输入一帧时间轴状态、输出「下一个所有权状态 + 一串命令」（`pause` / `seek` / `play`），由 `VideoFrameRenderer` 执行到真实 DOM 上（`src/media/VideoFrameRenderer.tsx:432-490`）。所以所有播放决策都可以在不碰浏览器的情况下推演。

## 反向 scrubRange 与到端自动播放

`scrubRange` 接受反向区间。`[10, 2]` 是合法的：因为映射只是线性插值，progress 0→1 会让 `currentTime` 从 10s 走到 2s，得到倒放。

但到端自动播放不理解反向区间。progress 到 1 时的判定只看一件事：`range[1] < duration`（`videoPlaybackOwnership.ts:161-168`）。对 `[10, 2]` 来说 `range[1]` 是 2，小于素材时长，于是判定为真，框架发出 `play()`。结果是视频在 t=2s 正向播到片尾，与「倒放到 2 秒就停」的作者意图正好相反。

这不是特例，而是反向区间的普遍后果：反向意味着 `range[1] < range[0] ≤ duration`，所以 `range[1] < duration` 几乎总是成立，任何反向 `scrubRange` 都会在到端时触发一段正向的尾段播放。类型签名与注释都不会警告这一点。

要「倒放到某一点就停」，两条路：接受尾段播放并用 `onPlay` 立刻手动 `pause`；或者不用反向区间，把素材预先倒序编码成一个正向片源，再用默认的 `[0, duration]` 映射。

## 单写者协议

所有权有六个状态值（`videoPlaybackOwnership.ts:3-9`）：

| status            | 谁在驱动     | 何时进入                              |
| ----------------- | ------------ | ------------------------------------- |
| `framework-scrub` | 框架         | 初始态；每次框架收回所有权            |
| `play-pending`    | 原生（在途） | 已发 `play()`，promise 未结算         |
| `native-playback` | 原生         | `play()` 成功，或观察到外部 play 事件 |
| `native-paused`   | 原生         | 非框架发起的 pause                    |
| `play-rejected`   | 无           | `play()` 被浏览器拒绝                 |
| `ended`           | 无           | 素材播完                              |

交接规则：

- **只有显式 `scrubRange` 且终点早于片尾才会 `play()`**。不写 `scrubRange` 的视频永远由框架驱动，到 progress 1 就停在末帧。
- **端点采用双阈值防抖**。自动播放的触发阈值为 `progress ≥ 1 - 0.001`；框架收回控制权的阈值为 `progress < 1 - 0.02`（`:58-59`、`:140-148`）。两处阈值保持差值，在端点附近轻微波动不会导致反复 play/pause。交接完成后这次交接被锁定，只有滚动离开防抖区间才会复位。
- **框架收回是位置驱动的**。`scroll` 与 `visibility` 来源的帧无条件收回；`gesture` 来源要求已离开端点带（`:140-148`）。收回时先 `pause` 再 `seek` 到当前映射位置。
- **`exiting` / `exited` 阶段仅执行一次离场 pause 并锁定**。首次检测到退场阶段时，若视频正在原生播放则发出一次 `pause` 指令并锁定该状态；后续退场帧直接保持原状态，不再重复发送命令（`:176-193`）。该锁定在下一次接收到跟随滚动的驱动帧时解除。

`play()` 请求带 requestId。带错 token 的 play 事件（迟到的、外部触发的）会被防御性地 pause 掉，避免两个来源同时认为自己拥有这个元素（`:278-314`）。

## 多实例之间没有仲裁

所有权是每个 `AnimateVideo` 实例自己的。框架没有跨实例的媒体仲裁器：同一个 zone 里放两个 `AnimateVideo`，各自到端后各自 `play()`，两段尾巴会同时播。全仓没有任何注册表或「暂停其他视频」的逻辑。

需要互斥就自己在业务层做：用 `onPlay` 记住谁在播，在别人 play 时手动 pause 上一个。透传的原生事件（`onPlay` / `onPause` / `onEnded` / `onTimeUpdate` / `onError`）是这件事唯一的挂钩点。

## releaseOnLeave 的三个前置条件

`releaseOnLeave`（默认 `false`）在观众滚远后丢弃解码帧。它触发释放需要三个条件同时成立（`src/components/Animate/AnimateVideo.tsx:126-151`）：

1. prop 为 `true`；
2. 当前 approach band 是 `far`；
3. 这个源已经被逐帧定位过至少一次。没看过的视频没有可释放的解码帧，所以这一条要等时间轴 progress 出现过大于 `1e-4` 的移动才成立。换 `src` 会重置这个事实，新素材不继承旧素材的「已看过」。

波段阈值为引擎内部固定常量（`src/components/Scene/sceneScrollRuntime.tsx:24-27`）：

| 阈值                            | 值  | 行为                                                       |
| ------------------------------- | --- | ---------------------------------------------------------- |
| `SCENE_SCROLL_APPROACH_FAR_VH`  | 1.5 | 离开 zone 超过 1.5 倍视窗高度，band 切换为 `far`，释放资源 |
| `SCENE_SCROLL_APPROACH_NEAR_VH` | 1   | 回到距 zone 1 倍视窗高度内，band 切换回 `near`，重新挂载   |

两个阈值刻意不相等，所以在它们之间悬停不会反复 release/warmUp。

zone 外与 drag 模式下这套机制不工作：approach band 只在锁定区内才有，拿不到 band 就既不释放也不回挂。把 `releaseOnLeave` 从 `true` 改回 `false` 会主动 `warmUp()` 一次，避免渲染器停在已摘除 src 的状态。

## 编码要求

跟随滚动的视频应该全关键帧编码。H.264 的 P/B 帧是相对前帧的差分，seek 到任意帧都要从最近的 I 帧起整段解码；关键帧稀疏时每一步 seek 都在打满解码线程。

```bash
ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264 out.mp4
```

开发环境下框架会自动检测该项指标：每个 src 采样 seek 延迟，累计 6 个样本后算中位数，超过 50ms 就打一次警告并给出这条 ffmpeg 命令（`src/media/VideoFrameRenderer.tsx:51-52,403-426`）。每个 src 只警告一次，生产构建里这段代码不存在。

代价是文件变大（每帧自包含），收益是任意帧直接解码、seek 延迟变平。

## 引擎内置固定的元素属性

`<video>` 元素有两个属性固化为底层固定基准，不可由外部属性覆盖（`src/media/VideoFrameRenderer.tsx:630-631`）：

- `muted`：这也是到端自动播放可行的前提。浏览器的自动播放策略只放行静音媒体，带声音的 `play()` 会被拒绝（走 `play-rejected` 分支）。
- `playsInline`：iOS Safari 不加这个属性会把视频弹成全屏播放器，逐帧定位彻底失效。

`playbackRate` 对逐帧定位没有任何作用。逐帧定位是直接写 `currentTime`，不经过播放速率；`playbackRate` 只作用于到端交接之后的那段原生播放（`:395-399`）。

## prop 面比 Animate 窄

`AnimateVideo` 只向内层 `Animate` 转发六项：`animateId`、`enterAnimation`、`exitAnimation`、`duration`、`timeline`、`visibility`（`src/components/Animate/AnimateVideo.tsx:231-239`）。`Animate` 上其余的能力这里都没有：

| Animate 有             | AnimateVideo | 说明                                 |
| ---------------------- | ------------ | ------------------------------------ |
| `loopAnimation`        | 无           | 循环动画与逐帧定位是两种驱动，不能叠 |
| `stagger`              | 无           | 视频没有「直接子元素」可错峰         |
| `enterRef` / `exitRef` | 无           | 手动触发只在时间驱动的动画上有意义   |
| render-prop children   | 无           | children 位置固定给内部帧渲染器      |
| `timeline.driver`      | 无           | 停在默认 `'scene'`                   |
| `timeline.zoneId`      | 无           | 由所在 Scene 的锁定区继承            |
| `timeline.phase`       | 无           | 无法限定锁定区内的逐帧定位区间       |

`timeline` 的类型就是 `{ delay?: number; after?: string }`（`:47-50`），只此两键。从 `Animate` 抄一段 `timeline={{ phase: { start: 0.5 } }}` 过来，TypeScript 消费者会拿到类型错误；JS 消费者不会有任何提示，那个键会被静默丢弃，元素照常从 zone 起点开始跟随滚动。

默认 `enterAnimation` 为静态透明度配置 `{ initial: { opacity: 1 }, animate: { opacity: 1 } }`（`:13-16`）。这样逐帧定位本身就是唯一可见的动画，不会额外叠加入场淡入。如需自定义入场效果，显式传入 `enterAnimation` 即可覆盖该默认值。

## 相关页面

- prop 全表与逐帧定位的语义见 [AnimateVideo](/docs/04-animate-video)。
- 视频进入共享缓存与冷启动就绪判定的路径见 [预加载](/docs/02-preload)。
- 每帧观测面与监控指标见 [性能](/docs/01-performance)。
- zone 预算与 `1ms = 1px` 见 [zones 与预算](/docs/02-zones-budget)。
